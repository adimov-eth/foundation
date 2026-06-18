---
title: Hermes repo audit (archived)
layer: history
status: verified
tags: [history, reconciliation, audit]
canonical-for: []
source-provenance:
  origin: tmp/hermes_analyses.md
  branch: origin/tmp-6164624
  retrieved: 2026-06-18
  authority: historical
last-verified: 2026-06-18
verified-against: origin/tmp-6164624
---

> ⚠️ Frozen historical copy — possibly outdated; current truth in [[source-layers]].

---

Deep research done. I did not modify files.

## Executive read

This repo is not a normal “foundation utilities” repo. It is three ambitious systems sharing one monorepo:

1. **Plexus** — CRDT-backed class/object state, with Yjs under the hood and TS decorators as the user surface.
2. **Arrival** — a sandbox-ish Scheme runtime forked from LIPS, with an explicit JS↔Scheme membrane, resource budgets, provenance, and capability assembly.
3. **Arrival Chain** — an LLM/tool orchestration substrate built on Scheme programs, content-keyed inference, effect logs, replay, provenance slicing, and projection into JS/Python.

The interesting part: the repo has unusually strong internal design notes and tests for hard boundaries, but its **workspace/package state is currently broken**. I could not run tests/build/typecheck because `pnpm install --frozen-lockfile` fails: the lockfile is stale and references old/missing packages.

That build-system break is the highest-priority practical issue. The architecture is sophisticated; the repo hygiene is lagging behind the refactor.

---

## Verified repository facts

- Branch: `main...origin/main`, clean working tree.
- Root package: `@here.build/foundations`, pnpm workspace, Turbo scripts.
- Size by rough line count:
  - `arrival`: 560 files / ~94k lines / 272 test files
  - `plexus`: 124 files / ~41k lines / 80 test files
  - `common`: 43 files / ~5.7k lines / 5 test files
- Root README claims packages:
  - `plexus`
  - `arrival/*`
  - `common/*`
- Actual workspace includes stale/missing entries:
  - `pnpm-workspace.yaml:3-5` references `device-frame`, `css-viewport-transform`, `ios-layout-solver`; all are missing.
- Submodule:
  - `.gitmodules:1-3` defines `arrival/arrival/vendor/chibi-scheme`.
  - `git submodule status` shows it uninitialized: `-97faa... arrival/arrival/vendor/chibi-scheme`.

---

## Build / verification status

I attempted the normal commands, but the workspace cannot install cleanly.

### Commands run

- `pnpm run typecheck`
  - failed because `pnpm` was not directly on PATH.
- `corepack pnpm --version`
  - returned `10.3.0`.
- `corepack pnpm run typecheck`
  - failed because `node_modules` missing and `turbo` unavailable.
- `corepack pnpm install --frozen-lockfile`
  - failed with stale lockfile.

### Exact blocker

`corepack pnpm install --frozen-lockfile` fails:

> `ERR_PNPM_OUTDATED_LOCKFILE`
>
> lockfile not up to date with `<ROOT>/common/error-invariant/package.json`

The lockfile has no `common/error-invariant` importer, while `common/error-invariant/package.json:28-33` declares dev dependencies.

Worse, `pnpm-lock.yaml` still references packages that no longer exist in the tree:

- `arrival/arrival-scheme`
- `arrival/arrival-sampler`
- `arrival/arrival-codemirror`
- `arrival/arrival-type-lens`

Meanwhile the actual package at `arrival/arrival/package.json:2` is named `@here.build/arrival`, but its README still says `# @here.build/arrival-scheme` at `arrival/arrival/README.md:1`.

**Blunt diagnosis:** the codebase has been renamed/refactored, but the lockfile and parts of documentation did not make the same trip. CI as written will fail before it reaches meaningful tests.

---

## Architecture map

### 1. Common foundations

#### `@here.build/collections`

Small utilities: defaulted maps, counters, multimaps, path maps, MobX computed collections.

Docs: `common/collections/README.md:1-27`.

