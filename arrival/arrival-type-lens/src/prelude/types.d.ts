// arrival-type-lens · prelude/types.d.ts — the PRE base-type vocabulary.
//
// Reconstructed 2026-07-08 from the carved-out package's in-tree contract:
//   - `rosetta.d.ts:60-62`: "Base types (List, SNum, SBool, SStr, Dict) come from
//     the lens prelude; host entity types come from the env's type-preamble."
//   - `types-emit.ts`: the emitter lowers `(f a b)` → `__arr.f(a,b)` / bare `f(a,b)`
//     and opaque heads → `sexpr(head, …)`. This file declares the ambient globals
//     those calls resolve against, in the Scheme-value type vocabulary.
//   - `__tests__/types-emit.test.ts:9-10`: the BITE contract — `PRE + car.d.ts +
//     program` must clean-check a good program AND make `(car 5)` bite.
//
// The base types model the interpreter's value classes (values/*.ts): SchemeExact/
// SchemeInexact → SNum, SchemeBool → SBool, SchemeString → SStr, Pair/Nil → List<T>,
// SchemeVector → Vec<T>, SchemeSymbol → Sym, SchemeCharacter → Char. Types are AUTHOR
// ASSERTIONS over the `any` impl — checkable by eye, faithful, not mechanically
// derived — the same trust model the real leaves carry (rosetta.d.ts:72-73).

declare global {
  // ── Scheme value types (the vocabulary every builtin leaf is typed in) ──
  /** A number — exact or inexact. Coarse over the exact/inexact tower (the real lens
   *  keeps them distinct where a builtin cares; here unified for the common arith path). */
  type SNum = number;
  /** A boolean. */
  type SBool = boolean;
  /** A string. */
  type SStr = string;
  /** A symbol. */
  type Sym = symbol;
  /** A character (modelled as a 1-char string at the type level). */
  type Char = string;
  /** A proper list of `T`. Generic — this is what makes `(car 5)` BITE: `5` is not `List<T>`. */
  type List<T = unknown> = readonly T[];
  /** A vector of `T`. */
  type Vec<T = unknown> = T[];
  /** A dict / assoc surface. */
  type Dict = Record<string, unknown>;
  /** The unspecified/void return of an effectful builtin. */
  type Unspecified = void;

  // ── the ambient tables the emitter calls into ──
  /** The `__arr` builtin table — populated by the ArrShape merge (types-emit + host leaves). */
  const __arr: ArrShape;
  /** Opaque/computed-head fallback: `((get-fn) 1 2)` → `sexpr(getFn, 1, 2)`. Total, untyped. */
  function sexpr<T = unknown>(head: unknown, ...args: unknown[]): T;

  /** The `__arr` member surface — the 31 `isBuiltin()` names route through here.
   *  Merged with per-builtin leaf declarations (builtins/*.d.ts) at type-check time. */
  interface ArrShape {}
}

export {};
