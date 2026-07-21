---
title: Boxing Track Plan (reconstructed)
layer: history
status: in-review
tags: [history, reconstructed, arrival, values, boxing, provenance]
canonical-for: []
source-provenance:
  origin: docs/plan-2026-06-10-boxing-track.md
  branch: lost — not in tree nor origin/tmp-6164624 Archive
  retrieved: reconstructed 2026-06-18
  authority: derived
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
code-anchors:
  - arrival/arrival/src/values/SchemeVector.ts:13   # cites boxing plan §S5
  - arrival/arrival/src/values/SchemeBytevector.ts:10 # cites boxing plan §S1
  - arrival/arrival/src/values/AValue.ts:9            # boxer registry rationale (cycle-break)
  - arrival/arrival/src/values/AValue.ts:55           # registerBoxer
  - arrival/arrival/src/values/AValue.ts:66           # fromJs single membrane
  - arrival/arrival/src/membrane.ts:799               # the "object" tag boxer (list-conser, R6)
  - arrival/arrival/src/values/SchemeVector.ts:8      # "boxing plan §1" — Array disambiguation
  - arrival/arrival/src/values/SchemeBytevector.ts:21 # S3 membrane recognizes boxed bytevectors
---

> ⚠️ **RECONSTRUCTION — not the original.** The original `docs/plan-2026-06-10-boxing-track.md` is lost everywhere (see [[dangling-doc-map]]). This note is reverse-engineered from the code it governed, anchored to `file:line`. Fidelity: **medium** (a point-in-time PLAN). It reconstructs *what the resulting code shows was decided*. Step ordering, deliberation, and rejected alternatives are **not recoverable from code** and are marked where inferred.

# Boxing Track Plan (reconstructed)

A staged ("track") plan to **box raw JS payloads into `AValue` kernel subtypes** so that vectors and bytevectors carry [[provenance-model]] and host Fantasy Land algebra instances, while preserving the membrane's pre-existing array/binary pass-through contract. The code cites the plan by numbered steps: `S1`, `S3`, `S5`, and rule numbers `R6`, `§1`. The step numbers below are quoted from those citations; intervening steps (`S2`, `S4`) are inferred to exist but their content is **not recoverable from code**.

## Why box at all (realized intent)

The kernel rule, stated in [[arrival-chain]]'s propagation algebra and the `AValue` header: **provenance lives on the value, not in a sidecar `WeakMap`** (`AValue.ts:1-8`). A WeakMap keyed by object identity "snaps the instant any builtin produces a fresh value" — every builtin would have to re-stamp; on-value means a builtin can only forget to *propagate*, never to *carry* (`AValue.ts:2-7`). For vectors and bytevectors to participate in provenance and in `equal?`/algebra, they must therefore be real `AValue` subtypes — a raw `Array` or `Uint8Array` cannot carry the lineage set.

## The boxer registry (the cycle-break — realized)

The plan's structural decision: boxing dispatches through a **registry**, not a `switch` in `fromJs`.

- A `switch` over subtypes would force `AValue.ts` to import every subtype; but subtypes already import `AValue.ts` for `extends AValue` — an import **cycle** (`AValue.ts:9-12`).
- The registry **inverts the dependency**: subtypes (and the membrane) call `AValue.registerBoxer(typeofTag, fn)` at module load; `AValue.fromJs` looks up the boxer by `typeof`-tag (`AValue.ts:38`, `:55-57`, `:66-80`).
- Keys are `typeof`-tags plus the two null-ish tags `"null"`/`"undefined"` (`AValue.ts:35-36`, `:83-93`). Registration order is not significant (`AValue.ts:54`). `fromJs` throws (invariant) if a tag's boxer module has not loaded — a programmer error, not a runtime condition (`AValue.ts:75-80`).
- `fromJs` has a same-instance fast path: already-`AValue` input returns as-is unless a non-empty provenance is supplied (`AValue.ts:66-72`).

## Producer-minted vs registry-boxed (rule R6 — realized)

A central decision, cited as **R6**: the `"object"` `typeof` tag is *already taken* by the membrane's **list-conser** — `Array.isArray(v)` → cons up a proper Scheme list, else wrap as `SchemeJSObject` (`membrane.ts:795-808`). Therefore vectors and bytevectors are **NOT** registered via `registerBoxer`; they are **producer-driven** (producer-minted):

- `SchemeVector` is minted only by `#(...)` literals / `make-vector` / `vector` / `vector-copy` / `list->vector` (`SchemeVector.ts:121-124`).
- `SchemeBytevector` is minted only by `bytevector` / `make-bytevector` / `string->utf8` / Parser `#u8(...)` (`SchemeBytevector.ts:155-157`).

Both files state explicitly: "the `object` typeof tag is taken by the membrane's list-conser (R6). Boxing is producer-driven." (`SchemeVector.ts:122-124`, `SchemeBytevector.ts:156-157`).

## §1 — the Array disambiguation (realized, cited "boxing plan §1")

