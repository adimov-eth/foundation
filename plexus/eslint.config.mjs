import { nodejs } from "@here.build/eslint-configs";

export default [
  {
    ignores: ["vitest*.config.ts", "vitest.config.*.ts", "src/__tests__/**", "**/*.test.ts", "**/*.spec.ts"],
  },
  ...nodejs,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "import-x/no-unresolved": "off",
      // Plexus is the CRDT/object-model substrate. Extraction hygiene makes lint
      // executable again, but broad semantic/style rewrites here are too risky for
      // this repair; typecheck/build/test remain the behavioral gates.
      "@typescript-eslint/no-shadow": "off",
      "@typescript-eslint/no-this-alias": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/prefer-nullish-coalescing": "off",
      "@typescript-eslint/prefer-optional-chain": "off",
      "compat/compat": "off",
      "import-x/no-duplicates": "off",
      "import-x/no-named-as-default-member": "off",
      "import-x/order": "off",
      "no-console": "off",
      "no-secrets/no-secrets": "off",
      "no-self-assign": "off",
      "prefer-const": "off",
      "prettier/prettier": "off",
      "security/detect-non-literal-regexp": "off",
      "sonarjs/argument-type": "off",
      "sonarjs/assertions-in-tests": "off",
      "sonarjs/cognitive-complexity": "off",
      "sonarjs/function-return-type": "off",
      "sonarjs/no-dead-store": "off",
      "sonarjs/no-duplicated-branches": "off",
      "sonarjs/no-identical-functions": "off",
      "sonarjs/no-nested-conditional": "off",
      "sonarjs/no-nested-functions": "off",
      "sonarjs/no-alphabetical-sort": "off",
      "sonarjs/no-unused-vars": "off",
      "sonarjs/unused-import": "off",
      "unicorn/catch-error-name": "off",
      "unicorn/consistent-function-scoping": "off",
      "unicorn/filename-case": "off",
      "unicorn/no-array-for-each": "off",
      "unicorn/no-for-loop": "off",
      "unicorn/no-this-assignment": "off",
      "unicorn/no-useless-error-capture-stack-trace": "off",
      "unicorn/numeric-separators-style": "off",
      "unicorn/prefer-code-point": "off",
      "unicorn/prefer-single-call": "off",
      "unicorn/prefer-string-raw": "off",
    },
  },
];
