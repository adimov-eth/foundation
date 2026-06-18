---
title: Trace and read provenance
layer: reference
status: verified
tags: [playbook, arrival, provenance, trace]
canonical-for: []
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
code-anchors:
  - arrival/arrival-chain/src/project.ts:1010        # Project.runTraced
  - arrival/arrival-provenance/src/trace.ts:268        # EvalTrace
  - arrival/arrival-provenance/src/trace-to-forest.ts:193 # traceToForest
  - arrival/arrival-provenance/src/trace-to-regions.ts:1184 # traceToRegions
  - arrival/arrival-provenance/src/slice.ts:205         # buildSlice
---

# Trace and read provenance

Capture an [[arrival-provenance|EvalTrace]] during a run, then derive its
render-models (forest / statechart / region tree) and a sound reverse-chain slice. The
package is **read-only** — it observes a finished trace; it never drives the evaluator.
See [[provenance-model]] (mechanics) and [[provenance-as-first-class]] (why).

## Steps

1. **Capture** — pass an `EvalTrace` to a traced run.
   ```ts
   import { EvalTrace } from "@here.build/arrival-provenance";
   const trace = new EvalTrace();
   const { userForms, finished, result } = await project.runTraced(src, { trace });
   await finished;
   ```
   (`runTraced`, `project.ts:1010`, is shorthand for `run({ trace })`; the builtin
   preamble + `(require …)` preambles are evaluated tap-free, so the trace holds only
   user-program forms.) The trace builds an observable `Map<Pair, NodeRecord>` keyed by
   AST-node Pair identity; each `(infer …)`/effect is bound via `bindTask`.

2. **Forest** (call tree) — `traceToForest(trace)` (`trace-to-forest.ts:193`):
   `Invocation.ancestors()` — how the interpreter got here.

3. **Statechart** (causality) — `traceToStatechart(trace)` (`statechart.ts:147`):
   the dataflow DAG over `Invocation.provenance`. `forwardCone(chart, id)` /
   `backwardCone(chart, id)` (`statechart.ts:285`) give the causal cone — the same cone
   [[arrival-chain]]'s `invalidateForwardCone` subtracts for partial-invalidation replay.

4. **Region tree** (studio blueprint) — `traceToRegions(trace)`
   (`trace-to-regions.ts:1184`), or `TraceRegionFold` for the incremental, per-frame
   streaming variant (parity-tested against `traceToRegions`).

5. **Slice** (sound, re-runnable) — `buildSlice(trace, outputNode)` (`slice.ts:205`):
   the reverse-chain `uneval` (Perera–Cheney). Selection is by **static backward
   reference-closure** from the output expression — NOT the provenance cone (the cone
   is unsound for slicing). Re-running the slice reproduces the value (purity is the
   soundness theorem); the provenance `points` are surfaced as attestation/highlight seeds.

6. **Persist** — `serializeTrace(trace)` → a versioned `TraceArtifact`;
   `loadTraceArtifact(json)` to reload (`trace-artifact.ts`). For hot O(n²) traversals
   use `snapshotTrace(trace)` (`trace-snapshot.ts`) — a de-MobXed `PlainTrace`.

## Watch the seam

Provenance set union + the statechart/snapshot traversals are O(n²) in invocation
count — fine for typical runs, GC-heavy on deep TCO loops; monitored by
`arrival-chain/src/__benchmarks__/provenance-memory.test.ts`. Reach for `snapshotTrace`
/ `TraceRegionFold` on large traces.

Reference: [[arrival-provenance]].
