---
title: P3 — dangling design-doc references in code
layer: backlog
status: fixed
fixed-in: pending-pr
validated-by:
  - "source grep: no stale dangling-doc path patterns remain"
tags: [backlog, p3, docs, dangling-docs]
canonical-for: []
last-verified: 2026-06-18
verified-against: repair/extraction-hygiene
---

# 07 · P3 · Dangling design-doc references

**Status.** Fixed in `pending-pr`.

**Original symptom.** Source comments and the arrival README pointed at design docs under
`docs/…` paths that did not exist. Readers were sent to dead ends by comments like “read this
before changing.”

**Original evidence.** Full inventory with referencing `path:line` lives in
[[dangling-doc-map]]. Of the originally tracked references:

- **2 RECOVERABLE** — survived in `tmp/Archive` on `origin/tmp-6164624`, re-vendored to
  `40-history/`: `docs/membrane-design.md` and `docs/sandbox-security-model.md`.
- **16 LOST EVERYWHERE** — not in tree, not in Archive; they survived only as inline comments.

**Root cause.** Docs were referenced from code, then deleted/relocated during extraction/refactor
without updating the references. The snapshot they might have been recovered from
([[source-layers]] input #2) is older than most of the missing docs.

**Fix applied.**

- Repointed the two recoverable references to:
  - `docs/40-history/membrane-design.archived.md`
  - `docs/40-history/sandbox-security-model.archived.md`
- Repointed lost-doc references uniformly to:
  - `docs/30-reconciliation/dangling-doc-map.md`

This keeps provenance honest: recoverable history points at archived docs; unrecovered history
points at the reconciliation ledger instead of pretending a replacement design doc exists.

**Validation.** Source grep found zero remaining stale patterns for the originally tracked broken
families:

```text
docs/foundations/arrival-scheme
docs/spec/arrival-chain.md
docs/working-proposals
docs/proposals/in-flight
docs/audit-2026-06-09
docs/CONSTRAINT-KERNEL-SPEC
sift/docs
docs/membrane-design.md
docs/sandbox-security-model.md
```

**Effort.** M · **Risk.** low.
