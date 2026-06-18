---
title: Architecture overview
layer: reference
status: in-review
tags: [reference, architecture, monorepo]
canonical-for: [architecture-overview]
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
code-anchors:
  - package.json:1                       # @here.build/foundations root, private monorepo
  - pnpm-workspace.yaml:1                # workspace package globs
  - LICENSE.md:1                         # FSL-1.1-MIT
---

# Architecture overview

Monorepo for here.build foundations: a CRDT state engine ([[plexus]]) and a sandboxed Scheme
runtime stack ([[arrival]] + `arrival-*`), plus shared `common-*` infra. Agent-first: see
[[cross-cutting/_moc]] for the concepts that span packages.

## Monorepo shape

- Tooling: **pnpm** workspaces + **turbo** task graph (`package.json:6` scripts delegate to
  `turbo build|test|typecheck|lint`; `pnpm@10.3.0`, Node `>=22` — `package.json:1`).
- Workspace globs (`pnpm-workspace.yaml:1`): `plexus`, `arrival/*`, `common/*`, plus
  `device-frame`, `css-viewport-transform`, `ios-layout-solver` **(unverified — listed in the
  workspace file but no matching top-level dirs present in the working tree)**.
- Supply-chain guard: `minimumReleaseAge: 10080` (7 days) refuses freshly-published deps
  (`pnpm-workspace.yaml:12`).

| Group | Count | Packages |
|---|---|---|
| root | 1 | `plexus` |
| `arrival/*` | 11 | arrival, arrival-chain, arrival-chain-view, arrival-env, arrival-inference, arrival-mcp, arrival-provenance, arrival-scheme-env-infer, arrival-scheme-env-ramda, arrival-serializer, arrival-sweet |
| `common/*` | 5 | collections, error-invariant, eslint-config, lexical-namer, tsconfig (note names prefixed `common-`) |

Verified: `arrival/` holds exactly 11 dirs; `common/` holds exactly 5. Package detail in
[[10-reference/packages/_moc]].

## The two flagships

| Flagship | What | Canonical concept |
|---|---|---|
| **Plexus** | two-Y.Doc CRDT state engine (shadow working copy + main committed store), liminality, virtual genesis, materialization. | [[crdt-state-model]] |
| **Arrival** | sandboxed Scheme interpreter (forked from LIPS) + the inference / chain / provenance / MCP stack layered on it. | [[membrane]], [[determinism-and-effects]], [[provenance-model]], [[discovery-action-tiers]] |

## Dependency direction

- The arrival stack layers **upward**: `arrival` (interpreter) → `arrival-inference` /
  `arrival-provenance` → `arrival-chain` → `arrival-mcp` / view packages.
- `arrival-scheme-env-infer` note: *"edge runs chain→here, never back"* — the env-infer pack is
  consumed by `arrival-chain` (`arrival/arrival-chain/src/infer-kernel.ts:27` imports
  `@here.build/arrival-scheme-env-infer`); the dependency never flows the reverse way. See
  [[arrival-scheme-env-infer]].
- Provenance is **read-only**: derived from a trace, it never drives the evaluator (see
  [[provenance-model]]).

## Build / verify commands

| Command | Effect |
|---|---|
| `pnpm build` | `turbo build` (`package.json:7`) |
| `pnpm test` | `turbo test` |
| `pnpm typecheck` | `turbo typecheck` |
| `pnpm lint` | `turbo lint` |

**Install currently fails.** `pnpm install --frozen-lockfile` errors
`ERR_PNPM_OUTDATED_LOCKFILE` — `pnpm-lock.yaml` is out of date with
`common/error-invariant/package.json` (verified 2026-06-18). Until fixed, the repo cannot be
built or run; see [[docs/90-backlog/_moc|backlog]].

## License

**FSL-1.1-MIT** (Functional Source License v1.1, MIT Future License) — converts to MIT two years
after release (`LICENSE.md:1`). See [[glossary#fsl-1-1-mit]].
