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

/**
 * Fixed rendered height of a PersonNode card (tall enough for the "You" badge).
 * PersonNode applies this height, so the layout and the DOM always agree and
 * side handles — and the spouse lines between them — stay level.
 */
export const PERSON_NODE_HEIGHT = 122;

const DEFAULT_NODE_WIDTH = 180;
const DEFAULT_NODE_HEIGHT = PERSON_NODE_HEIGHT;
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

interface SpouseGroup {
  id: string;
  /** Members in left-to-right (TB) / top-to-bottom (LR) order */
  members: string[];
}

/**
 * Groups people connected by spouse / co-parent links into "spouse groups".
 * Each group is laid out by dagre as a single composite node, which guarantees
 * that partners share a generation row and sit next to each other.
 *
 * Members are ordered by walking the spouse chain from an end, so a person
 * with two partners ends up between them (ex — person — spouse).
 */
function buildSpouseGroups(nodes: Node[], couples: CoupleData[]): SpouseGroup[] {
  const nodeIds = new Set(nodes.map((n) => n.id));
  const adjacency = new Map<string, string[]>();
  for (const c of couples) {
    if (!nodeIds.has(c.spouse1) || !nodeIds.has(c.spouse2)) continue;
    if (!adjacency.has(c.spouse1)) adjacency.set(c.spouse1, []);
    if (!adjacency.has(c.spouse2)) adjacency.set(c.spouse2, []);
    adjacency.get(c.spouse1)!.push(c.spouse2);
    adjacency.get(c.spouse2)!.push(c.spouse1);
  }

  const groups: SpouseGroup[] = [];
  const assigned = new Set<string>();

  // Iterate in input order so the result is deterministic
  for (const node of nodes) {
    if (assigned.has(node.id) || !adjacency.has(node.id)) continue;

    // Collect the connected component
    const component: string[] = [];
    const stack = [node.id];
    const inComponent = new Set([node.id]);
    while (stack.length) {
      const cur = stack.pop()!;
      component.push(cur);
      for (const next of adjacency.get(cur)!) {
        if (!inComponent.has(next)) {
          inComponent.add(next);
          stack.push(next);
        }
      }
    }

    // Order: walk the chain starting from a lowest-degree member
    const order = nodes.map((n) => n.id).filter((id) => inComponent.has(id));
    const degree = (id: string) => adjacency.get(id)!.length;
    const ordered: string[] = [];
    const visited = new Set<string>();
    while (ordered.length < order.length) {
      let cur: string | undefined = order
        .filter((id) => !visited.has(id))
        .sort((a, b) => degree(a) - degree(b))[0];
      while (cur) {
        visited.add(cur);
        ordered.push(cur);
        cur = adjacency.get(cur)!.find((n) => !visited.has(n));
      }
    }

    ordered.forEach((id) => assigned.add(id));
    groups.push({ id: `_grp_${groups.length}`, members: ordered });
  }

  return groups;
}

/** Gap between partners inside a spouse group (room for the dashed spouse line) */
const SPOUSE_GAP = 60;

/**
 * Computes a family-tree-aware dagre layout.
 *
 * Strategy:
 * 1. Collapse each spouse group (partners / co-parents) into one composite
 *    dagre node so partners always share a row and sit side by side
 * 2. For each couple with children, insert a junction node and route
 *    parent→child edges through it
 * 3. After layout, expand each composite into its members and centre each
 *    junction under its couple
 * 4. Build clean visual edges (spouse=horizontal dashed, parent-child=smoothstep)
 */
