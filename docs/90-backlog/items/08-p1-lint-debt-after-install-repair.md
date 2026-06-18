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
fails on pre-existing source/config lint debt.

**Evidence (verified 2026-06-18).**

```text
@here.build/arrival-serializer:lint: /arrival/arrival-serializer/src/__tests__/serializer.test.ts
Parsing error: ... was not found by the project service. Consider either including it in the tsconfig.json or including it in allowDefaultProject

@here.build/arrival-serializer:lint: /arrival/arrival-serializer/src/serializer.ts
23 errors, 6 warnings including sonarjs/function-return-type, sonarjs/cognitive-complexity,
sonarjs/no-nested-template-literals, no-console, prettier/prettier.
```

Before hitting `arrival-serializer`, the repaired lint run also exposed and this repair branch
fixed two small extraction-adjacent lint blockers:

- `common/collections`: identical helper implementations / mutable `Array#sort()` warnings were
  removed without changing collection semantics.
- `common/error-invariant`: the newly lockfile-visible package lacked an ESLint config; added
  `eslint.config.mjs` and exported a type-only `InvariantMessage` specifier so the side-effect
  module remains lintable without adding a runtime export.

**Root cause.** The repo had lint debt hidden behind the broken install. `arrival-serializer` has
both config mismatch (tests outside the package tsconfig project service) and legacy strict-rule
violations in a high-complexity serializer implementation.

**Proposed fix.** Separate from extraction hygiene unless the user explicitly expands scope:

1. Decide whether serializer tests belong in `tsconfig.json`, a `tsconfig.test.json`, or ESLint
   `allowDefaultProject`.
2. Run `eslint --fix` only for mechanical formatting.
3. Handle semantic lint rules deliberately; do not silence `sonarjs` project-wide just to get a
   green check.
4. Add/adjust tests before changing serializer behavior beyond the circular-reference logging fix.

**Effort.** M · **Risk.** med.
