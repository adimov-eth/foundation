// logic.d.ts — the variadic short-circuit forms `and` / `or`.
//
// These are in STDLIB (variadicLogic("&&"|"||")) → isBuiltin → the type-emitter lowers
// `(and a b)` to `__arr.and(a, b)` (a plain __arr member call — NOT a special form; the
// switch at types-emit.ts:266-289 reserves quote/if/let/… but not and/or). So they need a
// declared ArrShape member or idiomatic `(and …)` / `(or …)` reports a spurious
// `TS2339 'Property and does not exist'` on correct code.
//
// RETURN type is `unknown`, deliberately. In Scheme `and`/`or` return a VALUE, not a strict
// boolean — `(or #f 3)` is `3`, `(and 1 2)` is `2`. Narrowing to `SBool` would be a lie the
// lens then enforces; `unknown` is the honest coarse type (the operands are still checked as
// expressions, so a type error INSIDE `(and (car 5) …)` still bites). Modelling the precise
// short-circuit union is possible but not worth the overload complexity here.

declare global {
  interface ArrShape {
    and(...xs: unknown[]): unknown;
    or(...xs: unknown[]): unknown;
  }
}

export {};
