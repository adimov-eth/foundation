---
title: P1 — ESLint 9 flat-config migration never done (lint repo-wide red)
layer: backlog
status: open
tags: [backlog, p1, lint, eslint, ci]
canonical-for: []
last-verified: 2026-06-18
verified-against: claude/repair-workspace
---

# 10 · P1 · ESLint 9 flat-config migration was never done

> Uncovered by fixing the install (CI could finally run lint); not caused by the repair.

**Symptom.** `pnpm lint` is repo-wide red — only 1 of 13 tasks pass.

**Evidence (verified 2026-06-18).**
- `eslint .` →
  "ESLint couldn't find an eslint.config.(js|mjs|cjs) file. From ESLint v9.0.0 the default
  config file is now eslint.config.js" (e.g. in `common/error-invariant`).
- The packages have no flat-config (`eslint.config.js`) files.
- Secondary: `@typescript-eslint` 8.55.0 peer wants `typescript@>=4.8.4 <6.0.0`, but the repo
  pins `typescript@6.0.2` (install warning).

**Root cause.** The ESLint 9 flat-config migration was never carried out in the extraction —
the per-package `eslint.config.js` files were not extracted or created. This blocks the
`ci.yml` lint step.

**Proposed fix.** Add a per-package `eslint.config.js` consuming
`@here.build/eslint-configs`, and reconcile the `@typescript-eslint` ↔ TypeScript 6 peer range
(bump typescript-eslint or relax the pin).

**Effort.** L · **Risk.** med.
