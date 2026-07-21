---
title: Content-addressed effects
layer: method
status: draft
tags: [pattern, determinism, effects, caching, inference, arrival, agentic]
canonical-for: [content-addressed-effects]
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
code-anchors:
  - arrival/arrival-inference/src/infer-store.ts:71   # keyOf — content tuple [model,prompt,schema,cacheKey]
  - arrival/arrival-inference/src/infer-store.ts:225   # single-flight: identical key shares one Cell
  - arrival/arrival-chain/src/effect-log.ts:62         # EffectKind: infer|http|sql|mcp
  - arrival/arrival-chain/src/effect-log.ts:89         # effectKey / inferEffectKey — content-keyed
  - arrival/arrival-chain/src/effect-log.ts:113        # mcpEffectKey — positional (server state)
---

# Content-addressed effects

> Pattern (the *why*). Reference (the *what*): [[determinism-and-effects]]. Terms:
> [[glossary#content-keyed-cache]], [[glossary#effect-membrane-effect-log]].

## Problem

External effects (model inference, HTTP, SQL, MCP) are non-deterministic and expensive. If an
agent's chain cannot be replayed deterministically, every re-run re-pays the cost and may diverge
— and a divergent replay is another vector for the [[fragmentation-hypothesis|state desync]] that
breaks long chains.

## Mechanism

Key each effect by the **content that produced it**, not by call order. Identical content tuples
collapse to one result:

- a **content-keyed cache** keys on `[model, prompt, schema, cacheKey]`;
- **single-flight** means identical in-flight requests share one backend call;
- an **effect-log** records each effect under its content key for deterministic replay.

Effects whose result depends on mutable server state (MCP) are keyed **positionally** instead —
the honest exception that keeps the model sound.

| Effect | Keying |
|---|---|
| infer / http / sql | content-keyed (same content → same result) |
| mcp | positional `(inferenceId, server, n)` — result depends on server state |

## How this repo instantiates it

- The content tuple key — `arrival/arrival-inference/src/infer-store.ts:71` (`keyOf` →
  `JSON.stringify([spec.model, spec.prompt, spec.schema, cacheKey])`).
- Single-flight: one `Cell` per key, shared by all identical requests —
  `arrival/arrival-inference/src/infer-store.ts:225` (`InferStore.get`).
- Effect kinds and content keys — `arrival/arrival-chain/src/effect-log.ts:62` (`EffectKind`),
  `arrival/arrival-chain/src/effect-log.ts:89` (`effectKey` / `inferEffectKey`).
- The positional MCP exception — `arrival/arrival-chain/src/effect-log.ts:113` (`mcpEffectKey`).
- See [[arrival-inference]], [[arrival-chain]].

## Why it counters drift

Deterministic replay means a chain can be re-run, sliced, or counterfactually tweaked without the
world shifting underneath it — the same coherence guarantee that [[batch-context-immutability]]
gives within one batch, extended across the whole run. It also makes provenance
([[provenance-as-first-class]]) sound: a value's lineage is reproducible.

## How to apply elsewhere

1. Derive the cache/replay key from the *content* of the request, never from call order.
2. Single-flight identical requests to one backend call.
3. Keep a replayable effect-log keyed by content.
4. Be honest about effects that depend on external mutable state — key those positionally and
   document why. Anti-pattern: assuming all effects are pure/cacheable. See
   [[transferability-guide]].
