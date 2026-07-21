---
title: common-collections
summary: Map/WeakMap utilities with default-value semantics (DefaultedMap, Counter, PathMap, multimaps) plus MobX-reactive computed variants
layer: reference
status: verified
tags: [package, common, collections]
canonical-for: []
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
code-anchors:
  - common/collections/src/defaulted-collections.ts:16  # DefaultedMap
  - common/collections/src/defaulted-collections.ts:34  # DefaultedWeakMap
  - common/collections/src/counter.ts:31                # Counter
  - common/collections/src/path-map.ts:108              # PathMap
  - common/collections/src/multimap.ts:22               # ArrayMultimap
  - common/collections/src/multimap.ts:56               # SetMultimap
  - common/collections/src/computed-collections.ts:24   # ComputedMap (/mobx subpath)
---

# common-collections

Package `@here.build/collections` — small `Map`/`WeakMap` subclasses that capture recurring
idioms once. The root barrel re-exports counter / defaulted / multimap / path-map
(`common/collections/src/index.ts:1`); the mobx-coupled computed variants ship under the `./mobx`
subpath (`common/collections/src/mobx.ts:1`, `common/collections/package.json:15`).

Term: [[glossary#crdt]] (PathMap is used in CRDT-adjacent indexing).

## Public API table

### Root (`@here.build/collections`)

| Export | Signature / shape | File:line |
|---|---|---|
| `DefaultedMap<K,V>` | `Map` whose `get(key)` inserts `factory(key)` on miss | `common/collections/src/defaulted-collections.ts:16` |
| `DefaultedWeakMap<K,V>` | same, over `WeakMap` (`K extends object`) | `common/collections/src/defaulted-collections.ts:34` |
| `Counter<K>` | `Map<K,number>`; `get` returns `0` (read is side-effect-free), `increment(key,by=1)`, `keysAtLeast(min)` | `common/collections/src/counter.ts:31` |
| `PathMap<K,V>` | tuple/set/scalar composite-key map over three tries; `get`/`set`/`has`/`getOrInsert`/`getOrInsertComputed`/`getCanonicalKey` | `common/collections/src/path-map.ts:108` |
| `PathMapKey`, `PathMapKeyElement` (types) | the composite key shapes | `common/collections/src/path-map.ts:32`, `:30` |
| `ArrayMultimap<K,V>` | `DefaultedMap<K, V[]>`; `append(key,value)` | `common/collections/src/multimap.ts:22` |
| `SetMultimap<K,V>` | `DefaultedMap<K, Set<V>>`; `add(key,value)` | `common/collections/src/multimap.ts:56` |

### `@here.build/collections/mobx`

| Export | Signature / shape | File:line |
|---|---|---|
| `ComputedMap<K,V>` | `Map`; `get(key)` memoizes a mobx `computed(() => generator(key))` | `common/collections/src/computed-collections.ts:24` |
| `ComputedWeakMap<K,V>` | same, over `WeakMap` | `common/collections/src/computed-collections.ts:4` |
| `ComputedUniformMap<K,V>` | dual weak/strong backing; routes object keys to a `WeakMap`, others to a `Map` | `common/collections/src/computed-collections.ts:44` |

## Key internals

- `DefaultedMap.get` inserts on miss, so reads have a side effect — distinct from `Counter`,
  whose `get` returns `0` without inserting (`common/collections/src/counter.ts:25`).
- `ArrayMultimap`/`SetMultimap` are thin `DefaultedMap` subclasses; the empty bucket springs
  into existence on first `append`/`add` (`common/collections/src/multimap.ts:30`, `:63`).
- `PathMap` keeps three trie roots — flat scalar, set, array — plus a `storedEntries`
  id→{key,node} index and key canonicalization (`common/collections/src/path-map.ts:109`, `:125`). Set keys are
  sorted, array keys frozen, on canonicalization (`common/collections/src/path-map.ts:130`).
- The mobx variants store an `IComputedValue<V>` under the key and call `.get()` on read, so
  the value tracks dependencies lazily (`common/collections/src/computed-collections.ts:17`).

## Invariants / notes

- mobx is a dependency only of the `./mobx` entry — the root barrel stays mobx-free
  (`common/collections/src/index.ts:1` vs `common/collections/src/mobx.ts:1`).
- `Counter.get` deliberately does not insert; only `increment` writes (`common/collections/src/counter.ts:25`).

## Tests

No `__tests__/` dir present in `src/` at this revision.

## Tasks

- None open against this package.
