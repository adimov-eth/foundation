---
title: arrival-provenance
layer: reference
status: verified
tags: [package, arrival, provenance, cross-cutting]
canonical-for: []
summary: Read-only provenance analysis — capture an EvalTrace and derive forest/statechart/region/flow-graph/slice render-models; it reads append-only traces and never drives the evaluator.
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
code-anchors:
  - arrival/arrival-provenance/src/trace.ts:268          # EvalTrace (append-only EvalTap)
  - arrival/arrival-provenance/src/trace.ts:149          # Invocation
  - arrival/arrival-provenance/src/trace.ts:88           # computeProvenance (spec §5)
  - arrival/arrival-provenance/src/trace.ts:394          # bindTask
  - arrival/arrival-provenance/src/trace.ts:549          # markProvenancePoint
  - arrival/arrival-provenance/src/trace-to-regions.ts:1184 # traceToRegions
  - arrival/arrival-provenance/src/trace-region-fold.ts:1 # TraceRegionFold (incremental parity)
  - arrival/arrival-provenance/src/trace-to-forest.ts:193 # traceToForest
  - arrival/arrival-provenance/src/statechart.ts:147     # traceToStatechart
  - arrival/arrival-provenance/src/statechart.ts:285     # forwardCone
  - arrival/arrival-provenance/src/slice.ts:205          # buildSlice (reverse-chain uneval)
  - arrival/arrival-provenance/src/trace-snapshot.ts:1   # snapshotTrace (PlainTrace)
  - arrival/arrival-provenance/src/trace-artifact.ts:1   # serializeTrace / loadTraceArtifact
  - arrival/arrival-provenance/src/trace-to-flow-graph.ts:59  # traceToFlowGraph
  - arrival/arrival-provenance/src/trace-to-flow-graph.ts:55  # flowForwardCone / flowBackwardCone (re-export)
  - arrival/arrival-provenance/src/trace-to-chain.ts:51  # traceToChain
  - arrival/arrival-provenance/src/uneval.ts:61          # buildUneval
  - arrival/arrival-provenance/src/mdl-collapse.ts:184   # collapseMDL
  - arrival/arrival-provenance/src/extract-defines.ts:82 # extractDefines
  - arrival/arrival-provenance/src/slice.ts:46           # writeForm
  - arrival/arrival-provenance/src/slice.ts:141          # referencedSymbols
  - arrival/arrival-chain/src/__tests__/trace-region-fold.test.ts  # region/fold parity (cross-package)
---

# arrival-provenance

## Overview

