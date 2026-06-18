---
title: arrival-chain-view
summary: A faithful, deterministic projection of arrival-chain Scheme into a target language (JS, then Python) — the read-view glass over a chain program.
layer: reference
status: in-review
tags: [package, arrival, chain-view, projection, scheme]
canonical-for: []
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
code-anchors:
  - arrival/arrival-chain-view/src/project.ts:14            # projectToJs
  - arrival/arrival-chain-view/src/project.ts:19            # projectToJsRaw
  - arrival/arrival-chain-view/src/python.ts:146           # projectToPy
  - arrival/arrival-chain-view/src/compile-project.ts:141  # compileProject
  - arrival/arrival-chain-view/src/types-emit.ts:753       # emitTypes
  - arrival/arrival-chain-view/src/compile-project.ts:52   # DEP_VERSIONS (caret ranges)
  - arrival/arrival-chain-view/src/prompt.ts:318           # compilePromptToTs
  - arrival/arrival-chain-view/src/prompt.ts:324           # aiClientModule
  - arrival/arrival-chain-view/src/prompt.ts:305           # getPromptBackend
  - arrival/arrival-chain-view/src/prompt.ts:288           # PROMPT_BACKENDS
  - arrival/arrival-chain-view/src/prompt.ts:31            # PromptBackend
  - arrival/arrival-chain-view/src/prompt.ts:20            # PromptModule
---

# arrival-chain-view

Package `@here.build/arrival-chain-view` (`package.json:2`, `0.1.0`, license `FSL-1.1-MIT`). A
**faithful, deterministic** projection of arrival-chain Scheme into a target language (JS first,
Python next) — the read-view "glass" over a chain program (`package.json` description). See
[[s-expressions-vs-json]].

## Overview

The pipeline lowers a chain Scheme program through `desugar` → `lower` → `assemble` →
`format`/`python`, then `compileProject` packages a runnable project (with pinned deps) and
`emitTypes` derives the `.d.ts` view. Projection is deterministic: same source → same output.

## Public API

| Export | Signature | File:line |
|---|---|---|
| `projectToJs` | `(source: string, opts?: ProjectOptions) => Promise<string>` (formatted) | `project.ts:14` |
| `projectToJsRaw` | `(source: string, opts?: ProjectOptions) => string` (unformatted lowering) | `project.ts:19` |
| `projectToPy` | `(source: string, opts?: PyOptions) => string` | `python.ts:146` |
| `compileProject` | `async (files: Record<string,string>, entry: string, target: CompileTarget) => Promise<EmittedFile[]>` | `compile-project.ts:141` |
| `emitTypes` | `(scheme: string, opts?: EmitTypesOptions) => EmitTypesResult` | `types-emit.ts:753` |
| `sliceToTypeScript` | provenance-slice → TS | `slice-to-ts.ts`; `index.ts:6` |
| `formatJs` | eslint/prettier pass | `format.ts`; `index.ts:7` |
| `cleanName` / `nameCandidates` / `pyName` | identifier projection | `names.ts` / `python.ts`; `index.ts:8,18` |
| `compilePromptToTs` | `(source: string, promptName: string) => CompiledPrompt` (compile a `.prompt` → ax `.prompt.ts`) | `prompt.ts:318` |
| `aiClientModule` | `() => string` (the shared ax `_ai.ts` client module) | `prompt.ts:324` |
| `getPromptBackend` | `(id: PromptBackend["id"]) => PromptBackend` | `prompt.ts:305` |
| `PROMPT_BACKENDS` | `Record<PromptBackend["id"], PromptBackend>` (ax / langchain-js / dspy / langchain-py registry) | `prompt.ts:288` |
| `PromptBackend` | interface (`id`, `lang`, `compile`, `client`) | `prompt.ts:31` |
| `PromptModule` | interface (`filename`, `code`, `exportName`, `inputs`) | `prompt.ts:20` |

(`index.ts:5-21` is the barrel.)

## Key internals

| Concern | Where |
|---|---|
| JS assemble (raw lowering) | `project.ts:19` `projectToJsRaw` → `assemble.ts` |
| Format pass | `project.ts:14` wraps `assemble` in `formatJs` (`format.ts`) |
| Python emit | `python.ts:146` |
| Project packaging + dep pinning | `compile-project.ts:141` `compileProject`; `DEP_VERSIONS` (`:52`) |
| Type emission | `types-emit.ts:753` `emitTypes` |
| Lowering stages | `desugar.ts`, `lower.ts`, `nodes.ts`, `scheme-scope.ts`, `async-analysis.ts`, `imports.ts`, `prompt.ts`/`prompt-ir.ts` |

## Invariants

- Projection is deterministic — the read-view "glass" reflects, it does not interpret
  (`package.json` description).
- `projectToJsRaw` is the unformatted lowering; `projectToJs` = `projectToJsRaw` then `formatJs`
  (`project.ts:14-22`).

## Seams

- **DEP_VERSIONS pin overclaim** — `compile-project.ts:48-59` comments "a generated runnable
  project pins its deps rather than floating 'latest'" (citing
  `.claude/rules/npm-version-pinning.md`), but the values are **caret ranges** (`^22.0.2`,
  `^1.1.48`, `^1.4.7`, `^4.22.4`, `^6.0.3`) — caret ranges still float on `npm install`. The
  comment's "pins, not floating" claim does not match the data. → [[docs/90-backlog/_moc|backlog]].

## Tests

~184 cases across 15 files in `arrival/arrival-chain-view/src/__tests__/`.

## Tasks

- Reconcile the DEP_VERSIONS comment vs caret ranges (either exact-pin or soften the claim). →
  [[docs/90-backlog/_moc|backlog]]
