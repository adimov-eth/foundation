---
title: Membrane (JS ↔ Scheme boundary)
layer: reference
status: in-review
tags: [reference, cross-cutting, arrival, membrane, security]
canonical-for: [membrane]
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
code-anchors:
  - arrival/arrival/src/membrane.ts:6          # WRAPPER (fromJS/toJS) + CODEC layers
  - arrival/arrival/src/membrane.ts:174        # jsToWrapper WeakMap identity cache
  - arrival/arrival/src/membrane.ts:185        # per-wrapper entryCaches WeakMap
  - arrival/arrival/src/interop-access.ts:4     # own-data-only read policy
  - arrival/arrival/src/interop-access.ts:41    # INTEROP_BOUNDARY (module-local symbol)
  - arrival/arrival/src/interop-access.ts:70    # BUILTIN_BOUNDARY_PROTOTYPES fencing
  - arrival/arrival/src/inference-env.ts:8      # host-reaching verbs deleted at source
  - arrival/arrival/README.md:8                 # 0.x sandbox-escape warning
---

# Membrane

Canonical home for the JS↔Scheme interop boundary — the `@` / `:key` access form, value wrappers,
and the security posture. Package surface in [[arrival]].

**Why:** see [[20-method/patterns/security-by-deletion]] (sandbox by removing host-reaching verbs
at source, not by a per-env block list). Terms: [[glossary#membrane]],
[[glossary#security-by-deletion]], [[glossary#rosetta]].

## Two layers

`arrival/arrival/src/membrane.ts:6`:

| Layer | API | What |
|---|---|---|
| WRAPPER | `fromJS` / `toJS` | general JS↔Scheme value crossing — thin (cljs-bean-style) wrappers for objects/functions; primitives pass through unwrapped. |
| CODEC | `Codec` / `Operator` | typed bidirectional converters at FFI boundaries. |

Identity is preserved by a `WeakMap` (Miller / Van Cutsem pattern): `jsToWrapper`
(`arrival/arrival/src/membrane.ts:174`) ensures the same JS object always yields the same wrapper;
a second per-wrapper `entryCaches` WeakMap (`arrival/arrival/src/membrane.ts:185`) memoizes member
access. Wrappers: `SchemeJSObject` / `SchemeJSFunction` / `SchemeJSArray` (`SchemeJSArray` is lazy,
O(1) creation, converting elements on access — `arrival/arrival/src/membrane.ts:148`).

## Own-data-only access policy

`readMember` (wrapping `accessMember`) exposes **own data members only**
(`arrival/arrival/src/interop-access.ts:4`): never the substrate's prototype machinery —
`constructor`, `__proto__`, built-in prototype methods, well-known symbols. Framing: this is the
`InteropLibrary.readMember` contract (a foreign object exposes its members, not its language's
internals — like Graal JS not reaching Java's `getClass()`), **not** primarily a guest sandbox.

- Blocked property names include `constructor` / `__proto__` / `prototype`
  (`arrival/arrival/src/interop-access.ts:6`).
- Built-in prototypes are always boundaries — `BUILTIN_BOUNDARY_PROTOTYPES` fences
  `Object/Array/Function/String/.../Promise/Error.prototype`
  (`arrival/arrival/src/interop-access.ts:70`).
- `INTEROP_BOUNDARY` is a **module-local** `Symbol("...")` (NOT `Symbol.for`) so sandbox code
  cannot forge or strip boundary markers (`arrival/arrival/src/interop-access.ts:41`).
- Arrival's own value-types opt their internals out via `@arrival.private` so e.g.
  `(@ a-string :__string__)` cannot reach them.

## Security-by-deletion

The inference env is built post-sweep with every host-reaching verb **deleted at source** —
`eval` / `load` / `set-obj!` / `set-special!` / `new` / `instanceof`
(`arrival/arrival/src/inference-env.ts:8`). This is stronger than a per-env block list and removes
the "two-env divergence" risk; the full env "leaks nothing host-reaching"
(`arrival/arrival/src/inference-env.ts:69`).

## Invariants

- Reads cross the membrane via `accessMember`; own data only, prototype chain stops at a boundary.
- The same JS object always maps to the same wrapper (WeakMap identity) — relied on for
  reference equality across the boundary.
- `INTEROP_BOUNDARY` must stay module-local; exporting it as a registry symbol would let guests
  forge markers.

## Caveat (security maturity)

The package README warns: *"version 0.x may be unsafe - use zero-trust environments only … Assume
the sandbox can be escaped"* (`arrival/arrival/README.md:8`). Treat the membrane as a correctness
boundary, not a hardened security perimeter, at this version. Design history:
[[40-history/membrane-design.archived]], [[40-history/sandbox-security-model.archived]].
