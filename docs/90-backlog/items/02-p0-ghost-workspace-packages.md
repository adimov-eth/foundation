---
title: P0 — ghost packages in pnpm-workspace.yaml
layer: backlog
status: verified
tags: [backlog, p0, packaging, workspace]
canonical-for: []
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
---

# 02 · P0 · Ghost workspace packages

**Symptom.** `pnpm-workspace.yaml` enumerates three top-level packages that do not exist
anywhere in the tree. pnpm warns/errors on unresolved workspace members and the entries serve
no purpose.

**Evidence (verified 2026-06-18).**
- `pnpm-workspace.yaml:3` — `device-frame`
- `pnpm-workspace.yaml:4` — `css-viewport-transform`
- `pnpm-workspace.yaml:5` — `ios-layout-solver`

`ls -d device-frame css-viewport-transform ios-layout-solver` → all three "No such file or
directory". No `package.json` exists for any of them.

**Root cause.** Planned packages were declared in the workspace before (or instead of) being
created; the entries were never reconciled when the packages failed to materialize. They are not
in the Archive either, so they are forward-looking stubs, not lost code.

**Proposed fix (not executed).** Either remove the three lines from `pnpm-workspace.yaml`, or
create the packages if they are genuinely planned. Removal is the low-risk default. This change
should be made together with the lockfile regeneration in
[[items/01-p0-install-frozen-lockfile]] so workspace and lock agree.

**Effort.** S · **Risk.** low.
