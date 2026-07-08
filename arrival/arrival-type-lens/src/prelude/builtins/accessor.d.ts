// accessor.d.ts — the c[ad]+r pair-accessor family (caar/cadr/cddr/… depth 2–4).
//
// WHY these live here and not with car. `car`/`cdr` are single-step (car.d.ts, list.d.ts);
// the mixed combos are one `isAccessor` family — `decodeAccessor` (@here.build/arrival-sweet)
// accepts any `c[ad]+r` word, so `isBuiltin` is true for all of them and the type-emitter
// lowers each to `__arr.<word>(xs)` (types-emit.ts:311 — the type-view does NOT use the
// run-view's `accessorJs` member-chain; it emits a plain __arr member call, so the type of
// that member IS this declaration). Without these, idiomatic `(cadr xs)` / `(caddr xs)`
// reported a spurious `TS2339 'Property cadr does not exist'` — a real type error's shape on
// correct Scheme, which is exactly the mis-signal this lens is built to avoid.
//
// SHAPE convention (matches decodeAccessor's PULL/DROP chain, verified against it): the word's
// OUTERMOST (leftmost) letter after `c` decides the result — `a…` extracts an element (`T`),
// `d…` returns the tail (`List<T>`). PRECISE for accessors over a proper homogeneous list —
// `cadr`/`caddr`/`cddr`/`cdddr` are exactly `List<T> → T`/`List<T>`. COARSE only for words with
// an inner (non-leftmost) `a` — `caar`/`caaar`/`cadar`/… index into an element as if it were a
// list; over a flat `List<T>` those return one level too shallow (a nested `caar` truly wants
// `List<List<T>>`). All still BITE on a non-list arg — `(cadr 5)` fails `List<T>`, which is the
// point — and none FALSE-POSITIVES on a flat list. Depth is capped at 4 (the realistic hand-
// written ceiling); a deeper word like `cadddddr` is a valid accessor that degrades to `TS2339`
// here — a deliberate coverage choice, not a claim the family ends at 4.

declare global {
  interface ArrShape {
    caar<T>(xs: List<T>): T;
    cadr<T>(xs: List<T>): T;
    cdar<T>(xs: List<T>): List<T>;
    cddr<T>(xs: List<T>): List<T>;
    caaar<T>(xs: List<T>): T;
    caadr<T>(xs: List<T>): T;
    cadar<T>(xs: List<T>): T;
    caddr<T>(xs: List<T>): T;
    cdaar<T>(xs: List<T>): List<T>;
    cdadr<T>(xs: List<T>): List<T>;
    cddar<T>(xs: List<T>): List<T>;
    cdddr<T>(xs: List<T>): List<T>;
    caaaar<T>(xs: List<T>): T;
    caaadr<T>(xs: List<T>): T;
    caadar<T>(xs: List<T>): T;
    caaddr<T>(xs: List<T>): T;
    cadaar<T>(xs: List<T>): T;
    cadadr<T>(xs: List<T>): T;
    caddar<T>(xs: List<T>): T;
    cadddr<T>(xs: List<T>): T;
    cdaaar<T>(xs: List<T>): List<T>;
    cdaadr<T>(xs: List<T>): List<T>;
    cdadar<T>(xs: List<T>): List<T>;
    cdaddr<T>(xs: List<T>): List<T>;
    cddaar<T>(xs: List<T>): List<T>;
    cddadr<T>(xs: List<T>): List<T>;
    cdddar<T>(xs: List<T>): List<T>;
    cddddr<T>(xs: List<T>): List<T>;
  }
}

export {};
