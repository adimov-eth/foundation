---
title: Operating as an agentic framework
layer: method
status: draft
tags: [pattern, agentic, arrival, mcp, inference, provenance]
canonical-for: []
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
code-anchors:
  - arrival/arrival-mcp/src/McpEnvCapability.ts:173   # McpEnvCapability — shared env both tiers derive from
  - arrival/arrival-mcp/src/DiscoveryTool.ts:196       # read tier (readOnlyHint)
  - arrival/arrival-mcp/src/ActionTool.ts:329          # write tier — batch context snapshot
  - arrival/arrival-chain/src/runner.ts:50             # runPipeline — chain entry point
  - arrival/arrival-inference/src/registry.ts:16       # ModelRouter — model id → backend
---

# Operating as an agentic framework

> The key note for the downstream goal: how a **future step** wields *this repo's own features*
> to do agentic work on **other** projects. This is forward-looking design, not a built feature.

**Scope note:** MCP-*serving* (standing up a live MCP server) is **NOT built in this phase**. This
note describes the substrate that exists today and how it composes into an agentic loop later.

## The substrate (what exists, anchored)

| Capability | What it gives an agent | Package / anchor |
|---|---|---|
| **DiscoveryTool / ActionTool** | the two-tier surface — side-effect-free explore + immutable-batch mutate | [[arrival-mcp]] · `DiscoveryTool.ts:196`, `ActionTool.ts:329` |
| **McpEnvCapability** | the shared env (symbols/config/resources) both tiers derive from; the unit you author per domain | [[arrival-mcp]] · `arrival/arrival-mcp/src/McpEnvCapability.ts:173` |
| **capability / env-pack system** | composable, sandboxed environments assembled from packs | [[arrival-env]] · scheme env packs [[arrival-scheme-env-infer]], [[arrival-scheme-env-ramda]] |
| **content-keyed inference substrate** | `(infer …)` with single-flight cache + pluggable backends, replayable | [[arrival-inference]] · `runPipeline` `arrival/arrival-chain/src/runner.ts:50`, `ModelRouter` `arrival/arrival-inference/src/registry.ts:16` |
| **provenance** | per-value lineage → legibility / audit / slice | [[arrival-provenance]] |

## How it composes into an agentic loop

1. **Author a capability** for the target domain — define its symbols/config/resources on an
   `McpEnvCapability` (`McpEnvCapability.ts:173`). Discovery exposes them read-only
   ([[discovery-action-separation]]); Action exposes typed, batched mutations
   ([[batch-context-immutability]]). Playbook: [[author-an-mcp-tool]].
2. **Drive inference** through `runPipeline` (`runner.ts:50`), which binds a content-keyed
   `InferStore` over a `ModelRouter` (`registry.ts:16`). The router maps model ids to backends
   (`arrival/arrival-inference/src/backends/`: anthropic, openai, openrouter, ollama, vercel) and
   is immutable-by-construction. Per-run config ships as `config.scm` (config-as-code). Playbook:
   [[run-a-pipeline]].
3. **Replay deterministically** — effects are content-keyed ([[content-addressed-effects]]), so a
   run re-executes without the world shifting underneath it.
4. **Read what happened** — provenance ([[provenance-as-first-class]]) gives per-value lineage, so
   the agent's work on the other project is legible and sliceable.

## Why this is the right tool for the job

The same six patterns that counter [[fragmentation-hypothesis|drift]] *are* the framework's
operating contract: the agent explores safely ([[security-by-deletion]] +
[[discovery-action-separation]]), commits coherently ([[batch-context-immutability]]), in a
notation that matches its reasoning ([[sexpr-over-json]]), with replayable effects
([[content-addressed-effects]]) and first-class lineage ([[provenance-as-first-class]]). To take
the method to a non-here.build target, see [[transferability-guide]].

## What is deliberately out of scope here

- Standing up a live MCP server (serving) — later phase.
- A turnkey CLI agent — the pieces compose into one; assembling it is downstream work.
