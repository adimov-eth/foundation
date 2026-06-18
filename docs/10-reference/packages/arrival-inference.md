---
title: arrival-inference
layer: reference
status: verified
tags: [package, arrival, inference, cross-cutting]
canonical-for: []
summary: The shared inference plane — a ModelRouter, a content-keyed single-flight InferStore, lazy provider backends, the JS-side agentic tool-call loop, and cost projection.
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
code-anchors:
  - arrival/arrival-inference/src/registry.ts:16        # ModelRouter interface
  - arrival/arrival-inference/src/registry.ts:21        # StaticRouter
  - arrival/arrival-inference/src/registry.ts:42        # LayeredRouter
  - arrival/arrival-inference/src/registry.ts:55        # singletonRouter
  - arrival/arrival-inference/src/registry.ts:65        # emptyRouter
  - arrival/arrival-inference/src/infer-store.ts:94      # Cell (single-flight, ref-count abort)
  - arrival/arrival-inference/src/infer-store.ts:215     # InferStore
  - arrival/arrival-inference/src/infer-store.ts:238     # createInferStore
  - arrival/arrival-inference/src/infer-store.ts:329     # InferBinding
  - arrival/arrival-inference/src/backends/_shared.ts:57 # coerceModelJson (strict/repair/reasoning)
  - arrival/arrival-inference/src/backends/_shared.ts:80 # lazyBackend
  - arrival/arrival-inference/src/agentic-loop.ts:30     # DEFAULT_AGENTIC_MAX_ROUNDS = 24
  - arrival/arrival-inference/src/agentic-loop.ts:105    # runAgenticLoop
  - arrival/arrival-inference/src/model.ts:170           # ModelBackend
  - arrival/arrival-inference/src/pricing.ts:42          # referenceCost
  - arrival/arrival-inference/src/infer-store.ts:71      # keyOf cache key (whitelist)
  - arrival/arrival-inference/src/infer-string.ts:29     # InferString
  - arrival/arrival-inference/src/entity-middleware.ts:53  # DerivableEntity
  - arrival/arrival-inference/src/entity-middleware.ts:23  # EntityMiddleware
  - arrival/arrival-inference/src/entity-middleware.ts:102 # MCP_BREAK
  - arrival/arrival-inference/src/entity-middleware.ts:105 # isMcpBreak
  - arrival/arrival-inference/src/run-spend.ts:47        # RunSpend
---

# arrival-inference

## Overview

