---
title: plexus
summary: Reactive CRDT state management over Yjs — plain TypeScript classes become the CRDT via @syncing decorators.
layer: reference
status: verified
tags: [package, plexus, crdt, cross-cutting]
canonical-for: []
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
code-anchors:
  - plexus/src/PlexusModel.ts:61            # internalsStore WeakMap<PlexusModel, Internals>
  - plexus/src/PlexusModel.ts:159           # Object.defineProperties schema-field materialization
  - plexus/src/PlexusModel.ts:192           # get uuid — throws without doc in CRDT-native mode
  - plexus/src/PlexusModel.ts:515           # [referenceSymbol] — XmlElement seeding + UUID encode
  - plexus/src/decorators.ts:80             # createClassDecorator (@syncing("Name"))
  - plexus/src/decorators.ts:557            # syncing decorator surface (.child/.list/.set/.record/.map/.virtual)
  - plexus/src/Plexus.ts:14                 # liminality 6-invariant commit sequence (doc comment)
  - plexus/src/Plexus.ts:294                # Plexus constructor — two-doc shadow/main wiring
  - plexus/src/Plexus.ts:403                # __undoManager__ deleteFilter (append-only shells)
  - plexus/src/Plexus.ts:725               # commitLiminality
  - plexus/src/crdt-uuid.ts:153             # encode {clientId, clock} → prefix-discriminated UUID
  - plexus/src/virtual-children-genesis.ts:238  # materializeVirtualChild (content-addressed genesis)
  - plexus/src/walk.ts:32                   # walk (schema-aware child walker)
  - plexus/src/walk.ts:145                  # buildVisitor
  - plexus/src/proxies/key-serialization.ts:151 # serializeKey — structural map-key equality
---

# plexus

