---
title: Provenance model — reference (reconstructed)
layer: history
status: in-review
tags: [history, reconstructed, arrival-provenance, provenance, trace]
canonical-for: []
source-provenance:
  origin: docs/foundations/arrival-scheme/reference/provenance-model.md
  branch: lost — not in tree nor origin/tmp-6164624 Archive
  retrieved: reconstructed 2026-06-18
  authority: derived
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
code-anchors:
  - arrival/arrival-provenance/src/trace.ts:22       # the taxonomy invariant the file implements + doc citation
  - arrival/arrival-provenance/src/trace.ts:88        # computeProvenance — the authoritative impl
  - arrival/arrival-provenance/src/trace.ts:149       # Invocation (trace node)
  - arrival/arrival-provenance/src/trace.ts:268       # EvalTrace
  - arrival/arrival-provenance/src/trace.ts:333       # fieldPointMeta registry
  - arrival/arrival-provenance/src/trace.ts:376       # authoritative-provenance WeakSet
  - arrival/arrival-provenance/src/trace.ts:440       # enter tap
  - arrival/arrival-provenance/src/trace.ts:462       # exit tap (stamps provenance back)
  - arrival/arrival-provenance/src/trace.ts:561       # onSymbolResolved tap
  - arrival/arrival-provenance/src/index.ts:6          # public exports
---

> ⚠️ **RECONSTRUCTION — not the original.** The original `docs/foundations/arrival-scheme/reference/provenance-model.md` is lost everywhere (see [[dangling-doc-map]]). This note is reverse-engineered from the code it governed, anchored to `file:line`. Fidelity: **high** — `trace.ts:22-26` names the doc as authoritative *and* enumerates the exact invariant it documents, and the file implements that invariant. It records what the doc *must have specified* given the implementation — not its original wording.

# Provenance model — reference (reconstructed)

This is the lost **reference** doc for arrival-scheme's provenance model. The file header that cites it (`arrival/arrival-provenance/src/trace.ts:22-26`) states the doc is authoritative and **must be read before changing `computeProvenance`, the authoritative-set forwarding, or `fieldPoint`**. The same header enumerates the taxonomy invariant the doc documents — this reconstruction is anchored to that enumeration and to the code that realizes it.

The living KB note this superseded is [[provenance-model]]. See also the algebra spec it shares rules with, [[arrival-chain-spec.reconstructed]] §5.

## The taxonomy invariant (verbatim scope, from `trace.ts:22-24`)

The doc specified four properties, which `trace.ts` implements:

1. **Mint-only-at-boundaries.** Provenance ids are minted only at provenance points and at field projections — not at ordinary pure ops.
2. **Pure ops union/forward.** A pure op's provenance is the union (or single-set forward) of its inputs' provenance.
3. **Branch is an edge-role, NOT a node.** A control-flow branch contributes a role on an edge, not its own provenance node.
4. **Field-points are a node kind.** A `(:field …)` projection mints a distinct *field-point*, a first-class node kind in the provenance graph.

## The trace structure — `Invocation` is the provenance node

`Invocation` (`trace.ts:149-253`) is the trace node. The provenance-relevant fields:

- `id: number` — the invocation id; a provenance point's provenance is `{self.id}` (`trace.ts:150`, `trace.ts:89`).
- `node: Pair` — the AST Pair this invocation evaluated; trace records are keyed by Pair identity (`trace.ts:151`, `trace.ts:269`).
- `parent` / `children` — the dynamic call stack; `children` lets the exit tap compute provenance in O(children) (`trace.ts:152-158`).
- `provenance: ReadonlySet<number>` — computed on exit per §5; defaults to `EMPTY_PROVENANCE` (`trace.ts:173`).
- `isProvenancePoint: boolean` — set by a rosetta wrapper declared `provenance: true` or a sandbox override; flips the exit tap to emit `{self.id}` (`trace.ts:178`, `trace.ts:541-551`).
- `symbolContributions: Set<ReadonlySet<number>> | null` — provenance from bare-symbol resolutions, fed by `onSymbolResolved` (`trace.ts:204-211`).
- `metadata` — render-side metadata bound via a rosetta's `resultWithProvenance` (e.g. a `.prompt` node's `{ kind, path, model, inputs }`) (`trace.ts:179-185`).

