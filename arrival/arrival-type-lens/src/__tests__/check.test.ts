// check.test.ts — the reconstruction's acceptance, encoded.
//
// These are the BITE CONTRACT (a good program clean-checks; a mistyped one bites on the exact
// offending sub-form) plus the honest-degradation and lift-precision guarantees. They drive the
// real tsgo-wasm compiler through the built lens — a green run here is what "reconstructed" means.

import { describe, it, expect } from "vitest";
import { diagnoseScheme, loadAuthoredPrelude } from "../index.js";

/** True iff any diagnostic is an error. */
const hasError = (scm: string): boolean => diagnoseScheme(scm).diagnostics.some((d) => d.severity === "error");

describe("the prelude asset", () => {
  it("loads and declares the __arr table (the load-bearing `export {}` must survive)", () => {
    const pre = loadAuthoredPrelude();
    expect(pre).toContain("const __arr: ArrShape");
    // Each concatenated .d.ts must be a module (end with `export {}`) so its `declare global` is
    // legal — without this the whole type surface silently vanishes (Cannot find name '__arr').
    expect(pre).toContain("export {};");
    expect(pre).toContain("declare global");
  });
});

describe("the bite contract", () => {
  it("clean-checks a well-typed program", () => {
    expect(hasError("(car (list 1 2))")).toBe(false);
    expect(hasError('(string-length "hi")')).toBe(false);
    expect(hasError("(+ 1 2 3)")).toBe(false);
  });

  it("bites on a wrong argument type — and lands on the offending sub-form", () => {
    const { diagnostics } = diagnoseScheme("(car 5)");
    const err = diagnostics.find((d) => d.severity === "error");
    expect(err).toBeDefined();
    // The 5 (not a list) is the offending form; the lift must select it exactly.
    expect("(car 5)".slice(err!.schemeStart, err!.schemeStart + err!.schemeLength)).toBe("5");
    expect(err!.code).toBe(2345);
  });

  it("bites across the builtin surface", () => {
    expect(hasError("(string-length 42)")).toBe(true); // 42 not a string
    expect(hasError('(+ 1 "x")')).toBe(true); // string in arithmetic
    expect(hasError("(vector-ref (list 1 2) 0)")).toBe(true); // list where a vector is wanted
  });
});

describe("honest degradation", () => {
  it("reports an unmodelled builtin LOUDLY (Cannot find name), never silently", () => {
    const { diagnostics } = diagnoseScheme("(frobnicate 1)");
    const err = diagnostics.find((d) => d.severity === "error");
    expect(err).toBeDefined();
    expect(err!.code).toBe(2304); // Cannot find name
    expect(err!.message).toContain("frobnicate");
  });

  it("does not crash on malformed source", () => {
    expect(() => diagnoseScheme("(((")).not.toThrow();
    expect(() => diagnoseScheme("")).not.toThrow();
  });
});

describe("multi-line lift + top-form attribution", () => {
  it("lifts a diagnostic onto the correct source line and enclosing top-level form", () => {
    const { diagnostics } = diagnoseScheme("(define x 1)\n(car 5)");
    const err = diagnostics.find((d) => d.severity === "error");
    expect(err).toBeDefined();
    expect(err!.line).toBe(1); // the error is on the SECOND line
    expect(err!.topForm).toBe(1); // the second top-level form (via arrival-sweet's topFormSpans)
  });
});
