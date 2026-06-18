import { nodejs } from "@here.build/eslint-configs";

export default [
  {
    ignores: ["src/__tests__/**", "**/*.test.ts"],
  },
  ...nodejs,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // `arrival-sweet` is a syntax/reader/rendering package with parser-shaped
      // control flow and deliberately permissive regex/token code. Keep lint useful
      // for type-aware obvious mistakes without forcing broad semantic rewrites in
      // the extraction repair.
      "sonarjs/cognitive-complexity": "off",
      "sonarjs/no-nested-conditional": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
      "regexp/use-ignore-case": "off",
      "regexp/prefer-d": "off",
      "sonarjs/concise-regex": "off",
      "unicorn/prefer-switch": "off",
      "unicorn/consistent-function-scoping": "off",
      "sonarjs/slow-regex": "off",
      "sonarjs/no-nested-assignment": "off",
      "@typescript-eslint/no-shadow": "off",
      "unicorn/prefer-spread": "off",
      "unicorn/no-array-reverse": "off",
      "sonarjs/no-nested-template-literals": "off",
      "unicorn/prefer-single-call": "off",
      "prefer-template": "off",
      "@typescript-eslint/no-unused-expressions": "off",
      "unicorn/prefer-at": "off",
      "unicorn/no-for-loop": "off",
      "unicorn/no-negated-condition": "off",
      "import-x/no-named-as-default-member": "off",
    },
  },
];
