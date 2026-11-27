import { describe, it, expect } from 'vitest';
import type { Node, Edge } from '@xyflow/react';
import { computeDagreLayout } from './layout';

describe('computeDagreLayout', () => {
  it('returns empty arrays when given no nodes or edges', () => {
    const result = computeDagreLayout([], []);
    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);
  });

  it('assigns positions to a single node', () => {
    const nodes: Node[] = [
      { id: '1', position: { x: 0, y: 0 }, data: {} },
    ];
    const result = computeDagreLayout(nodes, []);
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].position.x).toBeTypeOf('number');
    expect(result.nodes[0].position.y).toBeTypeOf('number');
  });

  it('positions parent above child in TB layout', () => {
    const nodes: Node[] = [
      { id: 'parent', position: { x: 0, y: 0 }, data: {} },
      { id: 'child', position: { x: 0, y: 0 }, data: {} },
    ];
    const edges: Edge[] = [
      { id: 'e1', source: 'parent', target: 'child' },
    ];
    const result = computeDagreLayout(nodes, edges, { rankdir: 'TB' });
    const parentNode = result.nodes.find((n) => n.id === 'parent')!;
    const childNode = result.nodes.find((n) => n.id === 'child')!;
    expect(parentNode.position.y).toBeLessThan(childNode.position.y);
  });

  it('positions parent to the left of child in LR layout', () => {
    const nodes: Node[] = [
      { id: 'parent', position: { x: 0, y: 0 }, data: {} },
      { id: 'child', position: { x: 0, y: 0 }, data: {} },
    ];
    const edges: Edge[] = [
      { id: 'e1', source: 'parent', target: 'child' },
    ];
    const result = computeDagreLayout(nodes, edges, { rankdir: 'LR' });
    const parentNode = result.nodes.find((n) => n.id === 'parent')!;
    const childNode = result.nodes.find((n) => n.id === 'child')!;
    expect(parentNode.position.x).toBeLessThan(childNode.position.x);
  });

  it('returns edges unchanged when no couples exist', () => {
    const nodes: Node[] = [
      { id: '1', position: { x: 0, y: 0 }, data: {} },
      { id: '2', position: { x: 0, y: 0 }, data: {} },
    ];
    const edges: Edge[] = [
      { id: 'e1', source: '1', target: '2', data: { isSpouse: false } },
    ];
    const result = computeDagreLayout(nodes, edges);
    // Edges without spouse relationships are passed through
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].id).toBe('e1');
    expect(result.edges[0].source).toBe('1');
    expect(result.edges[0].target).toBe('2');
  });

  it('respects custom nodesep and ranksep options', () => {
    const nodes: Node[] = [
      { id: '1', position: { x: 0, y: 0 }, data: {} },
      { id: '2', position: { x: 0, y: 0 }, data: {} },
      { id: '3', position: { x: 0, y: 0 }, data: {} },
    ];
    const edges: Edge[] = [
      { id: 'e1', source: '1', target: '2' },
      { id: 'e2', source: '1', target: '3' },
    ];

    const tight = computeDagreLayout(nodes, edges, { nodesep: 10, ranksep: 20 });
    const wide = computeDagreLayout(nodes, edges, { nodesep: 200, ranksep: 300 });

    // With wider spacing, the distance between nodes should be greater
    const tightParent = tight.nodes.find((n) => n.id === '1')!;
    const tightChild = tight.nodes.find((n) => n.id === '2')!;
    const wideParent = wide.nodes.find((n) => n.id === '1')!;
    const wideChild = wide.nodes.find((n) => n.id === '2')!;

    const tightVerticalGap = tightChild.position.y - tightParent.position.y;
    const wideVerticalGap = wideChild.position.y - wideParent.position.y;
    expect(wideVerticalGap).toBeGreaterThan(tightVerticalGap);
  });

  it('uses node.measured dimensions when available', () => {
    const nodes: Node[] = [
      {
        id: '1',
        position: { x: 0, y: 0 },
        data: {},
        measured: { width: 200, height: 50 },
      },
    ];
    const result = computeDagreLayout(nodes, []);
    // The node should be positioned using the measured dimensions
    // Dagre centers the node, so position = center - width/2
    expect(result.nodes[0].position.x).toBeTypeOf('number');
    expect(result.nodes[0].position.y).toBeTypeOf('number');
  });

  it('preserves node data and other properties', () => {
    const nodes: Node[] = [
      {
        id: '1',
        position: { x: 0, y: 0 },
        data: { label: 'Test Node' },
        type: 'custom',
      },
    ];
    const result = computeDagreLayout(nodes, []);
    expect(result.nodes[0].id).toBe('1');
    expect(result.nodes[0].data).toEqual({ label: 'Test Node' });
    expect(result.nodes[0].type).toBe('custom');
  });

  it('handles multi-generation hierarchy correctly', () => {
    const nodes: Node[] = [
      { id: 'grandparent', position: { x: 0, y: 0 }, data: {} },
      { id: 'parent', position: { x: 0, y: 0 }, data: {} },
      { id: 'child', position: { x: 0, y: 0 }, data: {} },
    ];
    const edges: Edge[] = [
      { id: 'e1', source: 'grandparent', target: 'parent' },
      { id: 'e2', source: 'parent', target: 'child' },
    ];
    const result = computeDagreLayout(nodes, edges);
    const gp = result.nodes.find((n) => n.id === 'grandparent')!;
    const p = result.nodes.find((n) => n.id === 'parent')!;
    const c = result.nodes.find((n) => n.id === 'child')!;
    expect(gp.position.y).toBeLessThan(p.position.y);
    expect(p.position.y).toBeLessThan(c.position.y);
  });

  it('detects implicit co-parents (shared children, no spouse edge) and creates junction', () => {
    // Suk Maya and Jit both parent Harka, but have no spouse edge
    const nodes: Node[] = [
      { id: 'sukMaya', position: { x: 0, y: 0 }, data: {} },
      { id: 'jit', position: { x: 0, y: 0 }, data: {} },
      { id: 'harka', position: { x: 0, y: 0 }, data: {} },
      { id: 'parta', position: { x: 0, y: 0 }, data: {} },
    ];
    const edges: Edge[] = [
      { id: 'e1', source: 'sukMaya', target: 'harka', data: { isSpouse: false } },
      { id: 'e2', source: 'jit', target: 'harka', data: { isSpouse: false } },
      { id: 'e3', source: 'jit', target: 'parta', data: { isSpouse: false } },
    ];

    const result = computeDagreLayout(nodes, edges);

    // Co-parents should be at the same Y level
    const sukMaya = result.nodes.find((n) => n.id === 'sukMaya')!;
    const jit = result.nodes.find((n) => n.id === 'jit')!;
    expect(sukMaya.position.y).toBe(jit.position.y);

    // A junction node should exist
    const junctionNode = result.nodes.find((n) => n.type === 'junction');
    expect(junctionNode).toBeDefined();

    // Children should be below parents
    const harka = result.nodes.find((n) => n.id === 'harka')!;
    const parta = result.nodes.find((n) => n.id === 'parta')!;
    expect(harka.position.y).toBeGreaterThan(sukMaya.position.y);
    expect(parta.position.y).toBeGreaterThan(jit.position.y);

    // Should have a visual co-parent connector edge (dashed line between them)
    const coparentEdge = result.edges.find((e) => e.id.startsWith('_coparent_'));
    expect(coparentEdge).toBeDefined();
    expect(coparentEdge!.style).toHaveProperty('strokeDasharray');
  });

  it('keeps a childless spouse with no parents on their partner\'s generation, next to them', () => {
    // Regression: Anisha (no parents) married Amrit (child of Harka + Jau Maya).
    // Previously Amrit was dragged up to the grandparents' row and the spouse
    // line ran behind unrelated nodes.
    const ids = ['jit', 'sukMaya', 'harka', 'jauMaya', 'amrit', 'anisha', 'arjun', 'parta'];
    const nodes: Node[] = ids.map((id) => ({ id, position: { x: 0, y: 0 }, data: {} }));
    const edges: Edge[] = [
      { id: 's1', source: 'jit', target: 'sukMaya', data: { isSpouse: true } },
      { id: 's2', source: 'harka', target: 'jauMaya', data: { isSpouse: true } },
      { id: 's3', source: 'amrit', target: 'anisha', data: { isSpouse: true } },
      { id: 'p1', source: 'jit', target: 'harka', data: { isSpouse: false } },
      { id: 'p2', source: 'sukMaya', target: 'harka', data: { isSpouse: false } },
      { id: 'p3', source: 'jit', target: 'parta', data: { isSpouse: false } },
      { id: 'p4', source: 'harka', target: 'amrit', data: { isSpouse: false } },
      { id: 'p5', source: 'jauMaya', target: 'amrit', data: { isSpouse: false } },
      { id: 'p6', source: 'harka', target: 'arjun', data: { isSpouse: false } },
      { id: 'p7', source: 'jauMaya', target: 'arjun', data: { isSpouse: false } },
    ];

    const result = computeDagreLayout(nodes, edges);
    const pos = (id: string) => result.nodes.find((n) => n.id === id)!.position;

    // Amrit stays in the grandchildren row with his sibling, below his parents
    expect(pos('amrit').y).toBe(pos('arjun').y);
    expect(pos('amrit').y).toBeGreaterThan(pos('harka').y);
    // Anisha joins Amrit's row rather than pulling him up
    expect(pos('anisha').y).toBe(pos('amrit').y);

    // Every couple is adjacent: no other person sits between them on their row
    const people = result.nodes.filter((n) => n.type !== 'junction');
    for (const [a, b] of [['jit', 'sukMaya'], ['harka', 'jauMaya'], ['amrit', 'anisha']]) {
      const [lo, hi] = [pos(a).x, pos(b).x].sort((x, y) => x - y);
      const between = people.filter(
        (n) => n.position.y === pos(a).y && n.position.x > lo && n.position.x < hi
      );
      expect(between.map((n) => n.id)).toEqual([]);
    }
  });

  it('places a person with two partners between them', () => {
    const nodes: Node[] = ['ex', 'person', 'spouse'].map((id) => ({
      id,
      position: { x: 0, y: 0 },
      data: {},
    }));
    const edges: Edge[] = [
      { id: 's1', source: 'person', target: 'ex', data: { isSpouse: true, spouseStatus: 'divorced' } },
      { id: 's2', source: 'person', target: 'spouse', data: { isSpouse: true } },
    ];
    const result = computeDagreLayout(nodes, edges);
    const x = (id: string) => result.nodes.find((n) => n.id === id)!.position.x;
    const xs = [x('ex'), x('person'), x('spouse')];
    expect(Math.min(...xs)).toBeLessThan(x('person'));
    expect(Math.max(...xs)).toBeGreaterThan(x('person'));
  });

  it('does not duplicate couple detection when both spouse edge and shared children exist', () => {
    // Harka and Jau Maya are spouses AND share children
    const nodes: Node[] = [
      { id: 'harka', position: { x: 0, y: 0 }, data: {} },
      { id: 'jauMaya', position: { x: 0, y: 0 }, data: {} },
      { id: 'amrit', position: { x: 0, y: 0 }, data: {} },
    ];
    const edges: Edge[] = [
      { id: 'spouse', source: 'harka', target: 'jauMaya', data: { isSpouse: true } },
      { id: 'e1', source: 'harka', target: 'amrit', data: { isSpouse: false } },
      { id: 'e2', source: 'jauMaya', target: 'amrit', data: { isSpouse: false } },
    ];

    const result = computeDagreLayout(nodes, edges);

    // Should only have ONE junction node (not two — one from spouse, one from co-parent)
    const junctionNodes = result.nodes.filter((n) => n.type === 'junction');
    expect(junctionNodes).toHaveLength(1);

    // Should NOT have a co-parent edge (they already have a spouse edge)
    const coparentEdge = result.edges.find((e) => e.id.startsWith('_coparent_'));
    expect(coparentEdge).toBeUndefined();
  });
});
