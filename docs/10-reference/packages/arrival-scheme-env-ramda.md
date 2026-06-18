---
title: arrival-scheme-env-ramda
summary: An opt-in arrival-scheme palette pack wiring Ramda accessor/path/collection/logic/string verbs into the env
layer: reference
status: verified
tags: [package, arrival, env-pack]
canonical-for: []
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
code-anchors:
  - arrival/arrival-scheme-env-ramda/src/index.ts:80   # default export EnvCapability("scheme/ramda")
  - arrival/arrival-scheme-env-ramda/src/index.ts:17   # RAMDA verb table (aliased R.* ops)
  - arrival/arrival-scheme-env-ramda/src/index.ts:76   # ramdaVerbs — the wired surface
---

# arrival-scheme-env-ramda

The **opt-in Ramda palette pack** for the scheme env. Package
`@here.build/arrival-scheme-env-ramda`. It wires Ramda accessor / path / collection / logic /
string verbs into the env as a single `EnvCapability` a host roots when it wants them.

Ramda was evicted from the base sandbox (an external dep the interpreter shouldn't carry); this
package is where a host opts back in (`arrival/arrival-scheme-env-ramda/src/index.ts:1`). Rooting the capability **is** the
whole opt-in; a scope that doesn't want Ramda simply doesn't list it. See
[[add-a-scheme-env-pack]] for the wiring recipe and [[arrival-scheme-env-infer]] for the sibling
infer pack. Terms: [[glossary#membrane]], [[glossary#rosetta]].

## Public API table

| Export | Signature / shape | File:line |
|---|---|---|
| `default` | `EnvCapability("scheme/ramda", { symbols: RAMDA })` — symbols-only, no config/resource/deps | `arrival/arrival-scheme-env-ramda/src/index.ts:80` |
| `ramdaVerbs` | `readonly string[]` — the wired verb names (so a test asserts the surface) | `arrival/arrival-scheme-env-ramda/src/index.ts:76` |

## Key internals

The `RAMDA` table (`arrival/arrival-scheme-env-ramda/src/index.ts:17`) maps scheme verb names to `R.*` functions. The
design choice: each verb is offered under **every name a user might reach for** — a vocabulary,
not an API. The aliases are intentional, not redundant (`arrival/arrival-scheme-env-ramda/src/index.ts:11`).

| Group | Verbs (selected) | Maps to |
|---|---|---|
| property access | `prop` / `get` / `access` / `fetch` | `R.prop` |
| path navigation | `path` / `get-in` / `navigate` / `dig` | `R.path` |
| safe / defaulted | `prop-or`, `path-or`, `safe-prop`, `safe-path` | `R.propOr` / `R.pathOr` / wrapped |
| existence | `has` / `contains` / `exists?` / `present?`, `has-path` | `R.has` / `R.hasPath` |
| multi-read / sub-record | `props`, `paths`, `pick`, `omit`, `keys`, `values`, `toPairs`, `fromPairs` | `R.*` |
| collection | `group-by` / `classify`, `count-by` / `tally`, `sort-by` / `order-by`, `sort-with`, `reduce-by`, `reduce-right` | `R.*` |
| logic | `is`, `is-nil`, `is-empty`, `default-to`, `if-else` | `R.*` |
| string | `split`, `match`, `test`, `replace`, `to-lower`, `to-upper` | `R.*` |

Notably ABSENT: the polymorphic `map` / `filter` / `reduce`. The sandbox ships its own hardened
versions (they need LIPS `Pair`/`Nil` internals), and a second set would shadow them
(`arrival/arrival-scheme-env-ramda/src/index.ts:6`). The cut here is "what can re-enter cleanly": pure `R.*` with no
arrival-scheme-internal coupling.

## Invariants / notes

- Symbols-only capability: no config, no resource, no deps (`arrival/arrival-scheme-env-ramda/src/index.ts:78`).
- The source comment states the pack **tree-shakes when unused** via `sideEffects:false`
  (`arrival/arrival-scheme-env-ramda/src/index.ts:79`). **(unverified)** — `package.json` does NOT declare a
  `sideEffects` field (`arrival/arrival-scheme-env-ramda/package.json:1`); the tree-shake claim is not borne out by the
  manifest as it stands.
- Runtime deps: `@here.build/arrival`, `ramda 0.31.3` (`arrival/arrival-scheme-env-ramda/package.json:43`).

## Tests

`src/__tests__/ramda.test.ts` (vitest). Count not tallied in this pass.

## Tasks

- None open against this package. (See the `sideEffects` discrepancy above before relying on
  tree-shaking.)
