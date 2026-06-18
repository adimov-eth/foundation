---
title: P1 — lint debt exposed after install repair
layer: backlog
status: open
tags: [backlog, p1, lint, extraction-repair]
canonical-for: []
last-verified: 2026-06-18
verified-against: repair/extraction-hygiene
---

# 08 · P1 · Lint debt exposed after install repair

**Status.** Open. This was not visible until [[items/01-p0-install-frozen-lockfile]] was fixed and
`turbo lint` could run across the workspace.

**Symptom.** `corepack pnpm lint` starts successfully after the lockfile/workspace repair, but it
fails on pre-existing source/config lint debt. The first package reported by `turbo lint` can vary
because lint runs packages in parallel; the debt is not isolated to one package.

**Evidence (verified 2026-06-18).**

Latest CI run on this repair branch failed the build job at:

```text
@here.build/lexical-namer#lint
✖ 52 problems (45 errors, 7 warnings)
```

Focused local package lint checks also show broader pre-existing debt:

```text
corepack pnpm --filter @here.build/arrival-serializer lint
✖ 28 problems (23 errors, 5 warnings)
- serializer tests are outside the package project service
- serializer.ts still has strict-rule/prettier/sonarjs debt

corepack pnpm --filter @here.build/lexical-namer lint
✖ 52 problems (45 errors, 7 warnings)
- test formatting, Array#sort/toSorted, config project-service, and strict-rule debt

corepack pnpm --filter @here.build/arrival lint
✖ 401 problems (304 errors, 97 warnings)

corepack pnpm --filter @here.build/arrival-chain lint
exit 1; same class of strict/prettier/import/compat debt
```

The previous `no-console` warning for the circular-reference serializer path is fixed in
[[items/06-p2-serializer-console-error-leak]].

Before these remaining packages, the repaired lint run also exposed and this repair branch fixed
two small extraction-adjacent lint blockers:

- `common/collections`: the broken shared `DefaultedMap` helper was replaced with a
  `super`-bound closure helper for `DefaultedMap` plus inline `DefaultedWeakMap`, preserving
  no-recursion semantics without relying on duplicate-body lint suppression.
- `common/error-invariant`: the newly lockfile-visible package lacked an ESLint config; added
  `eslint.config.mjs` and exported a type-only `InvariantMessage` specifier so the side-effect
  module remains lintable without adding a runtime export.

**Root cause.** The repo had lint debt hidden behind the broken install. Once install is repaired,
strict ESLint 9 + SonarJS/Unicorn/Prettier/project-service rules run across packages that were not
previously reachable in CI.

**Proposed fix.** Separate from extraction hygiene unless the user explicitly expands scope:

1. Decide package-by-package whether test files belong in `tsconfig.json`, `tsconfig.test.json`,
   or ESLint `allowDefaultProject`.
2. Run `eslint --fix` only for mechanical formatting.
3. Handle semantic lint rules deliberately; do not silence `sonarjs`/`unicorn` project-wide just to
   get a green check.
4. Add/adjust tests before changing serializer/interpreter behavior beyond the circular-reference
   logging fix.

**Effort.** L · **Risk.** med.
