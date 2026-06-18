---
title: P0 — frozen-lockfile install fails (stale lockfile)
layer: backlog
status: fixed
fixed-in: claude/repair-workspace
validated-by: ["corepack pnpm install --frozen-lockfile"]
tags: [backlog, p0, packaging, lockfile]
canonical-for: []
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
---

# 01 · P0 · `pnpm install --frozen-lockfile` fails

> ✅ Resolved in this repair pass (branch claude/repair-workspace). Regenerated the lockfile after removing the ghost globs; `pnpm install --frozen-lockfile` now exits 0 ("Lockfile is up to date").

**Symptom.** A clean `pnpm install --frozen-lockfile` (exactly what CI runs,
`.github/workflows/ci.yml:25`) cannot satisfy the lockfile against the current tree, so install,
typecheck, build, and lint never start. The prior audit reached the same conclusion
independently ([[40-history/prior-audit/hermes-analyses.archived|hermes_analyses.md]]: "the
lockfile is stale and references old/missing packages").

**Evidence (verified 2026-06-18).**
- `pnpm-lock.yaml:476` declares importer `arrival/arrival-scheme` — a directory that no longer
  exists (renamed to `arrival/arrival`; see [[version-drift]]).
- `pnpm-lock.yaml` lists importers absent from the tree: `arrival/arrival-codemirror` (`:204`),
  `arrival/arrival-sampler` (`:436`), `arrival/arrival-type-lens` (`:596`), `delta/delta-css`
  (`:752`), `delta/postcss-oklch-plus` (`:827`), `editor-theme` (`:858`), `envelope-crypto`
  (`:883`), `mcp-typescript-lsp` (`:908`), `y-messageport` (`:1015`).
- `common/error-invariant/package.json` declares devDependencies (`@here.build/eslint-configs`,
  `@here.build/tsconfig`, `@types/node`, `eslint`, `typescript`) but **no `common/error-invariant`
  importer exists in `pnpm-lock.yaml`** (grep returns nothing) — a workspace package the lockfile
  has never seen.

**Root cause.** The `arrival-scheme → arrival` rename, the `commons/ → common/` move, the
deletion of several packages, and the addition of `common/error-invariant` all landed in source
without regenerating the lockfile. `--frozen-lockfile` refuses to reconcile the gap.

**Proposed fix (not executed).** Regenerate `pnpm-lock.yaml` from the current workspace
(`pnpm install` without `--frozen-lockfile`, then commit), confirming the new lock contains
`common/error-invariant` and drops every ghost importer. Pairs with
[[items/02-p0-ghost-workspace-packages]] and [[items/05-p2-readme-rename-drift]].

**Effort.** L · **Risk.** med (regeneration may pull newer transitive versions; the
`minimumReleaseAge: 10080` guard in `pnpm-workspace.yaml` mitigates supply-chain risk).
