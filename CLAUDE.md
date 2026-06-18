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

The workspace **installs, builds, and typechecks** (verified):
`corepack pnpm install --frozen-lockfile` → ok; `pnpm build` → 15/15; `pnpm typecheck` → 27/27.

Bootstrap (the chibi-scheme submodule is only needed for the R7RS conformance suite; tests skip
it gracefully when absent):

```sh
git submodule update --init --recursive   # optional: enables chibi-r7rs
corepack pnpm install --frozen-lockfile
corepack pnpm build
```

Known-open, **documented not fixed** (see [[docs/90-backlog/_moc|repair backlog]]):
`pnpm test` has 2 pre-existing failures (a test depending on the non-extracted `arrival-type-lens`;
an unhandled `AbortError` in arrival-chain's abort path) and `pnpm lint` is repo-wide red (the
packages were never migrated to ESLint 9 flat config). These were *uncovered* by fixing the
install — not introduced by it.

> Historical context (no longer the operating rule): earlier phases were strictly
> documentation-only ("build nothing / fix nothing"). That constraint has been lifted.

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

- When you state a fact about the code, anchor it with `path:line`. If you cannot verify it,
  mark it unverified. Prove "green" with pasted command output, not confidence language.
- Fix only what's in scope; if a change uncovers unrelated source/config debt, file it in
  [[docs/90-backlog/_moc|the backlog]] rather than silently expanding scope.
- Conventions for the vault live in [[conventions]]; note front-matter in [[front-matter-spec]].
