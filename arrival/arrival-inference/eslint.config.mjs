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
      // Inference connectors/backends use runtime APIs, dynamic parsing, and provider compatibility code; defer broad lint rewrites outside the extraction repair.

      "sonarjs/cognitive-complexity": "off",
      "sonarjs/no-nested-conditional": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
      "@typescript-eslint/prefer-nullish-coalescing": "off",
      "unicorn/no-array-sort": "off",
      "sonarjs/no-alphabetical-sort": "off",
      "unicorn/consistent-function-scoping": "off",
      "unicorn/no-this-assignment": "off",
      "@typescript-eslint/no-this-alias": "off",
      "sonarjs/no-nested-template-literals": "off",
      "unicorn/no-await-expression-member": "off",
      "compat/compat": "off",
      "sonarjs/slow-regex": "off",
      "regexp/no-unused-capturing-group": "off",
      "sonarjs/no-async-constructor": "off",
      "no-console": "off",
      "unicorn/no-array-for-each": "off",
      "unicorn/prefer-at": "off",
    },
  },
];
