/**
 * @here.build/arrival-meta
 *
 * Compositional codebase exploration via catamorphisms, e-graphs, and S-expressions.
 *
 * Phase 1: F-Algebras & Catamorphisms
 * - Generic fold over TypeScript AST
 * - 5 composable algebras: count, extract, patterns, dependencies, types
 * - Arrival Discovery tool integration
 * - S-expression composition
 *
 * Future: E-graphs, hypergraphs, tagless-final, algebraic effects
 * See: docs/vision/compositional-exploration.md
 */

// Core catamorphism
export { cata, monoidAlg, sum, flatten, type CodeAlg } from './catamorphism.js';

// Algebras
export * from './algebras/index.js';

// Discovery tool
export { CodeDiscovery } from './discovery-tool.js';
