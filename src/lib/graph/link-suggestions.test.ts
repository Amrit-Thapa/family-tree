import { describe, it, expect } from 'vitest';
import type { GraphNodeData, GraphRelationshipData } from '@/lib/services/graph.service';
import { getCoParentForNewChild, getLinkCandidates, parentTypeFor } from './link-suggestions';

const person = (id: string, gender?: string): GraphNodeData => ({
  id,
  personId: `p-${id}`,
  firstName: id,
  gender,
});

let relId = 0;
const rel = (
  fromNodeId: string,
  type: GraphRelationshipData['type'],
  toNodeId: string,
  spouseStatus?: GraphRelationshipData['spouseStatus']
): GraphRelationshipData => ({ id: `r${relId++}`, fromNodeId, toNodeId, type, spouseStatus });

// Mirrors the one-sided links found in a real tree
const nodes = [
  person('parta', 'male'),
  person('bhim', 'female'),
  person('samjhan', 'female'),
  person('susmita', 'female'),
  person('gam', 'male'),
  person('kalpana', 'female'),
  person('kushal', 'male'),
  person('ujjwal', 'male'),
  person('unknown'),
];
const relationships = [
  rel('parta', 'spouse', 'bhim'),
  rel('parta', 'father', 'samjhan'),
  rel('bhim', 'mother', 'samjhan'),
  rel('parta', 'father', 'susmita'), // bhim missing
  rel('gam', 'spouse', 'kalpana'),
  rel('gam', 'father', 'kushal'), // kalpana missing
  rel('kalpana', 'mother', 'ujjwal'), // gam missing
];

const ids = (cs: { node: GraphNodeData }[]) => cs.map((c) => c.node.id);

describe('parentTypeFor', () => {
  it('maps gender to parent type', () => {
    expect(parentTypeFor('male')).toBe('father');
    expect(parentTypeFor('female')).toBe('mother');
    expect(parentTypeFor('other')).toBeNull();
    expect(parentTypeFor(undefined)).toBeNull();
  });
});

describe('getLinkCandidates', () => {
  it("suggests the spouse's unlinked children first when adding a child", () => {
    const cs = getLinkCandidates('bhim', 'child', relationships, nodes, 'mother');
    expect(cs[0]).toMatchObject({ node: { id: 'susmita' }, suggested: true, reason: 'Child of parta' });
    // Already her child, so not offered
    expect(ids(cs)).not.toContain('samjhan');
    // ujjwal already has a mother
    expect(ids(cs)).not.toContain('ujjwal');
    // kushal has no mother, so is offered but not suggested
    expect(cs.find((c) => c.node.id === 'kushal')?.suggested).toBe(false);
  });

  it("suggests the other parent's spouse when adding a missing father", () => {
    const cs = getLinkCandidates('ujjwal', 'father', relationships, nodes);
    expect(cs[0]).toMatchObject({ node: { id: 'gam' }, suggested: true, reason: 'Spouse of kalpana' });
    // Women are not offered as a father
    expect(ids(cs)).not.toContain('kalpana');
    expect(ids(cs)).not.toContain('ujjwal');
    // Unknown gender is still allowed
    expect(ids(cs)).toContain('unknown');
  });

  it("suggests the other parent's spouse when adding a missing mother", () => {
    const cs = getLinkCandidates('kushal', 'mother', relationships, nodes);
    expect(cs[0]).toMatchObject({ node: { id: 'kalpana' }, suggested: true });
    expect(ids(cs)).not.toContain('gam');
  });

  it('suggests co-parents without a spouse link when adding a spouse', () => {
    const rs = [rel('a', 'father', 'kid'), rel('b', 'mother', 'kid')];
    const ns = [person('a', 'male'), person('b', 'female'), person('kid'), person('other')];
    const cs = getLinkCandidates('a', 'spouse', rs, ns);
    expect(cs[0]).toMatchObject({ node: { id: 'b' }, suggested: true });
    expect(ids(cs)).not.toContain('kid');
  });

  it('sorts suggestions first, then alphabetically', () => {
    const cs = getLinkCandidates('bhim', 'child', relationships, nodes, 'mother');
    const rest = ids(cs.filter((c) => !c.suggested));
    expect(rest).toEqual([...rest].sort());
  });
});

describe('getCoParentForNewChild', () => {
  it('returns the single active spouse as the other parent', () => {
    expect(getCoParentForNewChild('gam', 'father', relationships, nodes)).toMatchObject({
      node: { id: 'kalpana' },
      type: 'mother',
    });
  });

  it('returns null with no spouse, several spouses, or a divorced spouse', () => {
    expect(getCoParentForNewChild('kushal', 'father', relationships, nodes)).toBeNull();
    const multi = [...relationships, rel('gam', 'spouse', 'unknown')];
    expect(getCoParentForNewChild('gam', 'father', multi, nodes)).toBeNull();
    const divorced = [rel('gam', 'spouse', 'kalpana', 'divorced')];
    expect(getCoParentForNewChild('gam', 'father', divorced, nodes)).toBeNull();
  });

  it("returns null when the spouse's gender contradicts the other parent role", () => {
    const rs = [rel('x', 'spouse', 'y')];
    const ns = [person('x', 'female'), person('y', 'female')];
    expect(getCoParentForNewChild('x', 'mother', rs, ns)).toBeNull();
  });
});
