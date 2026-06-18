import { nodejs } from "@here.build/eslint-configs";

export default [
  {
    // Tooling / experiment files that aren't part of the typed src project.
    ignores: ["scripts/**", "scratch/**", "dist/**", "vitest.config.ts"],
  },
  ...nodejs,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "import-x/no-unresolved": "off",
      // MCP adapters intentionally use async/runtime primitives and dynamic
      // request-shaping code. Browser compat rules are not relevant to this Node package.
      "compat/compat": "off",
      "sonarjs/cognitive-complexity": "off",
      "sonarjs/no-unused-vars": "off",
      "no-console": "off",
      "security/detect-unsafe-regex": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
      "unicorn/numeric-separators-style": "off",
      "unicorn/filename-case": "off",
    },
  },
];
