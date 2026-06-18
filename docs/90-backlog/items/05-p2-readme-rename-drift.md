---
title: P2 — arrival README still names arrival-scheme
layer: backlog
status: fixed
fixed-in: claude/repair-workspace
validated-by: ["grep -rn @here.build/arrival-scheme arrival/*/README.md"]
tags: [backlog, p2, docs, drift]
canonical-for: []
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
---

# 05 · P2 · README rename drift (`arrival-scheme` → `arrival`)

> ✅ Resolved in this repair pass (branch claude/repair-workspace). Retitled the arrival README to `@here.build/arrival` and fixed the serializer README plus its ramda relative link.

**Symptom.** The package was renamed to `@here.build/arrival` but its README still presents the
old `@here.build/arrival-scheme` name in the title and in every install/import example, so
copy-pasting the docs installs/imports a package that no longer exists under that name.

**Evidence (verified 2026-06-18).**
- `arrival/arrival/package.json:2` — `"name": "@here.build/arrival"` (current truth).
- `arrival/arrival/README.md:1` — title `# @here.build/arrival-scheme` (stale).
- Stale example lines: `arrival/arrival/README.md:33` (`npm install @here.build/arrival-scheme`),
  `:39`, `:54`, `:71` (each `import { … } from '@here.build/arrival-scheme'`); also `:51`.
- `pnpm-lock.yaml:476` still keys the importer as `arrival/arrival-scheme`.

**Root cause.** Incomplete rename — see [[version-drift]]. The dir and `package.json` were
updated; README and lockfile were not.

**Proposed fix (not executed).** Update README title + all example imports to
`@here.build/arrival`, and regenerate the lockfile (the lock half is covered by
[[items/01-p0-install-frozen-lockfile]]).

**Effort.** S · **Risk.** low.
