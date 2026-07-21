---
title: Constraint-Kernel Spec (reconstructed)
layer: history
status: in-review
tags: [history, reconstructed, arrival, oracle, constraint-kernel, sampler, cross-project]
canonical-for: []
source-provenance:
  origin: docs/CONSTRAINT-KERNEL-SPEC.md (cited as sift/docs/CONSTRAINT-KERNEL-SPEC.md)
  branch: lost — not in tree nor origin/tmp-6164624 Archive
  retrieved: reconstructed 2026-06-18
  authority: derived
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
code-anchors:
  - arrival/arrival/src/oracle/index.ts:4    # the design-doc back-reference (sift/docs/...)
  - arrival/arrival/src/oracle/index.ts:43   # makeOracle() assembly point
  - arrival/arrival/src/oracle/contract.ts:1 # local copy of the oracle boundary
  - arrival/arrival/src/oracle/contract.ts:32 # OracleState verdict interface
  - arrival/arrival/src/oracle/contract.ts:84 # OracleScanner stateless entry
  - arrival/arrival/src/oracle/scanner.ts:1  # Layer S structural oracle
  - arrival/arrival/src/oracle/sigma.ts:1    # Layer Σ bound-symbol masking
  - arrival/arrival/src/oracle/env.ts:1      # OracleEnvΣ backed by a live Environment
---

> ⚠️ **RECONSTRUCTION — not the original.** The original `docs/CONSTRAINT-KERNEL-SPEC.md` (cited in code as `sift/docs/CONSTRAINT-KERNEL-SPEC.md`) is lost everywhere (see [[dangling-doc-map]]). This note is reverse-engineered from the code it governed, anchored to `file:line`. Fidelity: **high** (for the arrival half). It records what the doc *must have specified* given the implementation — not its original wording, nor rationale not evidenced in code.

# Constraint-Kernel Spec (reconstructed)

## Cross-project provenance

The spec is a **sibling/parent project artifact**: the code cites it as
`sift/docs/CONSTRAINT-KERNEL-SPEC.md` (`oracle/index.ts:4`) and the canonical contract source as
`sift/src/sampler/oracle-contract.ts` (`contract.ts:3`). The reference Layer-S reader is sift's
`prefix-oracle.ts` (`scanner.ts:24`, `:35`), and the static-half contract is
`sift/src/sampler/oracle-contract.ts` (`scanner.ts:3`). **`@here.build/foundations` (arrival) is the
foundation package; sift (`@sift/membrane`) depends on it, not the reverse** (`contract.ts:3-7`).
Hence arrival **re-declares the contract locally** rather than importing sift's types — importing
even type-only would invert the dependency arrow (`contract.ts:4-7`). The spec itself lives in the
sift tree and is not recoverable here beyond what arrival's implementation evidences.

## What the constraint kernel / oracle is

A **constraint kernel for autoregressive generation**: an oracle that, given an **accepted prefix**
of partial source, reports a verdict at the cursor that a constrained decoder compiles into a token
mask / validator / repair pass (`contract.ts:13-16`, `:31`). The whole design is one invariant:

> **Every method is a pure function of the ACCEPTED PREFIX. No lookahead, no backtracking** — so the
> constraint aligns with autoregressive generation (the model emits token t from 1..t-1 and never
> revises) (`contract.ts:16-17`, `scanner.ts:6-8`).

Two roles (`contract.ts:13-15`):
- **Track A (arrival, this package)** — *implements* the oracle.
- **Track B (sift)** — *consumes* the verdicts, compiling per-cursor verdicts into a mask /
  validator / repair pass "without knowing how the verdict is computed."

## Layered architecture (S / Σ / T)

The spec defines three layers, named in code as **Track O** with layers **S, Σ (O2), T (O3)**
(`index.ts:1`, `:8-10`; "Track O, Layer S" `scanner.ts:1`; "Track O, Layer Σ" `sigma.ts:1`):

| Layer | Role | Status in code |
|---|---|---|
| **S (structural)** | parse state of the prefix + structural next-token classes (`scanner.ts:1-8`) | live (`scanner.ts:352`) |
| **Σ (O2, bound-symbol masking)** | refine the `atom` class into the set of bound identifiers, position-filtered (`sigma.ts:1-11`) | live when an env is injected (`sigma.ts:22-23`) |
| **T (O3, types)** | `expectedType` / `produces` — the type constraint (`contract.ts:57-59`) | **not modelled yet**; degrades to null/true (`index.ts:9-10`, `scanner.ts:298-299`) |

**Graceful degradation** is a spec-level contract: with no env, Σ/T return `null`/`true` and the
oracle is byte-identical to the Layer-S scanner (`index.ts:35-46`, `contract.ts:10-12`,
`scanner.ts:30-32`).

## The kernel API (the contract)

`contract.ts` is "arrival's local copy of the constraint-kernel oracle boundary" (`contract.ts:1`).

**`OracleState`** — the per-cursor verdict, all fields pure functions of the prefix
(`contract.ts:32`):
- structural: `depth`, `inString`, `inComment`, `midToken`, `position`
  (`top`/`operator`/`argument`), `formKind` (`top`/`application`/`lambda-list`/`quote`/`lazy-arm`),
  `strict`, `closeable` (the EOS gate), `closeSuffix` (`")".repeat(depth)`), `overClosed`
  (`contract.ts:33-52`, `:23-29`).
- Σ: `validSymbols(): ReadonlySet<string> | null` — bound identifiers, position-filtered; `null` ⇒
  Σ not modelled (`contract.ts:54-55`).
