// check.test.ts — the ts-lsp `check` verb (the MCP surface's shaping of lens diagnostics).

import { describe, it, expect } from "vitest";
import { check } from "../check.js";

describe("check verb", () => {
  it("returns ok for a well-typed program", () => {
    const r = check("(car (list 1 2))");
    expect(r.error).toBeUndefined();
    expect(r.ok).toBe(true);
    expect(r.diagnostics).toEqual([]);
  });

  it("shapes a bite into a positioned diagnostic with the offending sub-form", () => {
    const r = check("(car 5)");
    expect(r.ok).toBe(false);
    const d = r.diagnostics?.[0];
    expect(d).toBeDefined();
    expect(d!.on).toBe("5"); // the sliced offending form
    expect(d!.code).toBe("TS2345");
    expect(d!.severity).toBe("error");
  });

  it("rejects a non-string / empty source with a clear error", () => {
    expect(check(42).error).toContain("non-empty Scheme source string");
    expect(check("").error).toContain("non-empty Scheme source string");
  });

  it("surfaces an unmodelled builtin as a loud diagnostic, not an error field", () => {
    const r = check("(frobnicate 1)");
    expect(r.error).toBeUndefined();
    expect(r.diagnostics?.some((d) => d.code === "TS2304")).toBe(true);
  });
});
