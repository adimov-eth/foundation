---
title: CRDT state model (shadow / main, liminality, materialization)
layer: reference
status: in-review
tags: [reference, cross-cutting, plexus, crdt]
canonical-for: [crdt-state-model, shadow-main-doc, liminality, materialization]
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
code-anchors:
  - plexus/src/Plexus.ts:4              # two Y.Docs: shadow working copy + main committed store
  - plexus/src/Plexus.ts:14            # 6 liminality-commit invariants
  - plexus/src/Plexus.ts:403           # __undoManager__ + deleteFilter undo strategy
  - plexus/src/Plexus.ts:448           # __liminalUndoManager__ (LIMINAL_ORIGIN, captureTimeout 0)
  - plexus/src/PlexusModel.ts:61       # internalsStore WeakMap<PlexusModel, Internals>
  - plexus/src/PlexusModel.ts:159      # Object.defineProperties materialization of schema fields
  - plexus/src/decorators.ts:80        # createClassDecorator (@syncing class decorator)
  - plexus/src/virtual-children-genesis.ts:28   # GENESIS_ORIGIN
  - plexus/src/proxies/materialized-array.ts:165 # in-place observer diffing
---

# CRDT state model

Canonical home for Plexus's two-Y.Doc architecture, liminality, materialization, and virtual
genesis. The package's own surface is in [[plexus]]; this note owns the mechanics.

**Why:** see [[20-method/patterns/batch-context-immutability]] (gesture writes held on a shadow,
committed as one atomic delta). Terms: [[glossary#crdt]], [[glossary#yjs]],
[[glossary#shadow-doc-main-doc]], [[glossary#liminality]], [[glossary#materialization]],
[[glossary#virtual-genesis]].

## Two-Y.Doc architecture

Each Plexus instance owns **two** `Y.Doc`s (`plexus/src/Plexus.ts:4`):

| Doc | Role |
|---|---|
| **shadow** | working copy. All entities bind here; reads and writes go through shadow. |
| **main** | committed store. Syncs to peers; receives forwarded writes from shadow. |

Origin-based routing controls what flows between docs (`plexus/src/Plexus.ts:8`):

| Origin | Behavior |
|---|---|
| `SHADOW_TO_MAIN` | normal entity write on shadow → forwarded to main; UndoManager tracks it. |
| `LIMINAL` | drag/scrub write → held on shadow, **not** forwarded. |
| `COMMIT_DELTA` | committed liminality → applied to main, forwarded to shadow. |
| `FROM_SHADOW` / `FROM_MAIN` | echo-prevention markers. |

## Liminality

Ephemeral gesture writes (drag, scrub) are held on the shadow doc and committed as one atomic
delta / undo step. The commit sequence has **6 required invariants** (`plexus/src/Plexus.ts:14`):

1. Fresh monotonic `clientId` per session (isolates liminal Items from prior writes).
2. ClientId rewrite → encode delta (reproduce the action under the committed namespace).
3. Apply to **main first** (forwarding propagates to shadow while scaffolding is intact).
4. Undo liminal Items on shadow (scaffolding removal — committed Items survive).
5. Fresh clientId after commit (prevents a clock gap on main).
6. Block the liminal UndoManager's origin from shadow→main forwarding (undo must not clobber main).

Two UndoManagers: the main `__undoManager__` tracks `SHADOW_TO_MAIN` + `COMMIT_DELTA`
(`plexus/src/Plexus.ts:403`); the `__liminalUndoManager__` tracks only `LIMINAL_ORIGIN` with
`captureTimeout: 0` (no batching) (`plexus/src/Plexus.ts:448`).

### deleteFilter undo strategy

`__undoManager__`'s `deleteFilter` (`plexus/src/Plexus.ts:407`) protects entity identity and
creation content from being reverted by undo:

- Entity shell in a type sub-map → **PROTECT** (never delete entity identity).
- Creation content inside a protected XmlElement → **PROTECT**, matched by
  `materializationClient` / `materializationClock` on the model's internals.
- Invariant relied on: entity content is **at most 2 levels deep** under its XmlElement
  (`plexus/src/Plexus.ts:417`) — do not flatten/deepen without revalidating.

## Materialization

A model's `@syncing` schema fields *are* the CRDT state. The `@syncing` class decorator
(`createClassDecorator`, `plexus/src/decorators.ts:80`) registers the model name, defines
`__type__`, and folds the field schema into `target.schema`. At construction, `PlexusModel`
walks `__schema__` and re-defines each field via `Object.defineProperties`
(`plexus/src/PlexusModel.ts:159`) so accessors back onto the Yjs layer (enumerable, configurable;
auto-corrects prop-vs-accessor declarations in children of synced elements).

Per-instance bookkeeping lives off-object in an `internalsStore`
`WeakMap<PlexusModel, Internals>` (`plexus/src/PlexusModel.ts:61`) — keeps the CRDT-backed
surface clean. Collection proxies apply **in-place diffing**: a remote-applied delta is reconciled
against the live proxy rather than rebuilt (`plexus/src/proxies/materialized-array.ts:165`, with
`materialized-{map,record,set}.ts` siblings).

## Virtual genesis

Content-addressed, deterministic spawning of conflict-free child entities under `GENESIS_ORIGIN`
(`plexus/src/virtual-children-genesis.ts:28`). Deterministic client ids mean two peers that spawn
"the same" child converge without conflict. Surface detail in [[plexus]].

## Invariants

- The shadow doc is the only bind target; reads/writes never go straight to main.
- All 6 liminality-commit steps are required and ordered; reordering breaks atomicity or leaves a
  clock gap.
- Entity content is at most 2 levels deep under its XmlElement (deleteFilter depends on it).
- `@syncing` fields are the source of truth; do not stash CRDT state outside the schema.

## Test coverage

~1080 tests in `plexus` (1083 `it`/`test` calls counted across `plexus/src/**/*.test.ts`,
2026-06-18).
