import { describe, it, expect } from 'vitest';
import type { GraphNodeData, GraphRelationshipData } from '@/lib/services/graph.service';
import { getFocusFamily, pickDefaultFocus, searchPeople } from './family-focus';

function person(id: string, firstName: string, gender?: string, extra: Partial<GraphNodeData> = {}): GraphNodeData {
  return { id, personId: `p-${id}`, firstName, gender, ...extra };
}

let relId = 0;
function rel(from: string, to: string, type: GraphRelationshipData['type'], spouseStatus?: GraphRelationshipData['spouseStatus']): GraphRelationshipData {
  return { id: `r${relId++}`, fromNodeId: from, toNodeId: to, type, spouseStatus };
}

const nodes = [
  person('gpa', 'Hari', 'male'),
  person('dad', 'Ram', 'male'),
  person('mum', 'Sita', 'female'),
  person('step', 'Gita', 'female'),
  person('me', 'Amrit', 'male', { linkedUserId: 'user-1' }),
  person('sis', 'Asha', 'female'),
  person('half', 'Bikash', 'male'),
  person('wife', 'Anisha', 'female'),
  person('kid', 'Kiran'),
];

const rels = [
  rel('gpa', 'dad', 'father'),
  rel('dad', 'me', 'father'),
  rel('mum', 'me', 'mother'),
  rel('dad', 'sis', 'father'),
  rel('mum', 'sis', 'mother'),
  rel('dad', 'half', 'father'),
  rel('step', 'half', 'mother'),
  rel('me', 'wife', 'spouse', 'active'),
  rel('me', 'kid', 'father'),
];

describe('getFocusFamily', () => {
  it('labels everyone from the focused person’s point of view', () => {
    const f = getFocusFamily('me', rels, nodes);
    expect(f.father?.node.id).toBe('dad');
    expect(f.father?.label).toBe('Dad');
    expect(f.mother?.label).toBe('Mum');
    expect(f.partners).toEqual([{ node: nodes[7], label: 'Wife', note: undefined }]);
    expect(f.children.map((c) => c.label)).toEqual(['Child']);
    expect(f.siblings.map((s) => [s.node.id, s.label])).toEqual([
      ['sis', 'Sister'],
      ['half', 'Half-brother'],
    ]);
    expect(f.siblings[1].note).toBe('via Ram');
    expect(f.extended.map((e) => [e.node.id, e.label])).toEqual([['gpa', 'Grandpa']]);
  });

  it('notes divorced partners', () => {
    const f = getFocusFamily('me', [rel('me', 'wife', 'spouse', 'divorced')], nodes);
    expect(f.partners[0].note).toBe('Divorced');
  });

  it('returns empty groups for someone with no links', () => {
    const f = getFocusFamily('kid', [], nodes);
    expect(f).toEqual({ father: null, mother: null, partners: [], children: [], siblings: [], extended: [] });
  });
});

describe('pickDefaultFocus', () => {
  it('prefers the signed-in user’s own node', () => {
    expect(pickDefaultFocus(nodes, rels, 'user-1')).toBe('me');
  });

  it('falls back to the best-connected person', () => {
    expect(pickDefaultFocus(nodes, rels, 'someone-else')).toBe('dad');
  });

  it('returns null for an empty tree', () => {
    expect(pickDefaultFocus([], [], 'user-1')).toBeNull();
  });
});

describe('searchPeople', () => {
  it('matches case-insensitively and ranks name starts first', () => {
    const list = [person('1', 'Mira', undefined, { lastName: 'Rai' }), person('2', 'Ramesh'), person('3', 'Bikram')];
    expect(searchPeople(list, 'ra').map((n) => n.id)).toEqual(['2', '1', '3']);
  });

  it('returns nothing for a blank query', () => {
    expect(searchPeople(nodes, '  ')).toEqual([]);
  });
});
