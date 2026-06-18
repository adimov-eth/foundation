---
title: Discovery / Action tiers (MCP)
layer: reference
status: in-review
tags: [reference, cross-cutting, arrival, mcp]
canonical-for: [discovery-action-tiers]
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
code-anchors:
  - arrival/arrival-mcp/src/DiscoveryTool.ts:1          # DiscoveryTool (read REPL, value not subclass)
  - arrival/arrival-mcp/src/DiscoveryTool.ts:10         # three membrane TIMES (eval/dispatch/describe)
  - arrival/arrival-mcp/src/DiscoveryTool.ts:34         # MCP_OUTPUT_BUDGET
  - arrival/arrival-mcp/src/ActionTool.ts:1             # ActionTool (batch mutations)
  - arrival/arrival-mcp/src/ActionTool.ts:12            # shared context scope, declared/validated ONCE
  - arrival/arrival-mcp/src/McpEnvCapability.ts:1       # McpEnvCapability (shared env both tiers derive from)
---

# Discovery / Action tiers

Canonical home for arrival's two-tier MCP surface: a read tier (Discovery) and a mutation tier
(Action), both derived from one capability. Package surface: [[arrival-mcp]].

**Why:** see [[20-method/patterns/discovery-action-separation]] (explore without side effects vs
mutate in immutable-context batches). Terms: [[glossary#mcp]], [[glossary#discoverytool]],
[[glossary#actiontool]], [[glossary#mcpenvcapability]], [[glossary#discovery-action-separation]].

## The two tiers

| Tier | Tool | Shape | Side effects |
|---|---|---|---|
| read | `DiscoveryTool` | a sandboxed Scheme **REPL** over a capability's symbols (`{expr, intent}` ∪ the capability's config). | none — exploration only. |
| mutation | `ActionTool` | a validated **batch** of tuple-invoked typed actions (`["place-node", {position, target}]`) sharing one context scope; **stop-on-first-failure** (a failing action halts the rest, prior actions persist) unless a `wrapBatch` supplies atomicity. | mutates. |

Both are **values, not subclasses** (`new DiscoveryTool(...)` / `new ActionTool(...)`), and both
derive from the same `McpEnvCapability` (`arrival/arrival-mcp/src/McpEnvCapability.ts:1`) — the
shared env of symbols / config / resources. `DiscoveryTool` derives its input schema, catalog
(`capability.allAnnotations()`), and eval env from that one capability
(`arrival/arrival-mcp/src/DiscoveryTool.ts:1`).

## Three membrane times (Discovery)

Host concerns enter at three distinct times, never co-mingled
(`arrival/arrival-mcp/src/DiscoveryTool.ts:10`):

| Time | What enters | Why isolated |
|---|---|---|
| eval-time | the capability's `resources` (per-call config; verbs read `this.resources.x.live`). | authorization = a resource that won't spawn. |
| dispatch-time | `ToolCallCtx` (session, user, abort signal, record sink). | lives ABOVE the eval membrane — a run can't reach session/other-call state. |
| describe-time | infra closed over when the host built the capability (the welcome). | static catalog text. |

Output is budgeted: `MCP_OUTPUT_BUDGET` (~40k chars, split per result element) keeps a tool result
inside the client's token limit (`arrival/arrival-mcp/src/DiscoveryTool.ts:34`) — see the budgeted
serializer in [[s-expressions-vs-json]].

## Immutable context (Action)

A batch's context is **declared once at the top and validated/resolved once per batch**, so N
actions don't re-declare shared fields (`projectId` / `component` / `element`)
(`arrival/arrival-mcp/src/ActionTool.ts:12`). This is the *"all actions in a batch share exactly the
same context scope"* constraint. The context is twice load-bearing: it's the awareness wiring
(actions reference shared fields by name; handlers receive them typed via `needs`) **and** the token
saver. Context fields may be `Ref`s that resolve a UUID/name/instance against the live ctx; one
action name may dispatch by receiver class (`on`/`receiverKey`, exact-class match).

## Invariants

- Discovery never mutates; mutation goes only through ActionTool batches.
- All actions in a batch share exactly one immutable context scope (declared/validated once).
- The three membrane times stay separated — a run reaches eval-time resources but never
  dispatch-time `ToolCallCtx`.
- Tool output stays within `MCP_OUTPUT_BUDGET`; over-budget renders truncate, they do not overflow.
