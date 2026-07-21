---
title: Awareness usage example (extracted product code)
layer: history
status: verified
tags: [history, audit, plexus, closed-code]
canonical-for: []
source-provenance:
  origin: tmp/awareness.ts
  branch: origin/tmp-6164624
  retrieved: 2026-06-18
  authority: historical
last-verified: 2026-06-18
verified-against: origin/tmp-6164624
---

> ⚠️ Frozen historical copy — possibly outdated; current truth in [[source-layers]].

---

# Awareness usage example (narrated)

This note **does not** reproduce `tmp/awareness.ts` verbatim. It is an extracted
**product usage example** — a slice of closed product code recovered alongside the
foundation sources — kept here only to document *that closed code still references the
public packages*, and what shape that reference takes. The narration below summarizes the
file; it is not the source.

## What the file demonstrates

`awareness.ts` defines a **`StudioAwareness` presence layer** built on top of the Yjs
`Awareness` protocol from `y-protocols/awareness`. It is a "zero-declaration" subclass:
it extends `Awareness` purely to add TypeScript types over the same runtime, so any
`Awareness` instance can be cast to `StudioAwareness` for typed access to
`setLocalStateField`, `getStates`, `getLocalState`, etc.

The presence model tracks viewport-based multiplayer presence with semantic dimensions:

- A broadcast `StudioAwarenessState` JSON object with a `client` discriminator
  (`"browser"` vs `"mcp"`), a server-injected `userId`, plus optional incrementally-built
  fields: `location`, `selection`, `variants`, `focusedFrame`, `viewport`, `pointer`,
  `isTabFocused`, and activity timestamps.
- Grouping logic (`getPresenceByUser`) that buckets all client states by user, dedupes MCP
  agent sessions by session id, and selects a "primary" session using the rule
  **focused human > most-recent human > most-recent agent**.
- A MobX-observable user-info cache with fire-and-forget fetching, and a deterministic
  per-client presence color palette.

It distinguishes **human browser sessions** from **AI agent (MCP) sessions** for the same
user, which is why it is interesting as an artifact: it is product-level presence code that
is explicitly multiplayer- and agent-aware.

## Why it matters for reconciliation (closed code referencing public types)

The significance is the **dependency direction**: this closed product file imports and
builds directly on public/foundation surfaces —

- `Awareness` from `y-protocols/awareness` (the CRDT presence primitive Plexus also builds on),
- `PlexusUUID` from `@here.build/plexus`,
- `PublicUserData` / `UserId` from `@here.build/types`.

It also references **closed product domain types** that are *not* part of the foundation
vault and have no living note here:

- `Arena`, `ArenaFrame`, `Component`, `TplNode`, `Variant`, `VariantGroup`
  (imported from a sibling `./index.js`).

So this file is evidence that **closed code still references the open packages** (and layers
its own closed types on top). It belongs in the prior-audit history as a recovered usage
example, not as authoritative API documentation. The closed types above are intentionally
left as dangling references — they live in a product codebase outside this vault. See
[[source-layers]] for how open-vs-closed boundaries are reconciled.
