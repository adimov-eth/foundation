/**
 * R7RS Unicode conformance — regression guards.
 *
 * Why this file exists
 * --------------------
 * JavaScript strings are UTF-16 code units; R7RS characters and strings are
 * Unicode code points. The two disagree on every non-BMP character (anything
 * ≥ U+10000 — emoji, ancient scripts, mathematical letters, etc.). An earlier
 * cut of the char/string primitives used UTF-16-grade APIs (`charCodeAt`,
 * `fromCharCode`) where code-point APIs (`codePointAt`, `fromCodePoint`) are
 * required. That family of bugs was FIXED; the character cluster now lives in
 * `../env/chars.ts` and reads/writes full code points throughout. The tests
 * below PIN that correct behavior so it can't silently regress.
 *
 * A second, once-separate bug lived in the `SchemeCharacter.__rev_names__`
 * mapping — the reverse lookup (codepoint → preferred name). When two names
 * share a codepoint, iteration order decides the winner. `alarm` and `bel`
 * both map to U+0007; a last-write-wins builder resolved U+0007 to `bel`,
 * whereas R7RS § 6.6 lists `alarm` as canonical (`bel` is only the SRFI-175
 * alias). That too is FIXED: the builder at `../values/types.ts:171-186` is
 * now first-write-wins over source order, and `alarm` is registered before
 * `bel`, so `(integer->char 7)` resolves to `#\alarm`. The last test guards it.
 *
 * Style — every test is a plain green `it()` asserting the CORRECT (post-fix)
 * R7RS behavior with the real implementation file:line. Flipping any of them
 * to red means the corresponding fix regressed.
 */

import { describe, expect, it } from "vitest";
import { env, exec } from "../stdlib";
import { initBridge } from "../bridge";

await initBridge();

/** Coerce a Scheme numeric result to a JS number (handles SchemeExact). */
const num = (r: unknown): number => {
  if (typeof r === "number") return r;
  if (typeof r === "bigint") return Number(r);
  if (r && typeof (r as { valueOf?: unknown }).valueOf === "function") {
    return Number((r as { valueOf: () => unknown }).valueOf());
  }
  return Number.NaN;
};

async function evalScheme(src: string): Promise<unknown> {
  const [r] = await exec(src, { env });
  return r;
}

describe("r7rs unicode — passing invariants (regression guards)", () => {
  it("string-length on emoji returns code-point count, not code-unit count", async () => {
    // `../env/strings.ts:56` uses `[...str].length` (code-point iteration).
    // "😀" is U+1F600, encoded as two UTF-16 code units but ONE code point.
    const r = await evalScheme(`(string-length "😀")`);
    expect(num(r)).toBe(1);
  });

  it("char->integer on ASCII returns the ASCII codepoint", async () => {
    // Sanity: the historical bug only surfaced for code points > 0xFFFF. The
    // ASCII path always worked (codePointAt(0) === charCodeAt(0) in the BMP).
    const r = await evalScheme("(char->integer #\\A)");
    expect(num(r)).toBe(65);
  });

  it("char-foldcase on a single-folded char (#\\A → #\\a) works", async () => {
    // Only ß-class chars (where Unicode fold expands to 2+ chars) exercised the
    // historical truncation bug. ASCII fold is a single char and always worked.
    const r = await evalScheme("(char-foldcase #\\A)");
    expect(String(r)).toBe("#\\a");
  });
});

describe("r7rs unicode — fixed bugs (regression guards; flipping to red = the fix regressed)", () => {
  it(
    "char->integer on a non-BMP character returns the full code point",
    async () => {
      // R7RS § 6.6: `char->integer` returns the Unicode scalar value.
      // FIXED — `../env/chars.ts:161-163` uses `charValue(char).codePointAt(0)`,
      // which reads a full surrogate pair. The prior cut used `charCodeAt(0)`,
      // returning only the high surrogate (0xD83D = 55,357 for 😀 instead of
      // 128,512). This guards the code-point result.
      const r = await evalScheme("(char->integer #\\😀)");
      expect(num(r)).toBe(128512);
    },
  );

  it(
    "integer->char round-trips a non-BMP code point",
    async () => {
      // R7RS § 6.6: `integer->char` is the inverse of `char->integer` over
      // the Unicode code point range. FIXED — `../env/chars.ts:170-176` uses
      // `String.fromCodePoint(code)`, which accepts up to U+10FFFF and emits
      // the correct surrogate pair. The prior cut used `String.fromCharCode`,
      // which silently truncated values > 0xFFFF
      // modulo 0x10000 (128,512 % 65,536 = 62,976 -> the wrong BMP
      // char), corrupting the round trip. This test guards that the round
      // trip now preserves the full non-BMP code point.
      const r = await evalScheme("(char->integer (integer->char 128512))");
      expect(num(r)).toBe(128512);
    },
  );

  it(
    "char-foldcase #\\ß returns #\\ß (multi-char folds are identity per R7RS § 6.6)",
    async () => {
      // R7RS § 6.6: char-foldcase takes a character and returns a character.
      // When Unicode fold would expand a single char to multiple chars
      // (Eszett ß → "ss"), R7RS specifies the operation returns the original
      // char unchanged (since a char is by definition a single Unicode
      // scalar value). FIXED — `../env/chars.ts:145-154` returns the input
      // when `[...folded].length !== 1`. The prior cut truncated the multi-char
      // fold to `folded[0]` (ß → s), producing a different character. This
      // guards that ß folds to itself.
      const r = await evalScheme("(char-foldcase #\\ß)");
      expect(String(r)).toBe("#\\ß");
    },
  );

  it(
    "char-alphabetic? recognizes CJK ideographs (Unicode category Lo)",
    async () => {
      // R7RS § 6.6: char-alphabetic? returns #t iff the character is in
      // a Unicode "Letter" category (Lu/Ll/Lt/Lm/Lo). FIXED —
      // `../env/chars.ts:81-94` switches on `unicodeProperties.getCategory(cp)`.
      // The prior cut used `/^[a-z]$/i || lower !== upper`, whose second
      // predicate missed CJK (and Hangul, Hebrew, Arabic …): category-Lo chars
      // have no case distinction → toLowerCase() === toUpperCase() → #f. This
      // guards that a CJK ideograph is recognized as alphabetic.
      const r = await evalScheme("(char-alphabetic? #\\漢)");
      expect(Boolean((r as { valueOf?: () => unknown })?.valueOf?.() ?? r)).toBe(true);
    },
  );

  it(
    "character at code point 7 names as 'alarm' (R7RS-canonical, not 'bel')",
    async () => {
      // R7RS § 6.6 lists `alarm` as the canonical name for U+0007; `bel` is
      // a SRFI-175 alias added later. Both names map to U+0007 in the
      // `characters` table, with `alarm` registered before `bel`. FIXED —
      // the `__rev_names__` builder at `../values/types.ts:171-186` is now
      // first-write-wins (skips codepoints already reversed), so U+0007
      // resolves to `alarm`. The prior builder overwrote in iteration order,
      // letting the later `bel` win. This guards the canonical name.
      const r = await evalScheme("(integer->char 7)");
      expect(String(r)).toBe("#\\alarm");
    },
  );
});
