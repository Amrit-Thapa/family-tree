import type { GraphNodeData, GraphRelationshipData } from '@/lib/services/graph.service';
import { groupDirectRelationships } from '@/lib/graph/group-relationships';
import { deriveRelationships, type DerivedRelationType } from '@/lib/graph/derived-relationships';
import { formatDisplayName } from '@/lib/graph/format-name';

export interface FocusPerson {
  node: GraphNodeData;
  /** Friendly relation to the focused person, e.g. "Mum", "Brother", "Half-sister" */
  label: string;
  /** Extra context, e.g. "via Ram" for half-siblings or "Divorced" for spouses */
  note?: string;
}

export interface FocusFamily {
  father: FocusPerson | null;
  mother: FocusPerson | null;
  partners: FocusPerson[];
  children: FocusPerson[];
  siblings: FocusPerson[];
  /** Grandparents, uncles & aunts, cousins and grandchildren, in that order */
  extended: FocusPerson[];
}

function byGender(gender: string | undefined, male: string, female: string, other: string): string {
  if (gender === 'male') return male;
  if (gender === 'female') return female;
  return other;
}

const EXTENDED_ORDER: DerivedRelationType[] = ['grandparent', 'uncle_aunt', 'cousin', 'grandchild'];

function extendedLabel(type: DerivedRelationType, gender?: string): string {
  switch (type) {
    case 'grandparent':
      return byGender(gender, 'Grandpa', 'Grandma', 'Grandparent');
    case 'uncle_aunt':
      return byGender(gender, 'Uncle', 'Aunt', 'Uncle / aunt');
    case 'cousin':
      return 'Cousin';
    case 'grandchild':
      return byGender(gender, 'Grandson', 'Granddaughter', 'Grandchild');
    default:
      return '';
  }
}

/**
 * Everyone around one person, labelled from that person's point of view.
 * Drives the person-centred "Family" view.
 */
export function getFocusFamily(
  personId: string,
  relationships: GraphRelationshipData[],
  nodes: GraphNodeData[]
): FocusFamily {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const direct = groupDirectRelationships(personId, relationships, nodes);
  const derived = deriveRelationships(personId, relationships, nodes);

  const siblings: FocusPerson[] = [];
  const extended: FocusPerson[] = [];
  for (const rel of derived) {
    const node = nodeMap.get(rel.nodeId);
    if (!node) continue;
    if (rel.type === 'sibling') {
      siblings.push({ node, label: byGender(node.gender, 'Brother', 'Sister', 'Sibling') });
    } else if (rel.type === 'half-sibling') {
      siblings.push({
        node,
        label: byGender(node.gender, 'Half-brother', 'Half-sister', 'Half-sibling'),
        note: rel.via ? `via ${rel.via}` : undefined,
      });
    }
  }
  for (const type of EXTENDED_ORDER) {
    for (const rel of derived) {
      if (rel.type !== type) continue;
      const node = nodeMap.get(rel.nodeId);
      if (node) extended.push({ node, label: extendedLabel(type, node.gender) });
    }
  }

  return {
    father: direct.father ? { node: direct.father, label: 'Dad' } : null,
    mother: direct.mother ? { node: direct.mother, label: 'Mum' } : null,
    partners: direct.spouses.map(({ node, status }) => ({
      node,
      label: byGender(node.gender, 'Husband', 'Wife', 'Partner'),
      note: status === 'divorced' ? 'Divorced' : status === 'separated' ? 'Separated' : undefined,
    })),
    children: direct.children.map((node) => ({
      node,
      label: byGender(node.gender, 'Son', 'Daughter', 'Child'),
    })),
    siblings,
    extended,
  };
}

/**
 * Who the Family view starts on: the signed-in user's own node, otherwise the
 * best-connected person in the tree.
 */
export function pickDefaultFocus(
  nodes: GraphNodeData[],
  relationships: GraphRelationshipData[],
  currentUserId: string
): string | null {
  if (nodes.length === 0) return null;
  const mine = nodes.find((n) => n.linkedUserId === currentUserId);
  if (mine) return mine.id;

  const degree = new Map<string, number>();
  for (const r of relationships) {
    degree.set(r.fromNodeId, (degree.get(r.fromNodeId) ?? 0) + 1);
    degree.set(r.toNodeId, (degree.get(r.toNodeId) ?? 0) + 1);
  }
  let best = nodes[0];
  for (const n of nodes) {
    if ((degree.get(n.id) ?? 0) > (degree.get(best.id) ?? 0)) best = n;
  }
  return best.id;
}

/**
 * Case-insensitive name search. Names starting with the query come first.
 */
export function searchPeople(nodes: GraphNodeData[], query: string, limit = 8): GraphNodeData[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored: { node: GraphNodeData; score: number; name: string }[] = [];
  for (const node of nodes) {
    const name = formatDisplayName(node.firstName, node.lastName).toLowerCase();
    if (!name.includes(q)) continue;
    // 0 = whole name starts with it, 1 = a later word starts with it, 2 = anywhere
    const score = name.startsWith(q) ? 0 : name.includes(` ${q}`) ? 1 : 2;
    scored.push({ node, score, name });
  }
  scored.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name));
  return scored.slice(0, limit).map((s) => s.node);
}