Read-only trace analysis. It captures an [[glossary#evaltrace-invocation|EvalTrace]]
as a program evaluates (implementing arrival-scheme's `EvalTap`) and turns a
*finished* trace into render-models: forest (call-tree), statechart (causal DAG),
region tree (the studio blueprint), flow graph, and the reverse-chain
[[glossary#reverse-chain-slice|slicer]]. The package **never drives the evaluator** —
it reads append-only traces. Its forward-cone + statechart are reused by
[[arrival-chain]]'s `invalidateForwardCone` for partial-invalidation replay. See
[[provenance-model]] for the mechanics and [[provenance-as-first-class]] for why.

Published `@here.build/arrival-provenance`.

## Public API table

| Export | Signature (abridged) | File:line |
|---|---|---|
| `EvalTrace` | `class implements EvalTap` — append-only MobX trace | trace.ts:268 |
| `Invocation` | `class` — one node entry; `provenance`/`children`/`parent`/`node` | trace.ts:149 |
| `NodeRecord` | `class` — per-AST-node bindings/enter/exit counts | trace.ts:255 |
| `EvalTrace.bindTask` | `(task, invocation) => void` — bind an effect to its invocation(s) | trace.ts:394 |
| `EvalTrace.markProvenancePoint` | `(invocation) => void` — mint a boundary point | trace.ts:549 |
| `EvalTrace.fieldPoint` | `(origin, key) => number` — field-projection point | trace.ts:351 |
| `traceToForest` | `(trace, opts?) => CandidateBox[]` — call-tree render model | trace-to-forest.ts:193 |
| `traceToStatechart` | `(trace) => Statechart` — causal DAG | statechart.ts:147 |
| `forwardCone` / `backwardCone` | `(chart, id) => Set<number>` | statechart.ts:285,288 |
| `traceToRegions` | `(trace) => RegionGraph` — blueprint region tree | trace-to-regions.ts:1184 |
| `TraceRegionFold` | `class` — incremental region fold (parity with `traceToRegions`) | trace-region-fold.ts |
| `buildSlice` | `(trace, outputNode) => Slice` — reverse-chain slice | slice.ts:205 |
| `writeForm` | `(node) => string` — re-serialize a homoiconic form to re-parseable Scheme | slice.ts:46 |
| `referencedSymbols` | `(form) => Set<string>` — symbols a form references (slice seed) | slice.ts:141 |
| `traceToFlowGraph` | `(trace, opts?) => FlowGraph` — flow render model | trace-to-flow-graph.ts:59 |
| `flowForwardCone` / `flowBackwardCone` | flow-graph cones (re-exported from `flow-graph.ts`) | trace-to-flow-graph.ts:55 |
| `traceToChain` | `(trace) => ProvenanceChain` — Lamport-layered causal chain | trace-to-chain.ts:51 |
| `buildUneval` | `(opts) => Uneval` — selector-driven reverse-slice builder | uneval.ts:61 |
| `collapseMDL` | `(forest, params?) => CollapseResult` — MDL box-collapse over the forest | mdl-collapse.ts:184 |
| `extractDefines` | `(source) => Promise<DefineInfo[]>` — top-level `(define …)` enumerator | extract-defines.ts:82 |
| `snapshotTrace` | `(trace) => PlainTrace` — de-MobXed snapshot for hot traversals | trace-snapshot.ts |
| `serializeTrace` / `loadTraceArtifact` | trace artifact persistence (versioned) | trace-artifact.ts |

## Key internals

- **`EvalTrace`** (`trace.ts:268`) — implements `EvalTap`; builds an observable
  `Map<ASTNode, NodeRecord>` keyed by **Pair identity** (the same Pair the parser
  produced). The flat `#entries` observable box is the ONLY remaining MobX-observed
  write (so `enter` keeps its `action` wrapper); `Invocation`/`NodeRecord` were
  de-MobXed to plain field bags after a 46k-invocation run retained ~186MB of pure
  admin (trace.ts:31-47). `bindTask` (line 394) binds an effect task (an
  `InferBinding`/`DataBinding`/`McpBinding`) to the invocation(s) that produced it via
  `invocationByTask` — the bridge the effect-log inverts. `DEFAULT_TRACE_CAP = 500_000`
  (line 266).
- **`computeProvenance`** (`trace.ts:88`) — the per-value lineage algebra per
  `docs/spec/arrival-chain.md` §5: provenance is **minted only at boundaries**, pure
  ops **union/forward** their children's sets (one level at exit), `branch` is an
  edge-role not a node, and field-points are a node kind (§5.1–5.3). Every `(infer …)`
  invocation is a provenance point whose own `.provenance` is the singleton `{self.id}`
  (§5.1 override) — so upstream inputs are read as `⋃ child.provenance` over its direct
  children (the statechart edge rule, statechart.ts:13-30). **Read the §5 rule before
  changing `computeProvenance`, authoritative-set forwarding, or `fieldPoint`** (trace.ts:22-26).
- **regions** (`trace-to-regions.ts` + `trace-region-fold.ts`) — `traceToRegions`
  rebuilds the whole `RegionGraph` per call (~6s on a 486k-invocation trace);
  `TraceRegionFold` maintains the SAME graph **incrementally** over the append-only
  trace (`applyDelta` walks only new invocations; per-tick cost O(Δ), not O(N)). The
  contract is **parity** — `current()` must deep-equal `traceToRegions` on every state,
  achieved by reusing the exact shared helpers rather than re-deriving region logic.
  The parity is enforced by a **cross-package** test that lives in the consuming chain
  suite, not in this package: `arrival/arrival-chain/src/__tests__/trace-region-fold.test.ts`
  (arrival-provenance's own `__tests__/` holds only `extract-defines` + `mdl-collapse`).
- **statechart** (`statechart.ts:147`) — the causal DAG behind the flows view; renders
  `Invocation.provenance` (causality), not the call stack. Operates on a `PlainTrace`
  snapshot because its traversal is O(n²) (reads children/provenance many times).
  `forwardCone`/`backwardCone` (line 285/288) are the cone the effect-log subtracts.
- **slice / uneval** (`slice.ts:205`, `uneval.ts`) — the reverse-chain slicer
  (Perera–Cheney `uneval`). **Sound by inversion**: selection is by static backward
  reference-closure from the output expression's symbols (NOT the provenance cone — a
  swarm proved the cone unsound because it cannot name the value's own binding form or
  pure-combinator consumers). Re-running the slice reproduces the value; arrival's
  PURITY invariant is the soundness theorem (slice.ts:1-20).
- **trace-snapshot / trace-artifact** — `snapshotTrace` produces a de-MobXed
  `PlainTrace` for the hot O(n²) traversals; `serializeTrace`/`loadTraceArtifact`
  persist a versioned `TraceArtifact`.

## Invariants

- The package is **read-only over the evaluator** — it consumes a finished/append-only
  trace; it never drives evaluation (package description; `trace.ts` is an `EvalTap`
  observer).
- Trace nodes are keyed by **Pair identity**; macro-expansion Pairs without
  `__location__`, atoms, bare symbols, and quoted data are not tracked.
- **Provenance is minted only at boundaries** and flows exactly one level per exit
  (§5). The slicer is sound only under arrival's purity invariant.
- See [[provenance-model]] (mechanics) and [[provenance-as-first-class]] (why).

## Seams

- **O(n²) provenance set union** — `computeProvenance`'s union/forward and the
  statechart/snapshot traversals are O(n²) in invocation count; on deep TCO loops this
  was a GC-freeze risk (trace.ts:37, 516; statechart.ts:11). De-MobXing + snapshotting
  + the incremental fold contain it. **Monitored by benchmark**:
  `arrival-chain/src/__benchmarks__/provenance-memory.test.ts` and `flow-graph.test.ts`.

## Tests

2 test files local to `arrival-provenance/src/__tests__/`
(`extract-defines.test.ts`, `mdl-collapse.test.ts`); the bulk of the trace/statechart/
region/slice/uneval suites live in the consuming `arrival-chain/src/__tests__/`
(e.g. `statechart.test.ts`, `trace-to-*.test.ts`, `slice.test.ts`, `uneval.test.ts`,
`trace-region-fold.test.ts`), with the memory/flow benchmarks in `__benchmarks__/`.

## Tasks

- Capture a trace and read its provenance / regions / slice → [[trace-and-read-provenance]].
