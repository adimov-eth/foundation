/**
 * R7RS identity-predicate conformance — regression guards (bug FIXED).
 *
 * Why this file exists
 * --------------------
 * R7RS § 6.1 defines a three-level hierarchy: `eq?` (pointer-grade), `eqv?`
 * (atom-grade, including same-numeric-value with same-exactness), and `equal?`
 * (structural, recurses into pairs/vectors/strings). The three are NOT
 * interchangeable — collapsing them breaks `memq`/`assv`/`hash-table-ref/eqv`/
 * `case` dispatch.
 *
 * HISTORY (corrected 2026-07-08): this file was written as an `it.fails` bug
 * LEDGER for a real string-identity bug — `eq?`/`eqv?` value-compared strings
 * via `.valueOf()`, so two distinct heap SchemeStrings compared equal,
 * collapsing eq?/eqv? into an equal? shape. That bug is FIXED: `eq?`/`eqv?` are
 * bound (stdlib.ts:1853-1854) to pointer-grade `eq`/`eqv` in
 * `values/structural-equal.ts`, whose SchemeString path returns `false` for
 * distinct instances (structural-equal.ts:145-158, with its own past-tense war
 * story). The old citations to `lips.ts:670-672`/`:3634-3635` are dead — that
 * file no longer exists.
 *
 * So the "known bugs" block below is now a set of REGRESSION GUARDS: plain
 * `it()` that PASS, pinning the correct pointer-grade answers. (They were once
 * `it.fails`; the comments that still predicted a `#t` failure were stale —
 * the probe returns `#f`, the correct value. Verified + corrected 2026-07-08.)
 * If a future "unify equal" patch reintroduces valueOf-collapse, these flip red.
 */

import { describe, expect, it } from "vitest";
import { env, exec } from "../stdlib";
import { initBridge } from "../bridge";

await initBridge();

/** Coerce a Scheme result to a JS primitive — handles SchemeBool wrapper and raw JS booleans. */
const truthy = (r: unknown): boolean => {
  if (typeof r === "boolean") return r;
  if (r && typeof r === "object" && "value" in (r as { value?: unknown })) {
    return Boolean((r as { value: unknown }).value);
  }
  if (r && typeof (r as { valueOf?: unknown }).valueOf === "function") {
    return Boolean((r as { valueOf: () => unknown }).valueOf());
  }
  return Boolean(r);
};

async function evalScheme(src: string): Promise<unknown> {
  const [r] = await exec(src, { env });
  return r;
}

describe("r7rs identity — passing invariants (regression guards)", () => {
  it("eq? on interned symbols is #t (R7RS § 6.1)", async () => {
    // The parser interns symbols — both occurrences of 'foo resolve
    // to the same heap SchemeSymbol, so eq? must be #t.
    const r = await evalScheme("(eq? 'foo 'foo)");
    expect(truthy(r)).toBe(true);
  });

  it("eq? on two distinct (list 1) calls is #f (R7RS § 6.1)", async () => {
    // Each `list` call mints a fresh Pair → in `equal` (lips.ts:633) Pair has
    // no special-case branch → falls through to `else x === y` (lips.ts:674)
    // → returns false. Correct by accident — guard against a future "let's
    // deepEqual into pairs" rewrite that would silently flip this to #t.
    const r = await evalScheme("(eq? (list 1) (list 1))");
    expect(truthy(r)).toBe(false);
  });

  it("eqv? on two distinct vector copies is #f (R7RS § 6.1)", async () => {
    // Vectors are JS Arrays; `equal` falls through to `else x === y` →
    // reference identity → #f. R7RS-correct by accident; regression guard.
    const r = await evalScheme(`(eqv? (vector 1 2) (vector 1 2))`);
    expect(truthy(r)).toBe(false);
  });

  it("string-length counts code points, not UTF-16 code units (R7RS § 6.7)", async () => {
    // The public `string-length` binding lives at `bridge.ts:680` and uses
    // `[...str].length` (code-point iteration). The internal SchemeString getter
    // at `SchemeString.ts:45` uses `.__string__.length` (code units, would be 2
    // for "😀"); that getter is NOT exposed to Scheme. Guard that the public
    // binding is the one Scheme code sees.
    const r = await evalScheme(`(string-length "😀")`);
    expect(Number((r as { valueOf: () => unknown }).valueOf())).toBe(1);
  });
});

describe("r7rs identity — string-identity regression guards (bug fixed; these PIN the correct answer)", () => {
  it(
    "eq? on two distinct string-copy results is #f (R7RS § 6.1)",
    async () => {
      // Once the load-bearing bug: eq? value-compared strings via `.valueOf()`,
      // returning #t for two distinct heap instances (collapsing eq? into
      // string-equal?). FIXED — `eq` (structural-equal.ts) is pointer-grade for
      // SchemeString. This pins #f; a valueOf-collapse regression flips it red.
      const r = await evalScheme(`(eq? (string-copy "abc") (string-copy "abc"))`);
      expect(truthy(r)).toBe(false);
    },
  );

  it(
    "eqv? on two distinct string-copy results is #f (R7RS § 6.1)",
    async () => {
      // Same fix: `eqv` is pointer-grade for strings, not aliased to `equal`.
      // Distinct heap instances answer #f (atom-grade). Regression guard.
      const r = await evalScheme(`(eqv? (string-copy "abc") (string-copy "abc"))`);
      expect(truthy(r)).toBe(false);
    },
  );

  it(
    "eqv? on two distinct make-string results is #f (R7RS § 6.1)",
    async () => {
      // Fresh SchemeString per `make-string`; eqv? answers #f under atom-grade
      // semantics. Was #t under the valueOf-collapse bug; now correct.
      const r = await evalScheme(`(eqv? (make-string 1 #\\a) (make-string 1 #\\a))`);
      expect(truthy(r)).toBe(false);
    },
  );
});
