# Act Vision: Context as Specification

## The Insight (Plain Language)

Current way: "Here's a file, do stuff to it"
```
act("src/foo.ts", [rename("OldName", "NewName")])
```

V's way: "Here's a description of what to operate on, do stuff to it"
```
act(clone(findElement("my-component")), [rename("NewComponent")])
```

The difference: in V's model, `clone(findElement(...))` isn't executed first. It's a *specification* - a description that gets resolved during execution. The clone doesn't exist until the act runs.

## Why This Matters

**Problem 1: The Clone Problem**

Imperative (current):
```javascript
const original = findElement("Button");
const copy = clone(original);      // clone exists NOW
rename(copy, "ButtonV2");          // operate on it
moveTo(copy, container, 0);        // move it
```

What if `rename` fails? The clone already exists. Rollback is messy.

Declarative (V's vision):
```scheme
(act-on (clone (find-element "Button"))
  (rename "ButtonV2")
  (move-to container 0))
```

Nothing happens until the whole thing is validated. Clone, rename, move are a single atomic unit.

**Problem 2: Reference Stability**

Imperative:
```javascript
const el = findElement("Button");
moveTo(el, newParent, 0);          // el's path changed!
setAttribute(el, "key", "value");  // does this still work?
```

After `moveTo`, where is `el`? Its file path changed. Its parent changed. Is your reference still valid?

Declarative:
```scheme
(act-on (find-element "Button")
  (move-to new-parent 0)
  (set-attr "key" "value"))
```

The system tracks identity through transformations. You said "the Button element" - the system knows what you mean even after it moves.

**Problem 3: Composition**

Imperative - can't compose:
```javascript
function moveAndRename(el, parent, name) {
  moveTo(el, parent, 0);
  rename(el, name);
}
// What if I want to add more operations? Modify the function.
```

Declarative - operations are data:
```scheme
(define my-operations
  (list (move-to parent 0)
        (rename "NewName")))

(act-on target my-operations)

; Add more? Just append to the list
(act-on target (append my-operations (list (set-attr "x" "y"))))
```

## Step by Step: From Current to Vision

### Step 0: What We Have Now

**Discovery** (`periphery/src/discover.ts`):
- 17 functions exposed via MCP
- Returns data: counts, metadata, graphs
- S-expression queries in sandboxed Scheme
- Read-only, safe exploration

**Act** (`periphery/src/act.ts`):
- 4 actions: rename-symbol, add-import, remove-unused-imports, format-file
- File-path based targeting
- Atomic batching (all succeed or all fail)
- Uses ts-morph for AST manipulation

**Gap**: Discovery and Act don't talk to each other. Discovery returns JSON, Act expects file paths.

### Step 1: Entity References (not file paths)

Current:
```typescript
registerAction({
  name: 'rename-symbol',
  props: {
    filePath: z.string(),  // <-- file path
    oldName: z.string(),
    newName: z.string(),
  },
  handler: async (context, { filePath, oldName, newName }) => { ... }
});
```

Goal:
```typescript
registerAction({
  name: 'rename',
  props: {
    target: EntityRef,     // <-- entity reference
    newName: z.string(),
  },
  handler: async (context, { target, newName }) => { ... }
});
```

Where `EntityRef` is something like:
```typescript
type EntityRef =
  | { type: 'existing', path: string[] }           // path in model tree
  | { type: 'query', expr: SExpression }           // find via query
  | { type: 'derived', base: EntityRef, op: 'clone' | 'create' }  // generative
```

### Step 2: Context Resolution Phase

Before executing actions, resolve all entity references:

```
Input:
  context: clone(find-element "Button")
  actions: [rename "ButtonV2", move-to parent 0]

Resolution:
  1. Evaluate (find-element "Button") → existing entity at path ["components", "Button"]
  2. Mark context as "clone of entity at path X"
  3. Validate all actions against this context type

Execution (only if validation passes):
  1. Perform clone → new entity created
  2. Apply rename to new entity
  3. Apply move-to to new entity
  4. Commit all changes atomically
```

### Step 3: Plexus Integration

Why Plexus matters here:

**Identity**: Plexus models have stable identity via `PlexusModel`. Moving a component doesn't change what it *is*.

**Atomicity**: Plexus operations can be batched. Multiple mutations, single commit.

**Tree Invariants**: Plexus automatically handles parent/child relationships. Clone a node, Plexus knows it needs a new parent.

**Operational Transformation**: If two agents act simultaneously, Plexus resolves conflicts.

Connection point - Act becomes a Plexus operation layer:
```typescript
class PlexusAct extends ActionToolInteraction<PlexusContext> {
  // Context is a Plexus document/room, not a file path
  // Actions mutate Plexus models
  // Commit happens through Plexus sync
}
```

### Step 4: S-Expression Actions (not JSON)

Current MCP call:
```json
{
  "actions": [
    ["rename-symbol", "src/foo.ts", "OldName", "NewName"],
    ["add-import", "src/foo.ts", "./bar.js", ["Thing"], ""]
  ]
}
```

Goal - actions as S-expressions in same language as discovery:
```scheme
; Discovery
(define button (find-element "Button"))
(define container (find-element "MainLayout"))

; Act - same language, same session
(act-on (clone button)
  (rename "ButtonV2")
  (move-to container 0)
  (set-attr "variant" "primary"))
```

The boundary between discovery and action dissolves. It's all composition.

### Step 5: The Montessori Principle

Why keep discovery and action separate at all?

**Safety**: Discovery can't mutate. An agent exploring the codebase can't accidentally delete files.

**Learning**: You understand the structure before changing it. Exploration builds mental model.

**Validation**: Discovery results feed into action planning. "I found these 5 components that need updating" → batch action on all 5.

The separation isn't artificial - it's pedagogical. But the *language* is unified. S-expressions flow from discovery into action specifications.

## Concrete Next Steps

### Phase A: Entity References in Current Act

1. Add `EntityRef` type to act.ts
2. Add resolution phase before execution
3. Keep file-path as one case of EntityRef
4. Test with `{ type: 'query', expr: '(find-class "MyClass")' }`

### Phase B: Clone/Create Operations

1. Add `derived` EntityRef type
2. Implement clone resolution (creates temporary entity)
3. Implement rollback (delete temporary on failure)
4. Test with `(act-on (clone x) (rename "Y"))`

### Phase C: Plexus Connection

1. Create `PlexusActToolInteraction`
2. Context becomes Plexus document reference
3. Actions become Plexus model mutations
4. Atomic commit through Plexus sync layer

### Phase D: Unified S-Expression Session

1. Discovery session state persists across calls
2. Variables defined in discovery available to act
3. Single Scheme environment for exploration → transformation
4. `(act-on target actions)` as registered function in discovery

## The Destination

```scheme
; Single session, unified language

; Explore
(define components
  (filter (extends? "BaseComponent")
          (all-classes)))

(define needs-update
  (filter (uses-deprecated-api?)
          components))

; Transform
(for-each
  (lambda (c)
    (act-on c
      (rename (concat (name c) "V2"))
      (replace-api 'old-method 'new-method)))
  needs-update)

; Verify
(assert (empty? (filter (uses-deprecated-api?) (all-classes))))
```

Discovery, transformation, verification - same language, same session, composable throughout.

---

## Open Questions

1. **Scope**: Should this work on any Plexus model, or specifically on code/AST?

2. **Conflict Resolution**: What happens when two agents act on the same entity?

3. **Undo**: Should actions be reversible? (Plexus has history, but...)

4. **Permissions**: Can discovery session see things act session can't modify?

5. **Performance**: Resolution phase could be expensive for complex queries. Cache?

---

*"Discovery action is built on Montessori principles" - V*

The child explores the prepared environment safely. Then acts on what they discovered. The environment (Plexus) ensures actions are safe, atomic, reversible. The language (S-expressions) ensures thoughts compose naturally.
