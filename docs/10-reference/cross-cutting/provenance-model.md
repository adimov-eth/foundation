---
title: Provenance model (eval-trace, region tree, reverse-chain slice)
layer: reference
status: in-review
tags: [reference, cross-cutting, arrival, provenance]
canonical-for: [eval-trace, region-tree, reverse-chain-slice]
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
code-anchors:
  - arrival/arrival-provenance/src/trace.ts:1            # per-form EvalTrace (EvalTap, append-only)
  - arrival/arrival-provenance/src/trace.ts:22           # mint-only-at-boundaries provenance rule
  - arrival/arrival-provenance/src/trace-to-regions.ts:1184   # traceToRegions (RegionGraph)
  - arrival/arrival-provenance/src/trace-region-fold.ts:2     # incremental region fold (parity)
  - arrival/arrival-provenance/src/statechart.ts:147     # traceToStatechart
  - arrival/arrival-provenance/src/statechart.ts:285     # forwardCone
  - arrival/arrival-provenance/src/slice.ts:205          # buildSlice (reverse-chain uneval)
---

# Provenance model

Canonical home for the read-only lineage stack: the eval trace, the render-models derived from it
(region tree / statechart), and the reverse-chain slicer. Package surface: [[arrival-provenance]].

**Why:** see [[20-method/patterns/provenance-as-first-class]] (lineage is an observable artifact of
evaluation, not a bolt-on). Terms: [[glossary#evaltrace-invocation]], [[glossary#provenance]],
[[glossary#region-tree-statechart-forest]], [[glossary#reverse-chain-slice]].

> **Read-only.** Everything here is *derived from* a trace and never drives the evaluator
> (`statechart.ts:2` — "pure; no React, no layout engine").

## EvalTrace

`trace.ts` implements arrival-scheme's `EvalTap` and builds an observable
`Map<ASTNode, NodeRecord>` keyed by **Pair identity** (the same Pair the parser produced)
(`arrival/arrival-provenance/src/trace.ts:1`). Append-only per node:

| Field | Meaning |
|---|---|
| `bindings` | monotonic set of every `Invocation` that entered this node (resolved ones are NOT removed; UI distinguishes live vs completed by `Invocation.state`). |
| `entered` / `exited` | lifetime enter / exit counts. |

Each `Invocation` captures the dynamic call stack via `parent`, so any running invocation walks back
to the program-root form. Atoms, bare symbols, quoted data, and macro-expansion Pairs (no
`__location__`) are not tracked.

**Provenance rule (mint-only-at-boundaries):** provenance is minted only at boundaries; pure ops
union/forward their inputs' sets; a branch is an edge-role, not a node; field-points are a node kind
(`arrival/arrival-provenance/src/trace.ts:22`). Hot machinery is de-MobXed — `Invocation` /
`NodeRecord` are plain field bags (a 46k-invocation run otherwise retained ~186MB of MobX admin),
the one observable being the `#entries` box (`arrival/arrival-provenance/src/trace.ts:32`).

## Render-models derived from the trace

| Model | Entry | Notes |
|---|---|---|
| region tree | `traceToRegions` → `RegionGraph` (`trace-to-regions.ts:1184`) | regions ARE boxes with boundary ports; `regionsAt` (`:674`) is the per-invocation walk. |
| incremental region fold | `TraceRegionFold` (`trace-region-fold.ts:2`) | streaming twin of `traceToRegions`; maintains the SAME `RegionGraph` incrementally and reuses the exact pure helpers — **parity** is enforced by `__tests__/trace-region-fold.test.ts`. |
| statechart | `traceToStatechart` (`statechart.ts:147`) | causal statechart; pure, plain snapshot. |

`forwardCone(chart, id)` returns the set of nodes causally downstream of `id`
(`arrival/arrival-provenance/src/statechart.ts:285`) — reused verbatim by the effect-log's
counterfactual subtraction (see [[determinism-and-effects]]).

## Reverse-chain slice

`buildSlice(trace, outputNode)` produces a sound, re-runnable reverse chain — the top-level forms an
output value depends on (Perera–Cheney `uneval`; arrival's PURITY invariant is the soundness
theorem) (`arrival/arrival-provenance/src/slice.ts:205`).

Selection is by **static backward reference-closure**, NOT the provenance cone: an adversarial swarm
proved the cone unsound (it walks upstream to evidence reads and structurally can't name the value's
own binding form or pure-combinator consumers between reads and output). The fix: seed from the
symbols the OUTPUT expression references, then transitively keep every reachable top-level
`(define name …)` (`arrival/arrival-provenance/src/slice.ts:7`). Granularity is the top-level form
(sound + runnable; intra-form minimal slicing is deferred). Provenance points are still surfaced
(`points`) as the attestation join key and a source-highlight seed.

## Invariants

- Provenance is read-only: derived from a trace, it never feeds back into evaluation.
- The trace is append-only and keyed by Pair identity; resolved invocations are retained, not
  removed.
- Provenance is minted only at boundaries; pure ops union/forward (do not mint).
- `traceToRegions` (batch) and `TraceRegionFold` (incremental) must produce byte-identical
  `RegionGraph`s (parity test).
- The slice is selected by static backward reference-closure, not the forward cone — the cone is
  unsound for slicing.
