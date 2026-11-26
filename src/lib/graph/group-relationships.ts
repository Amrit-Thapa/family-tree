import type { GraphNodeData, GraphRelationshipData } from '@/lib/services/graph.service';

export interface GroupedRelationships {
  father: GraphNodeData | null;
  mother: GraphNodeData | null;
  children: GraphNodeData[];
  spouses: { node: GraphNodeData; status?: string }[];
}

/**
 * Groups a person's direct relationships by type for side panel display.
 * Pure function: partitions relationships into father, mother, children, and spouses.
 *
 * For father/mother:
 * - If person is in toNodeId position → the fromNodeId person is the father/mother
 * - If person is in fromNodeId position → the toNodeId person is a child
 *
 * For spouse:
 * - The other person is a spouse (with status: active/divorced/separated)
 */
export function groupDirectRelationships(
  personNodeId: string,
  relationships: GraphRelationshipData[],
  nodes: GraphNodeData[]
): GroupedRelationships {
  let father: GraphNodeData | null = null;
  let mother: GraphNodeData | null = null;
  const children: GraphNodeData[] = [];
  const spouses: { node: GraphNodeData; status?: string }[] = [];

  const nodeMap = new Map<string, GraphNodeData>();
  for (const node of nodes) {
    nodeMap.set(node.id, node);
  }

  for (const rel of relationships) {
    if (rel.type === 'father') {
      if (rel.toNodeId === personNodeId) {
        // Person is the child → fromNodeId is the father
        const fatherNode = nodeMap.get(rel.fromNodeId);
        if (fatherNode) father = fatherNode;
      } else if (rel.fromNodeId === personNodeId) {
        // Person is the father → toNodeId is a child
        const childNode = nodeMap.get(rel.toNodeId);
        if (childNode) children.push(childNode);
      }
    } else if (rel.type === 'mother') {
      if (rel.toNodeId === personNodeId) {
        // Person is the child → fromNodeId is the mother
        const motherNode = nodeMap.get(rel.fromNodeId);
        if (motherNode) mother = motherNode;
      } else if (rel.fromNodeId === personNodeId) {
        // Person is the mother → toNodeId is a child
        const childNode = nodeMap.get(rel.toNodeId);
        if (childNode) children.push(childNode);
      }
    } else if (rel.type === 'spouse') {
      if (rel.fromNodeId === personNodeId) {
        const spouseNode = nodeMap.get(rel.toNodeId);
        if (spouseNode) spouses.push({ node: spouseNode, status: rel.spouseStatus });
      } else if (rel.toNodeId === personNodeId) {
        const spouseNode = nodeMap.get(rel.fromNodeId);
        if (spouseNode) spouses.push({ node: spouseNode, status: rel.spouseStatus });
      }
    }
  }

  return { father, mother, children, spouses };
}
