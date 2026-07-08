// check.test.ts — the reconstruction's acceptance, encoded.
//
// These are the BITE CONTRACT (a good program clean-checks; a mistyped one bites on the exact
// offending sub-form) plus the honest-degradation and lift-precision guarantees. They drive the
// real tsgo-wasm compiler through the built lens — a green run here is what "reconstructed" means.

import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, it, expect } from "vitest";

import { diagnoseScheme, loadAuthoredPrelude } from "../index.js";

/** True iff any diagnostic is an error. */
const hasError = (scm: string): boolean => diagnoseScheme(scm).diagnostics.some((d) => d.severity === "error");

// Each diagnoseScheme call boots a fresh ~49MB tsgo-wasm process (~2s local, ~4s CI), so tests
// that would loop one call per snippet time out under CI. Instead we batch snippets into ONE
// program (one line each → one spawn) and reason per-line — strictly stronger (the heads coexist)
// and ~30× cheaper. `linesWithError` returns the set of 0-based lines carrying an error.
const linesWithError = (program: string): Set<number> =>
  new Set(
    diagnoseScheme(program)
      .diagnostics.filter((d) => d.severity === "error")
      .map((d) => d.line),
  );

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
    // One program, one spawn — each line is a distinct wrong-type call that must error.
    const bites = [
      "(string-length 42)", //        line 0 — 42 not a string
      '(+ 1 "x")', //                 line 1 — string in arithmetic
      "(vector-ref (list 1 2) 0)", // line 2 — list where a vector is wanted
    ];
    const errored = linesWithError(bites.join("\n"));
    for (const [line] of bites.entries()) {
      expect(errored, `line ${line} (${bites[line]}) should bite`).toContain(line);
    }
  });
});

