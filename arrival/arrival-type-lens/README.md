# @here.build/arrival-type-lens

The TypeScript type surface that arrival Scheme is checked against, plus the checker that
positions type errors back onto the `.scm` source.

> ### ⚠️ This is a reconstruction
>
> The original `arrival-type-lens` was **carved out** of this open-source cut of the engine.
> Its importer block survives in `pnpm-lock.yaml` as a *ghost* (deps but no source); the real
> package lives only in the parent repo. This package **rebuilds the contract from public,
> in-tree parts** — it is faithful to the package's *shape* and its declared checker
> (`tsgo-wasm`), not a byte-for-byte copy of the parent original.
>
> What it is rebuilt from (all present in this repo):
> - the **BITE contract** pinned by `@here.build/arrival-chain-view`'s `types-emit.test.ts`
>   (`PRE + car.d.ts` must clean-check a good program *and* make `(car 5)` bite);
> - the emitter's `__arr` / bare-identifier **lowering surface** (`types-emit.ts`), including its
>   **host-function routing** (`hostMembers` → any host head lowers through `__arr`, so a consumer
>   that supplies host-rosetta signatures gets them typed).
>
> Its runtime dependencies are honestly **what this code imports** — `arrival-chain-view`
> (emit + span lens), `arrival-sweet` (top-form spans), `tsgo-wasm` (the checker). This is a
> *smaller, differently-routed* dep set than the ghost block declares, because the
> reconstruction duck-types the environment and routes emit through `arrival-chain-view`
> rather than coupling to `arrival-chain` directly. The ghost block is preserved unchanged as
> the archaeological record of the original's shape.

## What's in it

Two parts, plus a host-function typing hook:

1. **Base types** (`src/prelude/types.d.ts`) — the Scheme-value vocabulary: `List<T>`, `SNum`,
   `SBool`, `SStr`, `Sym`, `Char`, `Vec<T>`, `Dict`, `Unspecified`, plus the `__arr` table and
   the `sexpr` opaque-head fallback.
2. **Per-builtin leaves** (`src/prelude/builtins/*.d.ts`) — generic, *biting* signatures for the
   common R7RS builtins (`car`/`cdr`/`map`/`filter`, arithmetic, strings, vectors, predicates).
   Generic so `(car 5)` bites (`5` is not `List<T>`). An **unmodelled** builtin degrades
   *loudly* — `(hash-table-ref h 0)` → `Cannot find name 'hashTableRef'` — never silently.

**Host functions (rosettas)** are typed by the *consumer*, not harvested here. A consumer that has
host-function signatures — from a live env's `__rosettaTypes__`, a manifest, anywhere — passes
`diagnoseScheme(scm, { hostMembers, preludeAppend })`: `hostMembers` routes those heads through
`__arr` (the emitter's real capability), `preludeAppend` is a `.d.ts` fragment declaring them. This
package deliberately ships **no** env-reader that harvests those sigs off `__rosettaTypes__` — the
only in-tree consumer (`@here.build/arrival-ts-lsp`) checks pasted source with no env in hand, so a
harvester had zero callers. Sourcing the signatures is the consumer's job; typing them is this
package's. (History: the harvester shipped in an earlier reconstruction and was retracted as
correct-but-unconsumed; the two options are the mechanism-agnostic contract that survived.)

## The checker

`diagnoseScheme(scm)` runs the full pipeline:

```
scm ──emitTypes──▶ { ts, mappings }        (arrival-chain-view: type-faithful virtual TS + span lens)
PRE + ts ──tsgo-wasm --noEmit──▶ diagnostics @ (line,col)   (portable TypeScript-7 compiler)
each (line,col) ──offset + span-lens lift──▶ [scmStart, scmLen)   (back onto the .scm)
each diagnostic ──topFormSpans──▶ enclosing top-level form        (arrival-sweet)
```

It drives **`tsgo-wasm`** (TypeScript 7 / typescript-go compiled to WASM) rather than the node
`typescript` compiler API — because a lens that lives inside a sandboxed Scheme runtime needs a
*portable* tsc (WASM, no host install, worker/browser-runnable). That is the dependency the
original declared, and this reconstruction honors it.

```ts
import { diagnoseScheme } from "@here.build/arrival-type-lens";

const { diagnostics } = diagnoseScheme("(car 5)");
// → [{ code: 2345, severity: "error", schemeStart: 5, schemeLength: 1, line: 0, col: 5,
//      message: "Argument of type 'number' is not assignable to parameter of type 'readonly unknown[]'." }]
// The diagnostic lands on the exact offending sub-form: scm.slice(5, 6) === "5".
```

## License

FSL-1.1-MIT — see [LICENSE.md](./LICENSE.md).
