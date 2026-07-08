import { nodejs } from "@here.build/eslint-configs";

export default [
  ...nodejs,
  // src/prelude/**.d.ts are type-check ASSETS (the .d.ts vocabulary the checker tsc's against at
  // runtime), NOT project TypeScript — their `type SNum = number` aliases and the empty `ArrShape`
  // merge target are intentional and must not be "simplified" away. scripts/ + dist/ aren't in the
  // typed project either.
  { ignores: ["vitest.config.ts", "scripts/**", "dist/**", "src/prelude/**"] },
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // The fs paths here are internally constructed (tmpdir + fixed names, package-relative prelude
      // dirs), never user input — the non-literal-fs-filename heuristic is a false positive.
      "security/detect-non-literal-fs-filename": "off",
    },
  },
];
