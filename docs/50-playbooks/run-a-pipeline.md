---
title: Run a pipeline
layer: reference
status: verified
tags: [playbook, arrival, chain, run]
canonical-for: []
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
code-anchors:
  - arrival/arrival-chain/src/runner.ts:50          # runPipeline
  - arrival/arrival-chain/src/runner.ts:18          # RunPipelineOptions
  - arrival/arrival-inference/src/registry.ts:55     # singletonRouter
  - arrival/arrival-chain/src/project.ts:170         # config-as-code (config.scm)
---

# Run a pipeline

Run an arrival-scheme program against data files with a set of backends, end-to-end,
in one process. `runPipeline` ([[arrival-chain]] `./runner` subpath) bootstraps a
`Project`, binds an [[arrival-inference|InferStore]], loads the files, and evaluates
the entry.

## Steps

1. **Assemble a router + store** (see [[add-a-provider-backend]]):
   `const router = new StaticRouter({ "model-id": backend });`
   (or `singletonRouter(stub)` for tests — `registry.ts:55`).

2. **Call `runPipeline`** (`runner.ts:50`, options at `runner.ts:18`):
   ```ts
   import { runPipeline } from "@here.build/arrival-chain/runner";
   const value = await runPipeline({
     files: {
       "main.scm": `(require "config.scm")\n(infer config/model "summarize: …")`,
       "config.scm": `(define config/model "model-id")`,
     },
     entry: "main.scm",
     router,
     budgetMs: 30_000, // optional wall-clock cap (composes with signal)
   });
   ```
   - `files` is `path → content`; `entry` must be a key of `files`.
   - Inference resolves inline through the store's single-flight cells — **no
     out-of-band worker** to spawn or drain.

3. **config-as-code** (`project.ts:170`): per-run knobs are NOT a host-injected env —
   ship them as a `config.scm` the entry `(require …)`s; its `(define config/<name> …)`
   forms spill ordinary bindings into the run env. This is what keeps a run a pure
   function of its files (and therefore replayable — [[determinism-and-effects]]).

4. **`.scm` vs data files**: `.scm` `(require …)` *spills* defines; `.json`/`.yaml`/
   `.toml`/`.ndjson`/`.txt` return a value bound via `(define x (require "data.json"))`;
   `.hbs` returns a render lambda. See `loader.ts:208`.

## Lower-level alternative

For a long-lived host: `ArrivalChain.bootstrap(new Project())` →
`project.bindInfer(createInferStore(router))` → `project.addFile(path, src)` →
`project.run(src, { budgetMs })` (returns a thenable `RunHandle`). `runPipeline` is the
self-contained wrapper over exactly this.

Reference: [[arrival-chain]], [[arrival-inference]].
