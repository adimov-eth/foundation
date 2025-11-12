/**
 * Hypergraph Interpreters - Five ways to interpret a hypergraph
 *
 * Each interpreter is a HyperGraphAlg<A> - a fold that produces type A.
 * One graph definition, multiple interpretations.
 */

import type { Vertex, HyperGraph, HyperGraphAlg } from '../hypergraph.js';
import { foldHG } from '../hypergraph.js';

/**
 * Adjacency List representation
 */
export type AdjacencyList = Map<Vertex, Set<Vertex>>;

/**
 * Interpreter 1: toAdjacency
 *
 * Converts hypergraph to adjacency list representation.
 * Executes the graph as a data structure.
 */
const toAdjacency: HyperGraphAlg<AdjacencyList> = {
  Empty: () => new Map(),

  Vertex: (v) => {
    const map = new Map<Vertex, Set<Vertex>>();
    map.set(v, new Set());
    return map;
  },

  Edge: (vs) => {
    const map = new Map<Vertex, Set<Vertex>>();

    // Pairwise connections: vs[0]→vs[1], vs[1]→vs[2], etc.
    for (let i = 0; i < vs.length; i++) {
      if (!map.has(vs[i])) {
        map.set(vs[i], new Set());
      }

      // Connect to next vertex
      if (i < vs.length - 1) {
        map.get(vs[i])!.add(vs[i + 1]);
      }
    }

    return map;
  },

  Overlay: (l, r) => {
    const result = new Map(l);

    // Merge r into result
    for (const [v, edges] of r.entries()) {
      if (result.has(v)) {
        // Union the edge sets
        const existing = result.get(v)!;
        for (const target of edges) {
          existing.add(target);
        }
      } else {
        result.set(v, new Set(edges));
      }
    }

    return result;
  },

  Connect: (l, r) => {
    // All vertices from l connect to all vertices from r
    const result = new Map<Vertex, Set<Vertex>>();

    const lVertices = Array.from(l.keys());
    const rVertices = Array.from(r.keys());

    // Add all l vertices with edges to all r vertices
    for (const lv of lVertices) {
      const targets = new Set(rVertices);
      // Also preserve existing l edges
      for (const edge of l.get(lv)!) {
        targets.add(edge);
      }
      result.set(lv, targets);
    }

    // Add all r vertices (preserving their edges)
    for (const rv of rVertices) {
      if (!result.has(rv)) {
        result.set(rv, new Set(r.get(rv)!));
      } else {
        // Merge r edges into existing
        const existing = result.get(rv)!;
        for (const edge of r.get(rv)!) {
          existing.add(edge);
        }
      }
    }

    return result;
  },
};

/**
 * Graph metrics
 */
export type Metrics = {
  vertices: Set<Vertex>;
  edges: number;
  hyperEdges: number;
  density: number;
};

/**
 * Interpreter 2: toMetrics
 *
 * Computes graph statistics.
 */
const toMetrics: HyperGraphAlg<Metrics> = {
  Empty: () => ({
    vertices: new Set(),
    edges: 0,
    hyperEdges: 0,
    density: 0,
  }),

  Vertex: (v) => ({
    vertices: new Set([v]),
    edges: 0,
    hyperEdges: 0,
    density: 0,
  }),

  Edge: (vs) => ({
    vertices: new Set(vs),
    edges: vs.length - 1,  // n vertices = n-1 edges (pairwise)
    hyperEdges: vs.length > 2 ? 1 : 0,  // Count as hyperedge if >2 vertices
    density: vs.length > 1 ? (vs.length - 1) / (vs.length * (vs.length - 1)) : 0,
  }),

  Overlay: (l, r) => {
    const vertices = new Set([...l.vertices, ...r.vertices]);
    const edges = l.edges + r.edges;
    const hyperEdges = l.hyperEdges + r.hyperEdges;
    const n = vertices.size;
    const density = n > 1 ? edges / (n * (n - 1)) : 0;

    return { vertices, edges, hyperEdges, density };
  },

  Connect: (l, r) => {
    const vertices = new Set([...l.vertices, ...r.vertices]);
    const crossEdges = l.vertices.size * r.vertices.size;
    const edges = l.edges + r.edges + crossEdges;
    const hyperEdges = l.hyperEdges + r.hyperEdges;
    const n = vertices.size;
    const density = n > 1 ? edges / (n * (n - 1)) : 0;

    return { vertices, edges, hyperEdges, density };
  },
};

