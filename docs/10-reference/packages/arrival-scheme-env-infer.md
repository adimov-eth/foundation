---
title: arrival-scheme-env-infer
summary: The inference palette pack for the scheme env, shipping infer/infer-chat verbs plus the dependent MCP-agentic capability as EnvCapability values rooted into a chain base env
layer: reference
status: verified
tags: [package, arrival, inference, mcp, cross-cutting]
canonical-for: []
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
code-anchors:
  - arrival/arrival-scheme-env-infer/src/infer.ts:127     # arrivalInferCapability (infer / infer/chat)
  - arrival/arrival-scheme-env-infer/src/infer.ts:40      # InferFn — the host inference seam
  - arrival/arrival-scheme-env-infer/src/infer.ts:93      # asLlmModel coercion
  - arrival/arrival-scheme-env-infer/src/infer.ts:78      # canonicalizeMessages
  - arrival/arrival-scheme-env-infer/src/derive.ts:60     # arrivalDeriveCapability (mcp/llm/derive/llm-with)
  - arrival/arrival-scheme-env-infer/src/mcp.ts:313       # arrivalMcpCapability (mcp/call, mcp/list)
  - arrival/arrival-scheme-env-infer/src/mcp.ts:356       # arrivalAgenticCapability (infer/agentic/end-to-end)
  - arrival/arrival-scheme-env-infer/src/mcp.ts:251       # runAgenticInfer loop driver
  - arrival/arrival-scheme-env-infer/src/mcp.ts:120       # McpEffectResolver — the MCP membrane seam
  - arrival/arrival-scheme-env-infer/src/mcp.ts:134       # inertMcpResolver (disarmed default)
---

# arrival-scheme-env-infer

The **inference palette pack** for the scheme env. Package `@here.build/arrival-scheme-env-infer`.
It ships the `infer` / `infer/chat` verbs plus the dependent MCP-agentic capability as real
`EnvCapability` values rooted into a chain base env. Built on
`@here.build/arrival-inference` (the engine + derive-entity / middleware algebra) — `arrival/arrival-scheme-env-infer/src/infer.ts:13`.

The package's reason to exist is the dependency edge: it isolates the inference dependency out of
the chain core, and the edge runs **chain → here, never back** (`arrival/arrival-scheme-env-infer/src/index.ts:6`). No
`arrival-chain` import appears anywhere in `src/`. See [[arrival-inference]] for the engine and
[[discovery-action-tiers]] for how MCP read/mutation tiers split.