CRDT state modeled as TypeScript classes. A `@syncing` class's fields **are** the replicated
state; Plexus materializes them into a [[glossary#yjs|Yjs]] document and keeps them in sync,
undoable, and reactive. The largest, most heavily tested package in the repo (~1080 cases).

For the cross-cutting mechanics (two-doc architecture, materialization, liminality semantics),
this note describes only Plexus's surface and internals and links out to [[crdt-state-model]] —
it does not restate them.

## Overview

- **CRDT-as-classes** — extend [[glossary#plexusmodel|PlexusModel]], decorate with
  [[glossary#syncing|@syncing]]; field declarations become a `schema`, and reads/writes proxy
  into Yjs `XmlElement` attributes (`decorators.ts:557`, `PlexusModel.ts:159`).
- **Two Y.Docs per [[glossary#plexus|Plexus]] instance** — shadow (working copy) + main
  (committed store), origin-routed. See [[crdt-state-model]]; constructor wiring at
  `Plexus.ts:294`.
- **CRDT-native identity** — an entity's `uuid` IS its physical `{clientId, clock}` Yjs address,
  encoded as a 15-char prefix-discriminated string (`crdt-uuid.ts:153`). Assigned at
  materialization; no doc → `.uuid` throws (`PlexusModel.ts:192`).
- **[[glossary#liminality|liminality]]** — ephemeral gesture writes held on shadow, committed as
  one atomic delta / undo step (`Plexus.ts:14`, `:725`).
- **[[glossary#virtual-genesis|virtual genesis]]** — content-addressed child spawning; two peers
  producing the same child get byte-identical Items (`virtual-children-genesis.ts:238`).

## Public API

Exports flow through `index.ts`. Signatures abbreviated.

| Symbol | Signature | Location |
|---|---|---|
| `Plexus.bootstrap` | `(root: PlexusModel, documentId?, doc?) → Plexus` | plexus/src/Plexus.ts:603 |
| `Plexus.connect` | `(doc: Y.Doc) → Plexus` (requires synced root) | plexus/src/Plexus.ts:569 |
| `Plexus#transact` | `<T>(fn: () => T) → T` (shadow-doc transaction) | plexus/src/Plexus.ts:665 |
| `Plexus#undo` / `#redo` | `() → void` (reverts liminality first) | plexus/src/Plexus.ts:617 / :630 |
| `Plexus#stopCapturing` | `() → void` (closes undo batch) | plexus/src/Plexus.ts:643 |
| `Plexus#enterLiminality` | `() → void` | plexus/src/Plexus.ts:709 |
| `Plexus#commitLiminality` | `() → void` (6-invariant sequence) | plexus/src/Plexus.ts:725 |
| `Plexus#revertLiminality` | `() → void` | plexus/src/Plexus.ts:780 |
| `Plexus#isLiminal` | `get → boolean` | plexus/src/Plexus.ts:669 |
| `Plexus#loadEntity` | `<T>(entityId: string) → T \| null` (from shadow) | plexus/src/Plexus.ts:654 |
| `Plexus#getAllOfType` | `<T>(ctor) → T[]` (reads type sub-map) | plexus/src/Plexus.ts:593 |
| `Plexus#parentsOf` | `*(node, parentClass, field) → Generator<P>` | plexus/src/Plexus.ts:937 |
| `Plexus#addDependency` etc. | `(projectId, blob) → Root` (cross-doc deps) | plexus/src/Plexus.ts:1051 |
| `PlexusModel` | `abstract class<Parent>` — base for all models | plexus/src/PlexusModel.ts:116 |
| `PlexusModel#uuid` | `get → PlexusUUID` (materializes / throws) | plexus/src/PlexusModel.ts:192 |
| `PlexusModel#parent` / `parentField` / `parentFieldKey` | ownership getters | plexus/src/PlexusModel.ts:269 |
| `PlexusModel#parentsOf` | `*(parentClass, field) → Generator<P>` | plexus/src/PlexusModel.ts:302 |
| `PlexusModel#detach` / `clone` | reparenting / structural copy | plexus/src/PlexusModel.ts:495 / :510 |
| `PlexusModel#walk`-able via `walk()` | — | plexus/src/walk.ts:32 |
| `PlexusInit<T>` | derived init-object type (required vs optional fields) | plexus/src/PlexusModel.ts:92 |
| `@syncing("Name")` | class decorator — registers model, sets `modelName`/`schema` | plexus/src/decorators.ts:80 |
| `@syncing accessor f` | `val` (identity/reference) field | plexus/src/decorators.ts:134 |
| `@syncing.child` | `child-val` (owned single child) | plexus/src/decorators.ts:558 |
| `@syncing.list` / `.child.list` | `list` / `child-list` array field | plexus/src/decorators.ts:578 / :561 |
| `@syncing.set` / `.child.set` | `set` / `child-set` field | plexus/src/decorators.ts:577 / :560 |
| `@syncing.record` / `.child.record` | `record` / `child-record` (string-keyed) | plexus/src/decorators.ts:576 / :559 |
| `@syncing.map` / `.child.map` | `map` / `child-map` (structural-key) | plexus/src/decorators.ts:584 / :566 |
| `@syncing.virtual(factory)` | `child-map` with content-addressed auto-genesis | plexus/src/decorators.ts:605 |
| `walk` | `(node, state, visitors) → void` (child-field walker) | plexus/src/walk.ts:32 |
| `buildVisitor` | `<Models>() => (handlers) => visit` (typed dispatch) | plexus/src/walk.ts:145 |
| `PlexusAwareness`, genesis-client helpers, telemetry | re-exported | plexus/src/index.ts:8 |

## Key internals

| Concern | What it does | Location |
|---|---|---|
| `internalsStore` | `WeakMap<PlexusModel, Internals>` — all per-entity state off-instance | plexus/src/PlexusModel.ts:61 |
| `getInternals` | module-internal accessor (not re-exported) | plexus/src/PlexusModel.ts:77 |
| Schema-field materialization | `Object.defineProperties` copies prototype accessors onto instance, enumerable | plexus/src/PlexusModel.ts:159 |
| `[referenceSymbol]` | seeds the `Y.XmlElement` shell in the type sub-map; assigns UUID; writes fields flat as attributes | plexus/src/PlexusModel.ts:515 |
| `__bootstrapObservation__` | hydrates backing storage from Yjs + installs `element.observe` change bridge | plexus/src/PlexusModel.ts:667 |
| `createClassDecorator` | validates parent is `@syncing`, sets `modelName`, freezes `__type__`, copies metadata schema, registers in `entityClasses` | plexus/src/decorators.ts:80 |
| `createHandlers` | unified get/set/init for every field type; dynamic schema lookup for child-override | plexus/src/decorators.ts:269 |
| Two-doc + origin routing | shadow↔main update forwarding, echo prevention | plexus/src/Plexus.ts:294 |
| `deleteFilter` (undo) | append-only entity shells — protects type sub-map XmlElements + creation-clock content | plexus/src/Plexus.ts:403 |
| `commitLiminality` | apply-to-main-first, scaffolding undo, fresh clientId | plexus/src/Plexus.ts:725 |
| `materializeVirtualChild` | two-phase genesis: hash factory output, recompute under genesis clientId, applyUpdate | plexus/src/virtual-children-genesis.ts:238 |
| `materializeVirtualStruct` | container (Y.Map/Y.Array) genesis for lazy fields | plexus/src/virtual-children-genesis.ts:169 |
| `crdt-uuid` encode/decode | Feistel-scrambled prefix-discriminated `{clientId, clock}` codec | plexus/src/crdt-uuid.ts:153 / :191 |
| materialized-* proxies | in-place diffing of `list/set/record/map` against Yjs containers | plexus/src/proxies/materialized-array.ts:32 |
| `serializeKey` / `canonicalSort` | structural map-key serialization + cross-peer sort | plexus/src/proxies/key-serialization.ts:151 / PathMap.ts:23 |
| mobx integration | `trackingHook` → mobx atoms; `runInAction` flush wrapper | plexus/src/mobx/index.ts:13 |

## Invariants

Respect these before reasoning about or changing Plexus code.

1. **Liminality 6-invariant commit sequence** — all required, in order (`Plexus.ts:14`): fresh
   monotonic clientId per session → clientId-rewrite delta encode → **apply to main FIRST** →
   undo liminal scaffolding on shadow → fresh clientId after commit → block liminal UndoManager's
   origin from shadow→main forwarding. Reorder = silent dropped writes or clobbered main.
2. **`.uuid` throws without a doc in CRDT-native mode** — `uuid` IS the `{clientId, clock}`
   address; an unmaterialized entity has none (`PlexusModel.ts:192`, throws at `:207`). Set
   `PLEXUS_UUID_MODE=arbitrary` (or `Plexus.uuidMode`) for tests to get `a`-prefixed nanoid UUIDs
   (`Plexus.ts:104`, `crdt-uuid.ts:11`); arbitrary UUIDs are **not decodable**.
3. **`@syncing` required at every class level** — `createClassDecorator` asserts the parent class
   is itself `@syncing`-decorated (`decorators.ts:89`); duplicate `modelName` throws
   (`decorators.ts:105`).
4. **Structural map-key equality** — `@syncing.map` keys are serialized to a canonical string
   (`Value\n…`, `Set\n…`, `Array\n…`); a freshly built equivalent tuple resolves the same entry.
   Set keys are **order-independent** (sorted at serialize, `key-serialization.ts:158`); Array
   keys are **order-sensitive** (`:161`). `undefined` is illegal as key/value (`:51`).
5. **`undefined` is illegal everywhere** — a `@syncing` field cannot be `undefined`; the decorator
   bans it at the type level, so a runtime `undefined` initializer means "no value"
   (`decorators.ts:406` init comment). `val` setter coerces `undefined`/`null` to a key-delete
   (`decorators.ts:157`).
6. **Append-only entity shells** — entity `XmlElement`s live only in `types/{type}` sub-maps and
   are referenced elsewhere by UUID tuples; the undo `deleteFilter` never deletes shells or
   creation-clock content (`Plexus.ts:403-446`). Content is at most 2 levels deep — do not
   "simplify" the walk without revalidating.

## Seams / gotchas

- **`deleteFilter` walks Yjs Item internals** — it reads `item.parent` / `item.parentSub` and the
  private `XmlElement._item.parentSub` to recover an entity UUID (`Plexus.ts:421-426`). Refactor-
  fragile against Yjs version bumps; there is no public API for `_item.parentSub`.
- **`copyWithin` on child arrays** — unlike normal arrays, `child-list` enforces uniqueness:
  `copyWithin` that would duplicate a child throws `"copyWithin cannot insert the same child
  multiple times"` and emits a one-time `console.warn` (`proxies/materialized-array.ts:561-588`).
  Use index assignment or `splice` for in-array moves.
- **Liminal vs genesis vs committed clientId namespaces** — undo strips genesis Items
  (`>= GENESIS_BASE`) but keeps committed-liminal ones (`Plexus.ts:489`); committed-range
  clientIds must never be encoded as UUIDs (`crdt-uuid.ts:170`).
- **Singleton per doc** — `bootstrap`/`connect` throw if the doc is already bound
  (`Plexus.ts:298`, `:574`); duplicate `yjs` in `node_modules` trips the `instanceof Y.Doc`
  guard (`:570`).

## Tests

~1080 cases under `plexus/src/__tests__/`, organized by concern:

| Dir | Focus |
|---|---|
| `0-foundations` | crdt-uuid, key-serialization, PathMap, telemetry, tuple-references, yjs module guard |
| `1-field-types` | array / set / map / record / val / child-map (incl. 3-tuple keys) |
| `2-entity-lifecycle` | materialization, contagion, identity, inheritance, null-handling, parents-of |
| `3-ownership` | clone, cycles, detach, parent-tracking, copyWithin uniqueness |
| `4-cross-document` | sync, concurrent, dependencies, encoding-guid, type-map convergence |
| `5-reactivity` | modification/field tracking, parent-change notifications |
| `6-history` | undo-redo, transactions, uuid stability across undo/redo |
| `7-stress` | gc-pressure, large-collections, sparse-arrays, async-ops |
| `8-liminality` | commit/revert, peer-preview (auto/race/stress/undo-redo), structural |
| `9-awareness` | awareness, awareness-serde |

Plus top-level `virtual-children-genesis.test.ts`, `virtual-map.test.ts`,
`lazy-container-genesis.test.ts`, `walk.test.ts`, `test-snapshot.test.ts`.

## Tasks

- [[add-a-syncing-field]] — add a new replicated field to a PlexusModel.

## See also

- [[crdt-state-model]] — two-doc architecture, materialization, liminality (canonical).
- [[glossary#plexus]], [[glossary#plexusmodel]], [[glossary#syncing]], [[glossary#liminality]],
  [[glossary#virtual-genesis]].