The "talk to LLMs" layer — the [[glossary#inferstore|inference plane]] every host
shares. It owns the [[glossary#modelrouter|ModelRouter]] (model id → backend), the
content-keyed [[glossary#single-flight|single-flight]] `InferStore`, the provider
[[glossary#backend|backends]] (anthropic/openai/openrouter/ollama/vercel as optional
peer deps), the JS-side [[glossary#agentic-loop|agentic tool-call loop]], and the
cost/pricing projection. [[arrival-chain]] resolves every `(infer …)` through this
package via `bindInfer`; the package itself has no Scheme, no project model, and no
synced state — it's the injectable runtime plane. See [[determinism-and-effects]] for
how single-flight + the content key make a run replayable.

Published `@here.build/arrival-inference`.

## Public API table

| Export | Signature (abridged) | File:line |
|---|---|---|
| `ModelRouter` | `interface { backendFor(modelId): Promise<ModelBackend \| null> }` | registry.ts:16 |
| `StaticRouter` | `class` — immutable id→backend map (Map/iterable/record ctor) | registry.ts:21 |
| `LayeredRouter` | `class` — first non-null layer wins (order = precedence) | registry.ts:42 |
| `singletonRouter` | `(backend) => ModelRouter` — every id → one backend (test stub) | registry.ts:55 |
| `emptyRouter` | `ModelRouter` — every lookup null (default; cells reject) | registry.ts:65 |
| `InferStore` | `class implements InferStoreLike` — content-keyed cell map | infer-store.ts:215 |
| `InferStoreLike` | `interface { get(spec, cacheKey): InferCell }` | infer-store.ts:209 |
| `createInferStore` | `(router, cache?=noopCache) => InferStore` | infer-store.ts:238 |
| `InferCell` | `interface` — `done`/`text()`/`onDelta`/`acquire`/`release`/`finished` | infer-store.ts:77 |
| `InferCache` | `interface { read, write }` — cross-restart persistence contract | infer-store.ts:34 |
| `noopCache` | `InferCache` — no persistence (cell map still dedups) | infer-store.ts:44 |
| `overlayInferStore` | `(resolvePrimary, fallback) => InferStoreLike` — per-model overlay | infer-store.ts:301 |
| `InferBinding` | `class` — trace-side record of one infer (model/prompt/schema/cacheKey/cell) | infer-store.ts:329 |
| `lazyBackend` | `(loader) => ModelBackend` — SDK imported on first call | backends/_shared.ts:80 |
| `coerceModelJson` | `(text, diag) => JsonCoercion` — strict/repair/reasoning ladder | backends/_shared.ts:57 |
| `runAgenticLoop` | `(initial, deps) => Promise<AgenticResult>` | agentic-loop.ts:105 |
| `DEFAULT_AGENTIC_MAX_ROUNDS` | `24` | agentic-loop.ts:30 |
| `ModelBackend` / `ModelSpec` / `Completion` / `ToolCall` / `ToolDescriptor` | core types | model.ts:170,27,132,73,60 |
| `referenceCost` / `priceFor` | cost projection from `TokenUsage` | pricing.ts:42,37 |
| `InferString` | `class extends AString` — completion value carrying `__reasoning__`/`__chunks__`/tool calls | infer-string.ts:29 |
| `DerivableEntity` | `class` — kind-agnostic `(mcp …)`/`(llm …)`/`derive`/`mcp/define` handle | entity-middleware.ts:53 |
| `EntityMiddleware` | `interface { method, handler }` — `derive`'s interception unit | entity-middleware.ts:23 |
| `MCP_BREAK` | `unique symbol` — middleware halt sentinel (cross-membrane `Symbol.for`) | entity-middleware.ts:102 |
| `isMcpBreak` | `(v) => boolean` — is the value the `MCP_BREAK` sentinel | entity-middleware.ts:105 |
| `RunSpend` | `class` — per-run fresh-inference USD/call accumulator (`(infer/spent)` readout) | run-spend.ts:47 |

## Key internals

- **registry** (`registry.ts:16`) — `ModelRouter` is decoupled from `Project` so ONE
  router runs unchanged across hosts. `StaticRouter` (line 21, immutable — rebuild,
  never mutate), `LayeredRouter` (line 42, env > keychain > auto-detected local),
  `singletonRouter` (line 55, test stub), `emptyRouter` (line 65, default — every
  lookup null so the store rejects each cell with "no backend for model X").
- **InferStore single-flight `Cell`** (`infer-store.ts:94`) — the FIRST `get` for a
  content tuple starts the backend stream; later identical `get`s ride the SAME cell
  (one model call, many subscribers). The cell broadcasts deltas live, caches the
  final `Completion`, and **ref-counts**: `acquire()`/`release()`, and when the last
  holder drops *before* settle it aborts the underlying request (a superseded run
  cancels its slow call for free). Two content-keyed cache layers: the in-process
  `cells` map (single-flight + session) and an optional `InferCache` checked BEFORE
  the backend on first run (line 117) for **cross-restart replay**. `keyOf` whitelists
  exactly `[model, prompt, schema, cacheKey]` (infer-store.ts:71-72; the `InferStore`
  class is at :215). A failed/aborted cell evicts
  the slot so a re-request retries fresh (line 230). `overlayInferStore` (line 301)
  routes per-model between a primary and fallback plane (e.g. user-local $0 models
  over the team plane) via a `deferredCell` façade.
- **backends/_shared** (`backends/_shared.ts`) — `lazyBackend` (line 80) defers the
  provider SDK import to first `complete()`/`stream()`. `coerceModelJson` (line 57) is
  the ordered recovery ladder for a schema'd call: `strict` `JSON.parse` → `repair`
  (`jsonrepair`, **skipped when `finish === "length"`** — a truncated stream is data
  loss to surface) → `reasoning` (extract outermost JSON from the reasoning channel
  when content was empty). Reports `via` so the caller fails legibly; returns
  `{ ok: false }` when nothing parses (never fabricates).
- **provider backends** (`backends/{anthropic,openai,openrouter,ollama,vercel}.ts`) —
  each wrapped with `lazyBackend`. `@anthropic-ai/sdk` and `openai` are declared
  **optional peer deps** (`peerDependenciesMeta`); `openrouter` rides the OpenAI
  chat-completions protocol; `ollama` is node-`http(s)` (namespace-imported so the SPA
  bundle stub doesn't hard-fail); `vercel` uses the AI SDK (`@ai-sdk/*`, `ai`).
- **agentic-loop** (`agentic-loop.ts:105`) — `runAgenticLoop` drives multi-turn
  infer↔dispatch; `maxRounds` defaults to `DEFAULT_AGENTIC_MAX_ROUNDS = 24` (line 30,
  106). On exhausting rounds it returns `haltedByBackstop: true`.
- **pricing / projected-cost** (`pricing.ts`, `projected-cost.ts`) — `referenceCost`
  (line 42) maps `TokenUsage` → cost via `PRICE_MAP`; `effectiveCloudMs`/`SPEED_MAP`
  project timing; `projected-cost.ts` exposes `ProjectedCost` + `uncachedSumStrategy`.
- **model** (`model.ts`) — `ModelSpec extends LlmParams` (line 27), `Completion`
  (line 132, carries `value`/`toolCalls`/`usage`/`chunks`), `ToolCall`/`ToolDescriptor`,
  `ModelBackend` (line 170, `complete` + optional `stream`).

## Invariants

- **Single-flight by content tuple**: identical in-flight `(spec, cacheKey)` requests
  share ONE cell. The key is exactly `[model, prompt, schema, cacheKey]` (keyOf).
- A cell aborts when its **last subscriber releases before settle** — balance every
  `acquire()` with a `release()`.
- The `InferCache` is best-effort: a miss / IO / parse error resolves `undefined`;
  a failed write is swallowed (the next run re-infers). Determinism — a run is pure —
  is the warrant that a cached completion equals a fresh one.
- `coerceModelJson` never repairs a length-truncated stream (surface, don't fabricate).
- See [[determinism-and-effects]] (mechanics) and [[content-addressed-effects]] (why).

## Seams

- **Optional provider peer deps** — only `@anthropic-ai/sdk` + `openai` are declared
  (`peerDependenciesMeta`, both optional); the engine ships backend-agnostic and a
  host installs only the SDKs it routes to. `lazyBackend` is what keeps an unused
  SDK from ever being imported.
- **Verbose tracing** — `ARRIVAL_INFER_DEBUG=1` prints each cell's lifecycle
  (dispatch → first token → settle/abort) on the single plane (infer-store.ts:59).

## Tests

7 test files under `arrival-inference/src/__tests__/` (the chain suite exercises the
plane end-to-end through `runPipeline`/`(infer …)`).

## Tasks

- Implement + register a provider backend → [[add-a-provider-backend]].
