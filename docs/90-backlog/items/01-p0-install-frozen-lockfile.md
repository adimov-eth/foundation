---
title: P0 — frozen-lockfile install fails (stale lockfile)
layer: backlog
status: fixed
fixed-in: pending-pr
validated-by:
  - corepack pnpm install --frozen-lockfile
  - corepack pnpm typecheck
  - corepack pnpm build
  - corepack pnpm lint
  - corepack pnpm test
tags: [backlog, p0, packaging, lockfile]
canonical-for: []
last-verified: 2026-06-18
verified-against: repair/extraction-hygiene
---

# 01 · P0 · `pnpm install --frozen-lockfile` fails

**Status.** Fixed in `pending-pr`. The original failure is preserved here because it explains the
extraction drift and protects future agents from re-deriving the same cause.

**Original symptom.** A clean `pnpm install --frozen-lockfile` (what CI runs in
`.github/workflows/ci.yml`) could not satisfy the lockfile against the current tree, so install,
typecheck, build, and lint could not start.

**Reproduced before repair (2026-06-18).**

```text
Scope: all 18 workspace projects
ERR_PNPM_OUTDATED_LOCKFILE Cannot install with "frozen-lockfile" because pnpm-lock.yaml is not up to date with <ROOT>/common/error-invariant/package.json
Failure reason:
specifiers in the lockfile ({}) don't match specs in package.json ({"@here.build/eslint-configs":"workspace:^","@here.build/tsconfig":"workspace:^","@types/node":"24.0.0","eslint":"9.39.2","typescript":"6.0.2"})
```

**Original evidence.**

- `pnpm-lock.yaml` declared importer `arrival/arrival-scheme` — a directory that no longer exists
  (renamed to `arrival/arrival`; see [[version-drift]]).
- `pnpm-lock.yaml` listed importers absent from the tree: `arrival/arrival-codemirror`,
  `arrival/arrival-sampler`, `arrival/arrival-type-lens`, `delta/delta-css`,
  `delta/postcss-oklch-plus`, `editor-theme`, `envelope-crypto`, `mcp-typescript-lsp`,
  `y-messageport`.
- `common/error-invariant/package.json` declared devDependencies but had no lockfile importer.

**Root cause.** The `arrival-scheme → arrival` rename, `commons/ → common/` move, deletion of
several packages, and addition of `common/error-invariant` landed without regenerating the
lockfile. `--frozen-lockfile` correctly refused to reconcile the gap.

**Fix applied.** Regenerated `pnpm-lock.yaml` from the current workspace after removing the ghost
workspace globs tracked in [[items/02-p0-ghost-workspace-packages]]. The regenerated lockfile:

- includes `common/error-invariant` (`pnpm-lock.yaml:541`), and
- drops the stale importer rows listed above.

**Validation.**

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm typecheck
corepack pnpm build
corepack pnpm lint
corepack pnpm test
```

**Effort.** L · **Risk.** med (regeneration can move transitive versions; the
`minimumReleaseAge: 10080` guard remains in `pnpm-workspace.yaml`).
