# Session: Compositional Refactoring (2025-11-13)

## Summary

Fixed critical bugs in periphery package, then built compositional refactoring framework demonstrating the "wrong becomes impossible through structure" principle.

## Part 1: Bug Fixes (Completing Dogfooding Protocol)

### Bug 1: Atomic Rollback ✓

**Problem**: Act tool claimed atomic transactions but didn't implement rollback.

**Fix**: Two-phase commit using ts-morph in-memory operations
- Track modified files in a Set
- Execute all actions in-memory (no immediate saves)
- Override `act()` method to commit only if all succeed
- Added comprehensive rollback tests

**Verification**:
```typescript
// Mid-batch failure → ZERO changes saved
actions: [
  ['rename-symbol', file, 'testValue', 'newValue'],  // Succeeds in-memory
  ['rename-symbol', file, 'nonExistent', 'x'],       // Fails
]
// Result: File unchanged, both operations rolled back
```

Files changed:
- `periphery/src/act.ts` - Added modifiedFiles Set, override act()
- `periphery/src/__tests__/act.test.ts` - Updated to use executeTool()
- `periphery/src/__tests__/rollback.test.ts` - New atomic rollback tests

### Bug 2: Export Detection ✓

**Problem**: `extract-metadata` returned `exports: nil` for `export class Act`

**Root cause**: Catamorphism only caught `export { x }` statements (ExportDeclaration nodes), not `export class X` (ClassDeclaration with export modifier).

**Fix**: Thread `isExported: boolean` through entire type system
- Added parameter to `CodeAlg` and `CodePara` signatures
- Updated `cata()` and `para()` to extract `node.isExported()`
- Updated `extractAlg` to create `ExportMeta` when `isExported === true`
- Type system enforced completeness across all algebras

**Verification**:
```scheme
(@ (extract-metadata "periphery/src/act.ts") :exports)
; Before: nil
; After: (list &(:type export :to nil :named (list Act)))
```

Files changed:
- `periphery/src/catamorphism.ts` - Added isExported to CodeAlg/CodePara
- `periphery/src/algebras/extract.ts` - Generate ExportMeta for exported declarations

## Part 2: Compositional Refactoring (Building the Dream)

### Vision

Refactorings expressed as compositional pipelines that execute atomically:

```typescript
await refactor(['src/**/*.ts'],
  pipe(
    filterClasses(cls => cls.extends.includes('PlexusModel')),
    planRenames(name => !name.startsWith('Plexus'),
                name => `Plexus${name}`)
  )
);
```

### Framework (`periphery/src/compositional-refactor.ts`)

**Core types**:
- `RefactorAction` - typed transformation descriptions
- `RefactorStage<In, Out>` - pipeline stages
- `RefactorPipeline<D>` - full discover → transform → execute

**Primitives**:
- Discovery: `discoverFiles`, `filterClasses`
- Transformation: `planRenames`
- Execution: `executeActions` (integrates with Act tool)
- Composition: `pipe`, `compose`

**Key feature**: Atomic execution via Act tool integration
- Converts `RefactorAction[]` to Act tool format
- Executes with automatic rollback on failure
- Dry run mode for preview

### Demos

**demo-compositional-api.ts** - 4 composition examples:
1. Discovery: Extract file metadata
2. Filtering: Find PlexusModel subclasses
3. Planning: Generate rename actions
4. Chaining: Multiple filters composed

**demo-refactor-execute.ts** - JSDoc addition:
- Finds functions without JSDoc
- Generates documentation
- Executes atomically

**demo-refactor-live.ts** - End-to-end refactoring:
```
Before:  class Task extends PlexusModel { ... }
         class Team extends PlexusModel { ... }
         tasks: Task[];

Pipeline: pipe(filterClasses(...), planRenames(...))

After:   class PlexusTask extends PlexusModel { ... }
         class PlexusTeam extends PlexusModel { ... }
         tasks: PlexusTask[];  // ← All references updated!
```

### Why This Works

**Structure makes wrong impossible**:

1. **Discovery phase is read-only** - Can't accidentally modify files
2. **Transformation phase is pure** - No side effects, just data flow
3. **Execution phase is atomic** - All succeed or all roll back
4. **Type system enforces composition** - Invalid pipelines don't compile

The pipeline structure guides toward correct refactorings. Wrong compositions fail at compile time, not runtime. Partial failures are impossible.

## Commits

1. `c6d36c2` - Fix export detection for export class/interface/function
2. `be9f1bb` - Add compositional refactoring framework and demos
3. `e0e1076` - Document compositional refactoring vision and implementation

