# Refactoring Patterns

Reusable S-expression refactoring patterns for common code improvements.

## Files

### naming-conventions.scm

**Patterns**:
- `normalize-plexus-names` - Add "Plexus" prefix to PlexusModel subclasses
- `fix-generic-names` - Replace generic names (Model, Base, Manager) with descriptive ones
- `normalize-test-names` - Ensure test classes end with "Test"
- `normalize-interface-names` - Ensure interfaces start with "I"
- `fix-all-names` - Compose all naming fixes

**Example**:
```scheme
(normalize-plexus-names "src/models.ts")
; Task → PlexusTask (if Task extends PlexusModel)
```

### complexity-reduction.scm

**Patterns**:
- `find-complex-classes` - Identify classes with >N methods
- `complexity-report` - AST metrics for a file
- `analyze-codebase` - Compare complexity across files
- `find-data-classes` - Find classes with no methods (type candidates)
- `find-single-method-classes` - Find over-abstracted classes
- `mark-for-review` - Tag complex classes for refactoring

**Example**:
```scheme
(find-complex-classes "src/huge-file.ts" 10)
; Returns: ((HugeClass 15 "src/huge-file.ts"))
; Class has 15 methods, exceeds threshold of 10
```

## Usage

Load patterns via MCP discover tool:

```scheme
; Load pattern
(define (normalize-plexus-names file) ...)

; Apply to your code
(normalize-plexus-names "src/models.ts")
```

## Composition

Patterns compose naturally:

```scheme
; Fix all naming issues
(define (cleanup-file file)
  (list
    (normalize-plexus-names file)
    (normalize-test-names file)
    (mark-for-review file 15 "ToSplit")))

(cleanup-file "src/models.ts")
```

## Verified Metrics

From explorations on periphery codebase:
- Discover class: 6 methods (reasonable)
- Act class: methods TBD
- Test files: 601-2078 AST nodes
- No circular dependencies

## Next Patterns

- **dependency-cleanup.scm** - Remove unused imports, consolidate dependencies
- **pattern-based.scm** - Refactor based on AST patterns (emancipate calls, etc.)
- **cross-file.scm** - Atomic refactoring across multiple files
- **type-safety.scm** - Add missing type annotations, fix `any` usage

## Philosophy

Each pattern is:
- **Pure** - No side effects until `refactor!` called
- **Composable** - Patterns combine naturally via Scheme functions
- **Atomic** - All changes succeed or all roll back
- **Discoverable** - Results visible before execution

This is refactoring as data transformation, not imperative edits.