#### `@here.build/error-invariant`

Global `Error.invariant` / `TypeError.invariant` helper. Extracted so the assertion helper is not coupled to sandbox code. Package exists, but lockfile does not include it.

#### `@here.build/lexical-namer`

This is more important than it looks. It is a deterministic lexical name allocator with a flat API and a scope-tree API over one algorithm.

Key ideas:

- parent reservations propagate downward,
- user declarations propagate upward to avoid generated-name shadowing,
- sibling scopes stay independent,
- rich “shapes” let one entity choose among multiple physical code realizations.

Evidence:
- API concepts in `common/lexical-namer/README.md:19-30`
- implementation comments in `common/lexical-namer/src/index.ts:1-27`
- upward user declaration reasoning in `common/lexical-namer/src/index.ts:56-69`
- rich shape model in `common/lexical-namer/src/index.ts:92-127`

This supports code generation, not just “make names unique”.

---

### 2. Plexus

Plexus is a CRDT object model. The public surface says: decorate TS classes and fields; Plexus maps them into Yjs with CRDT identity, parent/child ownership, structural map keys, undo/redo, MobX reactivity, liminal editing, awareness, and dependencies.

Docs:
- high-level purpose: `plexus/README.md:12-16`
- stage-3 decorator requirement: `plexus/README.md:20-22`
- ownership/child fields: `plexus/README.md:93-122`
- virtual maps: `plexus/README.md:124-162`
- structural map keys: `plexus/README.md:163-189`
- UUID model: `plexus/README.md:302-320`

#### Core mechanism

`Plexus.ts` is explicitly a **shadow-primary CRDT orchestration layer**:

- shadow doc = working copy,
- main doc = committed/synced store,
- origin symbols route updates and prevent echo,
- liminal edits are local preview writes that can later commit as deltas.

Evidence: `plexus/src/Plexus.ts:1-21`.

The liminality commit sequence is documented as six required invariants:
`plexus/src/Plexus.ts:14-20`.

This is not incidental complexity; this is trying to solve collaborative “preview/scrub/drag” state without polluting committed CRDT history.

#### Model construction trick

`PlexusModel` stores internals in a WeakMap and materializes schema fields after construction:

- internals store: `plexus/src/PlexusModel.ts:61-79`
- constructor sets initialization/backing state: `plexus/src/PlexusModel.ts:126-151`
- schema fields are redefined enumerable/configurable from prototype descriptors: `plexus/src/PlexusModel.ts:159-188`

UUIDs are CRDT-native by default and throw before materialization unless arbitrary mode is enabled:
`plexus/src/PlexusModel.ts:192-207`.

#### Decorators are doing real work

The class decorator registers unique model names globally:
`plexus/src/decorators.ts:80-107`.

Field decorators write schema metadata and return accessors:
`plexus/src/decorators.ts:121-136`.

Child assignment validates before mutation, then handles orphan/adopt/emancipate ordering:
`plexus/src/decorators.ts:189-218`.

That is good: it explicitly avoids mutating half a parent-child graph and then discovering it was invalid.

#### Risk / concern

Plexus is powerful but depends heavily on decorator semantics, runtime WeakMaps, global registration, and hidden Yjs invariants. The test surface is broad, but this is the kind of library where small bundler/runtime changes can break behavior.

The project already knows this: there is a Yjs module identity guard test and many liminality/ownership tests. That is the correct paranoia.

---

### 3. Arrival interpreter core

The `arrival/arrival` package is still documented as `@here.build/arrival-scheme` in its README, but package name is now `@here.build/arrival`.

#### Stated security posture

README says:

- fork of LIPS.js,
- sandboxed by default,
- “version 0.x may be unsafe”,
- “Assume the sandbox can be escaped.”

Evidence:
- `arrival/arrival/README.md:3-12`
- `arrival/arrival/README.md:188-203`

This honesty is good. It avoids fake sandbox confidence.

#### Actual membrane posture