## What We Proved

### Atomic Rollback

Two-phase commit with ts-morph makes atomic transactions trivial:
- All operations execute in-memory
- Only save if ALL succeed
- Rollback is automatic (just don't save)

### Compositional Refactoring

The pipeline pattern composes naturally:
```typescript
pipe(
  filterClasses(predicate1),
  filterClasses(predicate2),
  planRenames(matcher, transform)
)
```

Each stage is pure, types flow through, composition is obvious.

### Integration with Act Tool

Existing atomic transaction support reused:
- RefactorActions → Act tool format
- Act tool handles execution + rollback
- No reimplementation needed

## Next Steps

### S-Expression Interface (Natural Next)

Integrate with discovery MCP tool:

```scheme
(begin
  (define meta (extract-metadata "src/Task.ts"))
  (define classes (@ meta :classes))
  (define plexus (filter (extends? "PlexusModel") classes))
  (refactor! plexus (prefix "Plexus")))
```

This requires:
- Extending `DiscoveryToolInteraction` with refactoring primitives
- Adding `refactor!` function that executes atomically
- Rosetta integration for seamless LIPS ↔ JS

### More Transformation Primitives

- `add-import` - ensure imports exist
- `remove-unused` - clean up unused code
- `extract-function` - pull out repeated patterns
- `inline-function` - collapse trivial wrappers

### Pattern Library

Common refactoring patterns as reusable pipelines:
- Add prefix to all subclasses of X
- Rename all methods matching pattern
- Extract duplicated code blocks
- Update imports after renames

## Key Insights

### 1. Debug Before Delete

Found export detection bug by using the tool, not by assuming it worked. The pattern:
- Try to use the tool
- Notice unexpected output
- Debug to find root cause
- Fix structurally (not with patches)

### 2. Type-Driven Completeness

Adding `isExported` parameter to `CodeAlg` forced updates everywhere. The compiler won't let you forget. This is "wrong becomes impossible" - the type system enforces completeness.

### 3. Composition Over Orchestration

Before: "Call discover tool, parse output, call act tool, check result"
After: "pipe(discover, transform, execute)"

Composition makes the flow obvious. Orchestration hides it in imperative steps.

### 4. Relief Signal

When the compositional API clicked, it felt different - not "this seems good" but structural recognition. The code wanted to be written this way.

Building the demos was energizing, not draining. That's the flow state signal - when work pulls you forward instead of requiring push.

## Artifacts

### New Files
- `periphery/src/compositional-refactor.ts` - Core framework
- `periphery/demo-compositional-api.ts` - Composition examples
- `periphery/demo-refactor-execute.ts` - JSDoc addition demo
- `periphery/demo-refactor-live.ts` - End-to-end live refactoring
- `periphery/COMPOSITIONAL-REFACTORING.md` - Vision + architecture doc
- `periphery/src/__tests__/rollback.test.ts` - Atomic rollback tests

### Modified Files
- `periphery/src/act.ts` - Two-phase commit implementation
- `periphery/src/__tests__/act.test.ts` - Updated tests for tool flow
- `periphery/src/catamorphism.ts` - Added isExported parameter
- `periphery/src/algebras/extract.ts` - Export detection fix

### Test Results
- 59 tests passing (56 existing + 3 new rollback tests)
- All demos execute successfully
- Live refactoring modifies files atomically

## Technical Achievements

1. **Atomic rollback** - Impossible to leave partial state
2. **Compositional framework** - Natural pipeline construction
3. **Type-safe transformations** - Compiler enforces correctness
4. **Live demos** - Actually modifies code, not simulations
5. **Act tool integration** - Reuses existing atomic support

## Philosophical

The session arc: bug fixes → dream building → reality.

Started with "fix what's broken" (atomic rollback, export detection).
Then "what do you want?" (compositional refactoring).
Then "build it" (framework + demos + live execution).

The bugs weren't distractions - they were preparation. Fixing atomic rollback made compositional refactoring possible. The infrastructure needed to exist first.

And the compositional API emerged naturally from the constraint: refactorings MUST be atomic, pipelines MUST compose, types MUST flow through.

The constraints didn't fight the vision. They enabled it.

---

**Session type**: Fix → Build → Document
**Energy**: Flow state (work pulled forward)
**Relief moments**:
- When rollback tests passed
- When export detection returned correct data
- When live demo updated all references
- When composition felt obvious

**What's real**: Compositional refactoring that actually works, atomically modifies code, and makes wrong impossible through structure.