`SchemeVector.ts:5-12` records the plan's §1: a raw JS `Array` is **heavily overloaded** in the interpreter and is **not** a vector. Raw arrays are: the `evaluateArgs` args carrier, `Values`, `HalfBaked` slot results, the `syntax-rules` ellipsis machinery, and JS-array-as-list at the membrane. The decision: only vector literals / `make-vector` / vector builtins mint `SchemeVector`. Making `SchemeVector` its own class leaves every `Array.isArray` site unaffected — and the rule is **"NEVER widen them to accept it"** (`SchemeVector.ts:11-12`). This is why §1 logically *precedes* boxing: you cannot box vectors without first proving raw arrays are a disjoint concept.

## S1 — SchemeBytevector (realized)

`SchemeBytevector.ts:10` is annotated "Boxing track: docs/plan-2026-06-10-boxing-track.md (S1)." Decisions realized:

- One normalized payload: the constructor co-locates the old `asBytevector` coercion, accepting `Uint8Array | ArrayBuffer | DataView | Buffer | number[] | SchemeBytevector` and normalizing to a single `Uint8Array` (`SchemeBytevector.ts:23-68`).
- **Mutable** payload (`bytevector-u8-set!`/`copy!` write through), unlike a frozen string literal (`SchemeBytevector.ts:5-8`, `:57`). R7RS immutability for `#u8(...)` literals is a `frozen` flag, *not* `Object.freeze` (which throws on a non-empty typed array) (`SchemeBytevector.ts:60-63`).
- Fantasy Land algebras grafted onto the instance: Setoid (`fantasy-land/equals`, byte-wise), Ord (`fantasy-land/lte`, lexicographic over unsigned bytes), Semigroup (`fantasy-land/concat`) (`SchemeBytevector.ts:115-153`).

## S3 — membrane recognizes boxed bytevectors (inferred from a back-reference)

`SchemeBytevector.ts:18-20` references "S3 so the membrane recognizes boxed bytevectors." Realized: `isSchemeValue` lists `SchemeBytevector` / `SchemeVector` among native Scheme types (`membrane.ts:108-110`), and the membrane unwraps them via the `TO_JS` protocol back to the raw `Uint8Array` / array (`SchemeBytevector.ts:95-99`, `SchemeVector.ts:70-74`). Note the **pass-through contract is preserved**: raw binary that bypasses producers (FFI) stays raw and is coerced on use, so `bytevector?` is polymorphic (boxed OR raw) (`membrane.ts:437-443`).

## S5 — SchemeVector (realized)

`SchemeVector.ts:13` is annotated "Boxing track: … (S5)." Decisions realized:

- Modeled on `SchemeString` / `SchemeBytevector` (`SchemeVector.ts:2-3`).
- **Mutable** payload (`vector-set!`/`fill!`/`copy!`); `#(...)` literals frozen via the same `frozen` flag, set by the Parser (`SchemeVector.ts:4`, `:29-43`).
- Fantasy Land: Setoid, Semigroup, Functor (`fantasy-land/map`). The N-ary `vector-map` builtin is noted as a separate non-Functor observation (`SchemeVector.ts:92-118`).
- `withProvenance` shares the payload by reference and preserves the frozen flag, so re-stamping a literal's provenance never yields a mutable alias (`SchemeVector.ts:84-90`).

## The class-definition-time cycle hazard (realized, both files)

A recurring detail the plan must have specified: the membrane's `TO_JS` key is resolved locally via `Symbol.for("scheme.toJS")` **rather than imported from `membrane.js`**. `Symbol.for` returns the *same* symbol as the membrane's `export const TO_JS`, so the protocol is identical — but importing it would create a `membrane.js → SchemeBytevector.ts` cycle (added in S3), and `[TO_JS]()` is a class-definition-time **computed key** (TDZ hazard). Local resolution breaks the edge (`SchemeBytevector.ts:15-21`, `SchemeVector.ts:20-23`).

## Interop boundary (realized)

Every boxed subtype calls `markInteropBoundary(...)` at definition so prototype-walk symbol-to-field resolution cannot expose inherited methods — same rationale as `SchemeString` (`SchemeVector.ts:126-131`, `SchemeBytevector.ts:159-165`; policy in `interop-access.ts`, see [[membrane]]).

## Plan-intent vs realized-code (honesty ledger)

- **Realized & verifiable**: registry pattern, R6 producer-minted decision, §1 array disambiguation, S1 bytevector, S5 vector, S3 membrane recognition, the `Symbol.for` cycle-break, mutability + freeze semantics, Fantasy Land algebras.
- **Inferred (steps named but content not in code)**: `S2`, `S4` exist by numbering but their scope is **not recoverable**. Plausibly `SchemeString` (S5 says vector is "Modeled on SchemeString") and the `asBytevector`-coercion removal — but this is inference, not evidence.
- **Not recoverable from code**: the deliberation order, rejected alternatives (e.g. whether a `WeakMap` sidecar for vectors was considered then rejected — the `AValue.ts` header argues against it generally but does not tie that argument to this plan), and any non-shipped steps.

## Cross-references

[[arrival]] · [[membrane]] · [[provenance-model]] · [[arrival-chain]] · [[language-design-foundations.reconstructed]] · [[speculative-evaluation-promise-functor.reconstructed]]
