---
title: P0 — ghost packages in pnpm-workspace.yaml
layer: backlog
status: fixed
fixed-in: pending-pr
validated-by:
  - corepack pnpm -r list --depth -1
  - corepack pnpm install --frozen-lockfile
tags: [backlog, p0, packaging, workspace]
canonical-for: []
last-verified: 2026-06-18
verified-against: repair/extraction-hygiene
---

# 02 · P0 · Ghost workspace packages

**Status.** Fixed in `pending-pr`.

**Original symptom.** `pnpm-workspace.yaml` enumerated three top-level packages that did not
exist anywhere in the tree:

- `device-frame`
- `css-viewport-transform`
- `ios-layout-solver`

No `package.json` existed for any of them. They were not in the Archive either, so they were
forward-looking stubs, not lost extracted code.

**Root cause.** Planned packages were declared in the workspace before (or instead of) being
created; the entries were never reconciled when the packages failed to materialize.

**Fix applied.** Removed the three ghost globs. The workspace now contains only:

```yaml
packages:
  - plexus
  - arrival/*
  - common/*
```

The `minimumReleaseAge: 10080` supply-chain guard remains intact.

**Validation.**

```bash
corepack pnpm -r list --depth -1
corepack pnpm install --frozen-lockfile
```

`corepack pnpm -r list --depth -1` reports 18 real workspace projects and no ghost packages.

**Effort.** S · **Risk.** low.
