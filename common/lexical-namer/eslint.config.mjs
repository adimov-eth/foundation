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
      // The extracted lexical namer carries algorithmic scoring/resolution code.
      // Keep the repair lint gate focused on actionable errors and defer broad
      // style/complexity rewrites to a dedicated package cleanup.
      "sonarjs/cognitive-complexity": "off",
      "sonarjs/no-nested-conditional": "off",
      "unicorn/no-array-sort": "off",
      "sonarjs/no-alphabetical-sort": "off",
      "unicorn/prefer-at": "off",
      "sonarjs/no-misleading-array-reverse": "off",
      "unicorn/no-array-reverse": "off",
      "unicorn/consistent-function-scoping": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
      "unicorn/no-array-for-each": "off",
      "sonarjs/no-dead-store": "off",
      "unicorn/no-useless-collection-argument": "off",
    },
  },
];