The JS interop membrane is much stronger than the README’s old “we know it may escape” tone suggests.

`interop-access.ts` explicitly restricts member access to own data members and blocks:

- `constructor`
- `__proto__`
- `prototype`
- well-known symbols
- built-in prototypes
- marked boundaries

Evidence:
- policy: `arrival/arrival/src/interop-access.ts:1-15`
- blocked names/symbols: `arrival/arrival/src/interop-access.ts:111-141`
- boundary logic: `arrival/arrival/src/interop-access.ts:182-233`
- access algorithm: `arrival/arrival/src/interop-access.ts:305-375`

The code also avoids a classic setter/prototype footgun by using `Object.defineProperty` for writes rather than bracket assignment:
`arrival/arrival/src/interop-access.ts:460-470`.

`membrane.ts` blocks function-valued property reads so Scheme cannot turn object methods into arbitrary callable JS:
`arrival/arrival/src/membrane.ts:270-278`.

It marks wrapper classes themselves as boundaries because otherwise Scheme could reach wrapper methods like `apply`, `call`, or `toString`:
`arrival/arrival/src/membrane.ts:398-414`.

This is exactly the kind of detail that prevents “sandbox theater”.

#### Budgets

`exec` supports:

- `AbortSignal`,
- wall-clock `budgetMs`,
- allocation-ish `heapBudget`,
- speculative eval flag.

Evidence: `arrival/arrival/src/eval/generator-exec.ts:37-72`.

Budget is scoped over the whole exec call, not reset per top-level form:
`arrival/arrival/src/eval/generator-exec.ts:124-157`.

That is a correct design choice.

#### Concern

Docs reference non-existent docs paths:

- `docs/sandbox-security-model.md` in `arrival/arrival/src/interop-access.ts:14`
- `docs/membrane-design.md` in `arrival/arrival/src/membrane.ts:15`
- `../../../docs/foundations/arrival-scheme/language-design-foundations.md` in `arrival/arrival/README.md:20`

There is no `docs/` directory in this repo. Either these docs were removed, not copied, or expected from another repo. For a security-sensitive interpreter, missing design docs are not cosmetic.

---

### 4. Arrival Chain

Arrival Chain is the orchestration layer.

README says it is a “distributed, content-addressed, write-once inference substrate built on Plexus + arrival-scheme”:
`arrival/arrival-chain/README.md:1-7`.

#### Project model

`Project` is a Plexus model with a child map of files:
`arrival/arrival-chain/src/project.ts:140-149`.

The inference store is intentionally runtime-bound, not synced:
`arrival/arrival-chain/src/project.ts:150-168`.

That prevents API keys / SDKs / host routing from becoming CRDT state. Correct boundary.

#### Environment capability assembly

`buildArrivalEnv`:

- starts from `sandboxedEnv`,
- temporarily binds extension registration,
- lowers arrival capabilities,
- only includes loader-core if a VFS is granted,
- seals extension registration after assembly.

Evidence:
- `arrival/arrival-chain/src/project.ts:64-90`

This is a strong capability-withholding pattern: absent capability means absent symbol, not a symbol that throws later.

#### Run handle

`Project.run` returns a synchronous `RunHandle` with promises for forms/result/env:
`arrival/arrival-chain/src/project.ts:107-138`.

That lets UIs observe parse/forms/trace while eval remains async. Reasonable.

#### Effect and replay model

The core idea is explicit:

- every non-deterministic external touch is an effect,
- effects are kind-tagged,
- full effect log enables replay,
- subtract forward cone enables partial invalidation.

Evidence:
- effect log rationale: `arrival/arrival-chain/src/effect-log.ts:1-50`
- kind-tagged keys: `arrival/arrival-chain/src/effect-log.ts:57-96`
- stable JSON: `arrival/arrival-chain/src/effect-log.ts:125-139`
- data effect keying: `arrival/arrival-chain/src/effect-log.ts:141-168`

This is one of the strongest parts of the repo. It is not just “cache LLM calls”; it is designing a causal replay substrate.

