---
title: Env-Pack Capability DAG (reconstructed)
layer: history
status: in-review
tags: [history, reconstructed, arrival, env, capability, dag]
canonical-for: []
source-provenance:
  origin: docs/working-proposals/env-pack-capability-dag-2026-06-13.md
  branch: lost — not in tree nor origin/tmp-6164624 Archive
  retrieved: reconstructed 2026-06-18
  authority: derived
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
code-anchors:
  - arrival/arrival/src/env/kernel.ts:1     # env-pack kernel: the pure DAG core
  - arrival/arrival/src/env/kernel.ts:7     # the design-doc back-reference
  - arrival/arrival/src/env/kernel.ts:14    # EnvPack interface (name/deps/config/apply)
  - arrival/arrival/src/env/kernel.ts:100   # closure(): DFS, cycle detect, config dedup
  - arrival/arrival/src/env/kernel.ts:128   # c3Linearize(): Python MRO
  - arrival/arrival/src/env/kernel.ts:233   # assembleEnv(): construct-time assembler
  - arrival/arrival/src/env/kernel.ts:263   # RuntimeAssembler: live-env require() path
  - arrival/arrival/src/env/capability.ts:1   # EnvCapability: the palette-pack shape
  - arrival/arrival/src/env/capability.ts:116 # lower(): capability → EnvPack
  - arrival/arrival/src/env/base-packs.ts:1   # BASE_PACKS: stdlib as a capability set
  - arrival/arrival-chain/src/project.ts:64   # buildArrivalEnv(): the consumer
  - arrival/arrival-chain/src/packs/index.ts:27 # arrivalCapabilities() root-set
---

> ⚠️ **RECONSTRUCTION — not the original.** The original `docs/working-proposals/env-pack-capability-dag-2026-06-13.md` is lost everywhere (see [[dangling-doc-map]]). This note is reverse-engineered from the code it governed, anchored to `file:line`. Fidelity: **high**. It records what the doc *must have specified* given the implementation — not its original wording, nor rationale not evidenced in code.

# Env-Pack Capability DAG (reconstructed)

The proposal specified an env-assembly model for [[arrival]]: an environment is built by
**linearizing a DAG of capability contributions** and applying each once. The kernel back-references
this doc directly (`kernel.ts:7`), and the header at `kernel.ts:1` names it "capability-DAG
assembly for arrival environments (P0: the pure core)."

## The pack — the DAG node

`EnvPack<E>` (`kernel.ts:14`) is "a named, dependency-carrying, async capability contribution to an
env" (`kernel.ts:1`). Fields:

- `name` — node identity component (`kernel.ts:15`).
- `deps?: readonly EnvPack<E>[]` — the DAG edges; **"the dep edge IS the capability grant"**
  (`kernel.ts:5`, `:16`).
- `config?: unknown` — host-injected arming for this pack (e.g. `inferPack.config` = the `InferFn`)
  (`kernel.ts:17-19`).
- `apply(env, ctx)` — runs once, after all deps, in C3 order; may `await import` /
  `ctx.onDispose`; "MUST contribute symbols via the env's membrane-wrapping API, never a bare host
  closure (§8)" (`kernel.ts:20-22`). The "(§8)" citation evidences a numbered section in the
  original spec governing the [[membrane]] discipline; its content is not recoverable from code
  beyond this one-line rule.

Pack **identity = (name, config)** (`kernel.ts:13`). "The DAG is the authoring form, the assembled
env is the flat runtime form" (`kernel.ts:4-5`).

## Reference-shared config dedup

A pack name may appear many times across the DAG (diamonds). Dedup is by identity, refined by
config equality (`closure`, `kernel.ts:100`, `:108-110`):

- Same name seen twice with **non-equal config** ⇒ `AssembleConfigConflictError` (`kernel.ts:49`,
  thrown at `:110`): "you armed the same capability two ways."
- `configEqual` (`kernel.ts:90`) is **identity-or-structural**: reference-equal short-circuits;
  **functions/resolvers are identity-only** (never structurally equal, `:92`); plain data is
  deep-equal (`:94-97`).

