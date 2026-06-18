---
title: Provenance as first-class
layer: method
status: draft
tags: [pattern, provenance, arrival, agentic, determinism]
canonical-for: [provenance-as-first-class]
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
code-anchors:
  - arrival/arrival-provenance/src/trace.ts:268    # EvalTrace — append-only record of an evaluation
  - arrival/arrival-provenance/src/trace.ts:149    # Invocation — dynamic call record
  - arrival/arrival-provenance/src/trace.ts:173    # per-value provenance set, computed at boundaries
  - arrival/arrival-provenance/src/slice.ts:1      # reverse-chain slice (Galois uneval)
  - arrival/arrival-provenance/src/uneval.ts:11    # Perera–Cheney uneval; purity = soundness theorem
---

# Provenance as first-class

> Pattern (the *why*). Reference (the *what*): [[provenance-model]]. Terms:
> [[glossary#provenance]], [[glossary#evaltrace-invocation]], [[glossary#reverse-chain-slice]].

## Problem

When an agent produces a result over a long chain, *why* it produced that result is usually lost
— there is no per-value lineage to inspect, audit, or replay. Without legibility the agent (and
its operator) cannot tell a coherent computation from a drifted one, and cannot localize where a
chain went wrong.

## Mechanism

Make lineage a **first-class, computed property** of every value, not an afterthought:

- an **EvalTrace** is an append-only, observable record of every evaluation;
- each value carries a **provenance set** — the invocation ids whose outputs flowed into its
  inputs — computed at boundaries;
- the trace projects into render-models (region tree / statechart / forest);
- a sound **reverse-chain slice** (Perera–Cheney `uneval`) can invert the forward cone to the
  minimal sub-program that produced a value — sound *because* evaluation is pure.

## How this repo instantiates it

- `EvalTrace` — append-only record — `arrival/arrival-provenance/src/trace.ts:268`.
- `Invocation` — dynamic call-stack record — `arrival/arrival-provenance/src/trace.ts:149`.
- Per-value provenance set computed on exit — `arrival/arrival-provenance/src/trace.ts:173`.
- Render-models from the trace — `statechart.ts`, `trace-to-forest.ts`, `trace-to-regions.ts`.
- Reverse-chain slice — `arrival/arrival-provenance/src/slice.ts:1`; the soundness theorem rests
  on purity — `arrival/arrival-provenance/src/uneval.ts:11`. See [[arrival-provenance]].

## Why it counters drift

Legibility is the audit surface for the whole thesis: if [[content-addressed-effects|effects are
deterministic]] then provenance is reproducible, so a drifted value can be *traced to its cause*
and sliced out rather than guessed at. First-class lineage turns "the chain feels wrong" into a
localizable, re-runnable fact.

## How to apply elsewhere

1. Attach lineage to values at boundaries; don't reconstruct it after the fact.
2. Keep an append-only trace you can project into multiple views.
3. Keep effects deterministic so the trace replays (see [[content-addressed-effects]]).
4. Anti-pattern: opaque results with no recorded inputs; logging strings instead of structured
   lineage. See [[transferability-guide]].
