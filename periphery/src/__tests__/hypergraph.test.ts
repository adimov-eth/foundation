/**
 * Hypergraph Tests
 *
 * Tests:
 * 1. Core DSL properties (laws)
 * 2. All 5 interpreters
 * 3. Composition patterns
 */

import { describe, it, expect } from 'vitest';
import {
  empty,
  vertex,
  edge,
  overlay,
  connect,
  vertices,
  edges,
  overlays,
  star,
  clique,
  foldHG,
  type HyperGraph,
} from '../hypergraph.js';
import {
  toAdjacency,
  toMetrics,
  toCycles,
  toPathChecker,
  hypergraphToDOT,
  hypergraphToAdjacency,
  hypergraphMetrics,
  type AdjacencyList,
} from '../algebras/hypergraph-interpreters.js';

describe('Hypergraph Core DSL', () => {
  it('empty is identity for overlay', () => {
    const v = vertex('a');

    const left = overlay(empty, v);
    const right = overlay(v, empty);

    // Should be structurally equal (both just have vertex 'a')
    const leftAdj = foldHG(toAdjacency)(left);
    const rightAdj = foldHG(toAdjacency)(right);
    const vAdj = foldHG(toAdjacency)(v);

    expect(leftAdj).toEqual(vAdj);
    expect(rightAdj).toEqual(vAdj);
  });

  it('overlay is commutative', () => {
    const a = vertex('a');
    const b = vertex('b');

    const ab = overlay(a, b);
    const ba = overlay(b, a);

    const abAdj = foldHG(toAdjacency)(ab);
    const baAdj = foldHG(toAdjacency)(ba);

    expect(abAdj).toEqual(baAdj);
  });

  it('overlay is associative', () => {
    const a = vertex('a');
    const b = vertex('b');
    const c = vertex('c');

    const abc1 = overlay(a, overlay(b, c));
    const abc2 = overlay(overlay(a, b), c);

    const adj1 = foldHG(toAdjacency)(abc1);
    const adj2 = foldHG(toAdjacency)(abc2);

    expect(adj1).toEqual(adj2);
  });

  it('overlay is idempotent', () => {
    const a = vertex('a');
    const aa = overlay(a, a);

    const aAdj = foldHG(toAdjacency)(a);
    const aaAdj = foldHG(toAdjacency)(aa);

    expect(aAdj).toEqual(aaAdj);
  });

  it('empty is identity for connect', () => {
    const v = vertex('a');

    const left = connect(empty, v);
    const right = connect(v, empty);

    const leftAdj = foldHG(toAdjacency)(left);
    const rightAdj = foldHG(toAdjacency)(right);
    const vAdj = foldHG(toAdjacency)(v);

    expect(leftAdj).toEqual(vAdj);
    expect(rightAdj).toEqual(vAdj);
  });

  it('connect is associative', () => {
    const a = vertex('a');
    const b = vertex('b');
    const c = vertex('c');

    const abc1 = connect(a, connect(b, c));
    const abc2 = connect(connect(a, b), c);

    const adj1 = foldHG(toAdjacency)(abc1);
    const adj2 = foldHG(toAdjacency)(abc2);

    expect(adj1).toEqual(adj2);
  });

  it('edge creates n-ary hyperedge', () => {
    const e = edge('a', 'b', 'c');
    const adj = foldHG(toAdjacency)(e);

    // Pairwise path: a→b, b→c (not all-to-all)
    expect(adj.get('a')?.has('b')).toBe(true);
    expect(adj.get('b')?.has('c')).toBe(true);
    expect(adj.get('c')?.size).toBe(0);  // c has no outgoing edges
  });
});

describe('Hypergraph Composition Helpers', () => {
  it('vertices creates overlay of multiple vertices', () => {
    const vs = vertices(['a', 'b', 'c']);
    const metrics = foldHG(toMetrics)(vs);

    expect(metrics.vertices.size).toBe(3);
    expect(metrics.edges).toBe(0);
  });

  it('edges creates overlay of multiple edges', () => {
    const es = edges([['a', 'b'], ['b', 'c']]);
    const adj = foldHG(toAdjacency)(es);

    expect(adj.get('a')?.has('b')).toBe(true);
    expect(adj.get('b')?.has('c')).toBe(true);
  });

  it('star creates hub pattern', () => {
    const s = star('hub', ['a', 'b', 'c']);
    const adj = foldHG(toAdjacency)(s);

    expect(adj.get('hub')?.has('a')).toBe(true);
    expect(adj.get('hub')?.has('b')).toBe(true);
    expect(adj.get('hub')?.has('c')).toBe(true);
  });

  it('clique creates fully connected graph', () => {
    const c = clique(['a', 'b', 'c']);
    const adj = foldHG(toAdjacency)(c);

    // All pairs connected
    expect(adj.get('a')?.has('b')).toBe(true);
    expect(adj.get('a')?.has('c')).toBe(true);
    expect(adj.get('b')?.has('c')).toBe(true);
  });
});