#### Inference plane

`InferStore` is content-keyed and single-flight:

- first request starts backend,
- identical calls share a cell,
- optional persistent cache read/write,
- ref-counted abort when last subscriber releases.

Evidence:
- `arrival/arrival-inference/src/infer-store.ts:6-28`
- cell read/write/cache path: `arrival/arrival-inference/src/infer-store.ts:112-168`
- ref counting abort: `arrival/arrival-inference/src/infer-store.ts:191-197`
- store keying: `arrival/arrival-inference/src/infer-store.ts:213-235`

This is the right primitive for LLM orchestration. It is boring in the good way: content identity, single-flight, abort.

#### MCP caveat

MCP calls are **positional**, not content-keyed, because server hidden state can make identical calls yield different results. The code documents this explicitly:
`arrival/arrival-chain/src/effect-log.ts:113-123`.

That is a high-quality design distinction.

---

### 5. Arrival Provenance

The provenance layer is trace analysis, not evaluator driving:
`arrival/arrival-provenance/README.md:1-23`.

`trace.ts` implements a detailed provenance algebra:

- provenance points mint singleton IDs,
- pure operations union/forward,
- field accessors refine upstream provenance into synthetic field points,
- authoritative provenance avoids exploding history sets.

Evidence:
- taxonomy note: `arrival/arrival-provenance/src/trace.ts:22-27`
- compute rules: `arrival/arrival-provenance/src/trace.ts:72-147`
- field point semantics: `arrival/arrival-provenance/src/trace.ts:127-140`

It also has a real performance scar: MobX was removed from hot trace objects after memory blowups:
`arrival/arrival-provenance/src/trace.ts:32-46`.

That is a good sign. Someone measured or at least debugged actual pathological behavior, not just wrote design prose.

---

### 6. Arrival MCP

`arrival-mcp` builds MCP tools as values. Two tiers:

- `DiscoveryTool`: read-only Scheme REPL over capability symbols.
- `ActionTool`: typed batched mutation actions with context/ref resolution.

Docs:
- `arrival/arrival-mcp/README.md:8-18`
- action batching/refs: `arrival/arrival-mcp/README.md:62-121`

#### DiscoveryTool

Discovery runs Scheme in a capability-assembled environment and serializes outputs under a budget:
`arrival/arrival-mcp/src/DiscoveryTool.ts:37-51`.

It uses per-session REPL replay with structural caching of safe `define`s:
`arrival/arrival-mcp/src/DiscoveryTool.ts:71-79`
and call flow:
`arrival/arrival-mcp/src/DiscoveryTool.ts:200-254`.

This is clever and dangerous in the right places. It acknowledges that re-running prior discovery statements can re-fire membrane penetrations, so it caches JSON-round-trippable defines instead.

#### ActionTool

`ActionTool` has:

- typed `FieldSpec` context,
- refs that resolve against live context,
- receiver dispatch,
- batch wrapping,
- partial failure reporting.

Evidence:
- high-level comments: `arrival/arrival-mcp/src/ActionTool.ts:1-20`
- handler shape: `arrival/arrival-mcp/src/ActionTool.ts:44-59`
- atomic wrapBatch rationale: `arrival/arrival-mcp/src/ActionTool.ts:128-140`
- result shape: `arrival/arrival-mcp/src/ActionTool.ts:165-176`

This is a real “MCP as transaction boundary” design, not a thin wrapper around tool calls.

---

### 7. Chain View / Sweet / Serializer

#### Chain View

Projects Scheme programs into JS/Python, including prompt backend glue and runnable project assembly.

Evidence:
- README: `arrival/arrival-chain-view/README.md:1-32`
- compile project comments: `arrival/arrival-chain-view/src/compile-project.ts:1-21`
- dependency pinning for generated projects: `arrival/arrival-chain-view/src/compile-project.ts:48-59`

