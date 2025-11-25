
/**
 * @here.build/periphery
 *
 * Compositional codebase exploration via catamorphisms, e-graphs, and S-expressions.
 *
 * Phase 1: F-Algebras & Catamorphisms ✓
 * - Generic fold over TypeScript AST (catamorphism)
 * - Paramorphism for context-aware traversal
 * - 5 composable algebras: count, extract, patterns, dependencies, types
 * - S-expression composition
 *
 * Phase 3: Algebraic Hypergraphs ✓
 * - Free algebra DSL for graph construction
 * - 5 interpreters: Adjacency, DOT, Metrics, Cycles, PathExists
 * - AST → HyperGraph converters
 * - Compositional queries via overlay/connect
 *
 * Phase 6: Action Tool ✓
 * - Auto-discovery (workspace root, project paths)
 * - Atomic batch validation
 * - 4 actions: format, rename, add-import, remove-unused
 *
 * Future: E-graphs, tagless-final, algebraic effects
 * See: docs/vision/compositional-exploration.md
 */

// Core recursion schemes
export { cata, para, monoidAlg, sum, flatten, type CodeAlg, type CodePara } from './catamorphism.js';

// Hypergraph DSL
export * from './hypergraph.js';

// Algebras
export * from './algebras/index.js';

// Tools
export { Discover } from './discover.js';
export { Act } from './act.js';

// Entity-level Act (context-as-specification pattern)
export { EntityAct, InMemoryEntityStore, TaskAct } from './entity-act.js';
export { PlexusAct, PlexusResolver, InMemoryPlexusDoc, type PlexusLike, type PlexusDocLike } from './plexus-act.js';
