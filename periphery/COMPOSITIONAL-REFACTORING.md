# Compositional Refactoring

**Status**: Foundational framework complete, S-expression interface next

## Vision

Refactoring should feel like rearranging blocks that only fit together in valid ways.

```scheme
; Discovery → Transformation → Execution as single compositional thought
(refactor
  (find-classes "src/**/*.ts")
  (filter (extends? "PlexusModel"))
  (rename-all (prefix "Plexus")))
```

## What We Built

### 1. Compositional Framework (`src/compositional-refactor.ts`)

**Core abstractions**:
- `RefactorAction` - typed transformation descriptions
- `RefactorStage<In, Out>` - pipeline stages
- `pipe` / `compose` - compositional operators

**Discovery primitives**:
- `discoverFiles(paths)` - extract file metadata
- `filterClasses(predicate)` - filter by predicate
- `planRenames(matcher, transform)` - plan rename actions

**Execution**:
- `executeActions(actions, dryRun?)` - atomic execution via Act tool
- Dry run mode for preview
- Automatic rollback on failure

### 2. Live Demos

**demo-compositional-api.ts** - 4 demos showing composition:
1. Discovery: extract metadata
2. Filtering: find PlexusModel subclasses
3. Planning: generate rename actions
4. Chaining: multiple filters composed

**demo-refactor-live.ts** - End-to-end refactoring:
- Before: `class Task extends PlexusModel`
- Refactoring: `pipe(filterClasses(...), planRenames(...))`
- After: `class PlexusTask extends PlexusModel`
- **All references updated atomically** (`tasks: PlexusTask[]`)

**demo-refactor-execute.ts** - JSDoc addition:
- Finds functions without JSDoc
- Generates documentation
- Executes atomically

## Architecture

### Discover → Transform → Act

```typescript
// 1. Discovery phase (read-only)
const metadata = discoverFiles(['src/**/*.ts']);

// 2. Transformation phase (pure functions)
const filtered = filterClasses(cls => cls.extends.includes('PlexusModel'))(metadata);
const actions = planRenames(name => !name.startsWith('Plexus'),
                           name => `Plexus${name}`)(filtered);

// 3. Execution phase (atomic mutations)
await executeActions(actions);
```

### Compositional Operators

```typescript
// Pipe - left-to-right
const pipeline = pipe(
  filterClasses(cls => cls.extends.includes('PlexusModel')),
  filterClasses(cls => cls.methods.length < 3),
  planRenames(name => !name.startsWith('Simple'),
              name => `Simple${name}`)
);

// Compose - right-to-left
const transform = compose(
  planRenames(...),
  filterClasses(...)
);
```

### Atomic Execution

```typescript
// Dry run (preview)
await refactor(files, pipeline, { dryRun: true });

// Execute (atomic transaction)
await refactor(files, pipeline);
```

All actions execute in-memory via ts-morph, then commit atomically. If any action fails, ALL changes roll back.

## Integration with Act Tool

The `executeActions` function converts `RefactorAction[]` to Act tool format:

```typescript
const actActions = actions.map(action => {
  switch (action.type) {
    case 'rename-symbol':
      return ['rename-symbol', action.file, action.oldName, action.newName];
    // ... other cases
  }
});

const tool = new Act({}, {}, { actions: actActions });
const results = await tool.executeTool();
```

This gives us atomic transactions with automatic rollback on failure.

## What's Working

✓ Compositional API - pipe/compose operators for building pipelines
✓ Discovery primitives - extract metadata from TypeScript files
✓ Transformation primitives - filter, map, plan actions
✓ Atomic execution - all succeed or all roll back
✓ Dry run mode - preview without executing
✓ Integration with Act tool - leverages existing atomic transaction support
✓ Live demos - end-to-end refactorings that actually modify code

## Next: S-Expression Interface

The natural next step is S-expression interface integrated with the discovery tool:

```scheme
; Combines discovery + refactoring in single MCP tool
(begin
  (define meta (extract-metadata "src/Task.ts"))
  (define classes (@ meta :classes))
  (define plexus (filter (lambda (c) (member "PlexusModel" (@ c :extends))) classes))
  (refactor! plexus (prefix "Plexus")))
```

This requires:
1. Extending DiscoveryToolInteraction with refactoring primitives
2. Adding `refactor!` function that plans and executes atomically
3. Integrating with Act tool for atomic transactions

The infrastructure is ready - just needs the MCP integration layer.

## Examples

### Simple Rename

```typescript
await refactor(
  ['src/models.ts'],
  pipe(
    filterClasses(cls => cls.extends.includes('PlexusModel')),
    planRenames(
      name => !name.startsWith('Plexus'),
      name => `Plexus${name}`
    )
  )
);
```

### Chained Filters

```typescript
await refactor(
  ['src/**/*.ts'],
  pipe(
    filterClasses(cls => cls.extends.includes('PlexusModel')),
    filterClasses(cls => cls.methods.length < 3),
    planRenames(
      name => !name.startsWith('Simple'),
      name => `Simple${name}`
    )
  )
);
```

### Dry Run

```typescript
await refactor(files, pipeline, { dryRun: true });
// Prints planned actions without executing
```

## Why This Matters

**Compositional refactoring makes wrong impossible through structure**:

- Discover phase is read-only (can't accidentally modify)
- Transform phase is pure (can't cause side effects)
- Execute phase is atomic (can't leave partial state)
- Type system enforces composition (can't pass wrong types)

The pipeline structure guides you toward correct refactorings. Invalid compositions don't type-check. Partial failures roll back automatically.

This is the "wrong becomes impossible" principle applied to refactoring.
