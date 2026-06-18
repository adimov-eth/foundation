---
title: arrival-env
summary: The lightweight type definitions and Symbol protocol for Arrival S-expression serialization, without the full LIPS runtime.
layer: reference
status: in-review
tags: [package, arrival, serialization, s-expression, protocol]
canonical-for: []
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
code-anchors:
  - arrival/arrival-env/src/index.ts:1     # package: protocol-only, no runtime
---

# arrival-env

Package `@here.build/arrival-env` (`package.json:2`, `0.1.0`). The lightweight type definitions and
`Symbol` protocol for Arrival [[s-expressions-vs-json|S-expression]] serialization — the typing +
protocol WITHOUT the full LIPS runtime (`package.json` description). It is the protocol that
[[arrival-serializer]] dispatches on.

## Overview

A single file (`src/index.ts`). Importing the package is an **idempotent side-effect import**: it
defines `Symbol.toSExpr` and `Symbol.SExpr` on the global `Symbol` constructor (guarded by
existence checks, so it is safe to import multiple times). No runtime, no LIPS — just the protocol
and ambient `declare global` types.

## Public API

| Symbol | Value | File:line |
|---|---|---|
| `Symbol.toSExpr` | `Symbol.for("arrival:toSymbolicExpression")` — custom serialization method key | `index.ts` (init block, guarded) |
| `Symbol.SExpr` | `Symbol.for("arrival:symbolicExpressionSymbol")` — custom expression-head name key | `index.ts` (init block, guarded) |

Ambient global types declared: `SExprSerializationContext` (`keyword`/`symbol`/`quote`/`string`/
`expr`/`tagged` helpers), `SExprSerializable`, and the `Object.[Symbol.toSExpr]` /
`Object.[Symbol.SExpr]` member shapes (`index.ts` `declare global`).

## Key internals

| Concern | Where |
|---|---|
| Idempotent symbol install | `index.ts` `if (typeof Symbol !== "undefined")` block — sets each symbol only `if (!Symbol.toSExpr)` / `if (!Symbol.SExpr)` |
| Type-only protocol | `index.ts` `declare global` — `SExprSerializationContext`, `SExprSerializable`, `Symbol`/`Object` augmentations |

## Invariants

- Idempotent: importing twice does not redefine the symbols (existence-guarded install).
- Uses `Symbol.for(...)` (the global registry), so the symbol identity is stable across module
  instances — `arrival-serializer` and a consumer class agree on the same key.
- No runtime dependency on the LIPS interpreter — protocol + types only (`package.json`
  description).

## Seams

- The package mutates the global `Symbol` constructor (a global side effect). Two packages defining
  the same `Symbol.for` key coexist; a DIFFERENT key would silently break dispatch.

## Tests

No test files (`src/` has only `index.ts`); the protocol is exercised through
[[arrival-serializer]]'s suite.

## Tasks

- None outstanding for this leaf at audit time.
