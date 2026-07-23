---
title: Speculative Evaluation — Promise Functor (reconstructed)
layer: history
status: in-review
tags: [history, reconstructed, arrival, evaluator, speculative, halfbaked, async]
canonical-for: []
source-provenance:
  origin: docs/working-proposals/speculative-evaluation-promise-functor-2026-06-05.md
  branch: lost — not in tree nor origin/tmp-6164624 Archive
  retrieved: reconstructed 2026-06-18
  authority: derived
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
code-anchors:
  - arrival/arrival/src/values/HalfBaked.ts:3      # cites this proposal; the speculative value
  - arrival/arrival/src/values/HalfBaked.ts:7       # motivating program
  - arrival/arrival/src/values/HalfBaked.ts:200     # decide(): give-up-safe early verdict
  - arrival/arrival/src/values/HalfBaked.ts:223     # force(): collapse to data-true value
  - arrival/arrival/src/bridge.ts:196               # cites this proposal; Tier-2 speculative compare
  - arrival/arrival/src/bridge.ts:169               # the numeric-op wrapper choke
  - arrival/arrival/src/bridge.ts:211               # verdictFor — soundness by interval containment
  - arrival/arrival/src/eval/evaluator.ts:34        # evaluator imports HalfBaked / is_half_baked
---

> ⚠️ **RECONSTRUCTION — not the original.** The original `docs/working-proposals/speculative-evaluation-promise-functor-2026-06-05.md` is lost everywhere (see [[dangling-doc-map]]). This note is reverse-engineered from the code it governed, anchored to `file:line`. Fidelity: **high** — the implementing files carry unusually dense design commentary. Rationale beyond what the code states (rejected designs, perf measurements) is **not recoverable from code**.
>
> **Post-snapshot outcome (added 2026-07-23; dated to the actual commits in
> `here-build/arrival` — see [[upstream-second-generation]]).** Everything below marked
> "(realized)" was true **as of this snapshot** — `HalfBaked.ts` and the `bridge.ts:194-262`
> hook were live, wired, and covered by dedicated tests (`half-baked.test.ts`,
> `speculative-eval.test.ts`). In later, private development the design was found unsound
> and formally killed:
>
> - **2026-06-25, `3e7e73eb`** — the hermetic-ctx migration surfaces the exact defect: a
>   `HalfBaked`/`AHalfBaked` carrier captures its *producing run's* live closures, so
>   ctx-on-the-value is "necessary but not sufficient." Eager `map`/`filter` forces to a
>   settled value before egress (fine); but with `speculate:true`, the carrier **escapes
>   the egress boundary still live** — "8 green [tests] characterize the hazard... 4 todo
>   spec force-on-egress" (the fix was speced, never built).
> - **2026-07-08, `6d89a703`** — *"AHalfBaked dissolved — speculation feature removed per
>   D2 KILL verdict."* Six clean steps, −910 net lines (the class, its dispatch plumbing,
>   the run-state flag, tests). Before killing it they grepped every downstream consumer —
>   **`chain`/`mcp`/`scheme`/`provenance`/`second-foundation`/`inhuman` — zero hits** — and
>   proved the removal behavior-neutral by diffing the full test-failure set against a
>   clean-HEAD worktree: byte-identical. The commit also notes the successor design
>   ("wireframe doc gains the motivating program as §8 acceptance criterion") — i.e. the
>   cardinality-narrowing capability HalfBaked chased is being rebuilt as a **static,
>   non-runtime-carrier mechanism** ("struct-fact wires") in `execution-plan-wireframe.md`,
>   not abandoned outright.
>
> Do not read "(realized)" below as a claim about current upstream state — it is accurate
> history of this snapshot's tree, superseded by the above two commits.

# Speculative Evaluation — Promise Functor (reconstructed)

A working proposal for **early-collapse (speculative) evaluation**: let an async fan-out reach a downstream decision *un-awaited*, and take a branch the instant the partial result makes the outcome certain — while promises are still outstanding. The realized seam is the `HalfBaked` value (`values/HalfBaked.ts`) plus a Tier-2 hook in the numeric-op wrapper (`bridge.ts:194-262`). Cross-link [[determinism-and-effects]], [[arrival]].

