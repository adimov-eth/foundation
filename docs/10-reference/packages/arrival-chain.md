---
title: arrival-chain
layer: reference
status: verified
tags: [package, arrival, chain, cross-cutting]
canonical-for: []
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
code-anchors:
  - arrival/arrival-chain/src/project.ts:141        # @syncing Project (doc root)
  - arrival/arrival-chain/src/project.ts:302        # Project.run (universal gateway)
  - arrival/arrival-chain/src/project.ts:410        # inferAndWait closure (content-keyed seam)
  - arrival/arrival-chain/src/project.ts:856        # runHypothesis (counterfactual)
  - arrival/arrival-chain/src/runner.ts:50          # runPipeline (self-contained entry)
  - arrival/arrival-chain/src/infer-kernel.ts:308   # inferIdentityKey (tools/params fold)
  - arrival/arrival-chain/src/infer-kernel.ts:324   # recordInfer / reviveInfer / freshInfer
  - arrival/arrival-chain/src/loader.ts:208         # defaultResolvers (.scm/.json/.yaml/.toml/.ndjson/.txt/.hbs)
  - arrival/arrival-chain/src/loader.ts:302         # makeProjectLoader (versionSet pinning)
  - arrival/arrival-chain/src/effect-log.ts:63      # EffectKind (infer|http|sql|mcp)
  - arrival/arrival-chain/src/effect-log.ts:89      # effectKey lowering (kind-tagged)
  - arrival/arrival-chain/src/effect-log.ts:313     # invalidateForwardCone (cone subtraction)
---

# arrival-chain

## Overview

