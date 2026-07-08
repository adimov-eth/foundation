// list.d.ts — the list builtins, GENERIC over element type (the lens's real precision).
//
// `list`/`cons`/`car`/`cdr`/`map`/`filter`/etc. carry element types through, so
// `(car (list 1 2))` is `SNum`, `(map string-upcase (list "a"))` type-checks, and
// wrong-type args bite. This is the difference from the coarse prelude — element
// types are inferred, not flattened to `unknown`.
//
// Split: the 4 in `isBuiltin()` (car in car.d.ts; cdr/cons/list/map/filter/length/
// append/reverse/list-ref here) route through `__arr`; the bare ones (for-each/fold/
// assoc/member/list-tail) are ambient globals (camelCased by the emitter).

declare global {
  interface ArrShape {
    list<T>(...xs: T[]): List<T>;
    cons<A, D>(a: A, d: D): List<A | D>;
    cdr<T>(xs: List<T>): List<T>;
    length(xs: List<unknown>): SNum;
    append<T>(...xs: List<T>[]): List<T>;
    reverse<T>(xs: List<T>): List<T>;
    "list-ref"<T>(xs: List<T>, i: SNum): T;
    map<T, U>(f: (x: T) => U, xs: List<T>): List<U>;
    filter<T>(f: (x: T) => SBool, xs: List<T>): List<T>;
  }

  // bare (not in isBuiltin → camelCase ambient)
  function forEach<T>(f: (x: T) => unknown, xs: List<T>): Unspecified;
  function fold<T, A>(f: (acc: A, x: T) => A, init: A, xs: List<T>): A;
  function foldLeft<T, A>(f: (acc: A, x: T) => A, init: A, xs: List<T>): A;
  function foldRight<T, A>(f: (x: T, acc: A) => A, init: A, xs: List<T>): A;
  function reduce<T>(f: (acc: T, x: T) => T, ridentity: T, xs: List<T>): T;
  function listTail<T>(xs: List<T>, k: SNum): List<T>;
  function assoc<T>(key: unknown, alist: List<T>): T | SBool;
  function assq<T>(key: unknown, alist: List<T>): T | SBool;
  function member<T>(x: T, xs: List<T>): List<T> | SBool;
  function memq<T>(x: T, xs: List<T>): List<T> | SBool;
}

export {};