## The motivating program (realized, verbatim)

`HalfBaked.ts:5-14` records the driving example:

```scheme
(if (>= (length (filter (lambda (x) (> x 0)) items)) 2) ...alt... ...else...)
```

Today the evaluator awaits the **entire** filtered fan before `length` yields a number before `>=` decides the branch. The insight: `length` of a partially-settled filtered container **is not unknown — it is a narrowing interval** `[kept-so-far, kept-so-far + pending]`. The instant the lower bound reaches 2, `>= 2` is *certain*, and the branch is taken with promises still outstanding (`HalfBaked.ts:9-14`).

## `HalfBaked` as a promise functor (realized)

The proposal's title — "promise functor" — is made precise in the header: this is **`traverse` over a promise functor: 0..1 per edge, not 0..N** (`HalfBaked.ts:31-35`). Explicitly **not Rx**: each slot is a one-shot `Promise<SchemeValue[]>` settling once; no scheduler, no subscription, no backpressure. "The 'streaming' effect is a fan of one-shot promises settling at different times" (`HalfBaked.ts:32-35`).

`HalfBaked extends AValue` (`HalfBaked.ts:79`). One class, **two domains** (`HalfBaked.ts:69-83`):

- `"collection"` — an input-indexed fan of `Promise<SchemeValue[]>` slots; `force()`/`refine()` folds them to a `Pair` (`HalfBaked.ts:80-81`, `:223-238`).
- `"number"` — a narrowing integer interval derived from a collection's cardinality (what `length` returns); `force()` folds to a settled count (`HalfBaked.ts:82-83`, `:225-228`). Built via `toCardinalityNumber`, sharing the source fan's settle stream (`HalfBaked.ts:176-180`).

Per-slot **cardinality** drives the interval: `filter` slots are `[0,1]` until settled; `map`/`list` slots are `[1,1]` from birth (the value is unknown but the *count* is not). The length interval is the elementwise sum (`HalfBaked.ts:53-65`, `:151-165`).

## Why a value, not a sidecar WeakMap (realized)

Same reasoning as `AValue.provenance`: a WeakMap keyed by object identity snaps when any builtin produces a fresh value. The interval/cardinality summary **must travel WITH the value through application boundaries**, so `HalfBaked` is a real `AValue` subtype (`HalfBaked.ts:16-24`; premise mirrors [[boxing-track-plan.reconstructed]] / `AValue.ts:1-8`).

## Threading through evaluation — the force-on-unknown-boundary contract (realized)

The proposal's correctness backbone:

- `is_promise` reports **false** on a `HalfBaked` (it has no `then`), so `evaluateArgs` passes it through **un-awaited** (`HalfBaked.ts:21-23`).
- Any operator that does **not** understand it **FORCES** it: `force()` → await → collapse to a settled value. This is the **force-on-unknown-boundary contract** (`HalfBaked.ts:23-24`).
- `force()` is memoized (like `SchemePromise.force`) and idempotent, so forcing at two boundaries runs the fold once (`HalfBaked.ts:217-238`). `refine()` is an alias — "the operator's `refine` in the `{pipe, refine}` algebra" (`HalfBaked.ts:240-243`).

The benign `.then` per slot only updates the record and notifies listeners; it fires no Scheme work — settlement is driven by the already-dispatched slot promises, and the lattice merely OBSERVES status (`HalfBaked.ts:126-138`, `:140-149`).

## Three registers — R0 / R1b (realized)

The interval/cardinality summary is **register R1b: host-only, give-up-safe, Scheme-invisible** (`HalfBaked.ts:25-30`). Scheme never sees an interval; it only ever sees the collapsed value (**R0**). "Unknown" (`undefined` from `decide`) is always a legal answer — the optimizer falls back to forcing, "slower but never wrong" (`HalfBaked.ts:28-30`). Even `toJs` returns the interval only as host-debug, never to a Scheme program (`HalfBaked.ts:245-251`).

