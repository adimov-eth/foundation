---
title: S-expressions vs JSON (serializer, rosetta bridge)
layer: reference
status: in-review
tags: [reference, cross-cutting, arrival, serialization, rosetta]
canonical-for: [s-expressions, rosetta]
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
code-anchors:
  - arrival/arrival-serializer/src/serializer.ts:106    # toSExpr (JS value → SExpr)
  - arrival/arrival-serializer/src/serializer.ts:331    # formatSExpr (SExpr → text)
  - arrival/arrival-serializer/src/serializer.ts:629    # toSExprString (entrypoint, budgeted)
  - arrival/arrival-serializer/src/serializer.ts:22     # per-render truncation budget
  - arrival/arrival/src/rosetta.ts:110                  # schemeToJs
  - arrival/arrival/src/rosetta.ts:254                  # jsToScheme
  - arrival/arrival/src/rosetta.ts:442                  # Environment.defineRosetta
---

# S-expressions vs JSON

Canonical home for why arrival surfaces values as **S-expressions** (token-efficient, homoiconic)
rather than JSON, and the **rosetta** bridge that converts JS↔Scheme values. Package surfaces:
[[arrival-serializer]], [[arrival-sweet]], [[arrival-chain-view]], [[arrival]].

**Why:** see [[20-method/patterns/sexpr-over-json]] (S-expr is denser and homoiconic — code and data
share one form, ideal for LLM-driven programs). Terms: [[glossary#s-expression]],
[[glossary#rosetta]], [[glossary#sweet-expression]], [[glossary#chain-view]].

## The serializer (token-efficient S-expr)

`toSExprString(obj, opts?)` renders a JS value to S-expression text
(`arrival/arrival-serializer/src/serializer.ts:629`), via `toSExpr` (value → `SExpr` tree,
`:106`) and `formatSExpr` (tree → text, `:331`). Serialization is **synchronous** and **budgeted**:
a per-render truncation budget caps collections/strings and, if still over, hard-cuts content with a
`#| ⚠ output reduced … |#` marker (`arrival/arrival-serializer/src/serializer.ts:22`, `:663`). This
is what keeps an MCP tool result inside its token budget (see
[[discovery-action-tiers]] — `MCP_OUTPUT_BUDGET`).

## The rosetta bridge

Automatic JS↔Scheme value conversion plus `Environment.defineRosetta(name, config)` for registering
JS functions as Scheme verbs (`arrival/arrival/src/rosetta.ts:442`).

| Direction | API | Anchor |
|---|---|---|
| Scheme → JS | `schemeToJs(value, opts?)` | `arrival/arrival/src/rosetta.ts:110` |
| JS → Scheme | `jsToScheme(value, …)` | `arrival/arrival/src/rosetta.ts:254` |

Rosetta works with the [[membrane]] wrappers (`fromJS`/`toJS`); it computes per-field provenance
*before* `schemeToJs` strips the `AValue` (`arrival/arrival/src/rosetta.ts:46`).

## Surface variants (all bidirectional projections)

| Package | Surface | Role |
|---|---|---|
| [[arrival-serializer]] | canonical S-expr text | token-efficient render of any value. |
| [[arrival-sweet]] | sweet-expressions (`xs.map{ it * 2 }`) | readable lens over Scheme, bidirectional. |
| [[arrival-chain-view]] | JS/Python projection | deterministic projection of a chain program. |

## Invariants

- S-expr serialization is synchronous and budgeted — never emit an unbounded payload; truncate with
  the warning marker instead.
- Rosetta conversion must preserve membrane identity (same JS object → same wrapper) and per-field
  provenance.
- Sweet / chain-view are projections: round-tripping must be faithful in the documented direction.
