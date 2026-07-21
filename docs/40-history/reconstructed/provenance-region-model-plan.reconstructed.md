---
title: Provenance region-model plan — 2026-06-02 (reconstructed)
layer: history
status: in-review
tags: [history, reconstructed, arrival-provenance, provenance, regions, render]
canonical-for: []
source-provenance:
  origin: docs/working-proposals/provenance-region-model-plan-2026-06-02.md
  branch: lost — not in tree nor origin/tmp-6164624 Archive
  retrieved: reconstructed 2026-06-18
  authority: derived
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
code-anchors:
  - arrival/arrival-provenance/src/trace-to-regions.ts:54   # RegionPort — "Stage 2" doc citation
  - arrival/arrival-provenance/src/region-boundaries.ts:3    # RegionBoundary — doc citation
  - arrival/arrival-provenance/src/trace-to-regions.ts:67     # Region union type (leaf/decision/fanout/output)
  - arrival/arrival-provenance/src/trace-to-regions.ts:674    # regionsAt — the region walk
  - arrival/arrival-provenance/src/trace-to-regions.ts:1010   # derivePorts — Stage 2a boundary ports
  - arrival/arrival-provenance/src/region-boundaries.ts:43     # regionBoundariesFromEdges — pure edge-vs-membership
  - arrival/arrival-provenance/src/trace-to-regions.ts:541      # addPointToHasse — transitive reduction
  - arrival/arrival-provenance/src/trace-to-regions.ts:1101     # buildRegions
---

> ⚠️ **RECONSTRUCTION — not the original.** The original `docs/working-proposals/provenance-region-model-plan-2026-06-02.md` is lost everywhere (see [[dangling-doc-map]]). This note is reverse-engineered from the code it governed, anchored to `file:line`. Fidelity: **high** — two files cite the plan by name, one by *stage* ("Stage 2"), and both implement a model that matches the citation; the staged structure is partly recoverable. It records what the doc *must have specified* given the implementation — not its original wording, nor the parts of the plan never implemented.

# Provenance region-model plan — 2026-06-02 (reconstructed)

A working proposal that planned the **region model**: how a flat provenance trace folds into a tree of nested *regions* (boxes) with first-class *boundaries* and *ports*. Cited at `trace-to-regions.ts:54` (Stage 2 — region ports) and `region-boundaries.ts:3` (region boundaries). The plan was explicitly **staged** — the citations reference "Stage 2" / "Stage 2a", implying earlier stages (the bare region tree) and the boundary/port layer on top.

The living model this fed is [[provenance-model]] / the blueprint render. See [[provenance-model-reference.reconstructed]] for the underlying provenance node model whose edges this folds.

## The core idea — a region is a first-class boundary, not a passthrough

`region-boundaries.ts:1-19` states the plan's thesis: turn a control-operator region "from a transparent passthrough into a first-class boundary." A region's boundary is **what crosses its scope** — explicitly cited as the convergent model across RVSDG region ports, PROV `used`/`wasGeneratedBy`, and Naiad ingress/egress (`region-boundaries.ts:13-16`). It replaces elk-layout's "lift each edge to the nearest visible ancestor" heuristic with the real boundary, computed once (`region-boundaries.ts:16-18`).

The derivation is **pure over data already computed** — the region tree (forest) + the statechart's point→point causal edges. No interpreter change, no new trace data (`region-boundaries.ts:6-9`).

## The region tree (the from-scratch fold)

`buildRegions(snapshotTrace(trace), trace)` (`trace-to-regions.ts:1101-1182`, exported as `traceToRegions` `:1184`) folds the **raw invocation tree** (not the scope-collapsing forest, so iterations survive) into a `RegionGraph` of `Region`s. The walk `regionsAt(inv, ctx)` (`trace-to-regions.ts:674-833`) classifies each invocation:

