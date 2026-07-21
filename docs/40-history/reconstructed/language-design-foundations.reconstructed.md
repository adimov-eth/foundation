---
title: Language Design Foundations (reconstructed)
layer: history
status: in-review
tags: [history, reconstructed, arrival, scheme, membrane, reader, evaluator]
canonical-for: []
source-provenance:
  origin: docs/foundations/arrival-scheme/language-design-foundations.md
  branch: lost — not in tree nor origin/tmp-6164624 Archive
  retrieved: reconstructed 2026-06-18
  authority: derived
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
code-anchors:
  - arrival/arrival/README.md:16          # "Design foundations" section citing this doc
  - arrival/arrival/README.md:20          # charter link
  - arrival/arrival/README.md:139         # polyglot-runtime link
  - arrival/arrival/src/membrane.ts:1      # membrane: two-layer interop boundary
  - arrival/arrival/src/membrane.ts:812    # polyglot member-access protocol (Graal InteropLibrary)
  - arrival/arrival/src/interop-access.ts:1 # interop member-access policy (abstraction-not-integration)
  - arrival/arrival/src/reader/Parser.ts:1  # reader: text→datum, parse-time reader extensions
  - arrival/arrival/src/eval/evaluator.ts:1 # generator evaluator + flat trampoline
---

> ⚠️ **RECONSTRUCTION — not the original.** The original `docs/foundations/arrival-scheme/language-design-foundations.md` is lost everywhere (see [[dangling-doc-map]]). This note is reverse-engineered from the code it governed, anchored to `file:line`. Fidelity: **high**. It records what the doc *must have specified* given the implementation — not its original wording, nor rationale not evidenced in code.

> **Recovery update (2026-07-21):** the source has since been restored as
> [`language-design-foundations.md`](../../foundations/arrival-scheme/language-design-foundations.md).
> This reconstruction is retained as the derived pre-recovery evidence artifact; use the restored
> source for the actual wording and this note only to audit what had previously been inferred.

# Language Design Foundations (reconstructed)

The README calls this doc the **charter** for arrival's language stance and demands it be read "before adding a reader macro, literal, or dialect borrowing" (`arrival/arrival/README.md:16-21`, `:139`). The README names three charter clauses verbatim, which fix the doc's spine:

1. **An R7RS-small sandboxed base** (`README.md:18`).
2. **A forgiving superset layered *under* strict (never beside it)** (`README.md:18-19`).
3. **The reserved-zone rule that keeps it non-conflicting with any SRFI** (`README.md:19-20`).

Everything below is the implementation evidence for those clauses and the deeper philosophy they rest on. See [[arrival]], [[membrane]], [[s-expressions-vs-json]].

## 1. The governing stance: abstraction, not integration

arrival is a **fork of LIPS.js rewritten to prioritize sandboxing over JavaScript compatibility** (`README.md:5`). The charter's deepest commitment is that arrival is a *polyglot runtime*, not a host with a fenced guest:

> "a value is a value whichever language minted it" (`membrane.ts:814-815`).

This reframes interop from a security fence into an **interop protocol**. The member-access policy (`interop-access.ts:1-15`) states it directly: when Scheme reads a member via `@`/`:key`, expose **own data members only — never the implementation substrate's prototype machinery** (`constructor`, `__proto__`, built-in prototype methods, well-known symbols). The stated model is **Graal's `InteropLibrary.readMember`**, not a sandbox: "a foreign object exposes its members, not its language's internals (Graal does the same — JS can't reach Java's `getClass()`)" (`interop-access.ts:8-11`). "Boundary" means *the prototype where the member walk STOPS*, not a fence (`interop-access.ts:13-14`).

This is the **[[membrane]]** — `arrival/arrival/src/membrane.ts`. It is explicitly two-layered (`membrane.ts:3-13`):

- **Wrapper layer** (`fromJS`/`toJS`): general JS↔Scheme crossing. Thin wrappers (cljs-bean style), a WeakMap identity cache (Miller/Van Cutsem pattern), primitives pass through unwrapped (`membrane.ts:6-9`, `:420-462`, `:174-185`).
- **Codec layer** (`Codec`/`Operator`): typed bidirectional conversion at FFI boundaries (`membrane.ts:11-13`, `:509-725`).

The membrane is **read-only by design**: writes and deletes through a foreign object throw, because "arrival is a pure-dataflow sandbox — mutating the foreign peer is not dataflow" (`membrane.ts:301-311`, `:324-332`). Methods (function-valued properties) are *invisible* — they collapse to `nil`, because the pure-dataflow sandbox has no representation for a foreign invocation and a callable would let Scheme escape into uncontrolled JS (`membrane.ts:270-278`). This is the abstraction-not-integration rule made executable: the foreign value's **data** crosses, its **behavior and substrate** do not.

The uniform polyglot read protocol — `readMember`/`hasMember`/`memberKeys` (`membrane.ts:836-884`) — backs both the `@`/`@?`/`@keys` surface and the `:key` keyword accessor: "one protocol, two syntaxes" (`membrane.ts:820-822`). A `:keyword` is simultaneously a symbol and an `@`-alias: `:foo` resolves to `(lambda (arg) (@ arg :foo))` and, applied to nothing, returns itself so it composes (`membrane.ts:886-910`).

### Security posture in the charter