Concern: generated project dependencies are pinned as comments claim, but still use caret ranges (`^22.0.2`, etc.). That is “pinned-ish”, not fully pinned. If the posture is strict supply chain determinism, caret ranges undercut it.

#### Sweet

A zero-dependency sweet-expression lens over canonical Scheme:
`arrival/arrival-sweet/src/index.ts:1-7`.

This is intentionally independent of the evaluator. Good package boundary.

#### Serializer

S-expression serializer has truncation budgets:
`arrival/arrival-serializer/src/serializer.ts:21-63`.

Cycle detection uses a DFS path-set, not cloned sets:
`arrival/arrival-serializer/src/serializer.ts:111-132`.

This is good. The serializer is designed for MCP/tool outputs where payload size matters.

Concern: on circular references it logs the object to console before throwing:
`arrival/arrival-serializer/src/serializer.ts:121-122`.

For tooling that may serialize user/system data, logging raw circular objects can leak sensitive data into logs. I would remove or gate that log.

---

## Quality and tests

The test surface is huge. My rough regex count found thousands of `describe`/`it` occurrences across the repo. Specific high-signal areas include:

- Arrival membrane/security:
  - `arrival/arrival/src/__tests__/sandbox-boundary.spec.ts`
  - `arrival/arrival/src/__tests__/sandbox-escape.test.ts`
  - `arrival/arrival/src/__tests__/membrane.spec.ts`
  - `arrival/arrival/src/__tests__/membrane-symmetry.test.ts`
- Arrival budgets:
  - `arrival/arrival/src/__tests__/abort.test.ts`
- Arrival chain replay/effects:
  - `arrival/arrival-chain/src/__tests__/effect-log.test.ts`
  - `arrival/arrival-chain/src/__tests__/replay-determinism.test.ts`
  - `arrival/arrival-chain/src/__tests__/data-effects.test.ts`
  - `arrival/arrival-chain/src/__tests__/mcp-effects.test.ts`
- Plexus:
  - field types, lifecycle, ownership, cross-document, history, liminality, awareness, stress tests.

But tests are presently theoretical until the workspace installs again.

Skipped tests found:
- generator error object handling skipped: `arrival/arrival/src/__tests__/generator-exec.spec.ts:245-305`
- parameterize skipped: `arrival/arrival/src/__tests__/generator-exec.spec.ts:316-317`
- rosetta empty list conversion skipped: `arrival/arrival/src/__tests__/rosetta-environment.test.ts:56-57`
- language spec has dynamic skip behavior: `arrival/arrival/src/__tests__/lang.spec.ts:117-119`, `:206-207`

These are not necessarily bad, but they should be tracked as explicit known gaps.

---

## Highest-priority findings

### 1. Workspace install is broken

This is the immediate blocker. CI uses frozen lockfile:

- `.github/workflows/ci.yml:24-34`
- `.github/workflows/test.yml:27-31`

But `corepack pnpm install --frozen-lockfile` fails locally.

**Likely fix:** regenerate `pnpm-lock.yaml` after deciding the intended package graph. Do not just `--no-frozen-lockfile` blindly; first reconcile renames and removed packages.

### 2. Package rename drift: `arrival-scheme` vs `arrival`

Evidence:

- Actual package name: `arrival/arrival/package.json:2` = `@here.build/arrival`.
- README title: `arrival/arrival/README.md:1` = `@here.build/arrival-scheme`.
- README install/import examples still use `@here.build/arrival-scheme`: `arrival/arrival/README.md:33`, `:39`, `:54`, `:71`.
- Lockfile references `arrival/arrival-scheme`.

This is not harmless. It confuses consumers and can break imports if stale package names survive in generated docs/examples.

### 3. Missing design docs referenced from code

Security/provenance docs are referenced but absent from repo. Examples:

- `docs/sandbox-security-model.md`
- `docs/membrane-design.md`
- `docs/foundations/arrival-scheme/language-design-foundations.md`
- `docs/spec/arrival-chain.md`
- `docs/foundations/arrival-scheme/reference/provenance-model.md`

