import type { GraphNodeData, GraphRelationshipData } from '@/lib/services/graph.service';
import { formatDisplayName } from '@/lib/graph/format-name';

export type DerivedRelationType =
  | 'sibling'
  | 'half-sibling'
  | 'grandparent'
  | 'grandchild'
  | 'uncle_aunt'
  | 'cousin';

export interface DerivedRelationship {
  nodeId: string;
  personName: string;
  type: DerivedRelationType;
  /** For half-siblings: the name of the parent they share with the person */
  via?: string;
}

/**
 * Derives extended family relationships by traversing the relationship graph.
 * Computes siblings, grandparents, grandchildren, uncles/aunts, and cousins.
 * Pure function: no side effects or external dependencies.
 */
export function deriveRelationships(
  personNodeId: string,
  relationships: GraphRelationshipData[],
  nodes: GraphNodeData[]
): DerivedRelationship[] {
  const nodeMap = new Map<string, GraphNodeData>();
  for (const node of nodes) {
    nodeMap.set(node.id, node);
  }

  // Helper: get parents of a given node (nodes in fromNodeId position where type is father/mother and toNodeId is the given node)
  function getParents(nodeId: string): string[] {
    return relationships
      .filter((r) => (r.type === 'father' || r.type === 'mother') && r.toNodeId === nodeId)
      .map((r) => r.fromNodeId);
  }

  // Helper: get children of a given node (nodes in toNodeId position where type is father/mother and fromNodeId is the given node)
  function getChildren(nodeId: string): string[] {
    return relationships
      .filter((r) => (r.type === 'father' || r.type === 'mother') && r.fromNodeId === nodeId)
      .map((r) => r.toNodeId);
  }

  // Track which nodeIds have been added to avoid duplicates
  const seen = new Set<string>();
  const results: DerivedRelationship[] = [];

  function addResult(nodeId: string, type: DerivedRelationType, via?: string): void {
    // Don't add the person themselves or duplicates
    if (nodeId === personNodeId || seen.has(nodeId)) return;
    const node = nodeMap.get(nodeId);
    if (!node) return;
    seen.add(nodeId);
    results.push({
      nodeId,
      personName: formatDisplayName(node.firstName, node.lastName),
      type,
      ...(via ? { via } : {}),
    });
  }

  // --- Siblings ---
  const parents = getParents(personNodeId);

  if (parents.length > 0) {
    // Find all children of each parent (excluding the person)
    const siblingSharedParents = new Map<string, string[]>();

    for (const parentId of parents) {
      const children = getChildren(parentId);
      for (const childId of children) {
        if (childId === personNodeId) continue;
        siblingSharedParents.set(childId, [...(siblingSharedParents.get(childId) ?? []), parentId]);
      }
    }

    for (const [siblingId, shared] of siblingSharedParents) {
      if (shared.length === parents.length && parents.length > 0) {
        // Full sibling: shares ALL of the person's parents
        addResult(siblingId, 'sibling');
      } else {
        // Half-sibling: shares at least one but not all parents
        const viaNode = nodeMap.get(shared[0]);
        addResult(
          siblingId,
          'half-sibling',
          viaNode ? formatDisplayName(viaNode.firstName, viaNode.lastName) : undefined
        );
      }
    }
  }

  // --- Grandparents (2 hops up) ---
  for (const parentId of parents) {
    const grandparents = getParents(parentId);
    for (const gpId of grandparents) {
      addResult(gpId, 'grandparent');
    }
  }

  // --- Grandchildren (2 hops down) ---
  const children = getChildren(personNodeId);
  for (const childId of children) {
    const grandchildren = getChildren(childId);
    for (const gcId of grandchildren) {
      addResult(gcId, 'grandchild');
    }
  }

  // --- Uncles/Aunts (siblings of parents) ---
  for (const parentId of parents) {
    const parentParents = getParents(parentId);
    for (const grandparentId of parentParents) {
      const parentSiblings = getChildren(grandparentId);
      for (const uncleAuntId of parentSiblings) {
        if (uncleAuntId === parentId) continue; // Skip the parent themselves
        addResult(uncleAuntId, 'uncle_aunt');
      }
    }
  }

  // --- Cousins (children of parents' siblings) ---
  // First collect all uncle/aunt IDs (siblings of parents, regardless of whether they were already added as a different type)
  const uncleAuntIds = new Set<string>();
  for (const parentId of parents) {
    const parentParents = getParents(parentId);
    for (const grandparentId of parentParents) {
      const parentSiblings = getChildren(grandparentId);
      for (const uncleAuntId of parentSiblings) {
        if (uncleAuntId !== parentId) {
          uncleAuntIds.add(uncleAuntId);
        }
      }
    }
  }

  for (const uncleAuntId of uncleAuntIds) {
    const cousinIds = getChildren(uncleAuntId);
    for (const cousinId of cousinIds) {
      addResult(cousinId, 'cousin');
    }
  }

  return results;
}
