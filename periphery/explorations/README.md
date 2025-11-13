# Explorations

S-expression queries demonstrating what compositional refactoring enables.

## Files

**plexus-analysis.scm** - Pattern analysis on Plexus codebase
- Find emancipate() calls
- Identify parent assignments
- Cross-reference patterns
- Hypergraph metrics

**cross-file-refactor.scm** - Cross-file refactoring patterns
- Load classes from multiple files
- Dependency analysis
- Complexity metrics
- Foundation for atomic cross-file refactoring

**real-world-refactor.scm** - Practical refactoring targets
- Test file analysis
- Demo file exploration
- Complexity metrics (AST node counts)
- Actual refactoring opportunities

## Usage

These are exploratory queries - copy/paste into the MCP tool to run.

Example:
```scheme
(begin
  (define patterns (find-patterns "plexus/plexus/src/PlexusModel.ts"))
  (filter (lambda (p) (eq? (@ p :type) "emancipate-call")) patterns))
```

## Insights So Far

- periphery/src/discover.ts: 335 AST nodes, 1 class (Discover)
- periphery/src/act.ts: 103 AST nodes, 1 class (Act)
- Test files range from 601-2078 nodes (rollback < act < hypergraph)
- Plexus has 3 emancipate calls, 5 parent assignments
- No circular dependencies in periphery (0 cycles found)
- 16 modules in discover.ts dependency graph

## Next

Build reusable refactoring patterns as Scheme functions that can be composed.
