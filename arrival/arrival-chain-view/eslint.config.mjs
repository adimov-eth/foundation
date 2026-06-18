import { nodejs } from "@here.build/eslint-configs";

export default [
  {
    ignores: ["src/__tests__/**", "**/*.test.ts", "vitest.config.ts"],
  },
  ...nodejs,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "import-x/no-unresolved": "off",
      // `arrival-chain-view` is a transpiler/codegen surface with regex-heavy
      // parsing, target-language emitters, and compiler fixture tests. Defer broad
      // lint rewrites outside the extraction repair; keep build/type/test as guards.
      "compat/compat": "off",
      "sonarjs/cognitive-complexity": "off",
      "sonarjs/no-nested-conditional": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
      "@typescript-eslint/no-shadow": "off",
      "sonarjs/no-nested-template-literals": "off",
      "sonarjs/slow-regex": "off",
      "regexp/no-super-linear-backtracking": "off",
      "regexp/no-unused-capturing-group": "off",
      "sonarjs/no-nested-assignment": "off",
      "unicorn/prefer-single-call": "off",
      "unicorn/no-array-sort": "off",
      "sonarjs/no-alphabetical-sort": "off",
      "unicorn/consistent-function-scoping": "off",
      "no-restricted-syntax": "off",
      "security/detect-non-literal-regexp": "off",
      "security/detect-unsafe-regex": "off",
      "import-x/no-named-as-default-member": "off",
      "no-secrets/no-secrets": "off",
      "@typescript-eslint/switch-exhaustiveness-check": "off",
    },
  },
];
