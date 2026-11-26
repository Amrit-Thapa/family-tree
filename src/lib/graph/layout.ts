import type { Node, Edge } from '@xyflow/react';
import { MarkerType } from '@xyflow/react';
import dagre from 'dagre';

export interface LayoutOptions {
  rankdir?: 'TB' | 'LR';
  nodesep?: number;
  ranksep?: number;
}

export interface LayoutResult {
  nodes: Node[];
  edges: Edge[];
}

const DEFAULT_NODE_WIDTH = 180;
const DEFAULT_NODE_HEIGHT = 90;
const JUNCTION_SIZE = 2;

interface CoupleData {
  spouse1: string;
  spouse2: string;
  sharedChildren: string[];
  junctionId: string;
  /** True if this couple was detected from shared children (no explicit spouse edge) */
  isImplicit: boolean;
}

/**
 * Detects couples for layout purposes. A "couple" is either:
 * 1. Two nodes connected by an explicit spouse edge, OR
 * 2. Two nodes that are "co-parents" — both have parent_child edges to the
 *    same child(ren) but have no spouse edge between them.
 *
 * For layout purposes, ALL children of either member of the couple are
 * routed through the couple's junction node so they appear below the pair.
 */
function detectCouples(edges: Edge[]): CoupleData[] {
  const couples: CoupleData[] = [];
  const seen = new Set<string>();

  // --- Step 1: Detect explicit spouse pairs ---
  const spouseEdges = edges.filter((e) => e.data?.isSpouse);

  for (const se of spouseEdges) {
    const key = [se.source, se.target].sort().join('|');
    if (seen.has(key)) continue;
    seen.add(key);

    const s1 = se.source;
    const s2 = se.target;

    // Children of each spouse
    const ch1 = new Set<string>();
    const ch2 = new Set<string>();
    for (const e of edges) {
      if (e.data?.isSpouse) continue;
      if (e.source === s1) ch1.add(e.target);
      if (e.source === s2) ch2.add(e.target);
    }

    // Union of all children from both spouses (for layout, treat as couple's children)
    const allChildren = new Set([...ch1, ...ch2]);

    couples.push({
      spouse1: s1,
      spouse2: s2,
      sharedChildren: Array.from(allChildren),
      junctionId: `_junc_${key}`,
      isImplicit: false,
    });
  }

  // --- Step 2: Detect implicit co-parent pairs (share children, no spouse edge) ---
  // Build a map: child → set of parents
  const parentChildEdges = edges.filter((e) => !e.data?.isSpouse);
  const childToParents = new Map<string, Set<string>>();

  for (const e of parentChildEdges) {
    if (!childToParents.has(e.target)) {
      childToParents.set(e.target, new Set());
    }
    childToParents.get(e.target)!.add(e.source);
  }

  // Find pairs of parents that share at least one child
  for (const [, parents] of childToParents) {
    if (parents.size < 2) continue;

    const parentArray = Array.from(parents);
    // Check all pairs of parents for this child
    for (let i = 0; i < parentArray.length; i++) {
      for (let j = i + 1; j < parentArray.length; j++) {
        const p1 = parentArray[i];
        const p2 = parentArray[j];
        const key = [p1, p2].sort().join('|');

        // Skip if already detected (either as spouse or co-parent)
        if (seen.has(key)) continue;
        seen.add(key);

        // Collect ALL children of either co-parent
        const ch1 = new Set<string>();
        const ch2 = new Set<string>();
        for (const e of parentChildEdges) {
          if (e.source === p1) ch1.add(e.target);
          if (e.source === p2) ch2.add(e.target);
        }
        const allChildren = new Set([...ch1, ...ch2]);

        couples.push({
          spouse1: p1,
          spouse2: p2,
          sharedChildren: Array.from(allChildren),
          junctionId: `_junc_${key}`,
          isImplicit: true,
        });
      }
    }
  }

  return couples;
}

/**
 * Computes a family-tree-aware dagre layout.
 *
 * Strategy:
 * 1. For each couple with shared children, insert a junction node
 * 2. Route parent→child edges through the junction
 * 3. Constrain spouses to the same rank using dagre's rank constraints
 * 4. After layout, force-align spouse Y positions
 * 5. Build clean visual edges (spouse=horizontal dashed, parent-child=smoothstep)
 */
