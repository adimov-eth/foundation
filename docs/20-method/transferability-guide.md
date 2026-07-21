---
title: Transferability guide
layer: method
status: draft
tags: [pattern, agentic, arrival]
canonical-for: []
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
---

# Transferability guide

> Applying the [[fragmentation-hypothesis|method]] to a project that is **not** here.build. A
> checklist over the six [[pattern-catalogue|patterns]], plus the anti-patterns that reintroduce
> drift. None of this requires Arrival's code; it requires Arrival's *shape*.

## Checklist

| # | Pattern | Do this in your project | Done when |
|---|---|---|---|
| 1 | [[discovery-action-separation]] | split the tool surface into a read-only explore tier and a commit tier | exploration cannot mutate by construction, not by convention |
| 2 | [[security-by-deletion]] | remove host-reaching verbs from the explore tier at source; one audited accessor for host data | there is no codepath from explore to a side effect |
| 3 | [[batch-context-immutability]] | resolve + freeze context once per mutation batch; pass the snapshot to each step | no step re-reads mutable global state mid-batch |
| 4 | [[sexpr-over-json]] | use a notation with an explicit operator position for compositional inputs; keep one syntax for code+data | tool outputs compose into tool inputs without reshaping |
| 5 | [[content-addressed-effects]] | key effects by request content; single-flight; keep a replayable effect-log | a run replays deterministically; positional-keyed effects documented |
| 6 | [[provenance-as-first-class]] | attach lineage to values at boundaries; keep an append-only trace | any output is traceable to its inputs and re-runnable |

## Anti-patterns (these reintroduce drift)

| Anti-pattern | Why it breaks | Fix |
|---|---|---|
| **Immediate-execution tools** — every call is an action | exploration fires the execution pathway → trial-and-error → failsafe restore → desync | tier 1 + 2 (explore/act split, deletion) |
| **JSON flattening** — compositional input crushed to flat key-value | thought↔representation translation overhead; no operator position | tier 4 (s-expr / operator-first notation) |
| **Mutable shared context** — actions read live global state mid-batch | actions observe different worlds → desync | tier 3 (freeze + snapshot) |
| **Allow-by-default sandbox** — denylist guards around dangerous verbs | every missed path is an escape *and* an accidental effect | tier 2 (delete, don't guard) |
| **Non-replayable effects** — keyed by call order, no log | re-runs diverge; slicing/audit impossible | tier 5 (content-key + effect-log) |
| **Opaque results** — outputs with no recorded inputs | chains illegible; can't localize drift | tier 6 (first-class lineage) |
| **Errors as panics** — thrown exceptions on soft failure | failsafe restore to earlier checkpoint → state desync | return errors as data (part of tier 1) |

## Minimal viable adoption

If you can only do two things: **(1)** add a side-effect-free explore tier with errors-as-data,
and **(2)** freeze mutation context per batch. Those two close the immediate-execution and
mid-batch-drift drivers — the two the [[fragmentation-hypothesis]] weighs most. Notation,
replay, and provenance compound the benefit but are additive.

## Caveat

The method rests on an **observational** hypothesis (correlation ≠ causation — see
[[fragmentation-hypothesis#Limitations]]). Adopt the patterns because they are sound engineering
(safe exploration, deterministic replay, legibility) and *measure* drift on your own tasks rather
than assuming the 50-vs-5-15 figure transfers.

To wield this repo's own implementations rather than reimplement, see
[[operating-as-agentic-framework]].
