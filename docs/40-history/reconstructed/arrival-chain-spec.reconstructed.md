---
title: arrival-chain spec — §5 Propagation algebra (reconstructed)
layer: history
status: in-review
tags: [history, reconstructed, arrival-chain, provenance, crdt]
canonical-for: []
source-provenance:
  origin: docs/spec/arrival-chain.md
  branch: lost — not in tree nor origin/tmp-6164624 Archive
  retrieved: reconstructed 2026-06-18
  authority: derived
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
code-anchors:
  - arrival/arrival/src/values/AValue.ts:8        # citation: "Propagation algebra §5"
  - arrival/arrival/src/values/AValue.ts:95        # citation: "§5.1: distinct-by-reference, forward singleton, union ≥2"
  - arrival/arrival/src/index.ts:25                # citation: "Provenance algebra: docs/spec/arrival-chain.md §5"
  - arrival/arrival/src/values/AValue.ts:42         # provenance lives on the value
  - arrival/arrival/src/values/AValue.ts:96         # unionProvenance impl
  - arrival/arrival/src/values/AValue.ts:114        # pointProvenance(callId)
  - arrival/arrival/src/values/AValue.ts:66         # fromJs membrane
  - arrival/arrival-provenance/src/trace.ts:73       # computeProvenance §5
  - arrival/arrival-provenance/src/trace.ts:118      # §5.2 symbol flow
  - arrival/arrival-provenance/src/trace.ts:129      # §5.3 field projection
  - arrival/arrival-provenance/src/trace-to-chain.ts:56  # §5.3 element/field origin resolution
---

> ⚠️ **RECONSTRUCTION — not the original.** The original `docs/spec/arrival-chain.md` is lost everywhere (see [[dangling-doc-map]]). This note is reverse-engineered from the code it governed, anchored to `file:line`. Fidelity: **high for §5** (multiple code sites cite §5/§5.1/§5.2/§5.3 verbatim and implement them); **low for the rest of the spec** (the doc was the whole `arrival-chain` spec; only its provenance section §5 left citation fingerprints in code). It records what the doc *must have specified* given the implementation — not its original wording, nor rationale not evidenced in code.

# arrival-chain spec — §5 Propagation algebra (reconstructed)

The lost `docs/spec/arrival-chain.md` was the specification for the [[arrival-chain]] package. Only **§5, the provenance propagation algebra**, is recoverable: it is cited by name at four call sites, and the cited code implements its rules directly. Sections §1–§4 (and §6+) are **not recoverable from code** — no other section number is referenced anywhere in the tree.

## What §5 is — provenance on the value, not a sidecar

§5 specifies dataflow **provenance**: each runtime value carries the set of *provenance-point invocation ids* whose outputs flowed into it. The header comment that cites §5 records the load-bearing design decision:

- Provenance lives **on the value**, as `AValue.provenance: ReadonlySet<number>` (`arrival/arrival/src/values/AValue.ts:42`), not in a sidecar `WeakMap` keyed by object identity (`AValue.ts:1-6`). Rationale evidenced in code: a `WeakMap` "snaps" the instant any builtin mints a fresh value, and primitives can't key a `WeakMap` at all; on-value, a builtin can only forget to *propagate* (visible as an empty result set), never to *carry* (`AValue.ts:2-6`).
- `AValue` is immutable; a provenance update mints a new instance via `withProvenance(p)` (`AValue.ts:51-52`).
- Empty provenance is the shared `EMPTY_PROVENANCE` singleton (`AValue.ts:18`).
- The JS→Scheme membrane `AValue.fromJs(v, provenance)` stamps provenance at the boundary, with a same-instance fast path (`AValue.ts:66-80`).

See [[crdt-state-model]] / [[provenance-model]] for the living KB notes that descend from this.

## §5.1 — the core propagation rule (distinct-by-reference, forward singleton, union ≥2)

Cited verbatim at `AValue.ts:95` ("§5.1: distinct-by-reference, forward singleton, union ≥2") and implemented by `unionProvenance(args)` (`AValue.ts:96-112`):

1. **Distinct-by-reference dedup.** Collect each argument's non-empty provenance set into a `Set<ReadonlySet<number>>` keyed by *reference identity* (`AValue.ts:97-100`). So `(+ x x)` where both `x` resolve to the same producing invocation's set contribute **one** membership, not two.
2. **Empty → singleton.** Zero distinct sets ⇒ return `EMPTY_PROVENANCE` (`AValue.ts:102-103`).
3. **Forward-singleton no-copy fast path.** Exactly one distinct set ⇒ return *that same set object* unchanged (`AValue.ts:104-105`). Preserving reference identity is what makes rule (1) work downstream and is exploited by the authoritative-forwarding optimization (below).
4. **Union ≥2.** Two or more distinct sets ⇒ allocate a fresh merged `Set<number>` (`AValue.ts:106-110`).

