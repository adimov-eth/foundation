---
title: P2 — arrival-chain-view test depends on non-extracted arrival-type-lens
layer: backlog
status: open
tags: [backlog, p2, test, extraction-gap]
canonical-for: []
last-verified: 2026-06-18
verified-against: claude/repair-workspace
---

# 08 · P2 · arrival-chain-view test depends on non-extracted `arrival-type-lens`

> Uncovered by fixing the install (CI could finally run the test suite); not caused by the repair.

**Symptom.** `arrival/arrival-chain-view/src/__tests__/types-emit.test.ts` fails with
`ENOENT … arrival-type-lens/src/prelude/types.d.ts` — it cannot read a file from a package that
is not in this repo.

**Evidence (verified 2026-06-18).**
- `arrival/arrival-chain-view/src/__tests__/types-emit.test.ts:24` reads
  `../../../arrival-type-lens/src/prelude`.
- `arrival-type-lens` is a non-extracted package — it is absent from the working tree (no
  `arrival/arrival-type-lens/` directory exists).

**Root cause.** Extraction gap: this test integrates with `arrival-type-lens`, a package that
was not open-sourced in this extraction, so the path it reads never landed in the tree.

**Proposed fix.** Make the test skip-when-absent, mirroring the repo's own extraction-gap
convention — the `fs.existsSync` guard in `arrival/arrival/src/__tests__/chibi-r7rs.spec.ts`.
Alternatively, extract `arrival-type-lens` so the dependency is satisfied.

**Effort.** S · **Risk.** low.