- T: `expectedType(): TypeTag | null`, `produces(id, type): boolean` (`contract.ts:57-59`).
- always-available: `validClasses(): Set<TokenClass>` — the structural mask (`contract.ts:60-61`).

**`OracleScanner`** — the stateless entry (`contract.ts:84`):
`analyze(prefix)` (whole-prefix verdict), `feasible(prefix)` ("is this a prefix of SOME valid
program?"), and optional `session(prefix?)` opening a **resumable** oracle (`contract.ts:84-89`,
`:69-81`). `OracleSession`: `advance(text)`, `clone()` (detached copy for masking candidates,
no effects), `state`, `lastClosed` (the eval result of the last-closed strict form, Layer S ⇒ null),
`failed` (Layer S ⇒ false) (`contract.ts:70-81`).

**`OracleEnv`** — what Track A injects so Σ/T can answer: `boundSymbols()` and `signatureOf(id)`
(`contract.ts:91-97`). Σ extends it to `OracleEnvΣ` with `isCallable(id)` for operator-position
filtering (`sigma.ts:30-38`).

`EvalResult` is the dynamic-half real value of a committed strict form (`contract.ts:64-67`) — the
shape T/Track-A's incremental evaluator returns; Layer S never produces one.

## How it's invoked

`makeOracle(env?)` (`index.ts:43`) is the assembly point — "the public face of the constraint-kernel
oracle (Track A of sift/docs/CONSTRAINT-KERNEL-SPEC.md)" (`index.ts:1-4`):

- `makeOracle()` (no arg) ⇒ the Layer-S `structuralScanner`, **byte-identical** to the structural
  scanner (`index.ts:43-44`, `:40-41`).
- `makeOracle(env)` ⇒ `makeSigmaScanner(oracleEnv)` — Σ-live (`index.ts:45-46`). `env` may be a live
  `Environment` (wrapped by `makeOracleEnv`) or a pre-built `OracleEnvΣ`, discriminated by
  `isOracleEnv` (`index.ts:45`, `:49-53`).

The package public export is a deferred `Ocontract`/`A3` node added through `src/index.ts`'s explicit
allowlist; `oracle/index.ts` is the module-local boundary that node re-exports (`index.ts:4-7`).

## Layer S — the structural oracle

`scanner.ts` is "arrival's implementation of the constraint-kernel oracle's STATIC/STRUCTURAL half"
(`scanner.ts:3`). Key spec points evidenced:

- **Defined on truncated input — EOF is its normal case** — so it is a single-pass scanner, NOT the
  real `Lexer` FSM, which throws `Unterminated` on exactly the truncated prefixes the oracle must
  report gracefully (`scanner.ts:11-25`). It reports `{inString:true}` / `{inComment:true}` where the
  Lexer crashes (`scanner.ts:14-18`).
- It **ports the proven single-pass semantics of sift's `prefix-oracle.ts`** (the S-only reference)
  and **agrees with it on every shared structural field for every prefix** — proven by the
  **O0 conformance corpus** (`scanner.ts:24-30`, `:53`, also `contract.ts:8`). The corpus runs sift's
  reference S reader and the arrival impl against one shared corpus and asserts agreement
  (`contract.ts:8`).
- `scan(src)` (`scanner.ts:98`) is pure, O(n), single pass — string escapes, `;` line comments,
  nested `#| |#` block comments honored (`scanner.ts:92-97`).
- `feasible` = `!overClosed`: over-closing is the only real misnesting; everything else is
  completable (`scanner.ts:356-361`).
- `formKind`/`strict` is the strict-vs-lazy axis the dynamic half needs; the contract adds it plus
  the Σ/T hooks beyond what `prefix-oracle.ts` carried (`scanner.ts:28-32`).
- The shared, non-crashing machinery reused from arrival is `specials.names()` (the reader-macro
  set), asserted coupled so a Lexer reader-macro change surfaces here (`scanner.ts:24-25`, `:51-57`).

## Layer Σ — bound-symbol masking

`sigma.ts` refines `atom` into the bound-identifier set (`sigma.ts:1-11`):
`Σ = boundSymbols() ∪ scope-locals`, then **position-filtered**: operator ⇒ callables only, argument
⇒ any bound symbol, top/quote ⇒ null (`sigma.ts:6-11`, `computeValidSymbols` `:276-305`). Two
sources: the live env's `boundSymbols()` (**the grant boundary — "Σ enforces the sandbox's binding
set for free (spec §A2)"**, `sigma.ts:12-14`, `env.ts:1-7`) and lexical scope-locals computed as a
pure function of the prefix (`scanScope`, `sigma.ts:93`). The "§A2" / "§A2 grant" citation
(`sigma.ts:14`, `env.ts:6`) evidences a numbered section of the original spec on the grant boundary;
its prose is not recoverable from code.

`env.ts` backs `OracleEnvΣ` with a live arrival `Environment`: `boundSymbols()` enumerates the frame
chain (`__env__` up `__parent__`), `isCallable()` resolves nearest-binding-wins and tests
applicability without importing the evaluator's `Macro`/`Syntax` classes (`env.ts:24-72`).

## Reconstruction limits

- The numbered sections cited in code (**§A2**, and the spec's own layer numbering O0/O1/O2/O3) tell
  us the original was a numbered, sectioned spec, but their full text lives in the sift tree and is
  **not recoverable from arrival's code**.
- **Track B** (sift's consumer: mask/validator/repair compilation) is described only by the contract
  contract; its implementation is out of this tree.
- **Layer T (O3)** is specified by the contract surface (`expectedType`/`produces`/`signatureOf`/
  `EvalResult`) but unimplemented here; its detailed semantics are not recoverable from code.