## Give-up-safe early decision — `decide` / `onSettle` (realized)

`decide(verdict)` returns a promise that resolves the instant `verdict(interval)` is defined — possibly with pending slots outstanding (the whole point). It checks once eagerly, then re-checks on each settle via `onSettle`; if the fan fully settles without a verdict, it resolves with the verdict of the collapsed point interval, which a correct verdict always decides (`HalfBaked.ts:192-215`, `:182-190`). Listeners register on the SOURCE so the collection and its derived number view share the stream (`HalfBaked.ts:186-190`, `:107`).

## The Tier-2 hook in the numeric wrapper (realized — `bridge.ts`)

`bridge.ts:194-197` cites this proposal directly. The integration:

- A `HalfBaked` reaches the numeric-op wrapper **only** for comparison ops marked `__speculate__`; the dispatch choke forces it for every other numeric op (`bridge.ts:169-189`). The speculative set is `{=, <, >, <=, >=}` (`bridge.ts:199-200`).
- If exactly one operand is a number-domain `HalfBaked` and the other a concrete number, `speculativeCompare` normalizes the interval to the left (via the `REFLECT` table) and asks `verdictFor` for an early-decision verdict, then returns `hb.decide(verdict)` — an early-decision promise, provenance-stamped to match the eager path (`bridge.ts:202-262`).
- If it cannot decide (both operands HalfBaked, undecidable interval, non-numeric operand), it **forces** the carrier(s) and runs the normal numeric path — "never wrong, just not early" (`bridge.ts:174-184`, `:246-257`).

### Soundness (realized — `verdictFor`)

`verdictFor(op, k)` (`bridge.ts:205-226`) returns a definite boolean only when the interval lies **entirely** on one side of `k`, so the answer cannot change as the interval narrows. E.g. `>=`: `iv.lo >= k → true`; `iv.hi < k → false`; else `undefined` (keep waiting) (`bridge.ts:213-214`). `=` requires a collapsed point interval equal to `k` for `true` (`bridge.ts:221-222`). The header states this is "sound by construction" (`bridge.ts:205-209`).

## The collapse — `force()` folds (realized)

Collection: `Promise.all(slots)` then flatten → `Pair` (via `arrayToPair`, carrying provenance) (`HalfBaked.ts:229-238`, `:262-265`). Number: the source collection's settled count via `pairLength` (`HalfBaked.ts:225-228`, `:267-271`). A rejected slot contributes nothing to cardinality and surfaces when `force()` awaits it; the record is still settled so the interval still narrows (`HalfBaked.ts:133-135`).

## This is a notable seam (caller's note, confirmed)

The proposal sits exactly between async fan-out and synchronous-looking control flow: `is_promise` deliberately returns false so the un-awaited value escapes `evaluateArgs`, and only a small allow-list of comparison ops is allowed to read its interval (`bridge.ts:185-189`). Everything else is forced at its boundary. Misclassifying an op as `__speculate__` without a sound `verdictFor` entry would be the failure mode — but the realized set and verdict table are aligned.

## Plan-intent vs realized-code (honesty ledger)

- **Realized & verifiable**: HalfBaked dual-domain value, traverse-over-promise-functor framing, R0/R1b registers, force-on-unknown-boundary contract, `decide`/`onSettle`, the Tier-2 comparison hook, the sound `verdictFor` table, provenance preservation.
- **Status**: filed under `working-proposals/` — a proposal, but **fully implemented** in the tree (HalfBaked.ts + bridge.ts), so realized state is high-confidence.
- **Not recoverable from code**: the proposal's "Tier 1" (the header references "Tier 1" registers and `bridge.ts` calls this "Tier 2" — a Tier-1 stage is implied but its content/scope is not in these files), perf measurements, and any rejected designs (e.g. an Rx-style scheduler, explicitly rejected in spirit at `HalfBaked.ts:31-35` but the deliberation is not recorded).

## Cross-references

[[arrival]] · [[determinism-and-effects]] · [[provenance-model]] · [[language-design-foundations.reconstructed]] · [[boxing-track-plan.reconstructed]]
