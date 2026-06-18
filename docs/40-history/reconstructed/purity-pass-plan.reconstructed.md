---
title: Purity Pass Plan (reconstructed)
layer: history
status: in-review
tags: [history, reconstructed, arrival, purity, provenance, effects]
canonical-for: []
source-provenance:
  origin: docs/plan-2026-06-11-purity-pass.md
  branch: lost — not in tree nor origin/tmp-6164624 Archive
  retrieved: reconstructed 2026-06-18
  authority: derived
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
code-anchors:
  - arrival/arrival/src/env/core.ts:41         # cites the purity-pass plan; the door LIST
  - arrival/arrival/src/env/core.ts:23          # "PURITY — what arrival omits, and why"
  - arrival/arrival/src/stdlib.ts:1092          # cites the plan; %purity-door host primitive
  - arrival/arrival/src/purity.ts:1             # PurityError + purityDoor typed throw
  - arrival/arrival/src/purity.ts:42            # purityDoor: deny + reason + alternative
  - arrival/arrival/src/values/AValue.ts:1      # provenance-on-value (the soundness premise)
---

> ⚠️ **RECONSTRUCTION — not the original.** The original `docs/plan-2026-06-11-purity-pass.md` is lost everywhere (see [[dangling-doc-map]]). This note is reverse-engineered from the code it governed, anchored to `file:line`. Fidelity: **medium** (a point-in-time PLAN). It reconstructs *what the resulting code shows was decided*. Sequencing and rejected alternatives are **not recoverable from code** and are marked.

# Purity Pass Plan (reconstructed)

A plan to make arrival **pure dataflow rather than general Scheme** by *omitting* two whole feature families and replacing each with a **teaching error-as-door**. Cited from both the language side (`env/core.ts:41`) and the host side (`stdlib.ts:1092`). Cross-link [[determinism-and-effects]].

## The soundness premise (realized)

The plan's justification is stated identically in three places: arrival's reason to exist is **value-level provenance** — every value carries the lineage of where it was constructed, and the MCP/trace engine reads it; **lineage is sound only if values are immutable and evaluation is pure** (`env/core.ts:27-31`, `purity.ts:3-9`, premise in `AValue.ts:1-8`). This is why purity is not a style preference but a load-bearing invariant: the "purity pass" is the work of *excluding everything that would falsify lineage*.

## The two omitted families (realized — the classification)

The pass classifies omitted features into exactly two families, each with a distinct reason (`env/core.ts:31-41`, `purity.ts:3-9`):

1. **DYNAMICS** — "tie a value's identity to WHEN/WHERE control re-enters — not to where it was built." Omitted: `call/cc`, `call-with-current-continuation`, `dynamic-wind`, `make-parameter`, `parameterize`, `delay`, `force`, `make-promise`, `delay-force` (`env/core.ts:32-33`, `:67-85`).
2. **WRITING METHODS** — "change a value after construction, falsifying its lineage. Every entity is frozen by design." Omitted: `set-car!`, `set-cdr!`, `append!`, `vector-set!`, `vector-fill!`, `vector-copy!`, `string-set!`, `string-fill!`, `string-copy!`, `bytevector-u8-set!`, `bytevector-copy!` (`env/core.ts:34-36`, `:43-65`).

The framing the plan insists on: "These are not missing features — they are what HAD to be excluded for the provenance engine to be true." (`env/core.ts:37-38`, echoed `purity.ts:9`).

## The mechanism — errors-as-doors (realized)

The decided architecture splits ownership cleanly:

- **The language owns the LIST.** Each omitted name is a `define-macro` "door" in `CORE_SCM` (`env/core.ts:17-86`), the base-most pack concatenated FIRST so it is the precedence floor (`env/core.ts:4-13`, `:11-13`). Each door expands to a quoted `(%purity-door feature reason alternative)` call carrying three strings: the omitted name, the provenance/purity reason, and the **supported alternative** (`env/core.ts:44-85`). Example: `set-car!` → reason "every value is frozen by design …" → alternative "construct a new value (cons / list)" (`env/core.ts:44-45`). Dynamics doors route to supported R7RS facilities where one exists — e.g. `call/cc` → "for early exit use guard / raise (R7RS section 6.11, supported)" (`env/core.ts:68-69`); `dynamic-wind` → a `(guard (e (#t (cleanup) (raise e))) ...)` pattern (`env/core.ts:72-73`).
- **The host owns the TYPED throw.** `%purity-door` is the single stdlib primitive behind every door (`stdlib.ts:1087-1096`). It stringifies its three args and calls `purityDoor`, which throws a `PurityError` (`purity.ts:42-44`). The `PurityError` carries `feature` as an internal routing/telemetry key (errors-as-doors Rule 3/5) and an `owner` tag `owned-by/purity-invariant` (`purity.ts:20-32`, `:14-16`). The thrown message is the three-line teaching form: `"<feature> is omitted from arrival by design.\n  Why: <reason>\n  Instead: <alternative>"` (`purity.ts:43`).

The stdlib comment states the division verbatim: "the language owns the LIST, the host owns the typed throw" (`stdlib.ts:1091-1092`), matched by `purity.ts:11-16`.

## Why doors, not silent absence (realized)

The decision was to make omissions **discoverable and teaching** rather than "symbol not bound" errors. A door names the omission, the reason, and the alternative — turning a dead end into a redirect. The telemetry hook (`feature`/`owner` codes → "follow-rate telemetry") is cited as the payoff: the engine can measure how often each door is hit and followed (`stdlib.ts:1090-1092`, `purity.ts:14-16`).

## Interaction with what is KEPT (realized nuance)

The purity pass is not a blanket ban on dynamic-looking forms:

- `parameterize` is a purity door in `core.ts` (`env/core.ts:76-77`), yet `stdlib.ts` *also* registers a working `parameterize` via `genMacroWrapper` with real dynamic-extent semantics (`stdlib.ts:1080-1084`). The precedence-floor ordering (`core.ts` first) means the door is the base-pack default; reading the two together, the realized state is that the door is the manifesto entry while a capability pack may still provide a controlled implementation. The exact resolution order is **partially recoverable** — `core.ts` is concatenated first (`env/core.ts:11-13`) — but which wins at a given assembly is **not fully recoverable from code** and would have been specified in the plan.
- `guard`/`raise` are the sanctioned control channel the dynamics doors redirect to (`env/core.ts:69`, `:73`), confirming the pass kept structured exception handling.

## Plan-intent vs realized-code (honesty ledger)

- **Realized & verifiable**: the two-family classification with distinct reasons; the full door list; the language-owns-list / host-owns-throw split; `%purity-door` → `purityDoor` → `PurityError`; the three-string teaching-door shape; telemetry intent.
- **Not recoverable from code**: whether a runtime *static* purity analysis (a "pass" over a program AST classifying each form pure/effectful) was ever planned beyond the door manifesto — the realized mechanism is door-at-call-time, not a pre-pass. The word "pass" in the filename may refer to the one-time refactor sweep that installed the doors rather than an analysis stage. Sequencing and rejected alternatives (e.g. throwing a bare `Error` vs `PurityError`) are not recoverable.

## Cross-references

[[determinism-and-effects]] · [[arrival]] · [[provenance-model]] · [[language-design-foundations.reconstructed]] · [[boxing-track-plan.reconstructed]]
