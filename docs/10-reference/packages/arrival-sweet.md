---
title: arrival-sweet
layer: reference
status: in-review
tags: [package, arrival, sweet-expression, scheme]
canonical-for: []
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
code-anchors:
  - arrival/arrival-sweet/src/sweet-render.ts:894   # schemeToSweet
  - arrival/arrival-sweet/src/sweet-read.ts:759     # sweetToScheme
  - arrival/arrival-sweet/src/sweet-read.ts:664      # readSweet
  - arrival/arrival-sweet/src/sweet-read.ts:461      # readSweetExpr
  - arrival/arrival-sweet/src/index.ts:15            # render primitives barrel
  - arrival/arrival-sweet/src/sweet-render.ts:30     # accessor codec
---

# arrival-sweet

Package `@here.build/arrival-sweet` (`package.json:2`, `0.1.0`). A **bidirectional**
[[glossary#sweet-expression|sweet-expression]] lens over Scheme source: curly-infix, `=>` lambda,
colon kwargs, `??` coalesce. A **zero-dependency leaf** consumed by the studio editor / codemirror,
the [[arrival-chain-view|chain-view]] compiler, and [[provenance-model|provenance]] rendering
(`package.json` description). See [[s-expressions-vs-json]].

## Overview

`schemeToSweet` renders stored canonical Scheme as the readable sweet form; `sweetToScheme` /
`readSweet` fold an edited sweet view back to classic Scheme. The two faces are a round-trip pair —
the classic↔sweet round-trip property is the integration-test contract over the program corpus
(`__tests__/`, see Tests).

## Public API

| Export | Signature | File:line |
|---|---|---|
| `schemeToSweet` | `(src: string, opts?: Partial<SweetOpts>) => string` | `sweet-render.ts:894` |
| `sweetToScheme` | `(sweetText: string, prevClassic: string, opts?: ReadOpts) => string` | `sweet-read.ts:759` |
| `readSweet` | `(text: string, opts?: ReadOpts) => Node[]` | `sweet-read.ts:664` |
| `readSweetExpr` | `(src: string, opts?: ReadOpts) => Node` | `sweet-read.ts:461` |
| `SweetOpts` / `ReadOpts` | option types | `sweet-render.ts` / `sweet-read.ts` |
| render primitives | `inlineSweet`, `inlineScheme`, `formatSweet`, `collectKwargHeads`, `inflateKwargs`, `flattenKwargs`, `nodeEq`, `DEFAULT_OPTS` | `index.ts:15-24` |
| accessor codec | `decodeAccessor`, `encodeAccessor`, `accessorStepLetters`, `PairStep` | `index.ts:30`; `sweet-render.ts:30` |
| reader utils | `topFormSpans`, `splitFormsWithBase`, `R7RS_ACCESSOR_DEPTH` | `index.ts:34` |

(`index.ts:11` `export * from "./sweet.js"` re-surfaces `schemeToSweet`/`sweetToScheme`/`readSweet`
via `sweet.ts:10,14`.)

## Key internals

| Concern | Where |
|---|---|
| Render (Scheme → sweet) | `sweet-render.ts:894` `schemeToSweet`; inline vs block via `inlineSweet`/`formatSweet` |
| Read (sweet → Scheme) | `sweet-read.ts:664` `readSweet`; single-expr `readSweetExpr:461`; fold-back `sweetToScheme:759` |
| Pair-accessor codec | `sweet-render.ts:30` — single decomposition of a `c[ad]+r` word into its PULL/DROP chain, shared by renderer (→ subscripts), reader (← fusion), and chain-view (→ JS `[k]`/`.slice(k)`); one source of truth so the three faces cannot drift |
| Kwarg (de)sugaring | `collectKwargHeads`/`inflateKwargs`/`flattenKwargs` (`index.ts:15-24`) |

## Invariants

- Round-trip: an edit through `schemeToSweet` then `sweetToScheme` preserves the classic program
  (the corpus round-trip property; `sweetToScheme` takes `prevClassic` to anchor the fold).
- Zero runtime dependencies — pure string↔string lens (`package.json` description; leaf).
- The pair-accessor codec is the single source of truth across renderer/reader/chain-view
  (`sweet-render.ts:30`).

## Seams

- The accessor codec is shared by three consumers; a change here ripples to chain-view JS emission
  and the reader fusion — they must stay co-decoded.
- `sweetToScheme` requires `prevClassic`: it is a *fold-back over an existing program*, not a
  free parse.

## Tests

~100 cases across 5 files in `arrival/arrival-sweet/src/__tests__/`, including the classic↔sweet
round-trip integration over the program corpus.

## Tasks

- None outstanding for this leaf at audit time.