/**
 * Interpreter 3: toDOT (private)
 *
 * Converts to Graphviz DOT format.
 * Made private to avoid name conflict with dependencies.ts toDOT.
 */
const toDOT: HyperGraphAlg<string> = {
  Empty: () => '',

  Vertex: (v) => `  "${v}";`,

  Edge: (vs) => {
    if (vs.length === 0) return '';
    if (vs.length === 1) return `  "${vs[0]}";`;

    // Pairwise edges: a→b, b→c
    const edgeStrs: string[] = [];
    for (let i = 0; i < vs.length - 1; i++) {
      edgeStrs.push(`  "${vs[i]}" -> "${vs[i + 1]}";`);
    }
    return edgeStrs.join('\n');
  },

  Overlay: (l, r) => {
    if (!l) return r;
    if (!r) return l;
    return l + '\n' + r;
  },

  Connect: (l, r) => {
    // Extract vertices from DOT strings
    const extractVertices = (dot: string): Set<string> => {
      const verts = new Set<string>();
      const vertexRe = /"([^"]+)"/g;
      let match;
      while ((match = vertexRe.exec(dot)) !== null) {
        verts.add(match[1]);
      }
      return verts;
    };

    const lVerts = extractVertices(l);
    const rVerts = extractVertices(r);

    const edges: string[] = [];
    for (const lv of lVerts) {
      for (const rv of rVerts) {
        edges.push(`  "${lv}" -> "${rv}";`);
      }
    }

    return [l, edges.join('\n'), r].filter(Boolean).join('\n');
  },
};

/**
 * Public wrapper for toDOT interpreter
 *
 * Wraps the DOT content in digraph {...}
 */
export const hypergraphToDOT = (hg: HyperGraph, graphName: string = 'G'): string => {
  const body = foldHG(toDOT)(hg);
  return `digraph ${graphName} {\n${body}\n}`;
};

/**
 * Public wrapper for toAdjacency interpreter
 */
export const hypergraphToAdjacency = (hg: HyperGraph): AdjacencyList => {
  return foldHG(toAdjacency)(hg);
};

/**
 * Public wrapper for toMetrics interpreter
 */
export const hypergraphMetrics = (hg: HyperGraph): Metrics => {
  return foldHG(toMetrics)(hg);
};

/**
 * Interpreter 4: toCycles
 *
 * Finds all cycles in the graph using DFS.
 */
export const toCycles = (hg: HyperGraph): Vertex[][] => {
  const adj = foldHG(toAdjacency)(hg);
  const cycles: Vertex[][] = [];
  const visited = new Set<Vertex>();
  const recStack = new Set<Vertex>();
  const path: Vertex[] = [];

  const dfs = (v: Vertex) => {
    visited.add(v);
    recStack.add(v);
    path.push(v);

    const neighbors = adj.get(v) || new Set();
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor);
      } else if (recStack.has(neighbor)) {
        // Found a cycle
        const cycleStart = path.indexOf(neighbor);
        const cycle = [...path.slice(cycleStart), neighbor];
        cycles.push(cycle);
      }
    }

    path.pop();
    recStack.delete(v);
  };

  for (const v of adj.keys()) {
    if (!visited.has(v)) {
      dfs(v);
    }
  }

  return cycles;
};

/**
 * Path query
 */
export type PathQuery = {
  from: Vertex;
  to: Vertex;
};

/**
 * Interpreter 5: toPathChecker
 *
 * Checks if a path exists between two vertices.
 * Returns a function that checks the specific query.
 */
export const toPathChecker = (query: PathQuery) => (hg: HyperGraph): boolean => {
  const adj = foldHG(toAdjacency)(hg);

  // BFS to check reachability
  const queue: Vertex[] = [query.from];
  const visited = new Set<Vertex>();

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current === query.to) {
      return true;
    }

    if (visited.has(current)) {
      continue;
    }

    visited.add(current);

    const neighbors = adj.get(current);
    if (neighbors) {
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          queue.push(neighbor);
        }
      }
    }
  }

  return false;
};

/**
 * Export commonly used interpreters
 */
export { toAdjacency, toMetrics };
