---
title: arrival-mcp
layer: reference
status: verified
tags: [package, arrival, mcp, cross-cutting]
canonical-for: []
summary: MCP tools-as-values over the official SDK — a read tier (DiscoveryTool, a sandboxed Scheme REPL) and a mutation tier (ActionTool, a validated batch of typed actions) derived from one McpEnvCapability.
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
code-anchors:
  - arrival/arrival-mcp/src/McpEnvCapability.ts:173   # McpEnvCapability
  - arrival/arrival-mcp/src/McpEnvCapability.ts:214    # allAnnotations
  - arrival/arrival-mcp/src/McpEnvCapability.ts:30      # McpAnnotation
  - arrival/arrival-mcp/src/DiscoveryTool.ts:183        # DiscoveryTool
  - arrival/arrival-mcp/src/DiscoveryTool.ts:144        # ToolCallCtx (above eval membrane)
  - arrival/arrival-mcp/src/ActionTool.ts:199           # ActionTool
  - arrival/arrival-mcp/src/ActionTool.ts:136           # wrapBatch (atomicity)
  - arrival/arrival-mcp/src/refs.ts:59                  # defineRef (ctx-aware resolution)
  - arrival/arrival-mcp/src/refs.ts:368                 # FieldSpec primitives
  - arrival/arrival-mcp/src/dispatch.ts:18              # serializeResult
  - arrival/arrival-mcp/src/sdk-adapter.ts:50           # registerTools
  - arrival/arrival-mcp/src/ActionTool.ts:590           # stop-on-first-failure batch (description)
  - arrival/arrival-mcp/src/ActionTool.ts:412           # wrapBatch invoked (true atomicity)
  - arrival/arrival-mcp/src/errors.ts:41                # MCPError
  - arrival/arrival-mcp/src/errors.ts:12                # MCPErrorKind
  - arrival/arrival-mcp/src/errors.ts:69                # classifyError
  - arrival/arrival-mcp/src/errors.ts:88                # withTimeout
  - arrival/arrival-mcp/src/errors.ts:133               # checkSizeLimit
  - arrival/arrival-mcp/src/errors.ts:118               # SizeLimits
  - arrival/arrival-mcp/src/errors.ts:127               # DEFAULT_SIZE_LIMITS
  - arrival/arrival-mcp/src/InMemorySessionStore.ts:3   # InMemorySessionStore (aliased InMemoryArrivalSessionStore)
  - arrival/arrival-mcp/src/store.ts:43                 # ArrivalSessionStore
  - arrival/arrival-mcp/src/store.ts:6                  # SessionRecord
  - arrival/arrival-mcp/src/store.ts:24                 # InteractionRecord
  - arrival/arrival-mcp/src/resources/index.ts:9        # ArrivalResourceContents
  - arrival/arrival-mcp/src/resources/index.ts:11       # ResourceProvider
  - arrival/arrival-mcp/src/resources/index.ts:19       # ARRIVAL_RESOURCE_MIME
  - arrival/arrival-mcp/src/refs.ts:368                 # Primitive union
  - arrival/arrival-mcp/src/refs.ts:392                 # optional
---

# arrival-mcp

## Overview

