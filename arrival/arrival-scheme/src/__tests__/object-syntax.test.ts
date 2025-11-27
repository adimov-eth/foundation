import { describe, it, expect } from "vitest";
import { exec, env as globalEnv } from "../lips.js";

describe("Object creation in LIPS", () => {
  it("alist->object", async () => {
    const r = await exec("(alist->object '((:name . \"test\") (:value . 42)))", { env: globalEnv });
    console.log("alist->object:", r[0]);
    console.log("Keys:", Object.keys(r[0] || {}));
  });

  it("direct object via JS", async () => {
    const env = globalEnv.inherit({ obj: { name: "test", value: 42 } });
    const r = await exec("obj", { env });
    console.log("Direct obj:", r[0]);
  });

  it("object? predicate", async () => {
    const r = await exec("(object? (alist->object '((:a . 1))))", { env: globalEnv });
    console.log("object? result:", r[0]);
  });
});
