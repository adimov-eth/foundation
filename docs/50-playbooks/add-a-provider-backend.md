---
title: Add a provider backend
layer: reference
status: verified
tags: [playbook, arrival, inference, backend]
canonical-for: []
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
code-anchors:
  - arrival/arrival-inference/src/model.ts:170            # ModelBackend contract
  - arrival/arrival-inference/src/backends/_shared.ts:80  # lazyBackend
  - arrival/arrival-inference/src/registry.ts:21          # StaticRouter
---

# Add a provider backend

Teach the [[arrival-inference|inference plane]] to talk to a new LLM provider. A
backend is a value implementing `ModelBackend`; a [[glossary#modelrouter|router]] maps
model ids to it; `(infer "model-id" …)` then routes there.

## Steps

1. **Implement `ModelBackend`** (`arrival/arrival-inference/src/model.ts:170`):
   - `complete(spec: ModelSpec): Promise<Completion>` — required.
   - `stream?(spec, onDelta, signal?, onNotice?): Promise<Completion>` — optional;
     when absent the cell falls back to `complete` as a single synthetic delta.
   - Honor `signal` (the cell aborts when its last subscriber releases — see
     [[arrival-inference]] single-flight `Cell`).
   - For a schema'd call, run raw output through `coerceModelJson`
     (`backends/_shared.ts:57`) so fenced/repairable/reasoning-channel output is
     recovered legibly (never repair a `finish === "length"` truncation).
   - Stamp `completion.usage` (input/output tokens) so cost projection works
     (`pricing.ts`).

2. **Wrap with `lazyBackend`** (`backends/_shared.ts:80`) so the provider SDK imports
   on first call, not at module load — keeps an unused provider off the bundle:
   `export const myBackend = (opts) => lazyBackend(async () => { const sdk = await import("…"); return { complete, stream }; });`
   Model the existing backends in `backends/{anthropic,openai,openrouter,ollama,vercel}.ts`.
   If the provider has an SDK, declare it as an **optional peer dep**
   (`peerDependenciesMeta`, like `@anthropic-ai/sdk`/`openai`).

3. **Register in a router** (`registry.ts:21`):
   - `new StaticRouter({ "my-model-id": myBackend(opts) })`, or layer it under a
     `LayeredRouter` (first non-null layer wins), or `singletonRouter(backend)` for a
     test stub. `emptyRouter` rejects every lookup.

4. **Bind + run**: `createInferStore(router)` → `project.bindInfer(store)`, or pass the
   router straight to `runPipeline({ …, router })`. See [[run-a-pipeline]].

## Verify

A program `(infer "my-model-id" "ping")` resolves through your backend; a second
identical call rides the same single-flight cell (no second provider call). Set
`ARRIVAL_INFER_DEBUG=1` to watch the cell lifecycle.

Reference: [[arrival-inference]].