[[glossary#mcp|MCP]] tools-as-values, built on the official `@modelcontextprotocol/sdk`.
The package splits a tool surface into the two [[discovery-action-tiers|tiers]]: a
read tier ([[glossary#discoverytool|DiscoveryTool]] — a sandboxed Scheme REPL over a
capability's symbols) and a mutation tier ([[glossary#actiontool|ActionTool]] — a
validated batch of typed actions). Both derive from one
[[glossary#mcpenvcapability|McpEnvCapability]] (the shared env of symbols/config/
resources). Tools are plain VALUES (`new DiscoveryTool(…)` / `new ActionTool(…)`), not
subclasses; `registerTools` mounts them on an official `McpServer`. See
[[discovery-action-separation]] (why explore ≠ mutate) and
[[batch-context-immutability]] (why a batch shares one validated-once context).

Published `@here.build/arrival-mcp`.

## Public API table

| Export | Signature (abridged) | File:line |
|---|---|---|
| `McpEnvCapability` | `class extends EnvCapability` — symbols + MCP annotations | McpEnvCapability.ts:173 |
| `McpEnvCapability.allAnnotations` | `() => Record<string, McpAnnotation>` — the catalog | McpEnvCapability.ts:214 |
| `McpAnnotation` | `interface` — `description`/`dynamicDescription`/`inputSchema`/`aliases` | McpEnvCapability.ts:30 |
| `DiscoveryTool` | `class` — `new (name, capability, opts)`; `describe()`/`call()` | DiscoveryTool.ts:183 |
| `ToolCallCtx` | `interface` — session/user/abort/record sink (above eval membrane) | DiscoveryTool.ts:144 |
| `ActionTool` | `class` — `new (name, opts)`; `describe()`/`call()` | ActionTool.ts:199 |
| `Act` / `ActBuilder` / `defineCluster` | typed-action declaration | ActionTool.ts:44,63,97 |
| `ActionToolOptions.wrapBatch` | `(ctx, runBatch, signal) => Promise<…>` — batch atomicity | ActionTool.ts:136 |
| `defineRef` / `Ref` / `RefSpec` | ctx-aware UUID/name/instance resolution | refs.ts:59,42,53 |
| `uuidShape`/`nameShape`/`objectShape`/`instanceShape` | ref shapes | refs.ts:158,178,204,254 |
| `FieldSpec` primitives | `str`/`num`/`bool`/`oneOf`/`scalar`/`stringRecord`/`rawList` | refs.ts:370–383 |
| `registerTools` | `(mcp, tools, resolveCtx?) => void` — mount on `McpServer` | sdk-adapter.ts:50 |
| `serializeResult` | `(result) => Promise<CallToolResult>` — userland → MCP lowering | dispatch.ts:18 |
| `McpTool` | `interface` — `describe()`/`call()` contract | sdk-adapter.ts:31 |
| `MCPError` | `class extends Error` — typed error with discrete `kind`/`details` | errors.ts:41 |
| `MCPErrorKind` | `type` union — `parse`/`validation`/`prepare`/`timeout`/`size-limit`/… | errors.ts:12 |
| `classifyError` | `(e, fallbackKind?) => MCPError` — egress normalizer (preserves MCPError) | errors.ts:69 |
| `withTimeout` | `(op, deadlineMs, phase, target?) => Promise<T>` — race against deadline | errors.ts:88 |
| `checkSizeLimit` | `(current, max, label, target?) => void` — throws `size-limit` MCPError | errors.ts:133 |
| `SizeLimits` | `interface` — `maxActions`/`maxPropsFields`/`maxStringFieldSize` | errors.ts:118 |
| `DEFAULT_SIZE_LIMITS` | `Required<SizeLimits>` — `50`/`64`/`16384` defaults | errors.ts:127 |
| `InMemoryArrivalSessionStore` | `class implements ArrivalSessionStore` (aliased from `InMemorySessionStore`) | InMemorySessionStore.ts:3 |
| `ArrivalSessionStore` | `interface` — session lifecycle + interaction/phantom recording | store.ts:43 |
| `SessionRecord` / `InteractionRecord` | `interface` — session + per-call records | store.ts:6,24 |
| `ResourceProvider` | `interface { list, read }` — wired to MCP `resources/list`/`read` | resources/index.ts:11 |
| `ArrivalResourceContents` | `type` — `TextResourceContents \| BlobResourceContents` | resources/index.ts:9 |
| `ARRIVAL_RESOURCE_MIME` | `const string` — arrival entity resource MIME | resources/index.ts:19 |
| `Primitive` | `type` union of `FieldSpec` primitives | refs.ts:368 |
| `optional` | `<P extends Primitive>(spec) => P & { optional: true }` | refs.ts:392 |

## Key internals

- **`McpEnvCapability`** (`McpEnvCapability.ts:173`) — extends the MCP-agnostic base
  `EnvCapability` (verbs/config/resources/deps/prelude) with per-verb MCP metadata.
  The annotation fields (`description`, `dynamicDescription`, positional `inputSchema`,
  `aliases`; keys at line 61) are written INLINE on each symbol def, then the
  constructor LIFTS them off (`liftInlineAnnotations`, line ~135) into a separate
  `annotations` record so they stay inert to the runtime wiring — reflected off the
  capability root-set by a transport. `allAnnotations()` (line 214) is the catalog;
  `inputSchema` is a getter whose `this` is the `Activation`, so its zod transforms
  resolve args against the capability's LIVE resources post-membrane, pre-call.
- **`DiscoveryTool`** (`DiscoveryTool.ts:183`) — the **read tier as a value**.
  `input schema = { expr, intent } ∪ the capability's configuration`; `catalog =
  capability.allAnnotations()`; `eval = assembleEnv(base, [capability.lower({config})])`
  then `execSerialized` (a Scheme REPL). Output is budgeted: `MCP_OUTPUT_BUDGET`
  ~40k chars split per result element (line 30-34) so an oversized payload the client
  rejects is shrunk, not dropped. Three host concerns enter at three membrane TIMES,
  never co-mingled (line 11-16): **eval-time** → the capability's `resources`;
  **dispatch-time** → the `ToolCallCtx` (lives ABOVE the eval membrane, so a run can't
  reach session/other-call state); **describe-time** → infra closed over at build.
- **`ToolCallCtx`** (`DiscoveryTool.ts:144`) — session/user/abort signal/record sink.
  Deliberately **above the eval membrane** — the sandboxed run cannot reach it.
- **`ActionTool`** (`ActionTool.ts:199`) — the **mutation tier as a value**.
  Dispatches a BATCH of tuple-invoked typed `Act`s (`["place-node", {…}]`) sharing
  ONE context scope. Props are a NAMED object (not positional); a context field may be
  a `Ref` resolving a UUID/name/instance against the live ctx. One action NAME may
  dispatch by RECEIVER class (`on`/`receiverKey`, exact-class). The batch runs
  sequentially and is **stop-on-first-failure — a failing action halts the rest, and
  prior actions PERSIST** (it returns a `{success:false, partial:true}` report with the
  prior results + the failed action's index/name, not a rollback; ActionTool.ts:590
  states this in the schema description). True atomicity happens ONLY when an optional
  `wrapBatch` is supplied — `call` invokes it around the whole burst (ActionTool.ts:412),
  so the host (e.g. a CRDT transaction) can make the actions commit-or-discard together.
  The signal cancels BETWEEN actions; the shared context is **validated/resolved ONCE per batch** (the
  token saver + the [[batch-context-immutability|immutability]] constraint).
- **`refs`** (`refs.ts`) — `defineRef` (line 59) builds ctx-aware resolution; `FieldSpec`
  (`str`/`num`/`bool`/`oneOf`/`scalar`/`stringRecord`/`rawList`, line 370-383) is used
  instead of bare zod precisely because a zod `.transform` can't see the runtime ctx
  (a Component UUID → the live `Component` off the plexus needs the ctx).
- **`dispatch` / `sdk-adapter`** (`dispatch.ts:18`, `sdk-adapter.ts:50`) —
  `serializeResult` is the ONE userland→MCP lowering (string→text, object→JSON, Blob→…;
  `{success:false}` marks `isError` WITHOUT throwing). `registerTools` mounts each
  `McpTool` on an official `McpServer`, serializing returns through `serializeResult`.

## Invariants

- **Discovery never mutates; Action never explores** — the read tier is a sandboxed
  REPL (side-effect-free over `resources`), the mutation tier is a validated batch.
  See [[discovery-action-separation]].
- **A batch shares exactly one context scope**, validated/resolved ONCE — N actions
  do not re-declare or re-resolve shared fields. See [[batch-context-immutability]].
- **`ToolCallCtx` lives above the eval membrane** — session/other-call state is never
  reachable from a sandboxed run.
- MCP annotations are **inert to runtime wiring** — lifted off symbols, read only by a
  transport. Aliases are bound but never cataloged.
- Tools are VALUES implementing `describe()`/`call()` (the `McpTool` contract).

## Seams

- **Output budget** — DiscoveryTool caps total serialized output (~40k chars, split
  per element) to avoid the client-rejecting oversized-payload drop (DiscoveryTool.ts:30).
- **`dynamicDescription`** — an optional live/personalized catalog thunk resolved at
  schema-fetch time; resolving to `undefined` honestly falls back to `description`
  (not flagged dynamic), so a failed live-fetch degrades cleanly (McpEnvCapability.ts:30-54).

## Tests

5 test files under `arrival-mcp/src/__tests__/`: `ActionTool.test.ts`,
`DiscoveryTool.test.ts`, `errors.test.ts`, `refs.test.ts`, `sdk-adapter.test.ts`.

## Tasks

- Author an MCP tool (capability → Discovery/Action → register) → [[author-an-mcp-tool]].
