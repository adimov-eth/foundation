import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    // tsgo-wasm boots a ~49MB WASM compiler per check (~2s local, ~4s CI cold). Tests batch
    // snippets into one program to minimize spawns, but a few still make 2–3 checks; 45s gives
    // CI cold-boot variance headroom without masking a genuine hang (the runTsgo guard throws on
    // a real failure, so a timeout here means "too many spawns", not "silently wrong").
    testTimeout: 45000,
    hookTimeout: 45000,
    include: ["src/__tests__/**/*.test.{ts,tsx}"],
  },
});
