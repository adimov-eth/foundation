---
title: P2 — arrival-chain abort path leaves an unhandled promise rejection
layer: backlog
status: open
tags: [backlog, p2, test, arrival-chain, abort]
canonical-for: []
last-verified: 2026-06-18
verified-against: claude/repair-workspace
---

# 09 · P2 · arrival-chain abort path leaves an unhandled rejection

> Uncovered by fixing the install (CI could finally run the test suite); not caused by the repair.

**Symptom.** The `arrival-chain` test task exits 1 even though all 100 test files pass — the
process fails on an unhandled rejection rather than on a failed assertion.

**Evidence (verified 2026-06-18).**
- Unhandled Rejection `AbortError: This operation was aborted` originating in
  `arrival/arrival-chain/src/__tests__/run-abort-fanout.test.ts` on the already-aborted-signal
  path (around line 48).
- The awaited assertion at line 49 passes; a second promise on the abort/teleological path
  rejects without anyone awaiting it.

**Root cause.** An abort listener on the teleological re-run path produces a promise rejection
that nobody awaits, so Node reports an unhandled rejection and the task exits non-zero.

**Proposed fix.** In arrival-chain's abort/teleological handling, ensure the abort-triggered
rejection is awaited or caught. This is a source fix in the abort path and needs care to avoid
swallowing genuine errors.

**Effort.** M · **Risk.** med.