For a project with security-sensitive boundaries, missing docs are a real problem. Either restore them, move them into package docs, or remove references and point to actual files.

### 4. Lockfile is from an older universe

`pnpm-lock.yaml` still lists old packages not present in the workspace and misses new packages. This suggests a large refactor landed without lockfile regeneration.

### 5. CI does not initialize submodules in `ci.yml`

`test.yml` checks out submodules recursively; `ci.yml` does not. If typecheck/build ever needs `arrival/arrival/vendor/chibi-scheme`, CI build may fail differently from CI test.

Evidence:
- test checkout has `submodules: recursive`: `.github/workflows/test.yml:14-17`
- CI checkout does not: `.github/workflows/ci.yml:13`

### 6. Documentation overclaims “pinning” in generated project deps

`arrival-chain-view/src/compile-project.ts:48-59` says generated runnable projects pin deps, but values use caret ranges. If deterministic supply chain is the stated posture, use exact versions.

### 7. Serializer can leak object contents on circular refs

`arrival/arrival-serializer/src/serializer.ts:121-122` logs circular objects. Remove or debug-gate.

---

## What triggered my curiosity most

### The strongest concept: effect-log + provenance cone

The repo is converging on a serious idea: LLM/tool workflows as replayable programs where every nondeterministic boundary is recorded and causally traceable. The combination of:

- content-keyed inference,
- positional MCP tapes,
- kind-tagged effect keys,
- provenance statechart,
- forward-cone invalidation,

is legitimately interesting. This is not LangChain-style orchestration glue. It is closer to “build system semantics for agentic computation.”

The best evidence is the effect-log rationale in `arrival/arrival-chain/src/effect-log.ts:1-50`.

### The best engineering taste: explicit non-security claims

`interop-access.ts` says “Boundary here is membrane sense — not a sandbox” at `arrival/arrival/src/interop-access.ts:13-14`.

That sentence matters. It shows the author understands the difference between a membrane API contract and a security boundary. The README still warns to assume sandbox escape. Good.

### The most fragile thing: Plexus liminality

Plexus’s shadow/main doc and liminal client ID rewrite model is sophisticated, but likely fragile. The six invariants in `plexus/src/Plexus.ts:14-20` should probably be promoted into a design doc and directly mapped to tests. This is the kind of subsystem where future maintainers will break it by “simplifying” one origin marker.

### The weirdest mismatch: polish inside packages, broken root state

Inside packages, comments are unusually rich and often encode real design scars. At root, the workspace cannot install. That mismatch means the project is in a post-refactor half-state: intellectual architecture advanced faster than packaging hygiene.

---

## Recommended next moves

1. **Repair package graph and lockfile.**
   - Decide whether the interpreter package is `@here.build/arrival` or `@here.build/arrival-scheme`.
   - Update README examples, package deps, lockfile, and stale workspace references consistently.
   - Remove missing workspace globs or restore missing packages.
   - Re-run `corepack pnpm install --lockfile-only` or full install, then verify frozen install.

2. **Run verification only after install is clean.**
   - `corepack pnpm run typecheck`
   - `corepack pnpm run build`
   - `corepack pnpm run test`
   - `corepack pnpm run lint`

3. **Restore or relocate missing design docs.**
   - Especially sandbox/membrane/provenance docs. These are not optional if the code points to them as authority.

4. **Fix docs/package rename drift.**
   - `arrival/arrival/README.md` is the main offender.

5. **Make CI checkout consistent.**
   - Add `submodules: recursive` to `.github/workflows/ci.yml` unless proven unnecessary.

6. **Remove/gate raw serializer console logging.**
   - Small fix, real hygiene/security value.

7. **Promote Plexus liminality invariants into a named test ledger.**
   - Six invariants → six direct tests or test section labels. Future maintainers need an executable map.

Bottom line: the core ideas are strong and unusually thoughtful. The current repo state is not release-clean because workspace/package drift blocks installation and verification. The next work should be boring packaging reconciliation, not new architecture.
