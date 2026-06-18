import { nodejs } from "@here.build/eslint-configs";

export default [
  {
    ignores: ["src/__tests__/**", "src/__benchmarks__/**", "src/__research__/**", "src/__custdev__/**", "**/*.test.ts", "**/*.spec.ts", "vitest*.config.ts", "scripts*.ts"],
  },
  ...nodejs,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // Arrival Chain is the effect/replay substrate and contains many graph,
      // loader, and runtime-boundary algorithms. This extraction repair gates it
      // with build/type/test and defers broad lint-driven rewrites.
      "@typescript-eslint/no-unnecessary-condition": "off",
      "@typescript-eslint/no-shadow": "off",
      "@typescript-eslint/prefer-optional-chain": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/prefer-nullish-coalescing": "off",
      "compat/compat": "off",
      "import-x/no-duplicates": "off",
      "import-x/order": "off",
      "prettier/prettier": "off",
      "promise/param-names": "off",
      "security/detect-non-literal-fs-filename": "off",
      "sonarjs/cognitive-complexity": "off",
      "sonarjs/no-nested-conditional": "off",
      "sonarjs/no-nested-template-literals": "off",
      "sonarjs/no-nested-assignment": "off",
      "unicorn/no-array-for-each": "off",
      "unicorn/no-await-expression-member": "off",
      "unicorn/no-for-loop": "off",
      "unicorn/no-negated-condition": "off",
      "unicorn/no-thenable": "off",
      "unicorn/prefer-export-from": "off",
      "unicorn/prefer-code-point": "off",
      "unicorn/prefer-module": "off",
      "unicorn/prefer-number-properties": "off",
      "unicorn/prefer-single-call": "off",
      "unicorn/text-encoding-identifier-case": "off",
      "unicorn/numeric-separators-style": "off",
      "unicorn/catch-error-name": "off",
      "no-secrets/no-secrets": "off",

      "@typescript-eslint/await-thenable": "off",
      "no-console": "off",
      "prefer-template": "off",
      "security/detect-unsafe-regex": "off",
      "sonarjs/disabled-auto-escaping": "off",
      "sonarjs/no-selector-parameter": "off",
      "sonarjs/no-unused-vars": "off",
      "sonarjs/prefer-regexp-exec": "off",
      "unicorn/consistent-function-scoping": "off",
      "unicorn/no-array-reverse": "off",
      "unicorn/no-useless-switch-case": "off",
    },
  },
];