The README is blunt that the membrane is not yet a hardened sandbox: "version 0.x may be unsafe — use zero-trust environments only" and "Assume the sandbox can be escaped" (`README.md:8-12`, `:188-203`). The interop-access module enforces the boundary defensively: prototype-walk blocking via `INTEROP_BOUNDARY`, a **module-local (not `Symbol.for`) marker** so sandbox code cannot forge or strip it (`interop-access.ts:37-41`), and an always-blocked set of built-in prototypes (`interop-access.ts:66-70`). Each value-type opts into hiding its internals with `@arrival.private` (`interop-access.ts:9-11`).

## 2. S-expressions as the notation

The charter's choice of Scheme is justified in the README and rests on s-expressions as the surface for compositional reasoning: agents "think in filter/map/compose patterns" and "Scheme is the notation for compositional thinking" (`README.md:23-28`). The deeper claim — that homoiconic s-expressions, not JSON, are the right carrier for agent-authored, inspectable, provenance-bearing programs — is the subject of [[s-expressions-vs-json]]. The reader is the single text→datum entry point shared by evaluator, analysis tools, and MCP (`reader/Parser.ts:2-4`), which is what makes the same surface readable, evaluable, and traceable.

## 3. The reader — `arrival/arrival/src/reader/`

The reader's second stage (`reader/Parser.ts`) turns the Lexer's token stream into Scheme data. Two charter-relevant facts:

- **Reader extensions evaluate at PARSE time, not later** — the quote family and the `specials` registry (`reader/Parser.ts:6-7`, `:12`). This is the seam the charter guards: adding a reader macro or literal changes parse-time behavior, so it must respect the reserved-zone / non-conflict rule (`README.md:20-21`).
- **Bounded native-stack descent**: `_enterNesting` caps nesting depth so a pathological input fails with a Scheme `ParseError`, catchable by `guard`, instead of an uncatchable host `RangeError` (`reader/Parser.ts:6-9`, `:47-50`). Structure is inspired by BiwaScheme's parser (`reader/Parser.ts:8`).

Reader components: `Lexer.ts`, `Parser.ts`, `Formatter.ts`, `serialize.ts`, `specials.ts`, `curly-infix.ts` (SRFI-105 curly-infix canonicalization, `reader/Parser.ts:42`), `foldcase.ts` (R7RS `#!fold-case`, `reader/Parser.ts:11`), `values-repr.ts`. Vector and bytevector **literals** are minted here (`#(...)`, `#u8(...)`) and frozen at parse time per R7RS (`reader/Parser.ts:33-34`; see [[boxing-track-plan.reconstructed]]).

The README's clause-3 ("reserved-zone rule … non-conflicting with any SRFI") and clause-4 ("polyglot runtime") govern this directory: the `(dict :key value …)` map constructor and `(:key d)` accessor are named as deliberate borrowings from other Lisp dialects, with the constraint that they not collide with SRFI namespace (`README.md:137-139`).

## 4. The evaluator — `arrival/arrival/src/eval/evaluator.ts`

A **generator-based evaluator with a flat trampoline**, not promise-recursion or `yield*` (`eval/evaluator.ts:1-16`). Stated benefits: ~100x fewer promise allocations for pure Scheme, **true stack-safety** via the flat trampoline, event-loop breathing via periodic `TICK` yields, and JS interop preserved because the runner awaits yielded promises (`eval/evaluator.ts:5-16`, `:459`). The protocol: `yield { call: generator }` to invoke a sub-generator flatly (no host-stack growth), `yield promise` for interop, `yield TICK` to breathe (`eval/evaluator.ts:11-16`).

Tail position is tracked per R7RS §3.5 (`eval/evaluator.ts:154-157`, `:223`), so proper tail calls hold. The trampoline supports a wall-clock execution budget and abort via `AbortError` at iteration boundaries (`eval/evaluator.ts:210`, `:262-265`). Evaluation errors carry a **Scheme-level** stack (`SchemeError.schemeStack`), since host JS frames are useless to an agent reading a trace (`eval/evaluator.ts:56-89`).

The evaluator is also the seam where speculative `HalfBaked` values thread through un-awaited (`eval/evaluator.ts:34`; see [[speculative-evaluation-promise-functor.reconstructed]]) and where purity is enforced via the omitted dynamics (see [[purity-pass-plan.reconstructed]]).

## 5. What the charter forbids / constrains

Drawn from the README's "read it before…" mandate and the code:

- New **reader macros / literals**: must not break the reserved-zone non-conflict rule (`README.md:18-21`).
- The **forgiving superset is layered UNDER strict, never beside it** (`README.md:18-19`) — a borrowing may extend, never override, the R7RS-small base.
- Dialect **borrowings** (e.g. `dict`) are expression means added to the polyglot runtime, and must round-trip through the serializer / arrival-chain-view transpilation (`README.md:137-139`).
- Whole feature **families are omitted by design** (dynamics, mutators) for provenance soundness — see [[purity-pass-plan.reconstructed]] (`env/core.ts:23-41`).

## Cross-references

[[arrival]] · [[membrane]] · [[s-expressions-vs-json]] · [[determinism-and-effects]] · [[boxing-track-plan.reconstructed]] · [[purity-pass-plan.reconstructed]] · [[speculative-evaluation-promise-functor.reconstructed]]
