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

## Current repo state — read before running anything

The extraction repair has reconciled the workspace and lockfile: `corepack pnpm install
--frozen-lockfile` now validates against the current `plexus`, `arrival/*`, and `common/*`
workspace. `build`, `typecheck`, and docs-index validation are expected to pass on the repair branch.
The original evidence-bearing repair queue remains in [[docs/90-backlog/_moc|repair backlog]];
items marked `fixed` record the validating commands instead of being deleted.

Known non-green checks are deliberately tracked, not hidden:

- `corepack pnpm lint` remains red on `arrival-serializer` strict/config lint debt — see
  [[docs/90-backlog/items/08-p1-lint-debt-after-install-repair]].
- `corepack pnpm test` currently reaches timing-sensitive runtime tests and can fail under
  full-suite load while focused tests pass — see [[docs/90-backlog/items/10-p1-timing-sensitive-tests-under-load]].

Bootstrap submodules before running the full local suite or tests that exercise vendored
Scheme behavior:

```bash
git submodule update --init --recursive
corepack pnpm install --frozen-lockfile
```

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

- Preserve reconciliation honesty: if a claim is historical, lost, inferred, or current-state,
  label it that way.
- When you state a fact about the code, anchor it with `path:line`. If you cannot verify it,
  mark it unverified.
- Conventions for the vault live in [[conventions]]; note front-matter in [[front-matter-spec]].
