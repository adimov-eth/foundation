---
title: Version drift
layer: reconciliation
status: verified
tags: [reconciliation, drift, packaging]
canonical-for: [version-drift]
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
---

# Version drift

> ✅ The *operational* drift below (ghost workspace packages, stale lockfile, `arrival-scheme`→
> `arrival` rename in README/lockfile) was **resolved** in the repair pass (branch
> `claude/repair-workspace`); see [[90-backlog/_moc|backlog]] items 01/02/05. This note remains as
> the record of what drifted.

Structural diff from the `tmp/Archive` snapshot (branch `origin/tmp-6164624`) to the current
working tree. Archive side verified via `git show origin/tmp-6164624:tmp/Archive/…`; current
side verified against the checked-out tree. This is the "what changed in the layout" companion
to [[source-layers]].

## Workspace & directory renames

| Aspect | Archive (snapshot) | Current (authoritative) |
|---|---|---|
| Shared libs dir | `commons/` | `common/` |
| Config packages | `configs/eslint`, `configs/tsconfig` (own `configs/*` glob) | folded into `common/`: `common/eslint-config`, `common/tsconfig` |
| Scheme package dir/name | `arrival/arrival-scheme`, name `@here.build/arrival-scheme` | `arrival/arrival`, name `@here.build/arrival` |
| Workspace globs | `configs/* , arrival/* , commons/* , plexus` | `plexus , device-frame , css-viewport-transform , ios-layout-solver , arrival/* , common/*` |

Verified: `git show origin/tmp-6164624:tmp/Archive/pnpm-workspace.yaml` vs `pnpm-workspace.yaml`.

## The arrival-scheme → arrival rename is incomplete

The package directory and `package.json` `name` were renamed to `@here.build/arrival`
(`arrival/arrival/package.json:2`), but the rename **did not propagate**:

- `arrival/arrival/README.md:1` title is still `# @here.build/arrival-scheme`.
- README example/install lines still use the old name:
  `arrival/arrival/README.md:33`, `:39`, `:51`, `:54`, `:71`.
- `pnpm-lock.yaml` still lists the importer as `arrival/arrival-scheme` (stale — see
  [[items/01-p0-install-frozen-lockfile]]).

Tracked by [[items/05-p2-readme-rename-drift]].

## Supply-chain / toolchain changes

- **`minimumReleaseAge: 10080`** added to `pnpm-workspace.yaml` (7 days, in minutes — refuse
  to install any package published less than 7 days ago). Not present in the Archive workspace.
- **Node engine** raised `>=20` → `>=22`
  (`git show origin/tmp-6164624:tmp/Archive/package.json` engines `node: >=20` vs current
  `package.json:17` `node: >=22`; CI `.github/workflows/ci.yml:21` pins `node-version: 22`).
- **Root package name** `@here.build/foundation` → `@here.build/foundations` (`package.json:2`).

## turbo.json drift

Archive `turbo.json` carried a `globalEnv` array (`NODE_ENV`, `DISABLE_BWRAP`, `HOST_URL`,
`REACT_APP_*`, `API_HOST`, `PARTYKIT_HOST`, `PUBLIC_URL`) and `remoteCache: { enabled: true }`.
The current `turbo.json`:

- **removed** `globalEnv`,
- **removed** `remoteCache`,
- **added** `"ui": "stream"`,
- switched `$schema` host `turbo.build` → `turborepo.com`.

## Package universe growth

The Archive shipped **5 arrival packages** (`arrival`/`arrival-scheme`, `arrival-env`,
`arrival-mcp`, `arrival-serializer`). The current tree ships **11**, i.e. **+6 new**:
`arrival-chain`, `arrival-chain-view`, `arrival-inference`, `arrival-provenance`,
`arrival-sweet`, plus the scheme-env pair `arrival-scheme-env-infer` / `arrival-scheme-env-ramda`
(net new arrival packages beyond the original five). These newer packages are exactly the ones
the Archive cannot describe and whose design docs are LOST in [[dangling-doc-map]].
