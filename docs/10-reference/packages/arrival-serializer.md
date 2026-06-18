---
title: arrival-serializer
layer: reference
status: in-review
tags: [package, arrival, serialization, s-expression]
canonical-for: []
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
code-anchors:
  - arrival/arrival-serializer/src/serializer.ts:106   # toSExpr
  - arrival/arrival-serializer/src/serializer.ts:331   # formatSExpr
  - arrival/arrival-serializer/src/serializer.ts:629   # toSExprString
  - arrival/arrival-serializer/src/serializer.ts:244   # Symbol.toSExpr dispatch
  - arrival/arrival-serializer/src/serializer.ts:121   # console.error leak on circular ref
  - arrival/arrival-serializer/src/serializer.ts:12    # SEXPR_TAG
---

# arrival-serializer

Package `@here.build/arrival-serializer` (`package.json:2`, `0.1.0`). A JS → S-expression
serializer: converts JavaScript objects to Scheme/Lisp representations, token-efficiently. Honors
the `Symbol.toSExpr` protocol (defined by [[arrival-env]]) for custom representations. See
[[s-expressions-vs-json]].

## Overview

`toSExpr` walks a JS value into an `SExpr` tree (cycle-safe DFS); `formatSExpr` pretty-prints it;
`toSExprString` is the convenience `format ∘ toSExpr` with token-budget caps. Objects implementing
`[Symbol.toSExpr]` control their own body and head (`[Symbol.SExpr]`).

## Public API

| Export | Signature | File:line |
|---|---|---|
| `toSExpr` | `(obj: any, visited?: Set<any>) => SExpr` | `serializer.ts:106` |
| `formatSExpr` | `(sexpr: SExpr, indent?: number) => string` | `serializer.ts:331` |
| `toSExprString` | `(obj: any, optsOrIndent?: number \| SerializeOpts) => string` | `serializer.ts:629` |
| `sexpr` / `smap` / `slist` | `SExprDefinition` constructors | `serializer.ts:677,682,687` |
| `SEXPR_TAG` | `Symbol.for("expression")` tag | `serializer.ts:12` |
| `SerializeOpts` | `{ maxItems?, maxStringChars?, maxTotalChars?, indent? }` | `serializer.ts:54` |
| `SExpr` / `SExprSerializable` / `SExprDefinition` | output/input types | `serializer.ts:65-76` |

(`index.ts:7` `export * from "./serializer.js"`.)

## Key internals

| Concern | Where |
|---|---|
| Tree walk + dispatch | `serializer.ts:106` `toSExpr` |
| Cycle detection | `serializer.ts:115-127` — DFS path-set: add on enter, `delete` on exit (`finally`), so a value reused across SIBLING branches is not a false cycle; O(n) (was O(n²) clone-per-node) |
| `Symbol.toSExpr` protocol | `serializer.ts:244-247` — head from `[Symbol.SExpr]()` ?? displayName ?? ctor name; body from `obj[Symbol.toSExpr](serializationContext)` |
| Serialization context | `serializer.ts:78` — `keyword`/`symbol`/`quote`/`string`/`expr`/`tagged` helpers |
| Token-efficiency caps | `serializer.ts:629` `toSExprString` — per-element caps SHRINK and re-render (fair across siblings), not a tail-cut |

## Invariants

- Cycle detection is an O(n) DFS path-set, not a clone-per-node (`serializer.ts:115-119`).
- Caps in `toSExprString` shrink fairly across siblings rather than truncating the tail
  (`serializer.ts:57-59`).
- Token-efficient output is the design goal (token-efficiency, `package.json` keywords).

## Seams

- **console.error leak on circular refs** — when a back-edge is found and the value is NOT a
  `Symbol.SExpr`-with-`uuid` object, the serializer does
  `console.error("circular reference found while serializing", obj)` then throws
  (`serializer.ts:121`). The `console.error` leaks the (possibly large / sensitive) object to the
  host console as a side effect of a throw path; the thrown `Error` already signals the condition.
  → [[docs/90-backlog/_moc|backlog]].

## Tests

~63 cases across 4 files in `arrival/arrival-serializer/src/__tests__/`.

## Tasks

- Drop the `console.error` from the circular-ref throw path (`serializer.ts:121`). →
  [[docs/90-backlog/_moc|backlog]]
