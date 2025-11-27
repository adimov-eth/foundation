import { describe, it, expect } from "vitest";
import { exec, specials, env as globalEnv } from "../lips.js";
import { sandboxedEnv } from "../sandbox-env.js";

describe("& syntax exploration", () => {
  it("should show specials list", async () => {
    console.log("Specials names:", specials.names());
    console.log("& in specials:", specials.get("&"));
  });

  it("should work as object literal", async () => {
    const r = await exec('&(:name "test" :value 42)', { env: globalEnv });
    console.log("Object literal result:", r[0]);
    console.log("Type:", typeof r[0]);
    console.log("Keys:", Object.keys(r[0] || {}));
    expect(r[0]).toBeDefined();
  });
});
