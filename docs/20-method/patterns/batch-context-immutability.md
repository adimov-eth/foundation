---
title: Batch context-immutability
layer: method
status: draft
tags: [pattern, mcp, arrival, agentic, invariant]
canonical-for: [batch-context-immutability]
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
code-anchors:
  - arrival/arrival-mcp/src/ActionTool.ts:14   # constraint: all actions in a batch share one context scope
  - arrival/arrival-mcp/src/ActionTool.ts:105  # context resolved + validated ONCE per batch
  - arrival/arrival-mcp/src/ActionTool.ts:329  # fullCtx snapshot
  - arrival/arrival-mcp/src/ActionTool.ts:390  # same snapshot to every action handler
---

# Batch context-immutability

> Pattern (the *why*). Reference (the *what*): [[discovery-action-tiers]] (the ActionTool batch).
> Term: [[glossary#actiontool]].

## Problem

When a tool runs a sequence of mutations, the context each step reads can change *mid-sequence*
(an earlier action, or a concurrent caller, shifts the world). There is no architectural
guarantee that every step saw the same state. Per the [[fragmentation-hypothesis]] this is
exactly where distinct response patterns desynchronize: "context changing mid-operation" leaves
different patterns operating on inconsistent state.

## Mechanism

Resolve and validate the action context **once**, snapshot it, and hand the *same frozen
snapshot* to every action in the batch. Mid-batch state drift becomes **structurally
impossible** — not merely discouraged. This is the write-tier half of
[[discovery-action-separation]].

## How this repo instantiates it

- The constraint is stated at the class header — `arrival/arrival-mcp/src/ActionTool.ts:14`
  ("all actions in a batch share exactly the same context scope").
- Context is resolved + validated once per batch — `arrival/arrival-mcp/src/ActionTool.ts:105`
  (the shared context scope, "validated + resolved ONCE per batch", which doubles as a token
  saver: declared once, not per action).
- The snapshot `fullCtx` is built once — `arrival/arrival-mcp/src/ActionTool.ts:329` — and the
  *same* object is passed to every handler — `arrival/arrival-mcp/src/ActionTool.ts:390`
  (`act.handle(fullCtx, …)`). See [[arrival-mcp]].

## Why it counters drift

Eliminating mid-batch context change removes the precise failure mode the
[[fragmentation-hypothesis]] names — there is no window in which two actions observe different
worlds. It also reduces tokens (context declared once), which keeps long chains cheaper and
cleaner. Closely related to the determinism story in [[determinism-and-effects]] and
[[content-addressed-effects]].

## How to apply elsewhere

1. Make batch tools resolve context **before** executing any step, then freeze it.
2. Pass the frozen snapshot explicitly to each step; never let a step re-read mutable global
   state.
3. Declare shared context once per batch (correctness *and* token savings).
4. Anti-pattern: a mutable shared context object that actions read live as they run. See
   [[transferability-guide]].
