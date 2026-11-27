import type { GraphNodeData, GraphRelationshipData } from '@/lib/services/graph.service';
import { groupDirectRelationships } from '@/lib/graph/group-relationships';
import { formatDisplayName } from '@/lib/graph/format-name';

/** What a quick-add button on a person's panel is adding to that person. */
export type QuickAddKind = 'father' | 'mother' | 'child' | 'spouse';

export interface LinkCandidate {
  node: GraphNodeData;
  /** True when the tree's data makes this person a likely match */
  suggested: boolean;
  /** Why it is suggested, e.g. "Child of parta darji" */
  reason?: string;
}

/** The parent relationship type implied by a person's gender, if any. */
export function parentTypeFor(gender?: string): 'father' | 'mother' | null {
  if (gender === 'male') return 'father';
  if (gender === 'female') return 'mother';
  return null;
}

const label = (n: GraphNodeData) => formatDisplayName(n.firstName, n.lastName);

function activeSpouses(personId: string, relationships: GraphRelationshipData[], nodes: GraphNodeData[]) {
  return groupDirectRelationships(personId, relationships, nodes)
    .spouses.filter((s) => !s.status || s.status === 'active')
    .map((s) => s.node);
}

/**
 * Lists existing people who could be linked to `personId` in the given role,
 * with likely matches flagged and sorted first.
 *
 * Suggestions come from the tree's own data, which is where one-sided links
 * usually come from:
 * - father / mother: the active spouse of the person's other parent
 * - child: children of the person's active spouse not yet linked to the person
 * - spouse: people who already share a child with the person
 *
 * People who could never fill the role are left out (self, people already in
 * that role, and the person's own parents/children where that would be circular).
 */
export function getLinkCandidates(
  personId: string,
  kind: QuickAddKind,
  relationships: GraphRelationshipData[],
  nodes: GraphNodeData[],
  /** For kind 'child': the parent type the person would have to the child */
  childParentType?: 'father' | 'mother' | null
): LinkCandidate[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const mine = groupDirectRelationships(personId, relationships, nodes);
  const myChildIds = new Set(mine.children.map((c) => c.id));
  const myParentIds = new Set([mine.father?.id, mine.mother?.id].filter(Boolean) as string[]);
  const mySpouseIds = new Set(mine.spouses.map((s) => s.node.id));

  const suggestions = new Map<string, string>();
  const excluded = new Set<string>([personId]);

  if (kind === 'father' || kind === 'mother') {
    // A parent can't be one of the person's own children
    myChildIds.forEach((id) => excluded.add(id));
    const existing = kind === 'father' ? mine.father : mine.mother;
    if (existing) excluded.add(existing.id);
    const otherParent = kind === 'father' ? mine.mother : mine.father;
    if (otherParent) {
      for (const s of activeSpouses(otherParent.id, relationships, nodes)) {
        suggestions.set(s.id, `Spouse of ${label(otherParent)}`);
      }
    }
    // Rule out people whose gender contradicts the role
    const wrongGender = kind === 'father' ? 'female' : 'male';
    for (const n of nodes) if (n.gender === wrongGender) excluded.add(n.id);
  } else if (kind === 'child') {
    myChildIds.forEach((id) => excluded.add(id));
    myParentIds.forEach((id) => excluded.add(id));
    // A child can only have one father and one mother
    if (childParentType) {
      for (const r of relationships) {
        if (r.type === childParentType) excluded.add(r.toNodeId);
      }
    }
    for (const s of activeSpouses(personId, relationships, nodes)) {
      for (const c of groupDirectRelationships(s.id, relationships, nodes).children) {
        if (!myChildIds.has(c.id)) suggestions.set(c.id, `Child of ${label(s)}`);
      }
    }
  } else {
    // spouse
    mySpouseIds.forEach((id) => excluded.add(id));
    myChildIds.forEach((id) => excluded.add(id));
    myParentIds.forEach((id) => excluded.add(id));
    for (const childId of myChildIds) {
      const child = nodeMap.get(childId)!;
      const theirs = groupDirectRelationships(childId, relationships, nodes);
      for (const p of [theirs.father, theirs.mother]) {
        if (p && p.id !== personId && !mySpouseIds.has(p.id)) {
          suggestions.set(p.id, `Also a parent of ${label(child)}`);
        }
      }
    }
  }

  return nodes
    .filter((n) => !excluded.has(n.id))
    .map((n) => ({
      node: n,
      suggested: suggestions.has(n.id),
      reason: suggestions.get(n.id),
    }))
    .sort(
      (a, b) =>
        Number(b.suggested) - Number(a.suggested) || label(a.node).localeCompare(label(b.node))
    );
}

/**
 * When adding a brand-new child to `personId`, returns the spouse who should
 * probably be linked as the other parent: only when there is exactly one
 * active spouse and their gender doesn't contradict the other parent role.
 */
export function getCoParentForNewChild(
  personId: string,
  personParentType: 'father' | 'mother',
  relationships: GraphRelationshipData[],
  nodes: GraphNodeData[]
): { node: GraphNodeData; type: 'father' | 'mother' } | null {
  const spouses = activeSpouses(personId, relationships, nodes);
  if (spouses.length !== 1) return null;
  const type = personParentType === 'father' ? 'mother' : 'father';
  const spouseType = parentTypeFor(spouses[0].gender);
  if (spouseType && spouseType !== type) return null;
  return { node: spouses[0], type };
}
