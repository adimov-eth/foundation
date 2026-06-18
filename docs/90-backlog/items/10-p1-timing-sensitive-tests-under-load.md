---
title: P1 — timing-sensitive tests fail under full-suite load
layer: backlog
status: open
tags: [backlog, p1, tests, timing, flake, extraction-repair]
canonical-for: []
last-verified: 2026-06-18
verified-against: repair/extraction-hygiene
---

# 10 · P1 · Timing-sensitive tests fail under full-suite load

**Status.** Open. This was exposed only after the workspace/install repair, `DefaultedMap`
recursion fix, `arrival-chain` abort rejection sink, and `arrival-chain-view` type-lens fixture
repair let the test suite run farther.

**Symptom.** Focused tests pass, but full package/workspace runs can fail timing thresholds under
parallel load.

**Evidence (verified 2026-06-18).**

```text
corepack pnpm test
@here.build/arrival:test: FAIL src/__tests__/abort.test.ts > AbortSignal execution budget > aborts an infinite loop when AbortSignal fires
AssertionError: expected 4517 to be less than 2000
Test Files 1 failed | 66 passed | 1 skipped
```

The same test passes when focused:

```text
corepack pnpm --filter @here.build/arrival exec vitest run src/__tests__/abort.test.ts
✓ src/__tests__/abort.test.ts (7 tests)
```

`arrival-chain` has the same class of load-sensitive threshold assertions when run as a full package:

```text
corepack pnpm --filter @here.build/arrival-chain test
FAIL converge.test.ts: expected 330 to be less than 300
FAIL cross-fertilization.test.ts: expected 368 to be less than 300
FAIL herebuild-react.test.ts: expected 600 to be less than 300
```

The same three test files pass when focused together:

```text
npx vitest run src/__tests__/converge.test.ts src/__tests__/cross-fertilization.test.ts src/__tests__/herebuild-react.test.ts
Test Files 3 passed (3)
Tests 9 passed (9)
```

**Root cause.** The affected tests assert wall-clock bounds (`<300ms`, `<2000ms`) while the full
suite imports/runs many expensive tests concurrently. The behavior under test may be correct, but
wall-clock thresholds are not stable enough under full-suite load to serve as deterministic CI gates.

**Proposed fix.** Separate from extraction hygiene:

1. Replace strict wall-clock upper bounds with structural concurrency assertions where possible
   (e.g. record overlapping backend start/finish windows or max in-flight calls).
2. For abort-budget tests, assert that abort is observed and bounded by scheduler ticks using a
   deterministic harness/fake timers if feasible.
3. Keep one coarse wall-clock smoke bound only if it is generous enough for CI variance.

**Effort.** M · **Risk.** med.
