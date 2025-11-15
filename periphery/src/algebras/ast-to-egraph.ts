/**
 * AST to E-graph Conversion
 *
 * Catamorphism that builds E-graph from TypeScript AST
 * Enables semantic pattern detection via equality saturation
 */

import type { CodeAlg } from '../catamorphism.js';
import { EGraph, type EClassId } from '../egraph.js';
import { monoidAlg } from '../catamorphism.js';

/**
 * E-graph building result
 */
export type EGraphResult = {
  egraph: EGraph;
  roots: EClassId[]; // Root e-classes for top-level expressions
};

const emptyResult: EGraphResult = {
  egraph: new EGraph(),
  roots: [],
};

const combineResults = (a: EGraphResult, b: EGraphResult): EGraphResult => ({
  egraph: a.egraph, // Shared mutable egraph
  roots: [...a.roots, ...b.roots],
});

/**
 * Build E-graph from AST
 */
export const toEGraph: CodeAlg<EGraphResult> = monoidAlg(
  emptyResult,
  combineResults,
  {
    CallExpr: (target, args, typeArgs) => {
      const egraph = target.egraph;

      if (target.roots.length === 0 || args.length === 0) {
        return { egraph, roots: [] };
      }

      // Build call e-node
      const fnClass = target.roots[0];
      const argClasses = args.flatMap(a => a.roots);

      const callNode = egraph.add({
        op: 'Call',
        fn: fnClass,
        args: argClasses,
      });

      return { egraph, roots: [callNode] };
    },

    PropertyAccess: (obj, property) => {
      const egraph = obj.egraph;

      if (obj.roots.length === 0) {
        return { egraph, roots: [] };
      }

      const memberNode = egraph.add({
        op: 'Member',
        obj: obj.roots[0],
        prop: property,
      });

      return { egraph, roots: [memberNode] };
    },

    Identifier: (name) => {
      const egraph = new EGraph();
      const varNode = egraph.add({ op: 'Var', name });
      return { egraph, roots: [varNode] };
    },

    // Other cases just combine children
  }
);

/**
 * Extract method chains for pattern matching
 *
 * Specifically looks for .map().map(), .splice(), etc.
 */
export function extractMethodChains(result: EGraphResult): Array<{ chain: EClassId; pattern: string }> {
  const chains: Array<{ chain: EClassId; pattern: string }> = [];
  const { egraph } = result;

  for (const root of result.roots) {
    // Check if it's a call expression
    for (const node of egraph.getNodes(root)) {
      if (node.op === 'Call') {
        // Check if fn is a member access
        for (const fnNode of egraph.getNodes(node.fn)) {
          if (fnNode.op === 'Member') {
            // Found method call - check if it's a chain
            const pattern = detectChainPattern(egraph, root);
            if (pattern) {
              chains.push({ chain: root, pattern });
            }
          }
        }
      }
    }
  }

  return chains;
}

/**
 * Detect specific chain patterns
 */
function detectChainPattern(egraph: EGraph, eclass: EClassId): string | null {
  for (const node of egraph.getNodes(eclass)) {
    if (node.op === 'Call') {
      for (const fnNode of egraph.getNodes(node.fn)) {
        if (fnNode.op === 'Member') {
          const { prop } = fnNode;

          // Check for map().map() pattern
          if (prop === 'map') {
            for (const objNode of egraph.getNodes(fnNode.obj)) {
              if (objNode.op === 'Call') {
                for (const innerFn of egraph.getNodes(objNode.fn)) {
                  if (innerFn.op === 'Member' && innerFn.prop === 'map') {
                    return 'map-map-chain';
                  }
                }
              }
            }
          }

          // Check for splice pattern
          if (prop === 'splice') {
            return 'splice-operation';
          }

          // Check for indexOf().splice() pattern
          if (prop === 'splice' && node.args.length > 0) {
            for (const argNode of egraph.getNodes(node.args[0])) {
              if (argNode.op === 'Call') {
                for (const argFn of egraph.getNodes(argNode.fn)) {
                  if (argFn.op === 'Member' && argFn.prop === 'indexOf') {
                    return 'remove-by-value-pattern';
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  return null;
}

/**
 * Semantic pattern: Operational transformation
 *
 * Detects: item exists check → splice → insert elsewhere
 * Meaning: Move operation with uniqueness enforcement
 */
export type OperationalPattern = {
  type: 'operational-transformation';
  description: string;
  operations: string[];
  semantics: 'move' | 'remove-before-insert' | 'uniqueness-enforcement';
  confidence: number;
};

/**
 * Detect operational transformation patterns via e-graph saturation
 */
export function detectOperationalPatterns(result: EGraphResult): OperationalPattern[] {
  const patterns: OperationalPattern[] = [];
  const chains = extractMethodChains(result);

  for (const { pattern } of chains) {
    switch (pattern) {
      case 'remove-by-value-pattern':
        patterns.push({
          type: 'operational-transformation',
          description: 'Remove item by value using indexOf + splice',
          operations: ['indexOf', 'splice'],
          semantics: 'remove-before-insert',
          confidence: 0.9,
        });
        break;

      case 'map-map-chain':
        patterns.push({
          type: 'operational-transformation',
          description: 'Map fusion opportunity',
          operations: ['map', 'map'],
          semantics: 'uniqueness-enforcement',
          confidence: 0.7,
        });
        break;
    }
  }

  return patterns;
}