export function computeDagreLayout(
  nodes: Node[],
  edges: Edge[],
  options?: LayoutOptions
): LayoutResult {
  const { rankdir = 'TB', nodesep = 100, ranksep = 100 } = options ?? {};
  const horizontal = rankdir === 'TB';

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir, nodesep, ranksep });

  const sizeOf = new Map<string, { w: number; h: number }>();
  for (const node of nodes) {
    sizeOf.set(node.id, {
      w: node.measured?.width ?? node.width ?? DEFAULT_NODE_WIDTH,
      h: node.measured?.height ?? node.height ?? DEFAULT_NODE_HEIGHT,
    });
  }

  const couples = detectCouples(edges);
  const groups = buildSpouseGroups(nodes, couples);

  // Map each person to the dagre node that represents them
  const repOf = new Map<string, string>();
  for (const node of nodes) repOf.set(node.id, node.id);
  for (const group of groups) {
    for (const m of group.members) repOf.set(m, group.id);
  }
  const rep = (id: string) => repOf.get(id) ?? id;

  // Add standalone people
  for (const node of nodes) {
    if (rep(node.id) !== node.id) continue;
    const { w, h } = sizeOf.get(node.id)!;
    g.setNode(node.id, { width: w, height: h });
  }

  // Add spouse groups as composite nodes laid side by side across the rank
  for (const group of groups) {
    const sizes = group.members.map((m) => sizeOf.get(m)!);
    const gaps = SPOUSE_GAP * (sizes.length - 1);
    const width = horizontal
      ? sizes.reduce((s, x) => s + x.w, 0) + gaps
      : Math.max(...sizes.map((x) => x.w));
    const height = horizontal
      ? Math.max(...sizes.map((x) => x.h))
      : sizes.reduce((s, x) => s + x.h, 0) + gaps;
    g.setNode(group.id, { width, height });
  }

  const addEdge = (from: string, to: string) => {
    const a = rep(from);
    const b = rep(to);
    if (a === b) return; // never add self-loops on a composite
    g.setEdge(a, b, { minlen: 1 });
  };

  const reroutedKeys = new Set<string>();

  // For each couple with children, add junction and reroute
  for (const couple of couples) {
    if (couple.sharedChildren.length === 0) continue;

    g.setNode(couple.junctionId, { width: JUNCTION_SIZE, height: JUNCTION_SIZE });

    // Parents → junction
    addEdge(couple.spouse1, couple.junctionId);
    addEdge(couple.spouse2, couple.junctionId);

    // Junction → children
    for (const child of couple.sharedChildren) {
      addEdge(couple.junctionId, child);
      // Suppress direct edges from EITHER parent to this child
      reroutedKeys.add(`${couple.spouse1}|${child}`);
      reroutedKeys.add(`${couple.spouse2}|${child}`);
    }
  }

  // Add non-rerouted parent-child edges
  for (const edge of edges) {
    if (edge.data?.isSpouse) continue;
    if (!reroutedKeys.has(`${edge.source}|${edge.target}`)) {
      addEdge(edge.source, edge.target);
    }
  }

  dagre.layout(g);

  // Resolve centre points for every person (expanding composites)
  const centerOf = new Map<string, { x: number; y: number }>();
  for (const node of nodes) {
    if (rep(node.id) !== node.id) continue;
    const dn = g.node(node.id);
    centerOf.set(node.id, { x: dn.x, y: dn.y });
  }
  for (const group of groups) {
    const dn = g.node(group.id);
    // Start at the composite's leading edge and place members along it.
    // Members share the composite's centre line so the side handles (and the
    // dashed spouse line between them) stay level even if card heights differ.
    let cursor = horizontal ? dn.x - dn.width / 2 : dn.y - dn.height / 2;
    for (const m of group.members) {
      const { w, h } = sizeOf.get(m)!;
      if (horizontal) {
        centerOf.set(m, { x: cursor + w / 2, y: dn.y });
        cursor += w + SPOUSE_GAP;
      } else {
        centerOf.set(m, { x: dn.x, y: cursor + h / 2 });
        cursor += h + SPOUSE_GAP;
      }
    }
  }

  // Build layouted real nodes
  const layoutedNodes: Node[] = nodes.map((node) => {
    const c = centerOf.get(node.id)!;
    const { w, h } = sizeOf.get(node.id)!;
    return {
      ...node,
      position: { x: c.x - w / 2, y: c.y - h / 2 },
    };
  });

  // Add junction nodes (invisible), centred between the couple across the rank
  for (const couple of couples) {
    if (couple.sharedChildren.length === 0) continue;
    const dn = g.node(couple.junctionId);
    if (!dn) continue;
    const c1 = centerOf.get(couple.spouse1);
    const c2 = centerOf.get(couple.spouse2);
    let jx = dn.x;
    let jy = dn.y;
    if (c1 && c2) {
      if (horizontal) jx = (c1.x + c2.x) / 2;
      else jy = (c1.y + c2.y) / 2;
    }
    layoutedNodes.push({
      id: couple.junctionId,
      type: 'junction',
      position: { x: jx - JUNCTION_SIZE / 2, y: jy - JUNCTION_SIZE / 2 },
      data: {},
      width: JUNCTION_SIZE,
      height: JUNCTION_SIZE,
    });
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