describe("idiomatic-builtin coverage (no spurious 'Property does not exist')", () => {
  // Regression guard: every head the emitter routes through `__arr` (isBuiltin) MUST have an
  // ArrShape member, else correct R7RS Scheme reports TS2339/TS2551 'Property X does not exist
  // on ArrShape' — a real-type-error SHAPE on correct code, the exact mis-signal this lens exists
  // to avoid (and the opposite of the loud TS2304 'Cannot find name' contract for the unmodelled).

  it("clean-checks the c[ad]+r family + and/or, list ops, and predicates (were TS2339/TS2551)", () => {
    // ONE program, ONE spawn (see linesWithError): every idiom coexists and NONE may error. This
    // is the whole coverage surface added by accessor.d.ts / logic.d.ts and the leaf additions.
    const program = [
      "(cadr (list 1 2 3))",
      "(cddr (list 1 2 3 4))",
      "(caddr (list 1 2 3 4))",
      "(cadddr (list 1 2 3 4 5))",
      "(and #t #t)",
      "(or #f #t)",
      "(first (list 1 2))",
      "(every (lambda (x) (> x 0)) (list 1 2))",
      "(some (lambda (x) (> x 0)) (list 1 2))",
      "(max-by (lambda (x) x) (list 1 2))",
      "(zero? 0)",
      "(even? 4)",
      "(odd? 3)",
      "(empty? (list))",
      '(string=? "a" "a")',
      '(string-ci=? "A" "a")',
    ].join("\n");
    const { diagnostics } = diagnoseScheme(program);
    // No 'Property does not exist' anywhere — the specific mis-signal a missing member produces.
    expect(diagnostics.filter((d) => d.code === 2339 || d.code === 2551)).toEqual([]);
    // And nothing errors at all — every line is well-typed Scheme.
    expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  });

  it("still BITES on a wrong argument through the newly-covered heads", () => {
    // Coverage must not become permissiveness. One program, one spawn: each 0-based line is a
    // genuine type error that must survive — assert every line carries one.
    const bites = [
      "(cadr 5)", //        line 0 — 5 is not a list
      "(caddr 42)", //      line 1 — 42 is not a list
      "(first 7)", //       line 2 — 7 is not a list
      '(zero? "x")', //     line 3 — string where a number is wanted
      "(string=? 1 2)", //  line 4 — numbers where strings are wanted
    ];
    const errored = linesWithError(bites.join("\n"));
    for (const [line] of bites.entries()) {
      expect(errored, `line ${line} (${bites[line]}) should bite`).toContain(line);
    }
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

  it("THROWS on a checker failure rather than reporting a false all-clear", () => {
    // The invariant the env-limit war story generalizes to: if tsgo exits unhappy (non-zero or
    // killed) with no parseable TSxxxx, an empty diagnostic set is a checker crash, NOT "clean".
    // Simulate a Go panic / crash by pointing TSGO_WASM_BIN at a stub that exits 2 with a
    // panic-shaped stderr and no diagnostics — the guard must surface it loudly.
    const dir = mkdtempSync(path.join(tmpdir(), "fake-tsgo-"));
    const stub = path.join(dir, "fake-tsgo.mjs");
    // Node runs this as `node <stub> --noEmit …` (the tsc flags are ignored); it mimics a crash.
    writeFileSync(stub, "process.stderr.write('panic: runtime error: index out of range\\n');\nprocess.exit(2);\n");
    const prev = process.env.TSGO_WASM_BIN;
    process.env.TSGO_WASM_BIN = stub;
    try {
      expect(() => diagnoseScheme("(car (list 1 2))")).toThrow(/tsgo-wasm failed to run/);
    } finally {
      if (prev === undefined) delete process.env.TSGO_WASM_BIN;
      else process.env.TSGO_WASM_BIN = prev;
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("host-function typing (the { hostMembers, preludeAppend } contract)", () => {
  // A consumer that has host-function (rosetta) signatures types them by passing BOTH
  // `hostMembers` (routes the head through `__arr`) and `preludeAppend` (a `.d.ts` fragment
  // declaring the member). This package does NOT harvest the sigs off a live env — the consumer
  // sources them; we type them. So these tests build the fragment the way a consumer does: by
  // hand. `arrShape(...)` assembles the `declare global { interface ArrShape { … } }` a consumer
  // would supply (it is EXACTLY the string the retracted harvester used to emit).
  const arrShape = (members: Record<string, string>): string =>
    `declare global {\n  interface ArrShape {\n${Object.entries(members)
      .map(([name, arrow]) => `  ${JSON.stringify(name)}: ${arrow};`)
      .join("\n")}\n  }\n}\nexport {};\n`;

  it("type-checks a host call when fragment + hostMembers are both fed in, and bites on misuse", () => {
    const hostMembers = new Set(["valid-ip?"]);
    const preludeAppend = arrShape({ "valid-ip?": "(ip: SStr) => SBool" });
    const clean = diagnoseScheme('(valid-ip? "1.2.3.4")', { hostMembers, preludeAppend });
    expect(clean.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    // and it BITES on a wrong arg — the whole point of declaring the signature
    const bad = diagnoseScheme("(valid-ip? 42)", { hostMembers, preludeAppend });
    expect(bad.diagnostics.some((d) => d.code === 2345)).toBe(true);
  });

  it("hostMembers WITHOUT the matching declaration SILENTLY untypes the head (the trap)", () => {
    // The mis-pairing the option docs warn about. The head routes to `__arr["valid-ip?"]`, but with
    // no ArrShape member declared and the checker running `--strict false` (noImplicitAny off), that
    // element access resolves to `any` — so a call that SHOULD bite (wrong arg) does NOT. That is
    // the real failure mode: silent loss of typing, not a spurious error. Supplying the matching
    // `preludeAppend` restores the bite (asserted in the sibling test above). Both directions here
    // keep the pairing requirement honest.
    const mispaired = diagnoseScheme("(valid-ip? 42)", { hostMembers: new Set(["valid-ip?"]) });
    expect(mispaired.diagnostics.filter((d) => d.severity === "error")).toEqual([]); // no bite → untyped
  });

  it("carries a callback (nested-paren) signature through without widening it", () => {
    const hostMembers = new Set(["find-first"]);
    const preludeAppend = arrShape({ "find-first": "(pred: (x: SNum) => SBool, xs: List<SNum>) => SNum" });
    // A wrong element type inside the list arg must bite — proving the nested arrow survived
    // intact rather than collapsing to `(...args: unknown[]) => unknown`.
    const clean = diagnoseScheme("(find-first (lambda (x) (> x 0)) (list 1 2 3))", { hostMembers, preludeAppend });
    expect(clean.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  });

  // REGRESSION GUARD (retained from #15) against typing host verbs the interpreter ACTUALLY emits.
  // These arrows are the `type:` strings from arrival-chain/src/data-effects.ts (http/sql) and
  // loader.ts (require), colon-form rewritten to arrow-form as a consumer supplies them. Each
  // carries the optional-param (`opts?`) shape. If the emitter/checker stops typing real host
  // verbs clean-and-biting, THIS fails — not a fake fixture that shares an assumption.
  it("types every host verb the live interpreter actually emits", () => {
    const hostMembers = new Set(["http/get", "sql/query", "require", "require/extension"]);
    const preludeAppend = arrShape({
      "http/get": "(label: SStr, path: SStr, opts?: unknown) => unknown",
      "sql/query": "(label: SStr, query: SStr, params?: unknown) => unknown",
      require: "(specifier: SStr) => unknown",
      "require/extension": "(suffix: SStr, resolver: unknown) => unknown",
    });
    const clean = diagnoseScheme('(http/get "l" "https://x")', { hostMembers, preludeAppend });
    expect(clean.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    const bad = diagnoseScheme("(http/get 5)", { hostMembers, preludeAppend });
    expect(bad.diagnostics.some((d) => d.code === 2554)).toBe(true); // wrong arg count
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
