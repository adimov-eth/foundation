---
title: common-error-invariant
layer: reference
status: verified
tags: [package, common, error-handling]
canonical-for: []
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
code-anchors:
  - common/error-invariant/src/index.ts:32   # Error.invariant assignment
  - common/error-invariant/src/index.ts:26   # global ErrorConstructor augmentation
  - common/error-invariant/src/index.ts:42   # receiver-as-thrown-class (new this(...))
  - common/error-invariant/src/index.ts:23   # NODE_ENV read once at install time
---

# common-error-invariant

Package `@here.build/error-invariant` — a **side-effect import** that installs a global
`Error.invariant(cond, msg)` assertion helper.

```ts
import "@here.build/error-invariant";
Error.invariant(cond, "message");      // throws Error when !cond
TypeError.invariant(cond, "message");  // throws TypeError
MyError.invariant(cond, "message");    // throws MyError
```

There is no value export — importing the module IS the install (`common/error-invariant/src/index.ts:51`,
`export {}`). It was extracted from `arrival-scheme/sandbox-boundary.ts` so the assertion helper is
a standalone foundation, not a side effect of the sandbox layer (`common/error-invariant/src/index.ts:17`).

## Public API table

| Export | Signature / shape | File:line |
|---|---|---|
| (side effect) | installs `Error.invariant(condition, message?) : asserts condition` on `ErrorConstructor` | `common/error-invariant/src/index.ts:32` |
| (ambient) | `declare global { interface ErrorConstructor { invariant(...) } }` | `common/error-invariant/src/index.ts:26` |

## Key internals

- **One assignment, every error class.** The method is set on `Error.invariant` but resolves on
  any error constructor (`TypeError`, user subclasses) because they inherit from `Error` through
  the constructor prototype chain (`common/error-invariant/src/index.ts:11`).
- **Receiver IS the thrown class.** It throws `new this(...)` (the receiver constructor), not a
  hardcoded `Error` — so `MyError.invariant(...)` throws a `MyError`, preserving the failure's
  type at the catch site (`common/error-invariant/src/index.ts:42`). If pulled off `Error` and invoked unbound,
  it falls back to `TypeError` (`common/error-invariant/src/index.ts:42`).
- **Production message drop.** `process.env.NODE_ENV` is read once at install time; in production
  the message is dropped to a constant string (no closure call), bundler-static-replaceable
  (`common/error-invariant/src/index.ts:23`, `:43`).
- Receivers must take a message as their first constructor arg; classes with structured
  constructors (e.g. Plexus errors) carry their own `static invariant` instead (`common/error-invariant/src/index.ts:14`).

## Invariants / notes

- **Install failure.** This package is the one **missing from `pnpm-lock.yaml`** — confirmed:
  `grep -c error-invariant pnpm-lock.yaml` returns `0` while sibling packages resolve. That
  absence breaks `pnpm install`. Tracked in [[docs/90-backlog/_moc|backlog]].
- No runtime dependencies; devDeps only (`@here.build/eslint-configs`, `@here.build/tsconfig`,
  typescript, eslint) — `common/error-invariant/package.json:28`.

## Tests

No `__tests__/` dir present in `src/` at this revision.

## Tasks

- **Add `@here.build/error-invariant` to `pnpm-lock.yaml`** so install succeeds. See
  [[docs/90-backlog/_moc|backlog]].
