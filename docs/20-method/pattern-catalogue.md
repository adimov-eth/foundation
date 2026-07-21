---
title: Pattern catalogue
layer: method
status: draft
tags: [pattern, agentic, arrival]
canonical-for: []
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
---

# Pattern catalogue

Index of the six patterns that operationalize the [[fragmentation-hypothesis]]. Each pattern note
is the **canonical home** for that mechanic's *why* and reciprocally links to its Layer-1
cross-cutting reference (the *what*).

| Pattern (Layer-2 *why*) | Reference (Layer-1 *what*) | One line | Drift driver countered |
|---|---|---|---|
| [[discovery-action-separation]] | [[discovery-action-tiers]] | explore side-effect-free; mutate in immutable batches | immediate execution |
| [[sexpr-over-json]] | [[s-expressions-vs-json]] | notation matching compositional thought | JSON flattening |
| [[batch-context-immutability]] | [[discovery-action-tiers]] (ActionTool batch) | all actions in a batch see one frozen context | mid-batch context drift |
| [[content-addressed-effects]] | [[determinism-and-effects]] | deterministic replay by content key | non-replayable effects |
| [[provenance-as-first-class]] | [[provenance-model]] | per-value lineage, computed at boundaries | illegible chains |
| [[security-by-deletion]] | [[membrane]] | remove host-reaching verbs at source | exploration causing host effects |

## How they compose

- **Within a turn:** [[security-by-deletion]] makes the read tier incapable of host effects, which
  is what lets [[discovery-action-separation]] keep Discovery genuinely side-effect-free;
  [[batch-context-immutability]] does the same for the write tier; [[sexpr-over-json]] is the
  notation both tiers speak.
- **Across the run:** [[content-addressed-effects]] makes the chain replayable, which makes
  [[provenance-as-first-class]] sound — lineage that reproduces.

## Reading order

1. [[fragmentation-hypothesis]] — the thesis these patterns serve.
2. This catalogue → individual pattern notes.
3. [[transferability-guide]] — apply the patterns to a non-here.build project.
4. [[operating-as-agentic-framework]] — wield this repo's own implementations.

Back to [[20-method/_moc|Method MOC]].