This is why `buildArrivalEnv` passes the **same raw `opts` object** as `config` to every capability
(`project.ts:67-69`, `:80-82`): the stored `config` field stays reference-equal across a
capability's root and dep appearances, so dedup matches by identity instead of tripping the conflict
error (`capability.ts:141-144`).

## DAG assembly — closure, cycle detection, C3

`linearize` (`kernel.ts:207`) runs the pure sync core:

1. **`closure`** (`kernel.ts:100`) — DFS from roots collecting packs by name, with **3-color cycle
   detection** (GRAY/BLACK, `:103-122`). A cycle throws `AssembleCycleError` with the offending path
   (`kernel.ts:40`, `:114`): "Packs form a DAG; break the edge."
2. **`c3Linearize`** (`kernel.ts:128`) — **C3 linearization (Python MRO), "cited not invented"**
   (`kernel.ts:10`, `:128`). Returns names **highest precedence first**. A synthetic
   `<assembly-root>` depending on all roots gives the total order (`:148-151`). Dep *names* are
   deduped before merge (`:137-140`) so an identity-deduped node appears once. An inconsistent
   precedence (C3 merge finds no "good head", `findGoodHead` `:156`) throws
   `AssembleLinearizationError` (`kernel.ts:58`, `:170`).

`makeOracle`-style "good head" = a list-head appearing in no list's tail (`kernel.ts:156-162`).

## Apply loop — order, disposal, timeout

`assembleEnv(base, roots)` (`kernel.ts:233`) is the construct-time assembler:

- **Async by construction** (a pack may `await import` / spin up a resource) (`kernel.ts:200`).
- Applies each pack **once in C3 order, least-precedence first** ⇒ **last-write-wins matches C3**
  (`kernel.ts:202-203`, `:236`).
- **Per-pack apply timeout** — `ASSEMBLE_PACK_TIMEOUT_MS` env var, default `30_000`ms
  (`kernel.ts:86`); breach ⇒ `AssemblePackTimeoutError` (`kernel.ts:76`).
- On any apply failure: **run the disposers collected so far, LIFO**, then reject —
  **"no half-built env escapes"** (`kernel.ts:202-204`, `:240-244`). Disposers are registered via
  `ctx.onDispose` and run LIFO (`makeCtx`, `kernel.ts:213-225`).
- `AssembledEnv` exposes the env, the `order` (audit/debug), and `dispose()` (`kernel.ts:32-37`).

A **sync `assembleEnv`** seam was planned for sync-only packs (the legacy rosetta-registering core),
keeping `buildArrivalEnv` callable from a sync constructor until chain construction itself moves to
async `init()` (`kernel.ts:249-256`). P0 scope explicitly: "No consumer wires it yet (that is P1:
buildArrivalEnv-as-one-pack)" (`kernel.ts:11`) — the actual `buildArrivalEnv` wiring landed later.

## Runtime assembly — the `(require/extension :name)` path

`RuntimeAssembler` / `createRuntimeAssembler` (`kernel.ts:263`, `:270`) applies packs onto an
**already-live env** mid-run (the `(require/extension …)` path), versus `assembleEnv`'s build-once:

- **Idempotent + single-flight**: a second `require` of a pack — or a concurrent one from a parallel
  HOF arm — awaits the one in-flight apply (`kernel.ts:264-265`, `:276-289`). The `applied` map keys
  by name (presence = APPLYING|APPLIED); a rejecting apply **deletes its entry so a re-require may
  retry** (`kernel.ts:273`, `:283`).
- Deps applied first in C3 order; a pack reached two ways applies once (`kernel.ts:262`, `:291-295`).
- Disposers collected for a single LIFO `dispose()` (`kernel.ts:266-267`, `:297-305`).

## How capabilities lower to env-packs

