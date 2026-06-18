---
title: P1 — arrival-chain-view type-lens semantic fixture restored
layer: backlog
status: fixed
tags: [backlog, p1, tests, extraction-repair, type-lens]
canonical-for: []
last-verified: 2026-06-18
verified-against: repair/extraction-hygiene
fixed-in: pending-pr
validated-by: corepack pnpm --filter @here.build/arrival-chain-view test
---

# 09 · P1 · `arrival-chain-view` type-lens semantic fixture restored

**Status.** Fixed in this repair branch. This was exposed after the install/workspace repair allowed
`turbo test` to run far enough to execute `arrival-chain-view` tests.

**Original symptom.** `corepack pnpm test` failed in `@here.build/arrival-chain-view#test` because
`src/__tests__/types-emit.test.ts` read a file from the removed package
`arrival/arrival-type-lens`.

**Evidence before fix (verified 2026-06-18).**

```text
@here.build/arrival-chain-view:test: FAIL src/__tests__/types-emit.test.ts
Error: ENOENT: no such file or directory, open '/private/tmp/foundation-repair/arrival/arrival-type-lens/src/prelude/types.d.ts'
 ❯ src/__tests__/types-emit.test.ts:25:13
 const LENS_PRELUDE = join(__dirname, "../../../arrival-type-lens/src/prelude")
 const PRE = readFileSync(join(LENS_PRELUDE, "types.d.ts"), "utf8")
```

**Root cause.** The missing `arrival-type-lens` pocket was not just a runtime package. Surviving
code identifies it as a static type-projection membrane:

- `arrival-chain-view/src/types-emit.ts` emits virtual TypeScript that is **type-checked, never run**.
- `arrival/src/Environment.ts` exposes `__rosettaTypes__` as a type-lens harvest surface.
- `arrival/src/env/scheme-env.ts` keeps optional Rosetta `type?: string` fragments for that lens.

The test needed a semantic prelude, not an empty ghost package.

**Fix.** Repointed the bite tests to a vendored minimal fixture under
`arrival-chain-view/src/__tests__/fixtures/type-lens-prelude/`:

```text
types.d.ts
builtins/list.d.ts
builtins/car.d.ts
```

The fixture keeps the semantic teeth of the original test:

- clean `(define xs (list 1 2 3)) (define h (car xs))` type-checks with no diagnostics;
- invalid `(car 5)` still produces a TypeScript diagnostic;
- the diagnostic span still lifts back to the `5` in Scheme source.

Snapshot and span round-trip tests remain always-on. Only the prelude-dependent bite block is wired
through a fixture-presence guard, so a future extraction failure skips the bite block rather than the
whole file.

**Validation after fix (verified 2026-06-18).**

```text
corepack pnpm --filter @here.build/arrival-chain-view test
✓ src/__tests__/types-emit.test.ts (11 tests)
Test Files 14 passed (14)
Tests 177 passed (177)
```

**Design decision.** Future reconstruction of `@here.build/arrival-type-lens` should keep this
boundary: `arrival-chain-view` owns syntax projection and `Mapping`; type-lens owns the ambient type
universe and TypeScript diagnostic production. Do not replace this with an empty package stub.

**Effort.** M · **Risk.** med.
