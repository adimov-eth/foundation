---
title: Packages — MOC
layer: reference
status: in-review
tags: [meta, package]
canonical-for: []
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
---

# Packages — map of content

Every workspace package's reference note, grouped by cluster. Notes are named exactly after the
package directory (the `common/` packages carry a `common-` prefix) per the file-tree contract in
[[conventions]]. Cross-package mechanics live once in
[[10-reference/cross-cutting/_moc|cross-cutting]]; each note describes only its participation.

## Plexus

| Note | Role |
|---|---|
| [[plexus]] | CRDT document instance: sync, undo, liminality, virtual genesis. |

## Arrival

| Note | Role |
|---|---|
| [[arrival]] | sandboxed Scheme interpreter (`@here.build/arrival`), forked from LIPS; membrane + rosetta. |
| [[arrival-chain]] | the chain program model + run orchestration (config-as-code, server-tape). |
| [[arrival-inference]] | inference engine: InferStore single-flight cache, ModelRouter, backends, derive algebra. |
| [[arrival-provenance]] | EvalTrace / Invocation, provenance lineage, region/statechart render models, reverse slice. |
| [[arrival-chain-view]] | deterministic projection of a chain program into JS/Python. |
| [[arrival-sweet]] | sweet-expression readable surface for Scheme, bidirectional. |
| [[arrival-mcp]] | MCP Discovery/Action tiers over a shared env capability. |
| [[arrival-serializer]] | (de)serialization of arrival values. |
| [[arrival-env]] | env / capability assembly for arrival scopes. |
| [[arrival-scheme-env-infer]] | palette pack: `infer`/`infer-chat` verbs + dependent MCP-agentic capability. |
| [[arrival-scheme-env-ramda]] | opt-in palette pack wiring Ramda accessor/collection/logic/string verbs into the env. |

## Common

| Note | Role |
|---|---|
| [[common-collections]] | DefaultedMap/WeakMap, Counter, PathMap, Array/Set multimaps, `/mobx` ComputedMap variants. |
| [[common-error-invariant]] | side-effect import installing global `Error.invariant`. |
| [[common-lexical-namer]] | priority-based, scope-aware name assignment (`assignNames` / `resolveLexicalNames`). |
| [[common-eslint-config]] | shared ESLint flat configs (`@here.build/eslint-configs`). |
| [[common-tsconfig]] | shared TypeScript config presets (`@here.build/tsconfig`). |

Back to [[10-reference/_moc]].