`EnvCapability` (`capability.ts:108`) is the authoring shape — **"the ONE shape every palette pack
uses"** (`capability.ts:1`): a module singleton, inheritance-free closed taxonomy of 5 spec keys,
configured by composition (`capability.ts:1-12`). `CapabilitySpec` keys (`capability.ts:77`):
`configuration` (zod), `resources`, `prelude`, `symbolPrefix`, `resolvers`, `deps`, `symbols`.

`EnvCapability.lower(opts)` (`capability.ts:116`) → a `LoweredPack` (= `EnvPack<SchemeEnv>` plus
`windDown`/`resume`, `capability.ts:23`):

- Parses `config` against `configuration` zod schemas (`capability.ts:119-120`).
- Wraps `resources` as ref-counted `ResourceCell`s; first touch of any symbol spawns all the
  capability's resources, single-flight, before the method body (`capability.ts:122-136`, `:165-173`).
- **`deps` → `spec.deps.map(d => d.lower({ ...same config }))`** — the capability DAG edge lowers to
  a pack DAG edge, with config reference-shared down the dep chain (`capability.ts:144`).
- `apply` (`capability.ts:154`): wires `symbols` (membrane-wrapping `env.defineRosetta` /
  `env.set`, prefixed by `symbolPrefix`), registers `resolvers`, then evals `prelude` via the
  injected `evalScheme` (`capability.ts:154-183`).

## DAG assembly at the consumer

`buildArrivalEnv` (`project.ts:64`) is the production consumer:

1. `base = sandboxedEnv.inherit(opts.name)` — the membrane-sandboxed floor (`project.ts:70`).
2. `arrivalCapabilities().map(cap => cap.lower({ config: opts, evalScheme: exec }))` — lower every
   capability with the **shared `opts`** (`project.ts:80-82`).
3. Append `arrivalLoaderCorePack(opts)` **only when a vfs is granted** — capability withholding by
   absence: a loader-less env has no `require` symbol at all (`project.ts:83-86`).
4. `await assembleEnv(base, packs)` (`project.ts:87`).

## Capability scoping

The DAG is scoped by choosing a **root-set**:

- `arrivalCapabilities()` (`packs/index.ts:27`) — the default root-set. `arrivalAgenticCapability`
  deps on infer + mcp and configures both via shared config, so rooting it pulls them into the
  closure (the `agentic→{infer,mcp}→derive` diamond C3 dedups, `packs/index.ts:21-41`).
- `discoveryCapabilities()` (`packs/index.ts:51`) — the [[discovery-action-tiers]] **read tier**:
  source reads + run launchers + provenance reflection, **deliberately no infer, no loader-core** —
  "the only way to run is to NAME a file" (`packs/index.ts:44-53`).
- "Capability scoping = assemble a SUBSET" — e.g. `[arrivalUtilsCapability]` for a pure-compute
  sandbox (`packs/index.ts:18-19`, `project.ts:69`).

`loader-core` stays a **raw `EnvPack`, not a capability, by necessity** — its `require` rosetta
closes over per-env mutable state (single-flight `inflight` cache, cycle stack, dir stack) and
needs the live-env `RuntimeAssembler` at wire time, which the declarative capability surface does not
provide (`packs/index.ts:72-79`).

## Base stdlib as packs

`BASE_PACKS` (`base-packs.ts:21`) recasts the scheme stdlib (`scheme/*` + `arrival/core-extensions`)
as a capability set; `initBridge` `assembleEnv`s them onto `user_env`, replacing "the legacy
hand-concatenated prelude string" (`base-packs.ts:1-12`). `scheme/core` is the precedence floor; the
base preludes are verified mutually order-independent, so C3 order is immaterial there
(`base-packs.ts:7-12`).

## Resource lifecycle (cross-reference)

Lowered packs carry `windDown()`/`resume()` over their resource cells (`capability.ts:23-28`,
`:146-153`), backed by `ResourceCell` — a re-acquirable cycle around TC39
`Symbol.asyncDispose` giving lazy spawn, parallel acquire, and reconstruction
(`arrival/arrival/src/env/resources.ts:1-16`).
