import { describe, it, expect } from "vitest";
import { exec, specials } from "../lips.js";
import { sandboxedEnv } from "../sandbox-env.js";
import { env as globalEnv } from "../lips.js";

describe("& syntax", () => {
  it("should show specials list", async () => {
    console.log("Specials names:", specials.names());
    console.log("Specials &:", specials.get("&"));
  });

  it("should test object literal in global", async () => {
    // Try using quotes to delay evaluation
    const r = await exec('(let ((x &(:name "test"))) x)', { env: globalEnv });
    console.log("Global let result:", r[0], typeof r[0]);
    console.log("Global let result keys:", Object.keys(r[0] || {}));
  });

  it("should test object literal in sandbox", async () => {
    // Add & to sandbox first
    sandboxedEnv.set("&", globalEnv.get("&"));
    const r = await exec('(let ((x &(:name "test"))) x)', { env: sandboxedEnv });
    console.log("Sandbox let result:", r[0], typeof r[0]);
  });
});
