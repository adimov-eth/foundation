---
title: common-lexical-namer
layer: reference
status: verified
tags: [package, common, naming]
canonical-for: []
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
code-anchors:
  - common/lexical-namer/src/index.ts:1008   # assignNames (flat pool)
  - common/lexical-namer/src/index.ts:384     # resolveLexicalNames (scope tree)
  - common/lexical-namer/src/index.ts:38      # ScopeSpec
  - common/lexical-namer/src/index.ts:99      # ScopedEntity
  - common/lexical-namer/src/index.ts:282     # onTie: burn | free | postfix
  - common/lexical-namer/src/index.ts:506     # onTie default = "burn"
---

# common-lexical-namer

Package `@here.build/lexical-namer` — priority-based, lexically-scope-aware name assignment.
The caller maps domain entities to opaque keys and supplies prioritized candidate ladders; this
module owns the resolution (`common/lexical-namer/src/index.ts:25`). Two public APIs over one core
algorithm.

Term: [[glossary#s-expression]] (used to name generated JS identifiers in projections).

## Public API table

| Export | Signature / shape | File:line |
|---|---|---|
| `resolveLexicalNames<E>` | `(spec: ScopeSpec<E>, options?: ResolveOptions<E>) → ResolveResult<E>` — scope tree | `common/lexical-namer/src/index.ts:384` |
| `assignNames<E>` | `(options: AssignNamesOptions<E>) → AssignNamesResult<E>` — flat pool | `common/lexical-namer/src/index.ts:1008` |
| `ScopeSpec<E>` (type) | a scope-tree node (id, entities, child scopes) | `common/lexical-namer/src/index.ts:38` |
| `ScopedEntity<E>` (type) | an entity with prioritized candidates inside a scope | `common/lexical-namer/src/index.ts:99` |
| `Candidate`, `ViaPath` (types) | a name candidate (string or path-derived) | `common/lexical-namer/src/index.ts:148`, `:162` |
| `Shape<E>`, `ShapeBinding<E>`, `FacetExpr<E>` (types) | multi-binding candidate shapes | `common/lexical-namer/src/index.ts:178`, `:202`, `:232` |
| `ResolveOptions<E>`, `ResolveResult<E>`, `EntityResolution<E>` (types) | resolver options / result | `common/lexical-namer/src/index.ts:237`, `:297`, `:331` |
| `PrioritizedCandidate`, `AssignNamesOptions<E>`, `AssignNamesResult<E>` (types) | flat-pool I/O | `common/lexical-namer/src/index.ts:885`, `:892`, `:934` |

## Key internals

- **One algorithm.** `assignNames` is a thin adapter — it builds a single childless root scope
  and delegates to `resolveLexicalNames`, so there is exactly ONE resolver to reason about
  (`common/lexical-namer/src/index.ts:19`).
- **Priority ladders.** Each entity emits a `Record<priority, Candidate>` ladder; higher key =
  higher priority. The resolver picks the highest-priority candidate that allocates without
  collision, descending the ladder on conflict (`common/lexical-namer/src/index.ts:103`).
- **Scope visibility.** Reservations and assigned names propagate down the parent chain but not
  to siblings — a descendant cannot reuse an ancestor's name; two disjoint sibling scopes can
  independently assign the same name (`common/lexical-namer/src/index.ts:34`).
- **`onTie` policy ladder** (`common/lexical-namer/src/index.ts:282`), default `"burn"` (`common/lexical-namer/src/index.ts:506`):
  - `"burn"` (default) — the bare name is off-limits to all lower-importance entities; a tied
    entity with a lower candidate descends to it instead of postfixing immediately.
  - `"free"` — like `"burn"` but the bare name stays claimable by lower-importance entities.
  - `"postfix"` — burn the bare name AND symmetric-postfix all tied entities at the tied tier.
    This is `assignNames`' policy (the CSS-class case, where the tied name is the identity to
    keep) — `common/lexical-namer/src/index.ts:21`.
- **Deterministic tie-break.** A tied group is resolved with a per-entity `postfixFor` and an
  optional `resolveTie` combiner (default `${name}-${postfix}`, CSS-friendly; JS use takes
  `${name}_${postfix}`) — `common/lexical-namer/src/index.ts:239`, `:250`.

## Invariants / notes

- `postfixFor` MUST be deterministic — the resolver validates this on tied groups
  (`common/lexical-namer/src/index.ts:241`).
- Domain-agnostic: no coupling to JS/CSS specifics beyond the default `resolveTie` separator.

## Tests

`src/__tests__/`: `resolver.test.ts` (32), `assign-names.test.ts` (16), `examples.test.ts` (16),
`assign-names-invariants.test.ts` (12), `examples-destructure.test.ts` (10) — **86** `it`/`test`
cases at this revision (vitest). **(unverified vs brief)** — the authoring brief said "170 tests";
the working tree shows 86. Package is shipped and tested.

## Tasks

- None open. (Note the test-count discrepancy above if the 170 figure is load-bearing elsewhere.)
