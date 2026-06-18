---
title: arrival
summary: A sandboxed Scheme interpreter (forked from LIPS) with a JS<->Scheme membrane, for agentic exploration without side effects.
layer: reference
status: in-review
tags: [package, arrival, scheme, sandbox, membrane, provenance]
canonical-for: []
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
code-anchors:
  - arrival/arrival/src/index.ts:139                  # bare exec/parse → generator path
  - arrival/arrival/src/eval/evaluator.ts:670         # flat-trampoline run()
  - arrival/arrival/src/eval/evaluator.ts:893         # TICK: abort + budget check
  - arrival/arrival/src/eval/generator-exec.ts:94     # exec ExecOptions
  - arrival/arrival/src/eval/generator-exec.ts:54     # budgetMs
  - arrival/arrival/src/eval/generator-exec.ts:63     # heapBudget
  - arrival/arrival/src/inference-env.ts:26           # inferenceEnv (Graal sweep)
  - arrival/arrival/src/inference-env.ts:90           # sandboxedEnv deprecated alias
  - arrival/arrival/src/Environment.ts:247            # Environment.defineRosetta
  - arrival/arrival/src/rosetta.ts:55                 # RosettaFunction
  - arrival/arrival/src/values/AValue.ts:42           # AValue.provenance
  - arrival/arrival/src/values/HalfBaked.ts:79        # HalfBaked
  - arrival/arrival/src/membrane.ts:837               # readMember (@ interop)
  - arrival/arrival/src/values/SchemeSymbol.ts:25     # unbounded intern table (DoS)
  - arrival/arrival/src/__tests__/sandbox-escape.test.ts:44   # sandbox escape vectors
---

# arrival

