---
title: arrival-sweet Extension Design — curly-infix & sweet reader (reconstructed)
layer: history
status: in-review
tags: [history, reconstructed, arrival, arrival-sweet, reader]
canonical-for: []
source-provenance:
  origin: docs/working-proposals/arrival-sweet-extension-design-ideation-2026-06-15.md
  branch: lost — not in tree nor origin/tmp-6164624 Archive
  retrieved: reconstructed 2026-06-18
  authority: derived
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
code-anchors:
  - arrival/arrival/src/reader/curly-infix.ts:1    # SRFI-105 curly-infix canonicalization, read-time
  - arrival/arrival/src/reader/curly-infix.ts:8    # §5.2 divergence from SRFI-105 (no $nfx$)
  - arrival/arrival/src/reader/curly-infix.ts:30   # FIXITY license table (PEMDAS)
  - arrival/arrival/src/reader/curly-infix.ts:60   # canonicalizeCurly element classifier
  - arrival/arrival/src/reader/curly-infix.ts:87   # resolveNfx — errors-as-door ParseError
  - arrival/arrival/src/reader/Parser.ts:300       # read_curly_elements (gathers flat datum seq)
  - arrival/arrival/src/reader/Parser.ts:522       # parser dispatch → canonicalizeCurly
  - arrival/arrival-sweet/src/sweet.ts:1           # pure classic↔sweet lens (no eval engine)
  - arrival/arrival-sweet/src/sweet-read.ts:1      # sweet → classic reader (i-exprs + {} + colon-pairs)
---

> ⚠️ **RECONSTRUCTION — not the original.** The original `docs/working-proposals/arrival-sweet-extension-design-ideation-2026-06-15.md` is lost everywhere (see [[dangling-doc-map]]). This note is reverse-engineered from the code it governed, anchored to `file:line`. Fidelity: **high** for the curly-infix half (`curly-infix.ts:1-12` names the proposal and its §5.2 by date "V 2026-06-15"); **medium** for the broader sweet reader (the proposal title is "ideation"; `arrival-sweet` implements far more than §5.2 cites, so the mapping to sections beyond §5.2 is inferred). It records what the doc *must have specified* given the implementation — not its original wording.

# arrival-sweet Extension Design (reconstructed)

The proposal designed the **sweet-expression lens** and its **SRFI-105 curly-infix** extension to the reader. Two artifacts implement it: the read-time canonicalizer in the interpreter ([[arrival]] reader), and the runtime-free classic↔sweet view package [[arrival-sweet]]. The single code citation from the doc is §5.2 at `curly-infix.ts:12`.

## §5.2 — Curly-infix as a pure read-time transform

`{ … }` is canonicalized to s-exprs **at READ time** (`curly-infix.ts:1-6`): `Parser.read_curly_elements` gathers the flat datum sequence between `{` and `}` (`Parser.ts:300-303`), and the parser dispatch hands it to `canonicalizeCurly` (`Parser.ts:522-523`). `{a + b}` → `(+ a b)` **before the evaluator ever runs** — so the evaluator, the value layer, the stored/canonical form, and the AI face never see `{}` (`curly-infix.ts:3-6`). This is the SRFI-105 "pure reader transform" property, and the doc's reason it "offloads."

### The element classifier (`canonicalizeCurly`, `curly-infix.ts:60-72`)

Standard SRFI-105 element rules:

- `{}` → `()` (empty, `:62`)
- `{x}` → `x` (single — escape, no wrap, `:63`)
- `{- x}` → `(- x)` (two-element prefix/unary, `:64`)
- n ≥ 3, **same operator throughout** → n-ary infix: `{a + b + c}` → `(+ a b c)` (`:66-70`)
- everything else → `resolveNfx` (`:71`)

`allSameOperator` checks every odd-index element is the *same* `SchemeSymbol` (`:75-83`).

### The formal divergence from SRFI-105 (§5.2, the cited section)

