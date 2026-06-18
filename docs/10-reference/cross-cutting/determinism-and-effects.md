---
title: Determinism and effects (infer-store, single-flight, effect-log)
layer: reference
status: in-review
tags: [reference, cross-cutting, arrival, inference, effects, determinism]
canonical-for: [infer-store, single-flight, effect-log]
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
code-anchors:
  - arrival/arrival-inference/src/infer-store.ts:94    # Cell (single-flight unit)
  - arrival/arrival-inference/src/infer-store.ts:213   # content-keyed single-flight store
  - arrival/arrival-chain/src/effect-log.ts:57         # EffectKind: infer/http/sql/mcp
  - arrival/arrival-chain/src/effect-log.ts:77         # canonical kind-tagged effect key
  - arrival/arrival-chain/src/effect-log.ts:113        # mcpEffectKey POSITIONAL, not content-keyed
  - arrival/arrival-chain/src/effect-log.ts:130        # stableJson (key-sorted canonical JSON)
  - arrival/arrival-chain/src/infer-kernel.ts:298      # cache key [model,prompt,schema,cacheKey]
  - arrival/arrival-chain/src/project.ts:302           # Project.run (version-pinning seam)
---

# Determinism and effects

Canonical home for the record/replay seam that makes inference-driven runs deterministic and
re-runnable. Package surface: [[arrival-inference]], [[arrival-chain]].

**Why:** see [[20-method/patterns/content-addressed-effects]] (an effect's identity is its content,
so identical effects collapse to one call and replay for free). Terms:
[[glossary#inferstore]], [[glossary#single-flight]], [[glossary#content-keyed-cache]],
[[glossary#effect-membrane-effect-log]], [[glossary#config-as-code]].

## InferStore + single-flight

Content-keyed single-flight store over a `ModelRouter`
(`arrival/arrival-inference/src/infer-store.ts:213`). The unit is a `Cell`
(`arrival/arrival-inference/src/infer-store.ts:94`): identical in-flight requests for the same
content tuple share **one** backend call and stream the same deltas.

Two cache layers, both content-keyed (`arrival/arrival-inference/src/infer-store.ts:16`):

| Layer | Scope | Effect |
|---|---|---|
| in-process `cells` map | per process | single-flight dedup; survives within a run. |
| disk cache (optional) | cross-restart | a completed call for the exact content replays with **no** model call. |

This lives in `arrival-inference` (not the OSS runner) so every host shares one inference plane
(`arrival/arrival-inference/src/infer-store.ts:23`). The `Cell` aborts the backend request when
the last interest holder releases before completion (`arrival/arrival-inference/src/infer-store.ts:89`).

## Inference cache key

The content tuple is `[model, prompt, schema, cacheKey]` (`arrival/arrival-chain/src/infer-kernel.ts:298`).
Extra identity dimensions (tools + content params) are folded into `cacheKey` via `stableJson` so a
param not folded in cannot silently serve a stale completion; folding is gated to byte-identity (no
tools and no params ⇒ `cacheKey` passes through unchanged, `infer-kernel.ts:315`).

## Effect-log (record / replay)

`EffectLog = Map<string, string>` — kind-tagged effect key → the JSON the effect produced
(`arrival/arrival-chain/src/effect-log.ts:66`). Insertion order **is** causal order (a `Map`, not a
record). The canonical key is `JSON.stringify([kind, ...payload])`
(`arrival/arrival-chain/src/effect-log.ts:77`).

| Kind | Keying | Identity payload |
|---|---|---|
| `infer` | CONTENT | the inference content tuple. |
| `http` | CONTENT | request content (same lowering as infer). |
| `sql` | CONTENT | `[label, query, paramsJson]` — params separate from query (injection-safe). |
| `mcp` | **POSITIONAL** | `mcpEffectKey(inferenceId, server, n)` — nth call per (inference, server). |

`mcp` is positional, not content-keyed, because an MCP call's result depends on the server's hidden
mutable state (the same read returns different values before vs after an intervening write, a
coupling invisible to the content key and the forward cone). The recorded tuple carries
`{server, method, request}` so replay can **verify alignment** and stop on divergence rather than
serve a stale value (`arrival/arrival-chain/src/effect-log.ts:113`).

Canonical JSON is `stableJson`: object keys sorted recursively (so `{city,units}` and
`{units,city}` mint the same key), arrays keep order (positional), `undefined` folds to `null`
(`arrival/arrival-chain/src/effect-log.ts:130`).

### Replay vs counterfactual (forward-cone subtraction)

Replay binds the whole log. A counterfactual edit invalidates only the **forward cone** — the
effects causally downstream of the edit (reusing provenance's `forwardCone`, see
[[provenance-model]]). `invalidateForwardCone` returns *log minus the cone's effect keys*: a cone
effect misses the log and re-hits the plane; every non-cone effect hits the log and costs nothing
(`arrival/arrival-chain/src/effect-log.ts:40`). This is the minimal recomputation.

## config-as-code & version pinning

Per-run knobs ship as a `config.scm` required by the entry program (`(require "config.scm")`).
`Project.run` (`arrival/arrival-chain/src/project.ts:302`) is the universal spawn gateway and the
version-pinning seam: a Run pins its entry program version at invoke-start (and replays `(require)`s
at the pinned version-set) so the same Run replays exactly as it did before
(`arrival/arrival-chain/src/project.ts:885`). See [[arrival-chain]].

## Invariants

- An effect's identity is its key; two calls with the same content key are the same effect.
- `infer`/`http`/`sql` are content-keyed and pure-by-content; `mcp` is positional and must be
  replayed in order with divergence checks.
- Effect-log insertion order is causal order — do not reorder.
- Counterfactual invalidation subtracts exactly the forward cone; over-subtracting loses cache,
  under-subtracting serves stale values.
