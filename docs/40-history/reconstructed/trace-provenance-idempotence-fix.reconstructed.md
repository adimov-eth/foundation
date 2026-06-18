---
title: Trace provenance idempotence fix — 2026-06-04 (reconstructed)
layer: history
status: in-review
tags: [history, reconstructed, arrival-provenance, provenance, performance]
canonical-for: []
source-provenance:
  origin: docs/working-proposals/trace-provenance-idempotence-fix-2026-06-04.md
  branch: lost — not in tree nor origin/tmp-6164624 Archive
  retrieved: reconstructed 2026-06-18
  authority: derived
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
code-anchors:
  - arrival/arrival-provenance/src/trace.ts:350      # the doc citation + absorption rationale
  - arrival/arrival-provenance/src/trace.ts:351       # fieldPoint() absorption impl
  - arrival/arrival-provenance/src/trace.ts:333        # fieldPointMeta registry
  - arrival/arrival-provenance/src/trace.ts:129        # where (:field x) mints field-points
  - arrival/arrival-chain/src/__tests__/provenance.test.ts:582   # idempotent re-projection regression tests
  - arrival/arrival-chain/src/__tests__/provenance-depth-bound.test.ts:1  # depth-bound gate (sibling fix)
---

> ⚠️ **RECONSTRUCTION — not the original.** The original `docs/working-proposals/trace-provenance-idempotence-fix-2026-06-04.md` is lost everywhere (see [[dangling-doc-map]]). This note is reverse-engineered from the code it governed, anchored to `file:line`. Fidelity: **medium** — it was a *working proposal* (a fix plan); the *problem, the fix, and the bound it restores* are pinned by the citing comment + two regression tests, but the proposal's deliberation, alternatives weighed, and rollout steps are **not recoverable from code**. It records what the doc *must have specified* given the implementation — not its original wording.

# Trace provenance idempotence fix — 2026-06-04 (reconstructed)

A working proposal that fixed a non-idempotent operation in the provenance field-point machinery. Cited at `arrival/arrival-provenance/src/trace.ts:350`, inside the `fieldPoint(origin, key)` doc-comment, as the source of the **absorption** rule.

## The problem — the one non-idempotent op in the provenance semiring

A field-point is minted by `EvalTrace.fieldPoint(origin, key)` when a keyword accessor `(:field x)` projects across the structured-output membrane (`trace.ts:129-141`, `trace.ts:333-360`). Before this fix, a nested re-projection `(:a (:b x))` minted `fieldPoint(fieldPoint(P, "b"), "a")` — a **fresh** synthetic id over an already-synthetic origin (`provenance.test.ts:583-588`). Minting a fresh id on every re-projection is the **one non-idempotent operation** in the provenance semiring (`trace.ts:347-348`).

Under loop accumulation it compounded **quadratically**: a single invocation carried **80,807** provenance members from ~1,800 invocations, blowing up the `fieldPointMeta` registry to ~80k entries (`trace.ts:348-349`, `provenance.test.ts:583-585`). That froze the chart — `O(n²)` field-point growth.

This is the same class of leak as the 2026-06-08 depth-accumulation heap dump (`provenance-depth-bound.test.ts:5-11`); the two fixes are siblings. This one bounds the *field-point registry*; the authoritative-forwarding fix bounds the *per-value set size*.

## The fix — absorb re-projection of a field-point

`fieldPoint(origin, key)` returns `origin` **unchanged** when `origin` is itself already a field-point (`trace.ts:351-352`):

```
fieldPoint(origin, key):
  if fieldPointMeta.has(origin): return origin   // ABSORB
  if (origin,key) already minted: return existing  // singleton per (origin,key)
  else mint a new id, record { origin, key }
```

Why it's sound (from the comment, `trace.ts:341-350`): a re-projection `(:a (:b x))` is a *deeper pluck within the same producer pin*. `resolvePoint` / `resolveOriginVia` already keep the **inner** key as the producer port and walk the chain to the base point, so the outer mint is observably a no-op. The pin stays the inner key (`provenance.test.ts:603-604`).

The mint is also a **singleton per `(origin, key)`** via `#fieldPointIds` (`trace.ts:334-336`, `trace.ts:353-357`), so the same pluck reuses one stable id across every fire — matching how Pair-identity collapses invocations.

## What "idempotent trace recording" means after the fix

Re-projecting a field-point is now a fixed point: `fieldPoint(fieldPoint(P, k), …) === fieldPoint(P, k)`. The registry is capped at **base-points × keys**, independent of loop depth or re-projection count — restoring "the semiring's free loop bound" (`trace.ts:349-350`).

## Regression tests that lock it in

`arrival/arrival-chain/src/__tests__/provenance.test.ts:582-615` ("field-point absorption (idempotent re-projection)"):

- `:590` — a field-point projected again returns *itself*, with no new registry entry; the pin stays the inner key (`:600-604`).
- `:607` — 1,000 successive re-projections of the same growing point yield a registry of size **1** (without absorption: ~1,000 ids) (`:610-613`).

The depth-bound gate `provenance-depth-bound.test.ts` is the sibling guard for the per-set-size side of the same family of leaks.

## Not recoverable from code

The proposal's framing, the alternatives considered (e.g. whether to GC stale field-points vs. absorb), and any migration/rollout notes are **not recoverable from code** — only the chosen rule and its tests survive.

## Cross-links

- [[provenance-model-reference.reconstructed]] — the field-point model this fix bounds.
- [[arrival-chain-spec.reconstructed]] — §5.3 field projection.
- [[provenance-model]] — living KB note.
- [[arrival-provenance]].