`NodeRecord` (`trace.ts:255-260`) aggregates per-Pair: a monotonic `bindings` set of every Invocation that entered the node, plus `entered`/`exited` counts.

## How call-ids map to trace nodes

A provenance set is a `Set<number>`. Each member is one of:

- A **provenance-point invocation id** — resolves directly to the `Invocation` of that id (the actual `(infer …)` / `.prompt` call).
- A **field-point id** — a synthetic id NOT backed by an invocation. It resolves through `EvalTrace.fieldPointMeta: Map<number, FieldPointMeta>` to `{ origin, key }` (`trace.ts:333`, `FieldPointMeta` `trace.ts:57-60`), where `origin` is the producer point (or another field-point — resolve transitively, the pin being the inner key closest to the real producer) and `key` is the plucked field.

`fieldPoint(origin, key)` mints (lazily, singleton per `(origin,key)`) the field-point id; it **absorbs** a re-projection of an existing field-point (returns it unchanged) — the idempotence guarantee documented in [[trace-provenance-idempotence-fix.reconstructed]] (`trace.ts:351-360`).

## The authoritative-set forwarding rule

`EvalTrace` keeps a `WeakSet<ReadonlySet<number>>` of **authoritative** provenance sets — those minted by a point (`{self.id}`) or a field projection (`trace.ts:376`, `markAuthoritativeProvenance` `trace.ts:380-383`). An authoritative set is the *complete* lineage of the value it stamps; upstream is reached by following the link, not by carrying the closure. At a forwarding boundary (function-call return, `let`, tail-recursive pass-through, untouched control-flow arm) `computeProvenance` forwards an authoritative set unchanged instead of re-unioning it (`trace.ts:88-107`). Without this, the re-union accumulates depth into an O(history) flat set (the 2026-06-08 1.3 GB heap dump — `trace.ts:368-374`). Keyed by *set identity* (`WeakSet`), so it rides the reference that §5.1's size-1 forward / `withProvenance` share, and is GC'd with it.

## The tap lifecycle (how the model is recorded)

`EvalTrace implements EvalTap` (`trace.ts:268`):

- **`enter(node, parent, tailPosition?)`** (`trace.ts:440-460`) — mints the next `Invocation`, links it to its parent, registers it in the `NodeRecord`, appends to the invocation log, bumps the lone observable `#entries` box (so it stays an `action`), and throws once `maxEntries` (default `DEFAULT_TRACE_CAP = 500_000`, `trace.ts:266`) is hit.
- **`exit(invocation, result)`** (`trace.ts:462-505`) — sets state resolved/rejected, runs `computeProvenance`, prunes child provenance (the depth-leak GC, `#pruneChildProvenance` `trace.ts:523-539`), and **stamps the computed set back onto the value** via `withProvenance` — substituting the stamped clone into the evaluator's continuation so provenance rides through bindings (`trace.ts:482-501`).
- **`onSymbolResolved(invocation, symbol, value)`** (`trace.ts:561-588`) — records the symbol's resolved value, and adds the value's provenance to `symbolContributions` (the §5.2 env-flow path). Tap exceptions are swallowed with a once-per-session warning.

## Public surface

The model is exported from `arrival/arrival-provenance/src/index.ts:6`: `EvalTrace`, `Invocation`, `NodeRecord`, `InvocationState`. The package reads finished traces and never drives the evaluator (`index.ts:1-4`).

## Cross-links

- [[provenance-model]] — the living KB note that succeeded this reference.
- [[arrival-chain-spec.reconstructed]] — §5 propagation algebra (the value-side rules).
- [[trace-provenance-idempotence-fix.reconstructed]] — field-point absorption / idempotence.
- [[provenance-region-model-plan.reconstructed]] — folding provenance edges into regions.
- [[arrival-provenance]].
