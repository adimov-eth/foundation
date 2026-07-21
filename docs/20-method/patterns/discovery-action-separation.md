---
title: Discovery/Action separation
layer: method
status: draft
tags: [pattern, mcp, arrival, agentic, sandbox]
canonical-for: [discovery-action-separation]
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
code-anchors:
  - arrival/arrival-mcp/src/DiscoveryTool.ts:196   # readOnlyHint — explore tier is side-effect-free
  - arrival/arrival-mcp/src/DiscoveryTool.ts:45     # sandboxed REPL env per call
  - arrival/arrival-mcp/src/ActionTool.ts:329       # fullCtx snapshot built once per batch
  - arrival/arrival-mcp/src/ActionTool.ts:390       # same fullCtx passed to every action
  - arrival/arrival-mcp/src/dispatch.ts:13          # errors returned as data (success:false), not thrown
---

# Discovery/Action separation

> Pattern (the *why*). Reference (the *what*): [[discovery-action-tiers]]. Term: [[glossary#discovery-action-separation]].

## Problem

In standard tool architectures **every tool call is an action** — there is no side-effect-free
way to look. An agent that wants to *explore* ("what fields exist? what's the shape of this?")
must do so by *executing*, threading exploration through the same mutation pathway as commitment.
Per the [[fragmentation-hypothesis]] this is a prime driver of [[glossary#fragmentation-hypothesis|subprocess desync]]:
the exploratory reasoning pattern fires the execution pathway, a misfire triggers a failsafe
restore, and distinct response patterns end up operating on inconsistent state.

## Mechanism

Split the surface into two tiers over **one** shared environment:

| Tier | Verb | Guarantee |
|---|---|---|
| **Discovery** | a sandboxed Scheme REPL over a capability's symbols | read-only; no external effect; errors return as data |
| **Action** | a validated *batch* of typed actions | mutates; all actions see one immutable context snapshot ([[batch-context-immutability]]) |

Explore freely and cheaply in Discovery; commit deliberately in Action. The tiers cannot bleed
into each other because the read tier has no mutation verbs in scope and the write tier resolves
its context once.

## How this repo instantiates it

- Discovery is advertised read-only and runs in a sandboxed env per call —
  `arrival/arrival-mcp/src/DiscoveryTool.ts:196` (`annotations: { readOnlyHint: true }`),
  env wiring at `arrival/arrival-mcp/src/DiscoveryTool.ts:45`.
- Action snapshots its context **once per batch** and reuses it for every action —
  `arrival/arrival-mcp/src/ActionTool.ts:329` (`fullCtx` built), then
  `arrival/arrival-mcp/src/ActionTool.ts:390` (same `fullCtx` handed to each `act.handle`).
- Soft failures (e.g. validation) surface as data, not exceptions —
  `arrival/arrival-mcp/src/dispatch.ts:13` (`success: false` convention).
- Both tiers derive from the same [[glossary#mcpenvcapability|McpEnvCapability]] — see [[arrival-mcp]].

## Why it counters drift

Exploration no longer fires the execution pathway, so the explore→panic→restore cascade in the
[[fragmentation-hypothesis]] has no trigger. Errors-as-data keep the agent in one coherent state
rather than a failsafe restore to an earlier checkpoint. Observed effect: markedly longer
drift-free tool-call chains than immediate-execution MCP — see [[fragmentation-hypothesis]] for
the figure and its caveats (observational; correlation ≠ causation).

## How to apply elsewhere

1. Add a read-only introspection verb (REPL, query, or `describe`) that is *architecturally*
   incapable of mutating — not merely "please don't".
2. Move all mutation behind a single batch-commit verb.
3. Make every error a value the model can read and recover from, never a thrown panic.
4. Anti-pattern: a single "do it" tool that both reads and writes. See [[transferability-guide]].