Terms: [[glossary#mcp]], [[glossary#modelrouter]], [[glossary#agentic-loop]],
[[glossary#effect-membrane-effect-log]], [[glossary#membrane]].

## Public API table

The barrel (`arrival/arrival-scheme-env-infer/src/index.ts:19`) surfaces only what crosses the package boundary.

| Export | Signature / shape | File:line |
|---|---|---|
| `arrivalInferCapability` | `EnvCapability("arrival/infer")` — verbs `infer`, `infer/chat`; `deps: [derive]` | `arrival/arrival-scheme-env-infer/src/infer.ts:127` |
| `arrivalDeriveCapability` | `EnvCapability("arrival/derive")` — pure entity algebra `mcp`/`llm`/`llm/with`/`derive`/`mcp/define`/`mcp/break` | `arrival/arrival-scheme-env-infer/src/derive.ts:60` |
| `arrivalMcpCapability` | `EnvCapability("arrival/mcp")` — dispatch verbs `mcp/call`, `mcp/list`; `deps: [derive]` | `arrival/arrival-scheme-env-infer/src/mcp.ts:313` |
| `arrivalAgenticCapability` | `EnvCapability("arrival/infer-agentic")` — verb `infer/agentic/end-to-end`; `deps: [infer, mcp]` | `arrival/arrival-scheme-env-infer/src/mcp.ts:356` |
| `runAgenticInfer` | `(infer, mcpResolve, ctx, model, messages, servers) → Promise<InferString>` | `arrival/arrival-scheme-env-infer/src/mcp.ts:251` |
| `InferFn` (type) | `(ctx, model, prompt, schema, cacheKey, tools?, params?) → Promise<unknown>` — host seam | `arrival/arrival-scheme-env-infer/src/infer.ts:40` |
| `asLlmModel` | `(model) → { name, middleware, params? }` — seal helper | `arrival/arrival-scheme-env-infer/src/infer.ts:93` |
| `canonicalizeMessages` | `(messages) → string` — `(role content)` list → wire string (seal helper) | `arrival/arrival-scheme-env-infer/src/infer.ts:78` |
| `schemaSlot` | `(v) → string \| null` — canonical schema slot (seal helper) | `arrival/arrival-scheme-env-infer/src/infer.ts:66` |
| `nullable` | `(v) → string \| null` — `#f`/null/undefined → null | `arrival/arrival-scheme-env-infer/src/infer.ts:62` |
| `McpEffectResolver` (type) | `(ctx, effect) → Promise<unknown>` — the MCP membrane seam | `arrival/arrival-scheme-env-infer/src/mcp.ts:120` |
| `inertMcpResolver` | disarmed default; throws a teaching error at call time | `arrival/arrival-scheme-env-infer/src/mcp.ts:134` |
| `describeMcpEffect` | `(effect) → string` — at-a-glance label (not the effect key) | `arrival/arrival-scheme-env-infer/src/mcp.ts:124` |
| `McpEffect`, `McpMethod`, `McpServerSpec`, `McpRoster` (types) | MCP protocol/seam shapes | `arrival/arrival-scheme-env-infer/src/mcp.ts:96`, `:40`, `:79`, `:89` |

`asLlmModel` / `canonicalizeMessages` / `schemaSlot` / `nullable` are the **seal helpers** chain's
`sealPromptUnit` imports — the seal lives in chain (it also needs the handlebars render), so it
pulls these out of this package rather than the reverse (`arrival/arrival-scheme-env-infer/src/index.ts:13`).

## Key internals

- **Three capabilities, deliberate dep order** (`arrival/arrival-scheme-env-infer/src/index.ts:6`): `derive` (pure value
  constructors, no config/resolver) → `infer` (`deps:[derive]`, needs `llm`) → `mcp` +
  `agentic` (dispatch + the loop). `derive` is the dependency floor — both `infer` (for `llm`)
  and `mcp` (for `mcp`/`derive`) `deps` on it (`arrival/arrival-scheme-env-infer/src/derive.ts:14`).
- **The inference seam.** Verbs read `this.configuration.infer` (an `InferFn` the host wraps
  around its cache-backed engine) — `arrival/arrival-scheme-env-infer/src/infer.ts:136`. `infer` config is required;
  `mcp` config is optional (`arrival/arrival-scheme-env-infer/src/mcp.ts:314`, `:357`).
- **The MCP membrane.** Program tool calls cross the value-only `McpEffect` seam
  (`arrival/arrival-scheme-env-infer/src/mcp.ts:96`); the credentialed transport stays host-side in `McpServerSpec.methods`
  (`arrival/arrival-scheme-env-infer/src/mcp.ts:79`). Absent a host resolver, calls route to `inertMcpResolver`, which
  throws a teaching "MCP is not enabled" error — never a silent no-op (`arrival/arrival-scheme-env-infer/src/mcp.ts:134`).
- **Agentic loop** (`arrival/arrival-scheme-env-infer/src/mcp.ts:251`): resolve `:tools` server values to neutral
  descriptors (`resolveTools`, `arrival/arrival-scheme-env-infer/src/mcp.ts:207`), then loop infer↔dispatch via
  `runAgenticLoop`. Each turn infers with `ctx=undefined` so per-turn inferences record as
  effects without re-binding the agentic node's trace (one provenance node, `arrival/arrival-scheme-env-infer/src/mcp.ts:267`).
  The loop runs on the captured RAW `InferString` (a scheme middleware return would demote it
  via `schemeToJs` and drop `toolCalls`).
- **`mcp/break`** is the global registered halt sentinel (`MCP_BREAK`), bound as a value so scheme
  and the JS runner compare `===` across the membrane (`arrival/arrival-scheme-env-infer/src/derive.ts:127`). A break on a
  single `(infer …)` is a category error (`BREAK_ON_SINGLE_INFER`, `arrival/arrival-scheme-env-infer/src/infer.ts:57`).
- **`derive`** installs observe-only, cache-NEUTRAL middleware; **`llm/with`** binds
  cache-AFFECTING content params (typed-not-bag — unknown/wrong-typed `:keyword` is a legible
  throw, `arrival/arrival-scheme-env-infer/src/derive.ts:74`).

## Invariants / notes

- Dependency edge **chain → here, never back**: no `arrival-chain` import in `src/`
  (`arrival/arrival-scheme-env-infer/src/index.ts:6`, `arrival/arrival-scheme-env-infer/src/mcp.ts:8`).
- `infer` resolution returns the raw value; the verb wraps to a scheme list (`inferList`,
  `arrival/arrival-scheme-env-infer/src/infer.ts:74`).
- MCP effect is positional-keyed by the host server-tape, NOT content-keyed like infer/http/sql
  (`arrival/arrival-scheme-env-infer/src/mcp.ts:123`); see [[glossary#effect-membrane-effect-log]].
- The host-side server-tape (`wrapMcpResolver`, positional record/replay) STAYS in arrival-chain;
  it imports the seam types from here one-way (`arrival/arrival-scheme-env-infer/src/mcp.ts:11`).
- `runtime deps`: `@here.build/arrival`, `@here.build/arrival-inference`, `tiny-invariant`, `zod`
  (`arrival/arrival-scheme-env-infer/package.json:42`).

## Tests

`src/__tests__/`: `infer.test.ts`, `derive.test.ts`, `mcp.test.ts`, `mcp-server-value.test.ts`,
`mcp-middleware.test.ts` (vitest). Counts not tallied in this pass.

## Tasks

- None open against this package.
- Recipe for adding a pack of this shape: [[add-a-scheme-env-pack]].
