---
title: Fragmentation hypothesis
layer: method
status: draft
tags: [pattern, agentic, arrival]
canonical-for: [fragmentation-hypothesis]
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
---

# Fragmentation hypothesis

> The kernel thesis of Layer 2. This is the *living* note; the frozen source artifact is
> vendored at [[fragmentation-hypothesis.archived]] (40-history). Term:
> [[glossary#fragmentation hypothesis]].

**Status: working hypothesis seeking validation. Observational; correlation ≠ causation.**

## Claim

Long-chain agent **drift** in tool use is **architecture-induced subprocess desynchronization**,
not capability failure. Distinct reasoning patterns ("subprocesses") keep separate state
histories; when a tool architecture forces them to share state inappropriately, they
desynchronize and the chain fragments.

**Observation:** the Arrival architecture sustains **50+ tool calls** without drift (private
beta), where published research shows standard MCP drifting within **~5-15 calls**
([arXiv:2508.06418v1](https://arxiv.org/abs/2508.06418v1)).

## The desync cascade

Standard architectures induce the failure in three ways:

| Driver | Mechanism | Countermeasure |
|---|---|---|
| **Immediate execution** | every call is an action; exploration fires the execution pathway → trial-and-error → failsafe restore → patterns on inconsistent state | [[discovery-action-separation]], [[security-by-deletion]] |
| **JSON serialization** | compositional thought flattened to key-value; translation overhead | [[sexpr-over-json]] |
| **Shared mutable context** | action context changes mid-batch; no coherent-state guarantee | [[batch-context-immutability]] |

Replay and legibility extend the same coherence guarantee across the whole run:
[[content-addressed-effects]] (deterministic replay) and [[provenance-as-first-class]]
(per-value lineage).

## The six countermeasures

See [[pattern-catalogue]] for the index. In one line each:

1. [[discovery-action-separation]] — explore side-effect-free; mutate in immutable batches.
2. [[sexpr-over-json]] — notation that matches compositional thought.
3. [[batch-context-immutability]] — all actions in a batch see one frozen context.
4. [[content-addressed-effects]] — deterministic replay by content key.
5. [[provenance-as-first-class]] — lineage as a computed property of every value.
6. [[security-by-deletion]] — remove host-reaching verbs at source, not guard them.

## Evidence

- **Observational:** 50+ tool calls in production beta vs published ~5-15 for standard MCP. Not a
  controlled head-to-head.
- **Supporting (independent, not designed to test this):** self-contradiction
  ([Zhang et al. 2023](https://arxiv.org/pdf/2305.15852)), mode collapse
  ([ScaLLM 2024](https://aclanthology.org/2024.scalellm-1.5/)), polysemantic activation
  ([Anthropic 2022](https://transformer-circuits.pub/2022/toy_model/index.html)), jailbreak
  boundaries ([arXiv 2024](https://arxiv.org/abs/2510.08859)), MoE specialization
  ([hydrox.ai 2025](https://arxiv.org/pdf/2503.21819)).

## Limitations

Honesty is part of the thesis. The cited research was **not** designed to test it
(self-contradiction work celebrates diversity; mode collapse is *convergence*, the opposite of
fragmentation; MoE specialization is intentional). **Alternative explanations** for Arrival's
coherence: token efficiency, two-layer (operator+operands) attention, clearer tool semantics,
reduced stochasticity, training-data alignment, confirmation bias. **No controlled comparison, no
architecture ablation — correlation is not causation.** If refuted, Arrival still works (50+ calls
observed) and understanding *why* still matters for generalization.

## What would validate it

Controlled drift experiments (standard MCP vs Arrival, same tasks, multiple models), subprocess
isolation tests, architecture ablation, a formal subprocess model with testable predictions.

## Downstream

- The transferable form: [[transferability-guide]].
- Wielding this repo's own features for agentic work: [[operating-as-agentic-framework]].
- Frozen original (CC BY 4.0): [[fragmentation-hypothesis.archived]].
