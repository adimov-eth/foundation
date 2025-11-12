/**
 * Algebras - composable AST analyses
 *
 * All algebras follow the same pattern:
 * - Type: CodeAlg<A>
 * - Empty: A (monoid identity)
 * - Combine: (A, A) => A (monoid operation)
 *
 * This makes them composable and allows running multiple analyses in one pass.
 */

export * from './count.js';
export * from './extract.js';
export * from './patterns.js';
export * from './dependencies.js';
export * from './types.js';
export * from './hypergraph-interpreters.js';
export * from './ast-to-hypergraph.js';
