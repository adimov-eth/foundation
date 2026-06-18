---
title: Agent consumption guide
layer: meta
status: verified
tags: [meta, agent]
canonical-for: [agent-consumption]
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
---

# Agent consumption guide

How an autonomous agent should use this vault efficiently.

## Load order (cheap → rich)

1. **`docs/_index/*.json`** — structured maps, cheapest to load (manifest: [[_index/README]]). Start here:
   - `packages.json` — every package: path, role, entrypoints, key files, deps.
   - `symbols.json` — key exports → signature → `file:line`.
   - `concepts.json` — concept → canonical note + code anchors.
   - `glossary.json`, `backlog.json`, `dangling-docs.json`.
2. **The note that owns your concept** — resolve via `concepts.json` → canonical note.
3. **`code-anchors`** in that note's front-matter — jump straight to `file:line` in source.

## Rules of trust

- The **current working tree is authoritative.** Notes carry `last-verified` + `verified-against`;
  if those are stale relative to HEAD, re-verify the `code-anchors` before relying on them.
- `40-history/*` notes are **frozen and possibly outdated** (`authority: historical`). Use them
  for design intent, not current truth; always cross-check the living reference note.
- Claims marked **(unverified)** were not confirmable against the tree — treat as hypotheses.

## Finding the answer to a task

- "How do I do X?" → `50-playbooks/`.
- "What is X / where is it?" → `concepts.json` or the package note's API surface + `code-anchors`.
- "Why is it built this way?" → `20-method/` (patterns) via the cross-cutting note's "why" link.
- "Can I build/run it?" → **No** for now; see [[docs/90-backlog/_moc|backlog]] (install is broken).

## Invariants to respect

Each reference note has an **Invariants** section listing properties an agent must not violate
when reasoning about or (later) changing that code. Read it before proposing edits.
