import { describe, it, expect } from 'vitest';
import { deriveRelationships } from './derived-relationships';
import type { GraphNodeData, GraphRelationshipData } from '@/lib/services/graph.service';

function makeNode(id: string, firstName: string, lastName?: string): GraphNodeData {
  return {
    id,
    personId: `person-${id}`,
    firstName,
    lastName,
  };
}

function makeParentChild(id: string, parentId: string, childId: string): GraphRelationshipData {
  return {
    id,
    fromNodeId: parentId,
    toNodeId: childId,
    type: 'father',
  };
}

describe('deriveRelationships', () => {
  it('returns empty array when person has no relationships', () => {
    const nodes = [makeNode('A', 'Alice')];
    const relationships: GraphRelationshipData[] = [];

    const result = deriveRelationships('A', relationships, nodes);
    expect(result).toEqual([]);
  });

  it('returns empty array when person has only direct parent/child relationships', () => {
    const nodes = [makeNode('P', 'Parent'), makeNode('C', 'Child')];
    const relationships = [makeParentChild('r1', 'P', 'C')];

    // From child's perspective: parent is direct, not derived
    const result = deriveRelationships('C', relationships, nodes);
    expect(result).toEqual([]);
  });

  it('computes full siblings (share both parents)', () => {
    const nodes = [
      makeNode('dad', 'Dad'),
      makeNode('mom', 'Mom'),
      makeNode('me', 'Me'),
      makeNode('bro', 'Brother'),
    ];
    const relationships = [
      makeParentChild('r1', 'dad', 'me'),
      makeParentChild('r2', 'mom', 'me'),
      makeParentChild('r3', 'dad', 'bro'),
      makeParentChild('r4', 'mom', 'bro'),
    ];

    const result = deriveRelationships('me', relationships, nodes);
    const siblings = result.filter((r) => r.type === 'sibling');
    expect(siblings).toHaveLength(1);
    expect(siblings[0].nodeId).toBe('bro');
    expect(siblings[0].personName).toBe('Brother');
  });

  it('computes half-siblings (share exactly one parent)', () => {
    const nodes = [
      makeNode('dad', 'Dad'),
      makeNode('mom', 'Mom'),
      makeNode('stepmom', 'StepMom'),
      makeNode('me', 'Me'),
      makeNode('half', 'HalfSib'),
    ];
    const relationships = [
      makeParentChild('r1', 'dad', 'me'),
      makeParentChild('r2', 'mom', 'me'),
      makeParentChild('r3', 'dad', 'half'),
      makeParentChild('r4', 'stepmom', 'half'),
    ];

    const result = deriveRelationships('me', relationships, nodes);
    const halfSiblings = result.filter((r) => r.type === 'half-sibling');
    expect(halfSiblings).toHaveLength(1);
    expect(halfSiblings[0].nodeId).toBe('half');
    // Names the parent they share
    expect(halfSiblings[0].via).toBe('Dad');
  });

  it('computes grandparents (2 hops up)', () => {
    const nodes = [
      makeNode('gp1', 'Grandpa'),
      makeNode('gp2', 'Grandma'),
      makeNode('dad', 'Dad'),
      makeNode('me', 'Me'),
    ];
    const relationships = [
      makeParentChild('r1', 'gp1', 'dad'),
      makeParentChild('r2', 'gp2', 'dad'),
      makeParentChild('r3', 'dad', 'me'),
    ];

    const result = deriveRelationships('me', relationships, nodes);
    const grandparents = result.filter((r) => r.type === 'grandparent');
    expect(grandparents).toHaveLength(2);
    expect(grandparents.map((g) => g.nodeId).sort()).toEqual(['gp1', 'gp2']);
  });

  it('computes grandchildren (2 hops down)', () => {
    const nodes = [
      makeNode('me', 'Me'),
      makeNode('child', 'Child'),
      makeNode('gc1', 'Grandchild1'),
      makeNode('gc2', 'Grandchild2'),
    ];
    const relationships = [
      makeParentChild('r1', 'me', 'child'),
      makeParentChild('r2', 'child', 'gc1'),
      makeParentChild('r3', 'child', 'gc2'),
    ];

    const result = deriveRelationships('me', relationships, nodes);
    const grandchildren = result.filter((r) => r.type === 'grandchild');
    expect(grandchildren).toHaveLength(2);
    expect(grandchildren.map((g) => g.nodeId).sort()).toEqual(['gc1', 'gc2']);
  });

  it('computes uncles/aunts (siblings of parents)', () => {
    const nodes = [
      makeNode('gp', 'Grandpa'),
      makeNode('dad', 'Dad'),
      makeNode('uncle', 'Uncle'),
      makeNode('me', 'Me'),
    ];
    const relationships = [
      makeParentChild('r1', 'gp', 'dad'),
      makeParentChild('r2', 'gp', 'uncle'),
      makeParentChild('r3', 'dad', 'me'),
    ];

    const result = deriveRelationships('me', relationships, nodes);
    const unclesAunts = result.filter((r) => r.type === 'uncle_aunt');
    expect(unclesAunts).toHaveLength(1);
    expect(unclesAunts[0].nodeId).toBe('uncle');
  });

  it('computes cousins (children of parents siblings)', () => {
    const nodes = [
      makeNode('gp', 'Grandpa'),
      makeNode('dad', 'Dad'),
      makeNode('uncle', 'Uncle'),
      makeNode('me', 'Me'),
      makeNode('cousin', 'Cousin'),
    ];
    const relationships = [
      makeParentChild('r1', 'gp', 'dad'),
      makeParentChild('r2', 'gp', 'uncle'),
      makeParentChild('r3', 'dad', 'me'),
      makeParentChild('r4', 'uncle', 'cousin'),
    ];

    const result = deriveRelationships('me', relationships, nodes);
    const cousins = result.filter((r) => r.type === 'cousin');
    expect(cousins).toHaveLength(1);
    expect(cousins[0].nodeId).toBe('cousin');
  });

  it('does not include duplicates when reachable via multiple paths', () => {
    // Uncle is reachable as sibling of both mom and dad (if both parents share the same parent)
    const nodes = [
      makeNode('gp', 'Grandpa'),
      makeNode('dad', 'Dad'),
      makeNode('mom', 'Mom'),
      makeNode('uncle', 'Uncle'),
      makeNode('me', 'Me'),
    ];
    const relationships = [
      makeParentChild('r1', 'gp', 'dad'),
      makeParentChild('r2', 'gp', 'mom'),
      makeParentChild('r3', 'gp', 'uncle'),
      makeParentChild('r4', 'dad', 'me'),
      makeParentChild('r5', 'mom', 'me'),
    ];

    const result = deriveRelationships('me', relationships, nodes);
    const uncleEntries = result.filter((r) => r.nodeId === 'uncle');
    expect(uncleEntries).toHaveLength(1);
  });

  it('does not include the person themselves in results', () => {
    const nodes = [
      makeNode('dad', 'Dad'),
      makeNode('me', 'Me'),
    ];
    const relationships = [
      makeParentChild('r1', 'dad', 'me'),
    ];

    const result = deriveRelationships('me', relationships, nodes);
    const selfEntries = result.filter((r) => r.nodeId === 'me');
    expect(selfEntries).toHaveLength(0);
  });

  it('handles complex multi-generation family correctly', () => {
    // Grandpa -> Dad -> Me -> Child -> Grandchild
    // Grandpa -> Uncle -> Cousin
    const nodes = [
      makeNode('grandpa', 'Grandpa'),
      makeNode('grandma', 'Grandma'),
      makeNode('dad', 'Dad'),
      makeNode('uncle', 'Uncle'),
      makeNode('me', 'Me'),
      makeNode('sibling', 'Sibling'),
      makeNode('cousin', 'Cousin'),
      makeNode('child', 'Child'),
      makeNode('grandchild', 'Grandchild'),
    ];
    const relationships = [
      makeParentChild('r1', 'grandpa', 'dad'),
      makeParentChild('r2', 'grandma', 'dad'),
      makeParentChild('r3', 'grandpa', 'uncle'),
      makeParentChild('r4', 'grandma', 'uncle'),
      makeParentChild('r5', 'dad', 'me'),
      makeParentChild('r6', 'dad', 'sibling'),
      makeParentChild('r7', 'uncle', 'cousin'),
      makeParentChild('r8', 'me', 'child'),
      makeParentChild('r9', 'child', 'grandchild'),
    ];

    const result = deriveRelationships('me', relationships, nodes);

    // Sibling shares dad (but only dad, since me only has dad as parent)
    const siblings = result.filter((r) => r.type === 'sibling');
    expect(siblings).toHaveLength(1);
    expect(siblings[0].nodeId).toBe('sibling');

    // Grandparents: grandpa and grandma
    const grandparents = result.filter((r) => r.type === 'grandparent');
    expect(grandparents).toHaveLength(2);

    // Grandchild
    const grandchildren = result.filter((r) => r.type === 'grandchild');
    expect(grandchildren).toHaveLength(1);
    expect(grandchildren[0].nodeId).toBe('grandchild');

    // Uncle
    const unclesAunts = result.filter((r) => r.type === 'uncle_aunt');
    expect(unclesAunts).toHaveLength(1);
    expect(unclesAunts[0].nodeId).toBe('uncle');

    // Cousin
    const cousins = result.filter((r) => r.type === 'cousin');
    expect(cousins).toHaveLength(1);
    expect(cousins[0].nodeId).toBe('cousin');
  });

  it('uses formatDisplayName for personName', () => {
    const nodes = [
      makeNode('dad', 'Dad', 'Smith'),
      makeNode('me', 'Me'),
      makeNode('bro', 'Brother', 'VeryLongLastNameThatExceedsTh'),
    ];
    const relationships = [
      makeParentChild('r1', 'dad', 'me'),
      makeParentChild('r2', 'dad', 'bro'),
    ];

    const result = deriveRelationships('me', relationships, nodes);
    const sibling = result.find((r) => r.nodeId === 'bro');
    expect(sibling).toBeDefined();
    // "Brother VeryLongLastNameThatExceedsTh" is > 30 chars, should be truncated
    expect(sibling!.personName.length).toBeLessThanOrEqual(30);
  });
});
