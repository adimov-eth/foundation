---
title: S-expressions over JSON
layer: method
status: draft
tags: [pattern, s-expressions, arrival, agentic, serializer]
canonical-for: [sexpr-over-json]
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
code-anchors:
  - arrival/arrival/src/reader/Parser.ts:416         # text → datum reader
  - arrival/arrival/src/values/Pair.ts:236           # cons cell (car/cdr) — the two-layer structure
  - arrival/arrival-serializer/src/serializer.ts:106 # toSExpr — JS value → s-expr
  - arrival/arrival-serializer/src/serializer.ts:312 # plain object → (dict :k v …), not flat KV
  - arrival/arrival-sweet/src/sweet-read.ts:59       # sweet text → Node (readable surface)
---

# S-expressions over JSON

> Pattern (the *why*). Reference (the *what*): [[s-expressions-vs-json]]. Term: [[glossary#S-expression]].

## Problem

Compositional reasoning is structurally a tree of operator-over-operands: *filter* this, *map*
that, *compose* the two. JSON forces that tree into nested key-value records with a **flat**
attention distribution — there is no distinguished operator position, so the model pays a
translation tax converting "the structure of the thought" into "the structure of the payload"
on every call. The [[fragmentation-hypothesis]] flags this translation overhead as a contributor
to drift.

## Mechanism

Represent tool input/output as **S-expressions**: a cons cell is exactly `(operator . operands)`,
a two-layer structure (car = head, cdr = rest) that mirrors compositional thought directly. The
form is homoiconic — code and data share one syntax — so the agent reads, writes, and composes in
the same notation it reasons in. A readable surface ([[arrival-sweet|sweet-expressions]]) keeps it
ergonomic without losing the structure.

| | JSON | S-expression |
|---|---|---|
| shape | nested key-value records | `(head . tail)` cons cells |
| attention | flat | operator + operands (two-layer) |
| code vs data | distinct | homoiconic |

## How this repo instantiates it

- Reader turns text into Scheme data — `arrival/arrival/src/reader/Parser.ts:416`
  (`_read_object`).
- The cons cell carrying the two-layer structure — `arrival/arrival/src/values/Pair.ts:236`
  (`Pair` constructor, `car`/`cdr`).
- JS values serialize to s-exprs — `arrival/arrival-serializer/src/serializer.ts:106` (`toSExpr`);
  a plain object becomes `(dict :k v …)` (operator `dict` + alternating operands, homoiconic
  round-trip) rather than a flat JSON map — `arrival/arrival-serializer/src/serializer.ts:312`.
- The readable bidirectional surface — `arrival/arrival-sweet/src/sweet-read.ts:59`
  (`parseSexprs`), inverse in `sweet-render.ts`. See [[arrival-sweet]], [[arrival-serializer]].

## Why it counters drift

Removing the thought↔representation translation step removes a class of structural noise the
model would otherwise have to maintain across a long chain. The operator/operands layering also
gives the [[membrane]] a single distinguished call position to police. (Observational; an
alternative explanation — token efficiency / two-layer attention — is preserved in the
[[fragmentation-hypothesis#Limitations|limitations]].)

## How to apply elsewhere

1. Prefer a notation with an explicit operator position over flat key-value where the tool's
   inputs are *compositional* (queries, transforms, plans).
2. Keep one syntax for code and data so the agent can compose tool outputs into new tool inputs.
3. Provide a human-readable surface, but make the structural form canonical.
4. Anti-pattern: deep JSON flattening that erases the operator/operand distinction. See
   [[transferability-guide]].