Where SRFI-105 emits `($nfx$ …)` for **mixed** operators and leaves precedence to the application, this design **resolves the arithmetic operators at read-time, in plain TS** — **no `$nfx$` symbol is ever emitted, no scheme macro is involved** (`curly-infix.ts:8-12`, `:86-87`). The divergence is "intentional, formal, predictable."

Precedence is granted **only where it is overlearned (PEMDAS)** via the `FIXITY` license table (`curly-infix.ts:27-38`):

| operator | prec | assoc |
|---|---|---|
| `*` `/` `modulo` `quotient` `remainder` | 7 | left |
| `+` `-` | 6 | left |

Levels are relative; only ordering matters (headroom left deliberately). Multiplicative binds tighter than additive; both left-associative. **Anything not in the table is a door** (`curly-infix.ts:29`).

### Errors-as-door (`resolveNfx`, `curly-infix.ts:87-130`)

Every other operator mix is a **teaching `ParseError`** rather than a silent canonicalization. Structural/parity doors checked before any precedence climb:

- even element count → "missing operand or trailing operator" (`:92-97`)
- two adjacent operands (odd slot not a symbol) → "expected an operator" (`:98-105`)
- an unlicensed operator at an odd slot → "ambiguous operator mix: '`X`' has no defined infix precedence here. Add explicit braces … e.g. `{{a + b} < c}`" (`:106-113`)
- an operator where an operand was expected (even slot) → malformed (`:114-122`)

When all operators are licensed and parity is valid, a **precedence-climbing parse** (left-assoc, n-ary same-operator runs, `parseExpr`, `curly-infix.ts:133-152`) produces the canonical s-expr; a leftover index throws "malformed infix" (`:125-128`).

## The sweet lens (broader package — inferred §§)

[[arrival-sweet]] is a **zero-dependency leaf** (its own S-expr parser; only `tiny-invariant`) carrying the **pure classic↔sweet syntax pair** with no eval engine (`sweet.ts:1-9`, `index.ts:1-7`):

- `schemeToSweet` renders canonical `.scm` as a readable sweet form: **curly-infix, `=>` lambda, colon kwargs, `??` coalesce** (`index.ts:3-5`).
- `sweetToScheme` / `readSweet` fold an edited sweet view back, losslessly: **the law `read(render(x)) ≡ x` on classic** (`sweet-read.ts:1-6`).

The reader has two layers plus colon-pairs (`sweet-read.ts:5-17`):

1. **I-expressions** (indentation): a line + its more-indented descendants form a list.
2. **Delimited sub-exprs**: `(…)` classic lists and `{…}` curly-infix (precedence ladder + arrow → lambda + display glyphs); bracket mode overrides indentation, so a `{…}` may span physical lines.
3. **Colon-pairs**: under kwarg calls a `key: value` line contributes `:key` + value.

SRFI-105 **space-significance** inside `{}`: an operator is a whitespace-isolated token equal to an operator string, so `config/min-for-boundary` reads as one atom (`sweet-read.ts:14-18`). The reader's glyph map is **injective** — only `==`←`equal?`, `&&`←`and`, `||`←`or` are remapped — so `read∘render = id` for every equality kind (`sweet-read.ts:33-35`). The reader's `GLYPH_PREC` must **mirror** the renderer's `INFIX_PREC` (including `modulo`/`quotient`/`remainder` as infix) or round-trip breaks (`sweet-read.ts:39-62`).

Consumers (none of which pull the eval engine): the studio editor toggle, codemirror, the chain-view compiler, sift's lowering, provenance region-label rendering (`index.ts:6-7`).

## What is NOT recoverable from code

- Section numbering beyond §5.2 (only §5.2 is cited from code; the curly-infix detail above is keyed to it, the broader sweet-reader sections are inferred from the package, not from surviving headings).
- The proposal was an **ideation** doc — its alternatives-considered, the `??`/`=>`/colon-kwarg design rationale, and any rejected SRFI-105 variants are not present in code.

See also [[arrival]], [[arrival-sweet]], [[arrival-chain-view]].
