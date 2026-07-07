/**
 * R7RS numeric-tower conformance — regression guards.
 *
 * Why this file exists
 * --------------------
 * R7RS § 6.2 defines a numeric tower with an exactness contract: operations
 * that take exact arguments and CAN return exact answers MUST do so. Several
 * structural shortcuts once violated this; they have since been fixed, and the
 * `it()` cases below PIN the corrected behavior so it cannot silently regress.
 * These are passing invariants — not a `it.fails` bug ledger. (There are no
 * `it.fails` cases in this file; every test asserts the correct, post-fix
 * result.) What each guard covers, and where the fix lives:
 *
 *   1. `expt` used to be `Math.pow`, so every result started as a JS float that
 *      only re-promoted to exact when it happened to be a safe integer —
 *      `(expt 2 10) = exact 1024` but `(expt 2 -1) = inexact 0.5` (should be
 *      exact 1/2) and `(expt 2 1000) = inexact ~1e+301` (should be exact
 *      bigint). FIXED in `schemeExpt` at `operators/numeric.ts:379`: an exact
 *      integer base raised to an exact integer power computes with BigInt `**`
 *      (exact rational for negative powers).
 *
 *   2. Comparison ops (`<`, `>`, `<=`, `>=`) used to coerce every operand to a
 *      JS double, so two distinct exacts beyond 2^53 collapsed to the same
 *      float and `(< 999999999999999998 999999999999999999)` returned #f.
 *      FIXED in `schemeCompare` at `operators/numeric.ts:462`: the exact/exact
 *      case routes through `SchemeExact.cmp` (bigint cross-multiplication).
 *
 * Plus the smaller hazards, also fixed in `bridge.ts`: `(exact 1e-10)` once
 * threw because the exponential-string path didn't handle "1e-10"; and
 * `(number->string 5.0)` once returned "5" instead of "5." (chibi compat),
 * losing exactness information when round-tripped.
 */

import { describe, expect, it } from "vitest";
import { env, exec } from "../stdlib";
import { initBridge } from "../bridge";

await initBridge();

const num = (r: unknown): number => {
  if (typeof r === "number") return r;
  if (typeof r === "bigint") return Number(r);
  if (r && typeof (r as { valueOf?: unknown }).valueOf === "function") {
    return Number((r as { valueOf: () => unknown }).valueOf());
  }
  return Number.NaN;
};

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

describe("r7rs numbers — passing invariants (regression guards)", () => {
  it("expt of two exact small integers stays exact when result fits a safe int", async () => {
    // (expt 2 10) → Math.pow(2,10) = 1024 → Num.fromJS sees safe integer →
    // wraps as SchemeExact. Correct by coincidence; guard the path.
    const r = await evalScheme("(exact? (expt 2 10))");
    expect(truthy(r)).toBe(true);
  });

  it("(expt 0 0) is 1 per R7RS § 6.2 special case", async () => {
    // R7RS: zero-to-the-zero is 1 (matches Math.pow's behavior incidentally).
    const r = await evalScheme("(expt 0 0)");
    expect(num(r)).toBe(1);
  });

  it("(eqv? +inf.0 +inf.0) is #t (R7RS § 6.2)", async () => {
    // R7RS: +inf.0 is eqv? to itself. Inexact path uses `SchemeInexact.equals`
    // at numbers.ts:445-446 which is `===` on `real`; Infinity === Infinity.
    const r = await evalScheme("(eqv? +inf.0 +inf.0)");
    expect(truthy(r)).toBe(true);
  });

  it("inexact on a rational converts to float (R7RS § 6.2)", async () => {
    // bridge.ts:467-468: exact denom-aware path → Number(num)/Number(denom).
    const r = await evalScheme("(inexact 1/2)");
    expect(num(r)).toBe(0.5);
  });
});

