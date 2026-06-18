---
title: Author an MCP tool
layer: reference
status: verified
tags: [playbook, arrival, mcp, tool]
canonical-for: []
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
code-anchors:
  - arrival/arrival-mcp/src/McpEnvCapability.ts:173   # McpEnvCapability
  - arrival/arrival-mcp/src/DiscoveryTool.ts:183        # DiscoveryTool
  - arrival/arrival-mcp/src/ActionTool.ts:199           # ActionTool
  - arrival/arrival-mcp/src/sdk-adapter.ts:50           # registerTools
---

# Author an MCP tool

Expose a capability as MCP [[discovery-action-tiers|tools]] on the official SDK. Tools
are VALUES (`new DiscoveryTool(…)` / `new ActionTool(…)`) implementing the `McpTool`
contract (`describe()`/`call()`), mounted with `registerTools`. See [[arrival-mcp]].

## Steps

1. **Define the shared capability** — an `McpEnvCapability`
   (`McpEnvCapability.ts:173`): symbols (verbs) with inline MCP annotations
   (`description`, optional `dynamicDescription`, positional `inputSchema`, `aliases`),
   plus `configuration` (the actor's typed args) and `resources` (eval-time, e.g. a
   credentialed handle a verb reads via `this.resources.x.live`). The constructor lifts
   annotations off the symbols; `allAnnotations()` is the resulting catalog.

2. **Build the read tier** — `new DiscoveryTool(name, capability, { description })`
   (`DiscoveryTool.ts:183`). Its input schema is `{ expr, intent } ∪ configuration`;
   `call({ expr, intent }, ctx)` runs a sandboxed Scheme REPL over the capability's
   symbols (`assembleEnv(base, [capability.lower({config})])`) and returns
   budget-capped serialized results. Discovery **never mutates** — see
   [[discovery-action-separation]].

3. **Build the mutation tier** — `new ActionTool(name, { description, context, actions })`
   (`ActionTool.ts:199`). Declare typed `Act`s with NAMED props (`FieldSpec` from
   `refs.ts`, which can be a `Ref` resolving a UUID/name/instance against the live ctx
   — `defineRef`, `refs.ts:59`). The batch shares ONE `context` scope **validated/
   resolved once** ([[batch-context-immutability]]); it runs sequentially with
   rollback-report, and an optional `wrapBatch` (`ActionTool.ts:136`) makes the burst
   atomic. Dispatch by receiver class via `on`/`receiverKey`.

4. **Register on a server** (`sdk-adapter.ts:50`):
   ```ts
   registerTools(mcpServer, [discoveryTool, actionTool], resolveCtx);
   ```
   `resolveCtx` maps an incoming call to its **dispatch-time** `ToolCallCtx`
   (session/user/record sink — lives ABOVE the eval membrane; the adapter adds the
   request `signal`). Returns are lowered by the one `serializeResult` (`dispatch.ts:18`):
   a `string[]` (Discovery), an object, or an array — `{success:false}` marks `isError`
   without throwing. Do NOT mix with `mcp.registerTool` (these handlers replace its
   dispatch).

## Three membrane times (keep them separate)

- **eval-time** → the capability's `resources` (authorization = a resource that won't spawn).
- **dispatch-time** → the `ToolCallCtx` (a run can't reach it).
- **describe-time** → infra closed over when the capability was built (the welcome).

Reference: [[arrival-mcp]].
