---
title: Ref Wiring via ComponentDataQuery (reconstructed — partial stub)
layer: history
status: in-review
tags: [history, reconstructed, plexus, crdt, stub, unrecoverable]
canonical-for: []
source-provenance:
  origin: docs/proposals/in-flight/ref-wiring-via-componentdataquery.md
  branch: lost — not in tree nor origin/tmp-6164624 Archive
  retrieved: reconstructed 2026-06-18
  authority: derived
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
code-anchors:
  - plexus/src/__tests__/2-entity-lifecycle/entity-keyed-map-references.test.ts:1   # the verification test, spec-mirroring header
  - plexus/src/__tests__/2-entity-lifecycle/entity-keyed-map-references.test.ts:81  # @syncing.map nodeRefs!: Map<Slot, Node|null> (the spec's one field)
  - plexus/src/__tests__/2-entity-lifecycle/entity-keyed-map-references.test.ts:180 # parentsOf finds owners by VALUE
  - plexus/src/__tests__/2-entity-lifecycle/entity-keyed-map-references.test.ts:244 # parentsOf does NOT match KEYs
  - plexus/src/__tests__/2-entity-lifecycle/entity-keyed-map-references.test.ts:264 # getAllOfType + .has(slot) workaround
---

> ⚠️ **RECONSTRUCTION — not the original.** The original `docs/proposals/in-flight/ref-wiring-via-componentdataquery.md` is lost everywhere (see [[dangling-doc-map]]). This note is reverse-engineered from the code it governed, anchored to `file:line`. Fidelity: **low — deliberately a partial stub.** `ComponentDataQuery` is an **external / closed-product concept that is not present in this extracted repo**; only a *verification test using stand-in entities* survives. This note records ONLY what that test + present Plexus code evidence. The product-side spec is **largely unrecoverable.**

# Ref Wiring via ComponentDataQuery (reconstructed — partial stub)

## Status: largely unrecoverable

The proposal governed a feature on a closed-product type, `ComponentDataQuery`, which **does not exist in this extracted [[plexus]] repo**. What survives is a single test, `entity-keyed-map-references.test.ts`, whose header explicitly explains it uses **stand-in entities** for the product types (`test.ts:8-14`):

```
Slot   ⇢ ArgSlot | ReturnSlot
Node   ⇢ TplNode
Query  ⇢ ComponentDataQuery
```

So everything below is the **Plexus capability the spec relied on**, pinned by the test — *not* the `ComponentDataQuery` design itself. The product names (`ArgSlot`, `ReturnSlot`, `TplNode`, `ComponentDataQuery`, and component "ref wiring" semantics) are referenced by the test header only and have no implementation here.

## The one field the spec added (per the test header)

The spec's sole change was a single field on `ComponentDataQuery` (`test.ts:4-7`):

```ts
@syncing.map accessor nodeRefs!: Map<ArgSlot | ReturnSlot, TplNode | null>
```

— a `@syncing.map` whose **key is an entity** and whose **value is a nullable entity reference** (reference-only, NOT a child — slots and nodes have their own owners, `test.ts:77-82`). The PR that lands it is called "PR-A" (`test.ts:53`).

## Plexus assumptions the spec rested on (what the test actually pins)

The test enumerates load-bearing assumptions A–H (`test.ts:15-52`); these *are* recoverable because they exercise present Plexus behavior:

- **A. Entity-keyed, nullable-valued `@syncing.map` works.** Accepts entity-key → entity-value and entity-key → `null`; set/delete/clear after creation (`test.ts:102-174`).
- **B. `parentsOf(node, Query, "nodeRefs")` finds owners by VALUE.** Plexus's `Plexus.ts` `case "map"` iterates only `.values()`, so reverse lookup works on values, dedups multi-key refs to the same node, and excludes null-valued entries (`test.ts:180-238`).
- **C. `parentsOf` does NOT match KEYs.** The negative space of B — confirming the upstream restriction the spec reacts to (`test.ts:244-258`).
- **D. The workaround for key-side lookup is `getAllOfType(Query)` + `q.nodeRefs.has(slot)`** (the spec's V2/V3, `test.ts:264-304`).
- **E. Null is first-class** = "wired but unbound"; `has(slot)` true while `get(slot)` is `null` (`test.ts:310-337`).
- **F. Detached value entities stay readable** — Plexus uses **append-only shells**: removing a node from its owner doesn't dematerialize it, so the ref still reads the same instance (spec L1: "Reads MAY return a detached TplNode reference; consumers null-check", `test.ts:343-385`).
- **G. A reference `@syncing.map` does NOT auto-orphan its values** (orphan cleanup runs only for `isChildField`), so the spec must do its **own stale-ref sweep** (`test.ts:391-422`).
- **H. CRDT convergence** — Y.Map LWW per key: distinct keys converge to the union; same-key concurrent writes converge to one canonical value; delete-vs-set converges with no half-state (`test.ts:428-515`).

These tie to [[crdt-state-model]] / [[plexus]]: `@syncing` / `@syncing.map` / `@syncing.child.list` decorators (`test.ts:58`, `:64-89`), `parentsOf`, `getAllOfType`, append-only shells, and Y.Map per-key LWW.

## What is NOT recoverable from code

- **`ComponentDataQuery` itself** — its full field set, what a "component data query" *is*, and how ref wiring binds args/returns to template nodes in the product. None of it is in this extraction.
- `ArgSlot` / `ReturnSlot` / `TplNode` types and their owners.
- The spec's "V1/V2/V3" verification clauses, "L1" read contract, and the validation-sweep design for stale refs (G) — referenced by the test but not implemented here.
- The PR-A landing plan beyond the single `nodeRefs` field.

This stub is intentionally short and honest: only the Plexus substrate behavior is reconstructible; the closed-product spec is not.

See also [[crdt-state-model]], [[plexus]].
