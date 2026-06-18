---
title: P1 — timing-sensitive tests fail under full-suite load
layer: backlog
status: fixed
fixed-in: repair/extraction-hygiene
validated-by:
  - corepack pnpm --filter @here.build/arrival exec vitest run src/__tests__/abort.test.ts
  - corepack pnpm --filter @here.build/arrival test
  - corepack pnpm --filter @here.build/arrival-chain exec vitest run src/__tests__/converge.test.ts src/__tests__/cross-fertilization.test.ts src/__tests__/herebuild-react.test.ts
  - corepack pnpm test
  - corepack pnpm typecheck
  - corepack pnpm build
tags: [backlog, p1, tests, timing, flake, extraction-repair]
canonical-for: []
last-verified: 2026-06-19
verified-against: repair/extraction-hygiene
---

# 10 · P1 · Timing-sensitive tests fail under full-suite load

**Status.** Fixed. The brittle wall-clock assertions that blocked full-suite CI were replaced with
structural assertions:

- `arrival/src/__tests__/abort.test.ts` now proves abort reachability through the evaluator's
  trampoline checkpoint hook instead of asserting `<2000ms` / `<500ms` elapsed time.
- `arrival-chain/src/__tests__/converge.test.ts`,
  `arrival-chain/src/__tests__/cross-fertilization.test.ts`, and
  `arrival-chain/src/__tests__/herebuild-react.test.ts` now prove fanout concurrency by recording
  maximum in-flight backend calls instead of asserting `<300ms` elapsed time.

This keeps the semantic property — abort checkpoints are reached and independent infer calls fan out
concurrently — without treating CI scheduler load as program semantics.

**Original evidence (verified 2026-06-18).**

```text
corepack pnpm test
@here.build/arrival:test: FAIL src/__tests__/abort.test.ts > AbortSignal execution budget > aborts an infinite loop when AbortSignal fires
AssertionError: expected 4517 to be less than 2000
Test Files 1 failed | 66 passed | 1 skipped
```

After the abort fix, the next hidden wall-clock failures surfaced in `arrival-chain`:

```text
corepack pnpm test
FAIL src/__tests__/herebuild-react.test.ts > 12 tasks fan out concurrently — one wall-clock round
AssertionError: expected 488 to be less than 300
```

**Fix applied.**

1. Added optional `onTrampolineCheckpoint` observability through `RunOptions` / `ExecOptions`.
2. Rewrote abort-budget tests to abort from the actual trampoline checkpoint and assert checkpoint
   count rather than elapsed time.
3. Rewrote `arrival-chain` fanout tests to use delayed stubs that track `active` and `maxActive`.
   The tests now assert all expected calls were simultaneously in flight:
   - convergence fanout: `maxActive === 8`
   - cross-fertilization fanout: `maxActive === 12`
   - herebuild-react fanout: `maxActive === 12`

**Validation (2026-06-19).**

```text
corepack pnpm --filter @here.build/arrival exec vitest run src/__tests__/abort.test.ts
Test Files 1 passed (1)
Tests 7 passed (7)

corepack pnpm --filter @here.build/arrival test
Test Files 67 passed | 1 skipped (68)
Tests 1072 passed | 6 expected fail | 29 skipped (1107)

corepack pnpm --filter @here.build/arrival-chain exec vitest run src/__tests__/converge.test.ts src/__tests__/cross-fertilization.test.ts src/__tests__/herebuild-react.test.ts
Test Files 3 passed (3)

corepack pnpm test
Tasks: 9 successful, 9 total
```

**Caveat.** These tests no longer prove a sub-300ms or sub-2s wall-clock latency budget. They prove
the stronger deterministic structure the budgets were approximating: checkpoint reachability and
full fanout overlap. If latency budgets become product semantics later, they should be benchmarked
separately with explicit performance-test infrastructure.

**Effort.** S · **Risk.** med.
