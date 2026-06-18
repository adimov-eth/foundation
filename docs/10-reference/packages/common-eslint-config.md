---
title: common-eslint-config
layer: reference
status: verified
tags: [package, common, tooling, lint]
canonical-for: []
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
code-anchors:
  - common/eslint-config/index.js:272   # nodejs config
  - common/eslint-config/index.js:286   # browser config
  - common/eslint-config/index.js:301   # shared config
  - common/eslint-config/index.js:316   # cloudflare config
  - common/eslint-config/index.js:330   # landing config
  - common/eslint-config/index.js:242   # reactConfig
---

# common-eslint-config

Package `@here.build/eslint-configs` — shared ESLint flat configs for Here.build packages
(`common/eslint-config/package.json:2`).

## Public API table

Named exports from `index.js` (each a flat-config array):

| Export | Purpose | File:line |
|---|---|---|
| `nodejs` | Node.js packages | `common/eslint-config/index.js:272` |
| `browser` | browser packages | `common/eslint-config/index.js:286` |
| `shared` | shared/isomorphic code | `common/eslint-config/index.js:301` |
| `cloudflare` | Cloudflare-targeted code | `common/eslint-config/index.js:316` |
| `landing` | landing site | `common/eslint-config/index.js:330` |
| `reactConfig` | React-specific rules | `common/eslint-config/index.js:242` |

(Matches the package description: `nodejs, browser, shared, cloudflare, landing, reactConfig` —
`common/eslint-config/package.json:3`.)

## Key internals

Flat-config arrays composed and re-exported from a single `index.js`; consumers import the
target preset by name.

## Invariants / notes

- Consumed as a devDependency across the workspace (e.g. `@here.build/error-invariant`,
  `common/error-invariant/package.json:29`).

## Tests

None (config package).

## Tasks

- None open.
