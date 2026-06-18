---
title: P1 — timing-sensitive tests fail under full-suite load
layer: backlog
status: partial
fixed-in: repair/arrival-abort-deterministic-on-pr4
validated-by:
  - corepack pnpm --filter @here.build/arrival exec vitest run src/__tests__/abort.test.ts
  - corepack pnpm --filter @here.build/arrival test
  - corepack pnpm --filter @here.build/arrival typecheck
  - corepack pnpm typecheck
  - corepack pnpm build
  - python3 docs/_index/check.py
tags: [backlog, p1, tests, timing, flake, extraction-repair]
canonical-for: []
last-verified: 2026-06-18
verified-against: repair/arrival-abort-deterministic-on-pr4
---

# 10 · P1 · Timing-sensitive tests fail under full-suite load

**Status.** Partially fixed. The `arrival/src/__tests__/abort.test.ts` strict wall-clock
assertions were replaced with structural trampoline-checkpoint assertions:

- the infinite-loop abort test now aborts from the trampoline checkpoint hook and asserts the
  checkpoint was reached exactly once;
- the pre-aborted fast path now asserts no trampoline checkpoint is reached, instead of asserting
  elapsed wall-clock time.

This preserves the intended abort/checkpoint contract without treating CI scheduler load as program
semantics. The broader `arrival-chain` fanout timing thresholds remain open.

**Symptom.** Focused tests pass, but full package/workspace runs can fail timing thresholds under
parallel load.

**Original evidence (verified 2026-06-18).**

```text
corepack pnpm test
@here.build/arrival:test: FAIL src/__tests__/abort.test.ts > AbortSignal execution budget > aborts an infinite loop when AbortSignal fires
AssertionError: expected 4517 to be less than 2000
Test Files 1 failed | 66 passed | 1 skipped
```

The same test passed when focused, proving the assertion was load-sensitive rather than a stable
behavioral failure:

```text
corepack pnpm --filter @here.build/arrival exec vitest run src/__tests__/abort.test.ts
✓ src/__tests__/abort.test.ts (7 tests)
```

**Fixed in this pass.** `abort.test.ts` no longer uses `Date.now()` / `<2000ms` or `<500ms` gates.
It uses `onTrampolineCheckpoint`, a diagnostic hook fired at the exact abort/budget checkpoint
cadence in `run()`, to prove:

1. an infinite loop reaches the checkpoint and aborts there; and
2. an already-aborted signal refuses before any checkpoint is reached.

Validation on the stacked #4 branch:

```text
corepack pnpm --filter @here.build/arrival exec vitest run src/__tests__/abort.test.ts
✓ src/__tests__/abort.test.ts (7 tests)

corepack pnpm --filter @here.build/arrival test
Test Files 67 passed | 1 skipped (68)
Tests 1072 passed | 6 expected fail | 29 skipped (1107)

corepack pnpm typecheck
Tasks: 27 successful, 27 total

corepack pnpm build
Tasks: 15 successful, 15 total

python3 docs/_index/check.py
OK — fast-path and markdown navigation agree.
```

**Still open.** `arrival-chain` has the same class of load-sensitive threshold assertions when run
as a full package:

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

**Root cause.** The affected tests asserted wall-clock bounds (`<300ms`, `<2000ms`) while the full
suite imports/runs many expensive tests concurrently. The behavior under test may be correct, but
wall-clock thresholds are not stable enough under full-suite load to serve as deterministic CI gates.

**Remaining proposed fix.** Separate from extraction hygiene:

1. Replace `arrival-chain` strict wall-clock upper bounds with structural concurrency assertions
   where possible (e.g. record overlapping backend start/finish windows or max in-flight calls).
2. Keep one coarse wall-clock smoke bound only if it is generous enough for CI variance and clearly
   documented as a hang guard, not semantic proof.

**Effort.** S for the remaining `arrival-chain` timing assertions · **Risk.** med.