- **provenance point** (`(infer …)` / `.prompt`) → a `leaf` region; its argument subtree's points are **hoisted** as preceding siblings so every wire lands on a rendered node (`:675-686`).
- **fan-out head** (`map`/`filter`/`fold`/…) → a `fanout` **container**; its iterations are the application children, kept **distinct** (Z-tab render, one shown at a time) (`:739-769`, `FANOUT` set `:185`).
- **TCO self-recursion** (a non-structural application recurring on its own ancestor chain) → one `fanout` container with `loop: true`, iterations = the body-entry spine cut at each next recursive call (`:688-737`, `nextSameBody` `:646`, `walkSpine` `:660`).
- **live branch** (an `if`/`cond`/… that took ≥2 distinct routes trace-wide) → a `decision` marker that *annotates* "a decision was made here" and flattens through to the taken arm — it does **not** box or fork (`:771-830`, `branchLiveness` `:1078`). A statically-determined branch dissolves (the dynamic-provenance gate, `:809-816`).
- **anything else** (`let`, `if` one-way, plain call) → **plumbing**: flattened through (`:832`).
- the program's final top-level value → an `output` terminal node (`appendOutput` `:972-989`).

The `Region` union type is `leaf | decision | fanout | output` (`trace-to-regions.ts:67-158`).

## Dataflow edges — Hasse transitive reduction over points

Point→point edges are the **transitive reduction** (Hasse diagram) of the provenance order, built in ascending-id order via `addPointToHasse` (`trace-to-regions.ts:541-565`); `upstreamOfPoint` resolves each child's provenance through `fieldPointMeta` (field-point → producer) and keeps in-graph points (`:569-582`). Field-qualified consumer attribution rewrites base edges into per-slot `field` edges (`attributeFieldEdges` `:854-964`).

## Stage 2 — regions are boxes with PORTS

`RegionPort` (`trace-to-regions.ts:53-65`) is cited as the plan's **Stage 2** deliverable: "the region-model's first-class PORT … This is what makes each container a hermetic mini-chart with explicitly known granular inputs and outputs." A port is keyed by the producer's **structural scope-id** (`head@line:col`), **not per-value**: a body that runs N times emits **one** port per structural producer, one dataflow (`:55-58`). Each `fanout` carries `inputs: RegionPort[]` / `outputs: RegionPort[]` (`:138-148`).

### Stage 2a — deriving the ports

`derivePorts(roots, edges)` (`trace-to-regions.ts:1008-1055`) is labelled "Stage 2a". It is pure **edge-vs-membership** over the region tree: an edge `P→C` is an **input** of every container holding `C` but not `P`, and an **output** of every container holding `P` but not `C` (`:1039-1046`). Ports are deduped by `producer|field` and sorted (`:1029-1054`).

## The boundary twin — `region-boundaries.ts`

`regionBoundariesFromEdges(forest, edges)` (`region-boundaries.ts:43-80`) computes the **same** edge-vs-membership rule over the *forest* + scope-id edges, producing a `RegionBoundary { id, label, entrance, exit }` per region (`region-boundaries.ts:26-35`): `entrance` = external producers feeding the region's internals (the "dive-in"), `exit` = internal producers feeding outside (`region-boundaries.ts:39-72`). `regionBoundaries(trace)` is the standalone driver: forest + statechart edges, lifted to scope-ids (`region-boundaries.ts:83-98`). This is the same boundary concept as Stage 2 ports, expressed over the forest model rather than the region tree — the plan unified both under "what crosses the scope boundary."

## Incremental twin (referenced, parity-locked)

The plan's fold is maintained incrementally by `TraceRegionFold` (`trace-region-fold.ts`), which reuses the exact pure helpers `trace-to-regions.ts` exports (`leafFor`, `conditionOf`, `addPointToHasse`, `regionsAt`, `derivePorts`, …) so the two paths cannot drift, enforced by a deep-equal parity test (`trace-to-regions.ts:36-45`).

## Not recoverable from code

The full stage list (Stages before 2, anything after 2a), the plan's milestones/sequencing, and rationale for the RVSDG/PROV/Naiad framing beyond the one-line citation are **not recoverable from code** — only Stage 2 / Stage 2a left fingerprints, and the rest of the staged plan is inferred only as "the region tree existed before the port layer."

## Cross-links

- [[provenance-model]] — living KB note for the provenance/region render.
- [[provenance-model-reference.reconstructed]] — the provenance node model whose edges fold here.
- [[arrival-chain-spec.reconstructed]] — §5 propagation algebra producing the edges.
- [[arrival-provenance]].
