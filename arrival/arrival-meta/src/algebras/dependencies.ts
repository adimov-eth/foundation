/**
 * Dependency Graph Algebra - builds module dependency graph
 *
 * Demonstrates:
 * - Graph construction as algebra
 * - Selective accumulation (only imports/exports matter)
 * - Later composition with hypergraph layer
 */

import type { CodeAlg } from '../catamorphism.js';
import { monoidAlg } from '../catamorphism.js';

/**
 * A dependency edge: from -> to
 */
export type Dependency = {
  from: string;  // Module name (file path)
  to: string;    // Imported module
  symbols: string[];  // What's imported
  isDefault: boolean;
};

/**
 * Dependency graph as adjacency list
 */
export type DependencyGraph = {
  edges: Dependency[];
  modules: Set<string>;
};

/**
 * Empty graph - monoid identity
 */
export const emptyGraph: DependencyGraph = {
  edges: [],
  modules: new Set(),
};

/**
 * Combine graphs - monoid operation
 */
export const combineGraphs = (
  a: DependencyGraph,
  b: DependencyGraph
): DependencyGraph => ({
  edges: [...a.edges, ...b.edges],
  modules: new Set([...a.modules, ...b.modules]),
});

/**
 * Dependency graph algebra
 *
 * Strategy:
 * - Only ImportDecl and ExportDecl produce edges
 * - Everything else just combines children
 * - Need current module context (passed separately)
 */
export const dependencyAlg = (
  currentModule: string
): CodeAlg<DependencyGraph> =>
  monoidAlg(emptyGraph, combineGraphs, {
    ImportDecl: (moduleSpecifier, namedImports, defaultImport) => {
      const symbols = [...namedImports];
      const isDefault = defaultImport !== null;
      if (isDefault && defaultImport) {
        symbols.push(defaultImport);
      }

      const edge: Dependency = {
        from: currentModule,
        to: moduleSpecifier,
        symbols,
        isDefault,
      };

      return {
        edges: [edge],
        modules: new Set([currentModule, moduleSpecifier]),
      };
    },

    ExportDecl: (moduleSpecifier, namedExports) => {
      if (!moduleSpecifier) {
        // Re-export from current module, no edge
        return emptyGraph;
      }

      const edge: Dependency = {
        from: moduleSpecifier,
        to: currentModule,
        symbols: namedExports,
        isDefault: false,
      };

      return {
        edges: [edge],
        modules: new Set([currentModule, moduleSpecifier]),
      };
    },
  });

/**
 * Utility: Get all dependencies of a module
 */
export const getDependencies = (
  graph: DependencyGraph,
  module: string
): string[] => {
  return graph.edges
    .filter(e => e.from === module)
    .map(e => e.to);
};

/**
 * Utility: Get all dependents of a module (reverse dependencies)
 */
export const getDependents = (
  graph: DependencyGraph,
  module: string
): string[] => {
  return graph.edges
    .filter(e => e.to === module)
    .map(e => e.from);
};

/**
 * Utility: Find circular dependencies
 *
 * Returns groups of modules that form cycles
 */
export const findCycles = (
  graph: DependencyGraph
): string[][] => {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const path = new Set<string>();

  const dfs = (module: string, currentPath: string[]) => {
    if (path.has(module)) {
      // Found cycle
      const cycleStart = currentPath.indexOf(module);
      const cycle = currentPath.slice(cycleStart);
      cycles.push([...cycle, module]);
      return;
    }

    if (visited.has(module)) {
      return;
    }

    visited.add(module);
    path.add(module);

    const deps = getDependencies(graph, module);
    for (const dep of deps) {
      dfs(dep, [...currentPath, module]);
    }

    path.delete(module);
  };

  for (const module of graph.modules) {
    if (!visited.has(module)) {
      dfs(module, []);
    }
  }

  return cycles;
};

/**
 * Utility: Topological sort (returns modules in dependency order)
 *
 * Returns null if graph has cycles
 */
export const topologicalSort = (
  graph: DependencyGraph
): string[] | null => {
  const cycles = findCycles(graph);
  if (cycles.length > 0) {
    return null;  // Graph has cycles
  }

  const inDegree = new Map<string, number>();
  for (const module of graph.modules) {
    inDegree.set(module, 0);
  }

  for (const edge of graph.edges) {
    inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
  }

  const queue: string[] = [];
  for (const [module, degree] of inDegree) {
    if (degree === 0) {
      queue.push(module);
    }
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const module = queue.shift()!;
    sorted.push(module);

    const deps = getDependencies(graph, module);
    for (const dep of deps) {
      const degree = inDegree.get(dep)! - 1;
      inDegree.set(dep, degree);
      if (degree === 0) {
        queue.push(dep);
      }
    }
  }

  return sorted.length === graph.modules.size ? sorted : null;
};

/**
 * Utility: Convert to DOT format for visualization
 */
export const toDOT = (graph: DependencyGraph): string => {
  const lines: string[] = ['digraph Dependencies {'];

  for (const edge of graph.edges) {
    const symbols = edge.symbols.length > 0
      ? ` [label="${edge.symbols.join(', ')}"]`
      : '';
    lines.push(`  "${edge.from}" -> "${edge.to}"${symbols};`);
  }

  lines.push('}');
  return lines.join('\n');
};