The content-addressed inference substrate. Sits on [[glossary#Plexus]] (the synced
document/CRDT layer) and the arrival-scheme evaluator, and turns a project of
`.scm`/data files into deterministic, replayable [[glossary#agentic loop|agentic]]
runs. A run is a **pure function of the project's files** — every contact with the
outside world (LLM, HTTP, SQL, MCP) crosses the [[glossary#effect membrane / effect-log|effect membrane]],
which is what makes [[determinism-and-effects|replay and counterfactuals]] sound. The
package owns the `Project` model, the `run`/`runPipeline` gateways, the module loader
for `(require …)`, the effect-log key algebra, and the [[content-addressed-effects|content-addressed]]
infer kernel. Inference resolution itself is delegated to [[arrival-inference]];
provenance/trace analysis to [[arrival-provenance]].

Published `@here.build/arrival-chain` with a `./runner` subpath
(`arrival/arrival-chain/package.json`).

## Public API table

| Export | Signature (abridged) | File:line |
|---|---|---|
| `Project` | `class extends PlexusModel` — doc root owning `files: Map<string, Program>` | project.ts:141 |
| `Project.bindInfer` | `(store: InferStoreLike) => void` — bind the runtime inference plane | project.ts:161 |
| `Project.run` | `(source, opts) => RunHandle` (thenable) — the universal run gateway | project.ts:302 |
| `Project.invoke` | `(opts) => Run` — reverse-membrane named-define call, version-pinned | project.ts:627 |
| `Project.runHypothesis` | `(opts) => { hypothesis, finished }` — counterfactual replay | project.ts:856 |
| `Project.runTraced` | `(source, opts) => { userForms, finished, env, result }` | project.ts:1010 |
| `Project.captureVersionSet` | `() => Map<string, number>` — coherent project cut for replay | project.ts:276 |
| `RunHandle` | `class implements PromiseLike` — `userForms`/`finished`/`result`/`env` | project.ts:119 |
| `buildArrivalEnv` | `(opts: BuildArrivalEnvOpts) => Promise<Environment>` | project.ts:64 |
| `BUILTIN_PREAMBLE` | `string` — chat/schema-DSL + superpowered-define macros | project.ts:1058 |
| `runPipeline` | `(opts: RunPipelineOptions) => Promise<unknown>` — `./runner` subpath | runner.ts:50 |
| `Loader` / `makeProjectLoader` | module-loading vfs over a Project's versions | loader.ts:87, 302 |
| `defaultResolvers` | `() => Map<string, ExtensionHandler>` — file-type table | loader.ts:208 |
| `defineRequireRosetta` | `(opts) => clearCache` — single-flight `(require …)` | loader.ts:348 |
| `EffectLog` | `Map<string, string>` — kind-tagged key → value JSON | effect-log.ts:74 |
| `inferEffectKey`/`httpEffectKey`/`sqlEffectKey`/`mcpEffectKey` | typed effect-key constructors | effect-log.ts:95,103,110,122 |
| `invalidateForwardCone` | `(fullLog, trace, changedNodeIds) => EffectLog` | effect-log.ts:313 |
| `effectLogCollector` | `() => { log, record }` — one-pass log accumulator | effect-log.ts:342 |
| `inferIdentityKey` | `(cacheKey, tools?, params?) => string \| null` | infer-kernel.ts:308 |

## Key internals

- **`Project` doc model** (project.ts:141) — `@syncing("ArrivalChainProject")`; owns
  `files: Map<path, Program>` (the project filesystem). The inference plane is
  **runtime, not synced** (`#infer`, bound via `bindInfer`; project.ts:159-168) — a
  run resolves through the host's own [[arrival-inference|InferStore]] so it stays a
  pure function of files. `config-as-code`: per-run knobs ship as a `config.scm` the
  entry `(require …)`s, spilling `(define config/<name> …)` bindings into the run env;
  there is no scheme-side write path and no host-injected env (project.ts:170-174).
- **`inferAndWait` closure** (project.ts:410) — the content-keyed seam every `(infer …)`
  flows through. Order: consult `tweaks` (counterfactual, NEW values, keyed by the
  UNTAGGED tuple `[model,prompt,schema,key]`) → consult `effectLog` (replay, RECORDED
  values, kind-tagged key) → acquire the [[arrival-inference|single-flight cell]] →
  `await cell.done` → record into the effect-log + reflective budget. Replay still
  marks the trace node cached + a provenance point so a replayed run's graph is
  shaped identically (project.ts:427-439).
- **infer-kernel** (`infer-kernel.ts`) — `inferIdentityKey` folds `tools` (ordered)
  and content `params` into the cacheKey so the `[model,prompt,schema,cacheKey]`
  machinery distinguishes them with no new key dimension (line 308; **gated to byte-
  identity** when neither present). `recordInfer`/`reviveInfer`/`freshInfer` (line
  324-345) are the record/replay shapes: a tool-enabled turn carries `{value,toolCalls}`,
  a plain infer the bare value. Also home to `buildArrivalEnv` + `BuildArrivalEnvOpts`
  (the host-capability seam: `infer`/`loader`/`data`/`mcp`/`onExpose`/`resolveOverride`)
  and `.prompt` (dotprompt) parsing/sealing.
- **loader** (`loader.ts`) — `(require …)` is an ordinary runtime rosetta resolving a
  specifier against a `Loader`. `defaultResolvers` (line 208) registers: `.scm` →
  `load` (spill defines, R5RS semantics), `.json`/`.yaml`/`.yml`/`.toml`/`.ndjson` →
  parsed value (bound via `(define x (require …))`), `.txt` → string, `.hbs` → render
  lambda. `.prompt` is **not** a loader builtin — it is registered by the `ext/prompt`
  capability (it needs the infer resource). Single-flight per path; cycles throw
  (R7RS); the reader is the traversal jail (line 106-119, rejects `..` escape + NUL).
- **effect-log** (`effect-log.ts`) — pure data + pure functions. `EffectKind` is
  `infer | http | sql | mcp` (line 63); every key is kind-tagged
  (`JSON.stringify([kind, ...payload])`, line 89) so the single map's key spaces are
  disjoint by construction. `infer`/`http`/`sql` are **CONTENT-keyed**; `mcp` is
  **POSITIONAL** per `(inferenceId, server, n)` (line ~58-62, 113-123) because an MCP
  call's result depends on the server's hidden mutable state, invisible to a content
  key + the forward-cone. `invalidateForwardCone` (line 313) subtracts the changed
  nodes' provenance forward-cone from a full log → the minimal-recompute replay log.

## Invariants

- A run is a **pure function of the project's files** (+ the bound effect plane).
  Replay soundness depends on this — do not inject host state into the run env.
- The inference plane is **never synced** — bind it per-host via `bindInfer`.
- Effect keys are **kind-tagged**; `mcp` keys are **positional**, the other three
  content-keyed. A new effect kind must extend `EffectKind` + add a typed constructor.
- `inferIdentityKey` is the SOLE place tools/params fold into the cache key —
  `keyOf` (infer-store) whitelists only `[model,prompt,schema,cacheKey]`, so a param
  not folded here would silently serve a stale completion.
- `(require …)` is statement-position + eager-sequential within a `.scm`; cycles throw.
- See [[determinism-and-effects]] (mechanics) and [[content-addressed-effects]] (why).

## Seams

- **Un-forced Promise from let-bound infer results** (substrate-notes; project.ts:300):
  parallelism falls out of LIPS's promise-aware evaluator — a missing/unsettled infer
  returns a Promise that is **forced at observation, not at the call**. A `let`-bound
  infer result is an un-forced carrier; the wait happens at the consumer
  (`promise_all` inside `map`/`string-append`). Reasoning about timing/cost must
  respect "force at observation". (Related characterized substrate behaviour:
  provenance-sensitive `equal?` can defeat string dedup in a fixpoint loop —
  `__tests__/closure-hang.test.ts`.)

## Tests

104 test files under `arrival-chain/src/__tests__/` (including the bulk of the
provenance/trace + slice/uneval/statechart suites). Performance-watched seams live in
`arrival-chain/src/__benchmarks__/` (`provenance-memory.test.ts`, `flow-graph.test.ts`).
The package also defines `__research__`/`__custdev__`/`__benchmarks__` test planes
(separate vitest configs `vitest.research.config.ts` / `vitest.custdev.config.ts` /
`vitest.benchmarks.config.ts`; the `files` allowlist in `package.json` excludes all of
them from publish). On disk only `__benchmarks__/` is currently materialized.

## Tasks

- Run a program against backends → [[run-a-pipeline]].
- Add a provider for `(infer …)` to route to → [[add-a-provider-backend]] ([[arrival-inference]]).