export function computeDagreLayout(
  nodes: Node[],
  edges: Edge[],
  options?: LayoutOptions
): LayoutResult {
  const { rankdir = 'TB', nodesep = 100, ranksep = 100 } = options ?? {};

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir, nodesep, ranksep });

  // Add real nodes
  for (const node of nodes) {
    const w = node.measured?.width ?? node.width ?? DEFAULT_NODE_WIDTH;
    const h = node.measured?.height ?? node.height ?? DEFAULT_NODE_HEIGHT;
    g.setNode(node.id, { width: w, height: h });
  }

  const couples = detectCouples(edges);
  const reroutedKeys = new Set<string>();

  // For each couple with children, add junction and reroute
  for (const couple of couples) {
    if (couple.sharedChildren.length === 0) continue;

    g.setNode(couple.junctionId, { width: JUNCTION_SIZE, height: JUNCTION_SIZE });

    // Parents → junction
    g.setEdge(couple.spouse1, couple.junctionId, { minlen: 1 });
    g.setEdge(couple.spouse2, couple.junctionId, { minlen: 1 });

    // Junction → children
    for (const child of couple.sharedChildren) {
      g.setEdge(couple.junctionId, child, { minlen: 1 });
      // Suppress direct edges from EITHER parent to this child
      reroutedKeys.add(`${couple.spouse1}|${child}`);
      reroutedKeys.add(`${couple.spouse2}|${child}`);
    }
  }

  // For spouse pairs WITHOUT children, anchor the floating spouse
  for (const couple of couples) {
    if (couple.sharedChildren.length > 0) continue;

    // Find if either spouse is part of ANOTHER couple that HAS a junction
    const s1Junction = couples.find(
      (c) => c.sharedChildren.length > 0 &&
        (c.spouse1 === couple.spouse1 || c.spouse2 === couple.spouse1)
    );
    const s2Junction = couples.find(
      (c) => c.sharedChildren.length > 0 &&
        (c.spouse1 === couple.spouse2 || c.spouse2 === couple.spouse2)
    );

    if (s1Junction && !s2Junction) {
      // spouse2 is floating — connect to spouse1's junction
      g.setEdge(couple.spouse2, s1Junction.junctionId, { minlen: 1 });
    } else if (s2Junction && !s1Junction) {
      // spouse1 is floating — connect to spouse2's junction
      g.setEdge(couple.spouse1, s2Junction.junctionId, { minlen: 1 });
    }
  }

  // Add non-rerouted parent-child edges
  for (const edge of edges) {
    if (edge.data?.isSpouse) continue;
    if (!reroutedKeys.has(`${edge.source}|${edge.target}`)) {
      g.setEdge(edge.source, edge.target, { minlen: 1 });
    }
  }

  dagre.layout(g);

  // Build layouted real nodes
  const layoutedNodes: Node[] = nodes.map((node) => {
    const dn = g.node(node.id);
    const w = node.measured?.width ?? node.width ?? DEFAULT_NODE_WIDTH;
    const h = node.measured?.height ?? node.height ?? DEFAULT_NODE_HEIGHT;
    return {
      ...node,
      position: { x: dn.x - w / 2, y: dn.y - h / 2 },
    };
  });

  // Add junction nodes (invisible)
  for (const couple of couples) {
    if (couple.sharedChildren.length === 0) continue;
    const dn = g.node(couple.junctionId);
    if (dn) {
      layoutedNodes.push({
        id: couple.junctionId,
        type: 'junction',
        position: { x: dn.x - JUNCTION_SIZE / 2, y: dn.y - JUNCTION_SIZE / 2 },
        data: {},
        width: JUNCTION_SIZE,
        height: JUNCTION_SIZE,
      });
    }
  }

  // Force-align all spouse pairs to the same Y level
  for (const couple of couples) {
    const n1 = layoutedNodes.find((n) => n.id === couple.spouse1);
    const n2 = layoutedNodes.find((n) => n.id === couple.spouse2);
    if (n1 && n2) {
      const minY = Math.min(n1.position.y, n2.position.y);
      n1.position.y = minY;
      n2.position.y = minY;

      // Ensure they don't overlap horizontally — if they're at the same X, push apart
      const n1Right = n1.position.x + (n1.width ?? DEFAULT_NODE_WIDTH);
      const n2Left = n2.position.x;
      const n1Left = n1.position.x;
      const n2Right = n2.position.x + (n2.width ?? DEFAULT_NODE_WIDTH);

      // Check if n1 overlaps n2
      if (n1Right > n2Left && n1Left < n2Right) {
        // They overlap — push them apart from their midpoint
        const midX = (n1.position.x + n2.position.x) / 2;
        const halfWidth = (DEFAULT_NODE_WIDTH + nodesep) / 2;
        n1.position.x = midX - halfWidth;
        n2.position.x = midX + halfWidth;
      }
    }
  }

  // Build final visual edges
  const finalEdges: Edge[] = [];

  // Spouse edges (horizontal, side-to-side)
  for (const edge of edges) {
    if (!edge.data?.isSpouse) continue;

    const n1 = layoutedNodes.find((n) => n.id === edge.source);
    const n2 = layoutedNodes.find((n) => n.id === edge.target);

    let leftNodeId = edge.source;
    let rightNodeId = edge.target;
    if (n1 && n2 && n1.position.x > n2.position.x) {
      leftNodeId = edge.target;
      rightNodeId = edge.source;
    }

    const isInactive = edge.data?.spouseStatus === 'divorced' || edge.data?.spouseStatus === 'separated';

    finalEdges.push({
      id: edge.id,
      source: leftNodeId,
      target: rightNodeId,
      sourceHandle: 'right',
      targetHandle: 'left',
      type: 'straight',
      data: { isSpouse: true, spouseStatus: edge.data?.spouseStatus },
      style: {
        strokeDasharray: '6 4',
        stroke: isInactive ? '#d1d5db' : '#f472b6',
        strokeWidth: 2,
      },
    });
  }

  // Add visual connector edges for implicit co-parent couples (no explicit spouse edge)
  for (const couple of couples) {
    if (!couple.isImplicit) continue;

    const n1 = layoutedNodes.find((n) => n.id === couple.spouse1);
    const n2 = layoutedNodes.find((n) => n.id === couple.spouse2);

    let leftNodeId = couple.spouse1;
    let rightNodeId = couple.spouse2;
    if (n1 && n2 && n1.position.x > n2.position.x) {
      leftNodeId = couple.spouse2;
      rightNodeId = couple.spouse1;
    }

    finalEdges.push({
      id: `_coparent_${couple.junctionId}`,
      source: leftNodeId,
      target: rightNodeId,
      sourceHandle: 'right',
      targetHandle: 'left',
      type: 'straight',
      data: { isSpouse: true },
      style: { strokeDasharray: '6 4', stroke: '#f472b6', strokeWidth: 2 },
    });
  }

  // Couple → junction → children edges
  for (const couple of couples) {
    if (couple.sharedChildren.length === 0) continue;

    // Spouse1 → junction
    finalEdges.push({
      id: `${couple.junctionId}-from-${couple.spouse1}`,
      source: couple.spouse1,
      sourceHandle: 'bottom',
      target: couple.junctionId,
      type: 'smoothstep',
      data: { isSpouse: false },
      style: { stroke: '#94a3b8', strokeWidth: 2 },
    });

    // Spouse2 → junction
    finalEdges.push({
      id: `${couple.junctionId}-from-${couple.spouse2}`,
      source: couple.spouse2,
      sourceHandle: 'bottom',
      target: couple.junctionId,
      type: 'smoothstep',
      data: { isSpouse: false },
      style: { stroke: '#94a3b8', strokeWidth: 2 },
    });

    // Junction → each shared child
    for (const child of couple.sharedChildren) {
      finalEdges.push({
        id: `${couple.junctionId}-to-${child}`,
        source: couple.junctionId,
        target: child,
        targetHandle: 'top',
        type: 'smoothstep',
        data: { isSpouse: false },
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: '#94a3b8', strokeWidth: 2 },
      });
    }
  }

  // Non-rerouted parent-child edges
  for (const edge of edges) {
    if (edge.data?.isSpouse) continue;
    const key = `${edge.source}|${edge.target}`;
    if (!reroutedKeys.has(key)) {
      finalEdges.push({
        ...edge,
        sourceHandle: 'bottom',
        targetHandle: 'top',
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: '#94a3b8', strokeWidth: 2 },
      });
    }
  }

  return { nodes: layoutedNodes, edges: finalEdges };
}
