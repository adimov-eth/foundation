// car.d.ts — THE REFERENCE LEAF (the test's guaranteed builtin).
//
// BITE CONTRACT (types-emit.test.ts:9-10): `PRE + car.d.ts + program` must
// clean-check a good `(car (list 1 2))` AND make an ill `(car 5)` BITE. That only
// works if `car` is GENERIC over `List<T>` — a coarse `(xs: unknown[]) => unknown`
// would NOT bite on `(car 5)` because `5` isn't checked against a list constraint
// via the emitter's `__arr.car(5)`. Generic `List<T> → T` makes `5` fail to satisfy
// `List<T>`, which is the whole point of the type lens.
//
// Author assertion over the `any` impl (rosetta trust model), checkable by eye.

declare global {
  interface ArrShape {
    /** `(car (list a b …)) → a`. Extracting the head requires a non-empty list;
     *  `(car 5)` bites because `5` is not `List<T>`. */
    car<T>(xs: List<T>): T;
  }
}

export {};