describe('ToAdjacency Interpreter', () => {
  it('interprets empty graph', () => {
    const adj = foldHG(toAdjacency)(empty);
    expect(adj.size).toBe(0);
  });

  it('interprets single vertex', () => {
    const adj = foldHG(toAdjacency)(vertex('a'));
    expect(adj.size).toBe(1);
    expect(adj.get('a')?.size).toBe(0);
  });

  it('interprets simple edge', () => {
    const adj = foldHG(toAdjacency)(edge('a', 'b'));
    expect(adj.get('a')?.has('b')).toBe(true);
  });

  it('interprets connect operation', () => {
    const left = vertices(['a', 'b']);
    const right = vertices(['c', 'd']);
    const g = connect(left, right);
    const adj = foldHG(toAdjacency)(g);

    // All left → all right
    expect(adj.get('a')?.has('c')).toBe(true);
    expect(adj.get('a')?.has('d')).toBe(true);
    expect(adj.get('b')?.has('c')).toBe(true);
    expect(adj.get('b')?.has('d')).toBe(true);
  });
});

describe('ToMetrics Interpreter', () => {
  it('counts vertices correctly', () => {
    const g = vertices(['a', 'b', 'c']);
    const metrics = foldHG(toMetrics)(g);
    expect(metrics.vertices.size).toBe(3);
  });

  it('counts edges correctly', () => {
    const g = edges([['a', 'b'], ['b', 'c']]);
    const metrics = foldHG(toMetrics)(g);
    expect(metrics.edges).toBe(2);
  });

  it('detects hyperedges', () => {
    const g = edge('a', 'b', 'c');  // 3-vertex hyperedge
    const metrics = foldHG(toMetrics)(g);
    expect(metrics.hyperEdges).toBe(1);
  });

  it('calculates density', () => {
    const g = clique(['a', 'b', 'c']);  // Fully connected (including self-loops)
    const metrics = foldHG(toMetrics)(g);
    // 3 vertices: connect creates 3*3=9 edges
    // Density = 9/(3*2) = 1.5 (includes self-loops)
    expect(metrics.density).toBe(1.5);
  });
});

describe('ToDOT Interpreter', () => {
  it('generates DOT for simple graph', () => {
    const g = edge('a', 'b');
    const dot = hypergraphToDOT(g);

    expect(dot).toContain('digraph');
    expect(dot).toContain('"a"');
    expect(dot).toContain('"b"');
  });

  it('handles hyperedges', () => {
    const g = edge('a', 'b', 'c');
    const dot = hypergraphToDOT(g);

    // Hyperedges rendered as pairwise: a->b, b->c
    expect(dot).toContain('"a" -> "b"');
    expect(dot).toContain('"b" -> "c"');
  });
});

describe('ToCycles Interpreter', () => {
  it('finds no cycles in DAG', () => {
    const g = edges([['a', 'b'], ['b', 'c']]);
    const cycles = toCycles(g);
    expect(cycles.length).toBe(0);
  });

  it('finds simple cycle', () => {
    const g = edges([['a', 'b'], ['b', 'c'], ['c', 'a']]);
    const cycles = toCycles(g);
    expect(cycles.length).toBeGreaterThan(0);

    // Check that 'a' appears in the cycle
    const hasCycle = cycles.some(cycle =>
      cycle.includes('a') && cycle.includes('b') && cycle.includes('c')
    );
    expect(hasCycle).toBe(true);
  });

  it('finds self-loop', () => {
    const g = edge('a', 'a');
    const adj = foldHG(toAdjacency)(g);
    // Self-loop should be detected (a points to itself in second position)
    // Actually, edge('a', 'a') with our semantics doesn't create self-loop
    // because it's v[0]->v[1], and both are 'a', but pairwise from i to i+1
    // Let's create explicit self-loop with connect
    const selfLoop = connect(vertex('a'), vertex('a'));
    const cycles = toCycles(selfLoop);
    expect(cycles.length).toBeGreaterThan(0);
  });
});

describe('ToPathChecker Interpreter', () => {
  it('finds direct path', () => {
    const g = edge('a', 'b');
    const hasPath = toPathChecker({ from: 'a', to: 'b' })(g);
    expect(hasPath).toBe(true);
  });

  it('finds transitive path', () => {
    const g = edges([['a', 'b'], ['b', 'c']]);
    const hasPath = toPathChecker({ from: 'a', to: 'c' })(g);
    expect(hasPath).toBe(true);
  });

  it('returns false for non-existent path', () => {
    const g = edge('a', 'b');
    const hasPath = toPathChecker({ from: 'b', to: 'a' })(g);
    expect(hasPath).toBe(false);
  });

  it('returns true for same vertex', () => {
    const g = vertex('a');
    const hasPath = toPathChecker({ from: 'a', to: 'a' })(g);
    expect(hasPath).toBe(true);
  });
});

describe('Complex Composition', () => {
  it('overlays multiple graphs', () => {
    const inheritance = edges([['Task', 'PlexusModel'], ['Team', 'PlexusModel']]);
    const calls = edges([['Task', 'Team'], ['Team', 'Task']]);
    const combined = overlay(inheritance, calls);

    const metrics = hypergraphMetrics(combined);
    expect(metrics.vertices.size).toBe(3);  // Task, Team, PlexusModel
    expect(metrics.edges).toBe(4);
  });

  it('connects inheritance to calls', () => {
    const models = vertices(['Task', 'Team']);
    const base = vertex('PlexusModel');
    const inheritance = connect(models, base);

    const adj = hypergraphToAdjacency(inheritance);
    expect(adj.get('Task')?.has('PlexusModel')).toBe(true);
    expect(adj.get('Team')?.has('PlexusModel')).toBe(true);
  });
});
