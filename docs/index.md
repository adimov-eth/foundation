---
title: Foundations knowledge base — home
layer: meta
status: in-review
tags: [meta]
canonical-for: [vault-home]
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
---

# `@here.build/foundations` — knowledge base

Agent-first map of this monorepo. Agents: start at [`CLAUDE.md`](../CLAUDE.md) (repo root, outside
this vault) and the structured indices in [`_index/`](./_index/). Humans: browse below.

This vault has **two interlinked layers** plus support:

## Layer 1 — Reference (what exists)
- [[architecture-overview]] — monorepo shape, build, dependency graph, the two flagships.
- **Packages** → [[10-reference/packages/_moc|package index]] (17 packages).
- **Cross-cutting concepts** → [[10-reference/cross-cutting/_moc|cross-cutting index]]:
  [[crdt-state-model]] · [[membrane]] · [[determinism-and-effects]] · [[provenance-model]] ·
  [[s-expressions-vs-json]] · [[discovery-action-tiers]].

## Layer 2 — Method (why it works, transferable)
- [[fragmentation-hypothesis]] — the kernel thesis.
- [[pattern-catalogue]] — the named patterns.
- [[operating-as-agentic-framework]] — how a future step wields this repo for agentic work.
- [[transferability-guide]] — applying the method to other projects.

## Doing things
- [[50-playbooks/_moc|Playbooks]] — task recipes.

## Honesty about this vault
- [[source-layers]] — the three inputs (current code / Archive / prior audit).
- [[dangling-doc-map]] — 19 in-code doc refs (2 recoverable, 17 lost).
- [[version-drift]] — rename drift, ghost packages.
- [[40-history/_moc|Vendored historical docs]] — frozen, dated.
- [[90-backlog/_moc|Repair backlog]] — original extraction breakages and their fixed/open status.

## Conventions
[[conventions]] · [[front-matter-spec]] · [[agent-consumption-guide]] · [[glossary]] ·
[[tag-taxonomy]].

> **Repo state:** workspace/lockfile extraction drift has been repaired. Use `corepack pnpm
> install --frozen-lockfile`; see [[90-backlog/_moc|Repair backlog]] for fixed/open status.