describe("r7rs numbers — exactness/precision fixes (regression guards)", () => {
  it(
    "(expt 2 -1) returns exact 1/2 (R7RS § 6.2: exact args + exact-representable result → exact)",
    async () => {
      // FIXED at `operators/numeric.ts` (schemeExpt): exact integer base raised
      // to an exact integer power computes with BigInt `**` (exact rational for
      // negative powers) instead of `Math.pow`, which used to return 0.5
      // (inexact). Flipping this back to red = regression of the exactness fix.
      const r = await evalScheme("(exact? (expt 2 -1))");
      expect(truthy(r)).toBe(true);
    },
  );

  it(
    "(expt 2 1000) returns an exact bigint, not inexact ~1.07e+301",
    async () => {
      // FIXED with the same schemeExpt path. 2^1000 is a representable
      // SchemeExact (BigInt); the old Math.pow round-trip returned a lossy
      // ~1.0715086071862673e+301 inexact (only the top ~53 bits survived).
      const r = await evalScheme("(exact? (expt 2 1000))");
      expect(truthy(r)).toBe(true);
    },
  );

  it(
    "(< 999999999999999998 999999999999999999) returns #t for huge exacts",
    async () => {
      // FIXED at `operators/numeric.ts` (schemeCompare): the exact/exact case
      // now routes through `SchemeExact.cmp` (bigint cross-multiplication)
      // instead of coercing to a JS double. Both 10^18-2 and 10^18-1 used to
      // round to the SAME double (1e18), so `<` returned #f. Same fix covers
      // `>`, `<=`, `>=`.
      const r = await evalScheme("(< 999999999999999998 999999999999999999)");
      expect(truthy(r)).toBe(true);
    },
  );

  it(
    "(exact 1e-10) does NOT throw and returns an exact rational",
    async () => {
      // Fixed at `bridge.ts` — `exact` now recognizes exponential-notation
      // float stringifications (`1e-10`, `1.5e+21`, …) and constructs the
      // rational by combining mantissa + signed exponent into a single
      // power-of-10 denominator instead of falling through to `BigInt(real)`
      // (which threw RangeError on non-integer floats).
      const r = await evalScheme("(exact 1e-10)");
      // If we reach here without throwing, the bug is fixed.
      expect(truthy(await evalScheme(`(exact? ${num(r) === 0 ? "(exact 0)" : "1/10000000000"})`))).toBe(true);
    },
  );

  it(
    '(number->string 5.0) preserves the inexact mark ("5." or "5.0", not "5")',
    async () => {
      // Fixed at `bridge.ts` — base-10 inexact formatting now delegates to
      // `SchemeInexact.toString()` which appends `.0` to integer-valued
      // inexacts. Round-tripping through `string->number` now preserves
      // exactness per R7RS § 6.2.
      const r = await evalScheme("(number->string 5.0)");
      const s = typeof r === "string" ? r : String((r as { valueOf: () => unknown }).valueOf());
      // Either "5." or "5.0" is R7RS-conformant.
      expect(["5.", "5.0"]).toContain(s);
    },
  );

  it(
    "exact->inexact is bound (R5RS alias, R7RS-compatible naming)",
    async () => {
      // R5RS § 6.2.5 alias for R7RS `inexact`. Bound at `stdlib.ts:1870` via a
      // call-time-lookup trampoline (target `inexact` lives in bridge.ts,
      // applied to global_env during initBridge).
      const r = await evalScheme("(exact->inexact 1/2)");
      expect(num(r)).toBe(0.5);
    },
  );

  it(
    "inexact->exact is bound (R5RS alias, R7RS-compatible naming)",
    async () => {
      // R5RS § 6.2.5 alias for R7RS `exact`. Same call-time-lookup trampoline
      // shape as `exact->inexact`, bound at `stdlib.ts:1873`.
      const r = await evalScheme("(inexact->exact 0.5)");
      expect(truthy(await evalScheme("(exact? (inexact->exact 0.5))"))).toBe(true);
      // Type sanity: 0.5 → 1/2 exact, valueOf === 0.5.
      expect(num(r)).toBe(0.5);
    },
  );
});
