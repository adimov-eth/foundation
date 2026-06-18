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
  },
  {
    files: ["src/serializer.ts"],
    rules: {
      // Serializer output is intentionally dynamic: it converts heterogeneous JS/LIPS
      // runtime values into a compact S-expression representation. These rules flag
      // that boundary shape as if it were ordinary application code.
      "import-x/no-unresolved": "off",
      "sonarjs/function-return-type": "off",
      "sonarjs/cognitive-complexity": "off",
      "sonarjs/no-nested-template-literals": "off",
      "unicorn/prefer-native-coercion-functions": "off",
      "@typescript-eslint/prefer-nullish-coalescing": "off",
      "sonarjs/no-unused-vars": "off",
    },
  },
];
