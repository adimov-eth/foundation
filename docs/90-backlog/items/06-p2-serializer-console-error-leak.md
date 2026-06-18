---
title: P2 — serializer console.error leaks object on circular ref
layer: backlog
status: fixed
fixed-in: pending-pr
validated-by:
  - "RED: serializer regression failed because console.error was called once with the circular object"
  - "GREEN: corepack pnpm --filter @here.build/arrival-serializer test -- src/__tests__/serializer.test.ts"
  - "corepack pnpm --filter @here.build/arrival-serializer typecheck"
tags: [backlog, p2, serializer, security]
canonical-for: []
last-verified: 2026-06-18
verified-against: repair/extraction-hygiene
---

# 06 · P2 · Serializer logs the offending object on circular reference

**Status.** Fixed in `pending-pr` with a RED/GREEN regression.

**Original symptom.** When the serializer detected an unhandled circular reference, it
`console.error`ed the **entire offending object** before throwing. That dumped potentially
sensitive runtime data to stderr/logs and produced noisy, unstructured output.

**Original evidence.**

- `arrival/arrival-serializer/src/serializer.ts` logged
  `console.error("circular reference found while serializing", obj);` immediately before
  `throw new Error("Circular reference detected");`.
- The branch fires only when the value is not an SExpr-with-uuid; the handled case returns a
  `circular-reference-to` form instead.

**Root cause.** A debug `console.error` remained in the error path. The thrown `Error` already
signals the condition, so logging the raw object was redundant and leaky.

**Fix applied.**

- Added a Vitest regression asserting that `console.error` is not called when a non-serializable
  circular object throws `Circular reference detected`.
- Confirmed the test failed before the production change:

  ```text
  AssertionError: expected "error" to not be called at all, but actually been called 1 times
  ```

- Removed the raw-object `console.error` and kept the thrown error.

**Validation.**

```text
Test Files  4 passed (4)
Tests       61 passed (61)
```

`corepack pnpm --filter @here.build/arrival-serializer typecheck` also passed.

**Effort.** S · **Risk.** low.
