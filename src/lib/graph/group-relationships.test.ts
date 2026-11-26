import { describe, it, expect } from 'vitest';
import { groupDirectRelationships } from './group-relationships';
import type { GraphNodeData, GraphRelationshipData } from '@/lib/services/graph.service';

function makeNode(id: string, firstName: string): GraphNodeData {
  return { id, personId: `person-${id}`, firstName };
}

describe('groupDirectRelationships', () => {
  const personNode = makeNode('person-1', 'Alice');
  const fatherNode = makeNode('father-1', 'Bob');
  const motherNode = makeNode('mother-1', 'Eve');
  const childNode = makeNode('child-1', 'Charlie');
  const spouseNode = makeNode('spouse-1', 'Diana');

  const allNodes = [personNode, fatherNode, motherNode, childNode, spouseNode];

  it('groups father relationship where person is the child (toNodeId)', () => {
    const relationships: GraphRelationshipData[] = [
      { id: 'rel-1', fromNodeId: 'father-1', toNodeId: 'person-1', type: 'father' },
    ];

    const result = groupDirectRelationships('person-1', relationships, allNodes);

    expect(result.father).not.toBeNull();
    expect(result.father!.id).toBe('father-1');
    expect(result.mother).toBeNull();
    expect(result.children).toHaveLength(0);
    expect(result.spouses).toHaveLength(0);
  });

  it('groups mother relationship where person is the child (toNodeId)', () => {
    const relationships: GraphRelationshipData[] = [
      { id: 'rel-1', fromNodeId: 'mother-1', toNodeId: 'person-1', type: 'mother' },
    ];

    const result = groupDirectRelationships('person-1', relationships, allNodes);

    expect(result.mother).not.toBeNull();
    expect(result.mother!.id).toBe('mother-1');
    expect(result.father).toBeNull();
  });

  it('groups father/mother relationships where person is the parent (fromNodeId) as children', () => {
    const relationships: GraphRelationshipData[] = [
      { id: 'rel-2', fromNodeId: 'person-1', toNodeId: 'child-1', type: 'father' },
    ];

    const result = groupDirectRelationships('person-1', relationships, allNodes);

    expect(result.children).toHaveLength(1);
    expect(result.children[0].id).toBe('child-1');
    expect(result.father).toBeNull();
    expect(result.mother).toBeNull();
    expect(result.spouses).toHaveLength(0);
  });

  it('groups spouse relationships correctly when person is fromNodeId', () => {
    const relationships: GraphRelationshipData[] = [
      { id: 'rel-3', fromNodeId: 'person-1', toNodeId: 'spouse-1', type: 'spouse' },
    ];

    const result = groupDirectRelationships('person-1', relationships, allNodes);

    expect(result.spouses).toHaveLength(1);
    expect(result.spouses[0].node.id).toBe('spouse-1');
    expect(result.father).toBeNull();
    expect(result.mother).toBeNull();
    expect(result.children).toHaveLength(0);
  });

  it('groups spouse relationships correctly when person is toNodeId', () => {
    const relationships: GraphRelationshipData[] = [
      { id: 'rel-4', fromNodeId: 'spouse-1', toNodeId: 'person-1', type: 'spouse' },
    ];

    const result = groupDirectRelationships('person-1', relationships, allNodes);

    expect(result.spouses).toHaveLength(1);
    expect(result.spouses[0].node.id).toBe('spouse-1');
  });

  it('ignores relationships that do not involve the person', () => {
    const relationships: GraphRelationshipData[] = [
      { id: 'rel-5', fromNodeId: 'father-1', toNodeId: 'child-1', type: 'father' },
      { id: 'rel-6', fromNodeId: 'spouse-1', toNodeId: 'child-1', type: 'spouse' },
    ];

    const result = groupDirectRelationships('person-1', relationships, allNodes);

    expect(result.father).toBeNull();
    expect(result.mother).toBeNull();
    expect(result.children).toHaveLength(0);
    expect(result.spouses).toHaveLength(0);
  });

  it('handles multiple relationships of different types', () => {
    const relationships: GraphRelationshipData[] = [
      { id: 'rel-1', fromNodeId: 'father-1', toNodeId: 'person-1', type: 'father' },
      { id: 'rel-1b', fromNodeId: 'mother-1', toNodeId: 'person-1', type: 'mother' },
      { id: 'rel-2', fromNodeId: 'person-1', toNodeId: 'child-1', type: 'father' },
      { id: 'rel-3', fromNodeId: 'person-1', toNodeId: 'spouse-1', type: 'spouse' },
    ];

    const result = groupDirectRelationships('person-1', relationships, allNodes);

    expect(result.father).not.toBeNull();
    expect(result.father!.id).toBe('father-1');
    expect(result.mother).not.toBeNull();
    expect(result.mother!.id).toBe('mother-1');
    expect(result.children).toHaveLength(1);
    expect(result.children[0].id).toBe('child-1');
    expect(result.spouses).toHaveLength(1);
    expect(result.spouses[0].node.id).toBe('spouse-1');
  });

  it('returns empty groups when no relationships are provided', () => {
    const result = groupDirectRelationships('person-1', [], allNodes);

    expect(result.father).toBeNull();
    expect(result.mother).toBeNull();
    expect(result.children).toHaveLength(0);
    expect(result.spouses).toHaveLength(0);
  });

  it('skips relationships referencing nodes not in the nodes array', () => {
    const relationships: GraphRelationshipData[] = [
      { id: 'rel-7', fromNodeId: 'unknown-node', toNodeId: 'person-1', type: 'father' },
    ];

    const result = groupDirectRelationships('person-1', relationships, allNodes);

    expect(result.father).toBeNull();
  });

  it('includes spouse status in the result', () => {
    const relationships: GraphRelationshipData[] = [
      { id: 'rel-8', fromNodeId: 'person-1', toNodeId: 'spouse-1', type: 'spouse', spouseStatus: 'divorced' },
    ];

    const result = groupDirectRelationships('person-1', relationships, allNodes);

    expect(result.spouses).toHaveLength(1);
    expect(result.spouses[0].status).toBe('divorced');
  });
});
