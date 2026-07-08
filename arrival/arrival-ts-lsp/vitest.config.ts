import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    // tsgo-wasm boots a ~49MB WASM compiler per check; give the subprocess room.
    testTimeout: 30000,
    hookTimeout: 30000,
    include: ["src/__tests__/**/*.test.{ts,tsx}"],
  },
});