The sandboxed [[glossary#flat-trampoline-evaluator|flat-trampoline]] Scheme interpreter.
Package `@here.build/arrival` (`arrival/arrival/package.json:2`, version `0.1.0`), forked from
LIPS.js. Models author and evaluate Scheme on the inference plane; host reach is removed by
[[glossary#security-by-deletion|deletion]], not by a block list.

> Rename drift: the package is `@here.build/arrival` but `README.md:1` still titles it
> `@here.build/arrival-scheme` (the pre-rename name). See [[version-drift]].

## Overview

- **Entry**: bare `exec`/`parse` resolve to the generator path, shadowing the stdlib star-export
  (`index.ts:139`). The legacy recursive `evaluate` is deleted; stdlib's own `exec` delegates to
  the generator so both paths agree (`index.ts:131-139`).
- **Evaluator**: a generator-based, stack-safe trampoline (`eval/evaluator.ts`, ~2780 lines). No
  host recursion / promise chains — a flat generator stack (`eval/evaluator.ts:670`).
- **Base env**: `inferenceEnv` (`inference-env.ts:26`) — the totalic inference-plane env, NOT a
  security fence. The Graal-thesis sweep deleted `eval`/`load`/`set-obj!`/`set-special!`/`new`/
  `instanceof` at the source (`inference-env.ts:8-14`), so they do not EXIST to be fenced.
- **Boundary**: the only language-crossing door is the always-on polyglot [[membrane]]
  (`@`/`@?`/`@keys`), see `membrane.ts:837`.
- Values carry per-value [[provenance-model|provenance]]; see [[s-expressions-vs-json]] for the
  data/code form. Why deletion over fencing → [[security-by-deletion]].

## Public API

| Export | Signature | File:line |
|---|---|---|
| `exec` | `(code, ExecOptions?) => Promise<SchemeValue[]>` (generator path) | `eval/generator-exec.ts:94`; re-export `index.ts:139` |
| `parse` | `(code, env) => Promise<SchemeValue[]>` | re-export `index.ts:139` |
| `sandboxedEnv` | deprecated alias of `inferenceEnv` (never a security sandbox) | `inference-env.ts:90`; re-export `index.ts:8` |
| `inferenceEnv` | inference-plane base `Environment` | `inference-env.ts:26` |
| `jsToScheme` | JS → Scheme value conversion (rosetta) | re-export `index.ts:19`; `rosetta.ts` |
| `schemeToJs` | Scheme → JS value conversion (rosetta) | re-export `index.ts:19`; `rosetta.ts` |
| `Environment.defineRosetta` | `(name, RosettaFunction) => void` declarative JS-fn wrap | `Environment.ts:247` |
| `evaluateGenerator` / `execGenerator` | low-level generator evaluator | `index.ts:105`; `eval/evaluator.ts` |
| `installHeapMeter` | the ONE way to make an env allocation-bounded | `index.ts:129`; `heap-budget.ts` |

`ExecOptions` (`eval/generator-exec.ts:29`): `env`, `dynamic_env`, `use_dynamic`, `tap`,
`nodeFilter`, `signal` (`AbortSignal`, `:45`), `budgetMs` (internal wall-clock bound, `:54`),
`heapBudget` (per-run allocation cap on `to_array` cells, `:63`), `speculate` (Tier-2 lazy
`HalfBaked` opt-in, `:71`).

## Key internals

| Concern | Where | Notes |
|---|---|---|
| Flat trampoline | `eval/evaluator.ts:670` `run<T>()` | generator stack + frameStack + callStack; no JS call-stack growth |
| Budget/abort check | `eval/evaluator.ts:893` | rides the TICK cadence (every >1000 iter or >5ms); abort → `signal.reason ?? DOMException("AbortError")`; overrun → `SchemeError(/budget/)` |
| Budget setup | `eval/evaluator.ts:674-690` | fast-fail on pre-aborted signal / non-positive budget |
| `EvalContext` | `eval/evaluator.ts:209-282` | `signal`/`budgetMs`/`speculate` flags |
| `SchemePromise` | `eval/evaluator.ts:582` | memoized sync `force()`; `is_scheme_promise` (`:605`) |
| Speculation flag | `eval/evaluator.ts:337-340` | `_speculate` read synchronously by producer builtins |
| Environment | `Environment.ts:110` | `get`/`set`/`inherit`/`init`/`registerResolver`/`defineRosetta` |
| Graal sweep | `inference-env.ts:8-25` | deletes host verbs at source; inherits `userEnv` (no whitelist copy) |
| Reader/parser | `stdlib.ts` (upstream-LIPS-derived) | bridged to generator via `generator-exec.ts:12-14` |
| Values + provenance | `values/AValue.ts:42` | immutable; `withProvenance` mints a copy (`:51`); `unionProvenance` (`:96`), `pointProvenance` (`:114`) |
| `HalfBaked` | `values/HalfBaked.ts:79` | lazy Promise carrier (AValue subtype); `is_promise` false → passed un-awaited; force-on-unknown-boundary (`:18-23`) |
| Rosetta bridge | `rosetta.ts:55` `RosettaFunction`; `Environment.defineRosetta` (`Environment.ts:247`) | auto JS↔Scheme convert; `provenancePoint`/`argProvenance`/`withContext` options |
| fl-interop overlay | `env/fl-interop.ts` | SchemeJSArray-aware `car`/`cdr`, FL-dispatching `filter`/`map`/`reduce`; assembled onto `inferenceEnv` in `bridge.ts` `initBridge` |

## Invariants

- Bare `exec`/`parse` ALWAYS resolve to the stack-safe, budget-bounded generator path
  (`index.ts:131-139`).
- Host-reaching verbs (`eval`/`load`/`new`/`instanceof`/`set-obj!`/`set-special!`) do not exist in
  the env — non-existence, not a per-env block list (`inference-env.ts:8-14`).
- AValues are immutable; a provenance update mints a new instance (`values/AValue.ts:51`).
- The intern map is `Object.create(null)` so `(string->symbol "__proto__")` cannot pollute
  `Object.prototype` (`values/SchemeSymbol.ts:21-25`).

## Seams

- **0.x sandbox may be escaped** — `README.md:8-15` warns "assume the sandbox can be escaped; use
  zero-trust environments only." Escape-vector probes pinned in
  `__tests__/sandbox-escape.test.ts:44`.
- **Symbol-interning DoS** — `SchemeSymbol.list` never evicts; `(string->symbol unique)` in a loop
  grows it unboundedly until OOM. DOCUMENTED (not fixed) at `values/SchemeSymbol.ts:25`; behavior
  pinned in `__tests__/sandbox-escape.test.ts:307`. → [[docs/90-backlog/_moc|backlog]].
- **Un-forced Promise seam** — `HalfBaked`/`SchemePromise` have no `then`, so `is_promise` reports
  false and the value travels un-awaited; any operator that does not understand it must `force()`
  (force-on-unknown-boundary, `values/HalfBaked.ts:18-23`). A consumer that mishandles the carrier
  observes a raw lazy value.

## Tests

~1130 cases across `arrival/arrival/src/__tests__/` (67 files; `it/test/describe` count 1257,
`it/test`-only ~1004). Includes `sandbox-escape.test.ts` (escape + DoS vectors) and
`chibi-r7rs.spec.ts` (R7RS conformance against the chibi corpus). The chibi submodule
(`arrival/arrival/vendor/chibi-scheme`, `.gitmodules`) is **uninitialized** (`git submodule
status` reports the `-`/unchecked-out commit `97faa0b…`), so that spec cannot run against vendor
sources as-is. → [[docs/90-backlog/_moc|backlog]].

## Tasks

- Resolve the README rename drift (`arrival-scheme` → `arrival`). → [[version-drift]]
- Bound the symbol intern table (LRU or per-trace scoping). → [[docs/90-backlog/_moc|backlog]]
- Initialize the chibi submodule so `chibi-r7rs.spec.ts` runs. → [[docs/90-backlog/_moc|backlog]]