A single point's provenance is minted by `pointProvenance(callId)` = `new Set([callId])` (`AValue.ts:114-116`).

## §5.2 — provenance flows through symbol/env bindings

Cited at `arrival/arrival-provenance/src/trace.ts:118` ("Per spec §5.2: provenance flows through env bindings via the resolved value's origin") and `:576` ("symbols don't carry provenance themselves; the producing invocation's provenance flows through them at resolve time").

Implementation: the evaluator's symbol-resolution tap `onSymbolResolved` reads provenance directly off the resolved `AValue` and accumulates it into the current invocation's lazily-allocated `symbolContributions` set (`trace.ts:561-580`). `computeProvenance` then folds `symbolContributions` alongside child-invocation provenance (`trace.ts:120-124`). A bare symbol therefore carries no provenance of its own; it conveys whatever the producing invocation stamped onto the value via `withProvenance`.

## §5.3 — field/element projection across the structured-output membrane

Cited at `trace.ts:129` ("§5.3 sibling") and `trace-to-chain.ts:56` ("a value read across the structured-output membrane … carries the FIELD-POINT that truncates to it"). Two related rules:

- **Field projection.** A keyword accessor `(:field x)` does not merely forward the producer's provenance — it **refines** each upstream point `P` into a synthetic **field-point** `(P, "field")` (`trace.ts:129-141`). The field-point is a plain `number` member of the provenance set, so it rides through `string-append`/binding like any point, but resolves back through `EvalTrace.fieldPointMeta` to `(producer cell, pin)` (`trace.ts:322-360`).
- **Element provenance.** `car`/`cdr` attribute to the specific fan-out producer, so a chained `(:verdict (car reactions))` qualifies `react[0]`'s point specifically (`trace.ts:135-136`).
- **Authoritative truncation.** A point's set and a field-projected set are marked **authoritative** (`trace.ts:140`, `markAuthoritativeProvenance` `trace.ts:380`). An authoritative set is the *complete* lineage of its value; upstream is reached by *following the link* (the field-point resolves to its producer), never by carrying the transitive closure. The forwarding boundary forwards an authoritative set unchanged rather than re-unioning (`trace.ts:105-107`). This is the depth-bound fix (see [[trace-provenance-idempotence-fix.reconstructed]] and the depth-bound regression gate `arrival/arrival-chain/src/__tests__/provenance-depth-bound.test.ts`).

## §5 — control-flow restriction

The §5 invocation-level summary (`trace.ts:165-172`) notes that control-flow forms (`if`/`cond`/`when`/`unless`/`case`) restrict provenance to *predicate + chosen-arm result*. Per `trace.ts:84-86` that restriction is enforced by the rosetta wrappers for those forms, **not** by `computeProvenance`, which applies the general union rule. So §5 specified the rule; its enforcement is split between the value algebra (`AValue`) and the form wrappers.

## Where §5 is consumed (the trace layer)

The trace recorder `EvalTrace.computeProvenance` (`trace.ts:88-147`) is the authoritative implementation of §5 over invocations: provenance-point invocations emit `{self.id}`; everything else applies §5.1's distinct-by-reference union over children + `symbolContributions`, with §5.3 field-refinement when the node is a `(:field …)` accessor. The exit tap stamps the computed set back onto the value with `withProvenance` (`trace.ts:496-501`), closing the loop so the next symbol resolution (§5.2) carries it.

## Lower-fidelity inference: the rest of `arrival-chain.md`

The doc was the spec for the whole [[arrival-chain]] package — the CRDT-backed program model. From the package surface (`arrival/arrival-chain/src/index.ts`, `program.ts`, `run.ts`, `arrival-chain.ts`) the spec **plausibly** covered:

- `Project` / `Program` / `ProgramVersion` / `Draft` — the Plexus-synced source-of-the-program model; `ProgramVersion.run()` executes one exact source against the doc's task cache (`arrival/arrival-chain/src/program.ts:16-74`).
- `ArrivalChain extends Plexus<Project>` — bootstrap/connect lifecycle (`arrival/arrival-chain/src/arrival-chain.ts:17`).
- `Run`/`RunResult`/`RunError`, the effect log, and the content-addressed task cache (`arrival/arrival-chain/src/index.ts`).

These section assignments are **not recoverable**: no code cites a section number for them. Treat the list as the package's scope, not as the doc's table of contents.

## Cross-links

- [[provenance-model]] — living KB note for the provenance model.
- [[provenance-model-reference.reconstructed]] — the lost reference doc for the same model.
- [[trace-provenance-idempotence-fix.reconstructed]] — the §5.3 field-point absorption fix.
- [[provenance-region-model-plan.reconstructed]] — how §5 provenance edges fold into regions.
- [[arrival-chain]], [[arrival-provenance]], [[arrival]].
