# CLAUDE.md — agent entry point for `@here.build/foundations`

> You are an autonomous agent working in this repository. **Read this file first.**
> It routes you into the knowledge base under [`docs/`](./docs/index.md), which is the
> authoritative, agent-first map of this codebase. Prefer the KB over re-deriving facts
> from source; every claim in it carries a `file:line` anchor you can verify.

## What this repo is (30-second orientation)

`@here.build/foundations` is the **open-sourced extraction** of here.build's production
foundation packages. ~124K LOC TypeScript, pnpm + turbo monorepo, FSL-1.1-MIT. Two flagship
systems plus shared infra:

- **`plexus/`** — reactive CRDT state management over Yjs: plain TypeScript classes become the
  CRDT via `@syncing` decorators. See [[plexus]].
- **`arrival/`** — a stack for agentic work in a sandboxed Scheme: an interpreter
  ([[arrival]]), a content-keyed inference substrate ([[arrival-chain]], [[arrival-inference]]),
  provenance ([[arrival-provenance]]), an MCP tool layer ([[arrival-mcp]]), and supporting
  projection/serialization packages.
- **`common/`** — shared utilities ([[common-collections]], [[common-error-invariant]],
  [[common-lexical-namer]], configs).

The intellectual through-line is the **[[fragmentation-hypothesis]]**: long-chain agent drift
is architecture-induced, and is countered by the patterns in [[pattern-catalogue]]. This repo
is intended to be reused as a *framework for agentic work on future projects* — see
[[operating-as-agentic-framework]].

## ⚠️ Current repo state — read before running anything

This is a **post-refactor half-state**. **`pnpm install` currently fails** (stale lockfile,
ghost workspace packages). Do **not** assume a clean build. The full, evidence-bearing list of
known breakages is the repair backlog: [[docs/90-backlog/_moc|repair backlog]]. None are fixed
yet — this repo phase is **documentation/research only; build nothing**.

## How to navigate the knowledge base

| You need… | Go to |
|---|---|
| A fast structured map (JSON, cheap to load) | [`docs/_index/`](./docs/_index/) — `packages.json`, `symbols.json`, `concepts.json` |
| How to read this vault as an agent | [[agent-consumption-guide]] |
| What a package is + its API + `file:line` anchors | `docs/10-reference/packages/<name>.md` |
| A concept that spans packages (CRDT, membrane, effects, provenance) | `docs/10-reference/cross-cutting/` |
| Why the design works / transferable patterns | `docs/20-method/` |
| A step recipe for a concrete task | `docs/50-playbooks/` |
| What's broken / missing / drifted | `docs/30-reconciliation/`, `docs/90-backlog/` |
| Term definitions | [[glossary]] |

## Working rules in this repo

- This phase **builds nothing** and **fixes nothing** — it only produces documentation under
  `docs/` and this file. Do not modify source code.
- When you state a fact about the code, anchor it with `path:line`. If you cannot verify it,
  mark it unverified.
- Conventions for the vault live in [[conventions]]; note front-matter in [[front-matter-spec]].
