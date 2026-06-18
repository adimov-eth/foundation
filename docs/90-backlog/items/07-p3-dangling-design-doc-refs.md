---
title: P3 — dangling design-doc references in code
layer: backlog
status: verified
tags: [backlog, p3, docs, dangling-docs]
canonical-for: []
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
---

# 07 · P3 · Dangling design-doc references

**Symptom.** Source comments and the arrival README point at **18 design docs under `docs/…`**
that do not exist at those paths. Readers ("read it before changing") are sent to dead ends.

**Evidence (verified 2026-06-18).** Full inventory with referencing `path:line` lives in
[[dangling-doc-map]]. Of the 18:
- **2 RECOVERABLE** — survive in `tmp/Archive` on `origin/tmp-6164624`, re-vendored to
  `40-history/`: `docs/membrane-design.md` (`arrival/arrival/src/membrane.ts:15`) and
  `docs/sandbox-security-model.md` (`arrival/arrival/src/interop-access.ts:14`).
- **16 LOST EVERYWHERE** — not in tree, not in Archive (snapshot predates them); they survive
  only as the inline comments naming them. Sample verified anchors:
  `arrival/arrival-provenance/src/trace.ts:25` (provenance-model.md),
  `arrival/arrival/src/index.ts:25` (spec/arrival-chain.md),
  `arrival/arrival/src/env/kernel.ts:7` (env-pack-capability-dag).

**Root cause.** Docs were referenced from code, then deleted/relocated during the refactor
without updating the references; the snapshot they might have been recovered from
([[source-layers]] input #2) is older than most of the missing docs.

**Proposed fix (not executed).** For the 2 recoverable refs, repoint the comments at the
archived copies (`[[40-history/membrane-design.archived]]`,
`[[40-history/sandbox-security-model.archived]]`). For the 16 lost refs, either remove the
dead reference or replace it with a pointer to the nearest surviving vault note. No code is
changed this phase.

**Effort.** M · **Risk.** low.
