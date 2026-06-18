---
title: P2 — serializer console.error leaks object on circular ref
layer: backlog
status: verified
tags: [backlog, p2, serializer, security]
canonical-for: []
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
---

# 06 · P2 · Serializer logs the offending object on circular reference

**Symptom.** When the serializer detects an unhandled circular reference, it `console.error`s
the **entire offending object** before throwing. That dumps potentially sensitive runtime data
to stderr/logs — a data-leak surface — and produces noisy, unstructured log output.

**Evidence (verified 2026-06-18).**
- `arrival/arrival-serializer/src/serializer.ts:121` —
  `console.error("circular reference found while serializing", obj);` immediately followed by
  `throw new Error("Circular reference detected");` (`:122`). The branch fires only when the
  value is not an SExpr-with-uuid (the handled case at `:119` returns a
  `circular-reference-to` form instead).

**Root cause.** A debug `console.error` left in the error path; the thrown `Error` already
signals the condition, so logging the raw object is redundant and leaky.

**Proposed fix (not executed).** Remove the `console.error`, or replace it with a message that
does not embed `obj` (e.g. include only a type/uuid). The `throw` carries the failure; no object
dump is needed.

**Effort.** S · **Risk.** low.
