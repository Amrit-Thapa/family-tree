import { describe, it, expect } from 'vitest';
import SidePanel from './SidePanel';
import type { SidePanelProps } from './SidePanel';
import type { GraphNodeData, GraphRelationshipData } from '@/lib/services/graph.service';

describe('SidePanel', () => {
  it('exports SidePanel as default', () => {
    expect(SidePanel).toBeDefined();
    expect(typeof SidePanel).toBe('function');
  });

  it('SidePanelProps interface supports all required fields', () => {
    const props: SidePanelProps = {
      node: null,
      relationships: [],
      allNodes: [],
      isAdmin: false,
      treeId: 'tree-123',
      onClose: () => { },
      onNavigateToNode: () => { },
      onRelationshipCreated: () => { },
      onRelationshipDeleted: () => { },
    };

    expect(props.node).toBeNull();
    expect(props.relationships).toEqual([]);
    expect(props.allNodes).toEqual([]);
    expect(props.isAdmin).toBe(false);
    expect(props.treeId).toBe('tree-123');
  });

  it('SidePanelProps accepts a GraphNodeData node', () => {
    const node: GraphNodeData = {
      id: 'node-1',
      personId: 'person-1',
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: '1990-01-15T00:00:00.000Z',
      dateOfDeath: '2020-06-01T00:00:00.000Z',
      gender: 'male',
      profilePhotoUrl: 'https://example.com/photo.jpg',
      linkedUserId: 'user-1',
    };

    const props: SidePanelProps = {
      node,
      relationships: [],
      allNodes: [node],
      isAdmin: true,
      treeId: 'tree-123',
      onClose: () => { },
      onNavigateToNode: () => { },
      onRelationshipCreated: () => { },
      onRelationshipDeleted: () => { },
    };

    expect(props.node?.firstName).toBe('John');
    expect(props.node?.lastName).toBe('Doe');
    expect(props.node?.dateOfBirth).toBe('1990-01-15T00:00:00.000Z');
    expect(props.node?.dateOfDeath).toBe('2020-06-01T00:00:00.000Z');
    expect(props.isAdmin).toBe(true);
  });

  it('SidePanelProps accepts relationships and allNodes arrays', () => {
    const nodes: GraphNodeData[] = [
      { id: 'n1', personId: 'p1', firstName: 'Alice' },
      { id: 'n2', personId: 'p2', firstName: 'Bob' },
    ];

    const relationships: GraphRelationshipData[] = [
      { id: 'r1', fromNodeId: 'n1', toNodeId: 'n2', type: 'father' },
    ];

    const props: SidePanelProps = {
      node: nodes[0],
      relationships,
      allNodes: nodes,
      isAdmin: false,
      treeId: 'tree-456',
      onClose: () => { },
      onNavigateToNode: () => { },
      onRelationshipCreated: () => { },
      onRelationshipDeleted: () => { },
    };

    expect(props.relationships).toHaveLength(1);
    expect(props.allNodes).toHaveLength(2);
    expect(props.relationships[0].type).toBe('father');
  });

  it('SidePanelProps node can omit optional fields', () => {
    const node: GraphNodeData = {
      id: 'node-minimal',
      personId: 'person-minimal',
      firstName: 'MinimalPerson',
    };

    const props: SidePanelProps = {
      node,
      relationships: [],
      allNodes: [node],
      isAdmin: false,
      treeId: 'tree-789',
      onClose: () => { },
      onNavigateToNode: () => { },
      onRelationshipCreated: () => { },
      onRelationshipDeleted: () => { },
    };

    expect(props.node?.lastName).toBeUndefined();
    expect(props.node?.dateOfBirth).toBeUndefined();
    expect(props.node?.dateOfDeath).toBeUndefined();
    expect(props.node?.gender).toBeUndefined();
    expect(props.node?.profilePhotoUrl).toBeUndefined();
    expect(props.node?.linkedUserId).toBeUndefined();
  });
});
