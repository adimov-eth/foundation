// misc.d.ts — predicates, equality, vectors, io/control.
// `null? eq? eqv? equal? not apply` route through __arr (isBuiltin); rest bare.

declare global {
  interface ArrShape {
    "null?"(x: unknown): SBool;
    "eq?"(a: unknown, b: unknown): SBool;
    "eqv?"(a: unknown, b: unknown): SBool;
    "equal?"(a: unknown, b: unknown): SBool;
    not(x: unknown): SBool;
    apply<T>(f: (...a: unknown[]) => T, args: List<unknown>): T;
  }

  // predicates (bare, camelCased — the `?` is stripped)
  function pair(x: unknown): SBool;
  function number(x: unknown): SBool;
  function string(x: unknown): SBool;
  function symbol(x: unknown): SBool;
  function boolean(x: unknown): SBool;
  function procedure(x: unknown): SBool;
  function char(x: unknown): SBool;

  // vectors (bare) — generic like lists
  function vector<T>(...xs: T[]): Vec<T>;
  function vectorRef<T>(v: Vec<T>, k: SNum): T;
  function vectorSet<T>(v: Vec<T>, k: SNum, x: T): Unspecified;
  function makeVector<T>(k: SNum, fill?: T): Vec<T>;
  function vectorLength(v: Vec<unknown>): SNum;
  function vectorToList<T>(v: Vec<T>): List<T>;
  function listToVector<T>(xs: List<T>): Vec<T>;

  // io / control (bare)
  function display(x: unknown): Unspecified;
  function newline(): Unspecified;
  function write(x: unknown): Unspecified;
  function error(msg: SStr, ...irritants: unknown[]): never;
  function values(...xs: unknown[]): unknown;
  function callCc<T>(f: (k: (x: T) => never) => T): T;
}

export {};
