---
title: common-tsconfig
layer: reference
status: verified
tags: [package, common, tooling, typescript]
canonical-for: []
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
code-anchors:
  - common/tsconfig/package.json:9      # exports map (purpose/* + env/*)
  - common/tsconfig/env/node.json:1     # node env base
  - common/tsconfig/purpose/lib.json:1  # lib purpose preset
---

# common-tsconfig

Package `@here.build/tsconfig` — shared TypeScript configuration for Here.build packages
(`common/tsconfig/package.json:2`). Presets are split along two axes: **purpose** (lib vs app) and
**env** (node / cf / browser / consumer), each a subpath export a `tsconfig.json` extends.

## Public API table

Subpath exports (`common/tsconfig/package.json:9`):

| Subpath | File |
|---|---|
| `@here.build/tsconfig/purpose/lib` | `common/tsconfig/purpose/lib.json` |
| `@here.build/tsconfig/purpose/app` | `common/tsconfig/purpose/app.json` |
| `@here.build/tsconfig/env/node` | `common/tsconfig/env/node.json` |
| `@here.build/tsconfig/env/cf` | `common/tsconfig/env/cf.json` |
| `@here.build/tsconfig/env/browser` | `common/tsconfig/env/browser.json` |
| `@here.build/tsconfig/env/browser-widespread` | `common/tsconfig/env/browser-widespread.json` |
| `@here.build/tsconfig/env/consumer` | `common/tsconfig/env/consumer.json` |

## Key internals

Two preset families under `purpose/` and `env/` (`common/tsconfig/purpose`, `common/tsconfig/env`).
The `env/node` base targets ES2024 with the esnext lib (`common/tsconfig/env/node.json:1`). A
package's `tsconfig.json` extends one purpose + one env preset.

## Invariants / notes

- Consumed as a devDependency across the workspace (`workspace:^`), e.g.
  `arrival/arrival-scheme-env-infer/package.json:49`.

## Tests

None (config package).

## Tasks

- None open.
