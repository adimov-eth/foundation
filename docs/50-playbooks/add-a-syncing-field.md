---
title: Add a syncing field
layer: reference
status: verified
tags: [playbook, plexus, crdt]
canonical-for: []
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
code-anchors:
  - plexus/src/decorators.ts:557                 # @syncing decorator surface
  - plexus/src/PlexusModel.ts:92                 # PlexusInit<T> required/optional derivation
  - arrival/arrival-chain/src/program.ts:53      # real model with val + child-list + child-map + child fields
---

# Add a syncing field

Recipe for adding one replicated field to a [[glossary#PlexusModel|PlexusModel]]. A `@syncing`
field's value **is** CRDT state — see [[plexus]] for the API and [[crdt-state-model]] for the
mechanics. Use a real model as a template: `arrival/arrival-chain/src/program.ts:53`.

## 1. Pick the decorator

All field decorators live on `syncing` (`plexus/src/decorators.ts:557`). Two axes: **container
type** and **reference vs child** (`child-*` = exclusive ownership, walked by `walk()` and
emancipated on reparent; plain = a non-owning reference).

| Field shape | Reference | Child (owned) | Schema kind |
|---|---|---|---|
| scalar / single ref | `@syncing accessor f: T` | `@syncing.child accessor f: M \| null` | `val` / `child-val` |
| array | `@syncing.list accessor f: T[]` | `@syncing.child.list accessor f: M[]` | `list` / `child-list` |
| set | `@syncing.set accessor f: Set<T>` | `@syncing.child.set accessor f: Set<M>` | `set` / `child-set` |
| string-keyed record | `@syncing.record accessor f: Record<string,T>` | `@syncing.child.record accessor f: Record<string,M>` | `record` / `child-record` |
| structural-key map | `@syncing.map accessor f: Map<K,T>` | `@syncing.child.map accessor f: Map<K,M>` | `map` / `child-map` |
| auto-genesis child map | — | `@syncing.virtual(factory) accessor f: VirtualMap<K,M>` | `child-map` |

- Declared with the stage-3 **`accessor`** keyword — not a plain property.
- `@syncing.virtual(factory)` is assignment-blocked; entries auto-materialize on `.get(key)` via
  content-addressed [[glossary#virtual genesis|genesis]] (`plexus/src/decorators.ts:605`). Owner
  must be doc-connected; ephemeral `.get()` throws.
- The **class** must be `@syncing("Name")`-decorated, and so must every ancestor class — see
  Invariant 3 in [[plexus]].

## 2. Default value and nullability

```ts
@syncing("ArrivalChainProgram")
class Program extends PlexusModel<Project> {
  @syncing accessor source: string = "";        // val, required-ish (has default)
  @syncing.child accessor draft: Draft | null = null;  // child-val, nullable
  @syncing.child.list accessor versions: ProgramVersion[] = [];  // child-list
}
```

- Give an inline default; the decorator's `init()` reconciles
  `init[field] ?? child-default ?? parent-default` (`plexus/src/decorators.ts:406`).
- **`undefined` is illegal.** The decorator type bans it, so a runtime `undefined` is read as "no
  initializer." Use `null` for an empty `val`/`child-val`; collections default to empty
  (`[]` / `new Set()` / `{}` / `new Map()`).
- A `val`/`child-val` set to `undefined`/`null` deletes the Yjs key
  (`plexus/src/decorators.ts:157`) — i.e. `undefined → null` is coerced to absence.

## 3. Construction / `PlexusInit` shape

`new Model(init)` accepts a `PlexusInit<T>` (`plexus/src/PlexusModel.ts:92`):

- **Required** keys: non-nullable scalar (`val`/`child-val`) fields with no `null` in their type.
- **Optional** keys: collection fields and any field whose type includes `null`.
- Keys inherited from `PlexusModel` itself are excluded.

```ts
const v = new ProgramVersion({ source });          // arrival-chain/src/program.ts:64
program.versions.push(v);                            // attach → materializes + adopts
```

Mutate after construction through the normal getters/setters; writes go through the proxy into
Yjs (wrap multi-step edits in `plexus.transact(fn)` for one undo step).

## 4. Verify

- `new Model({...})` typechecks with the new field; required/optional matches expectation.
- Reading before doc-attach works for ephemeral models; `.uuid`/`@syncing.virtual.get()` need a
  doc (see [[plexus]] Invariants 2). For tests, `PLEXUS_UUID_MODE=arbitrary`.
- `child-*` field: confirm the value is emancipated from any prior parent on assignment, and that
  `walk()` visits it.
- Add a case under the matching `plexus/src/__tests__/1-field-types/` (or the owning package's
  model tests).

## See also

- [[plexus]] — full decorator surface, invariants, gotchas (`copyWithin`, structural map keys).
- [[crdt-state-model]] — how a field becomes replicated CRDT state.
