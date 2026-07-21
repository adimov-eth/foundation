---
title: Add a scheme env pack
layer: reference
status: verified
tags: [playbook, arrival, env-pack]
canonical-for: []
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
code-anchors:
  - arrival/arrival-scheme-env-ramda/src/index.ts:80   # minimal symbols-only pack
  - arrival/arrival-scheme-env-infer/src/derive.ts:60  # config-less algebra pack
  - arrival/arrival-scheme-env-infer/src/infer.ts:127  # config-bearing pack with deps
  - arrival/arrival-scheme-env-infer/src/mcp.ts:356    # dependent pack (deps on two caps)
---

# Add a scheme env pack

Recipe for defining an `EnvCapability` / palette pack and rooting it into a scheme env. A pack is
an opt-in bundle of verbs (and optionally config/resource/deps) a host adds to a scope. Models:
the symbols-only [[arrival-scheme-env-ramda]] and the config-bearing, multi-capability
[[arrival-scheme-env-infer]]. The base interpreter is [[arrival]].

Terms: [[glossary#membrane]], [[glossary#rosetta]].

## 1. Choose the pack shape

| Shape | When | Template |
|---|---|---|
| symbols-only | pure JS verbs, no host wiring | `arrival/arrival-scheme-env-ramda/src/index.ts:80` |
| config-less algebra | pure value constructors/transforms, no resolver | `arrival/arrival-scheme-env-infer/src/derive.ts:60` |
| config-bearing | a verb needs a host-injected seam (an `InferFn`-like resolver) | `arrival/arrival-scheme-env-infer/src/infer.ts:127` |
| dependent | extends other caps; `deps: [...]` so assemble linearizes them first | `arrival/arrival-scheme-env-infer/src/mcp.ts:356` |

## 2. Define the capability

```ts
import { EnvCapability } from "@here.build/arrival/capability";

export default new EnvCapability("scheme/my-pack", {
  symbols: { "my-verb": { type: "(x: unknown): unknown", fn: (x) => /* … */ } },
});
```

- **Name** the capability with a stable string id (`"scheme/ramda"`,
  `arrival/arrival-scheme-env-ramda/src/index.ts:80`; `"arrival/infer"`,
  `arrival/arrival-scheme-env-infer/src/infer.ts:127`).
- **Symbols** are either `{ type, fn }` verbs or `{ value }` bindings (`mcp/break` is a bound
  value — `arrival/arrival-scheme-env-infer/src/derive.ts:127`). Use `withContext: true` when the verb needs the eval
  context, and `options: { provenancePoint: true }` to make it a provenance node
  (`arrival/arrival-scheme-env-infer/src/infer.ts:133`).
- Offer aliases when the pack is a vocabulary (`prop`/`get`/`access`/`fetch` →
  `R.prop`, `arrival/arrival-scheme-env-ramda/src/index.ts:11`).

## 3. Wire host config (only if a verb needs a seam)

Declare a `configuration` schema and read it via `this.configuration.*` inside the verb. The host
arms it at assembly time; absent config, ship a **disarmed default that throws a teaching error**,
never a silent no-op (the `inertMcpResolver` pattern, `arrival/arrival-scheme-env-infer/src/mcp.ts:134`).

```ts
new EnvCapability("arrival/infer", {
  configuration: { infer: z.custom<InferFn>() },
  deps: [arrivalDeriveCapability],
  symbols: { infer: { withContext: true, async fn(ctx, model, prompt) {
    return inferList(await this.configuration.infer(ctx, /* … */));
  } } },
});
```

Make optional config `.optional()` so the pack roots inert until armed
(`arrival/arrival-scheme-env-infer/src/mcp.ts:314`).

## 4. Declare deps for dependent packs

If a verb references another pack's symbol, `deps: [thatCapability]` so assemble brings it into
scope and linearizes it first. The infer cluster orders `derive → infer → mcp/agentic`
(`arrival/arrival-scheme-env-infer/src/index.ts:6`); the agentic pack `deps: [infer, mcp]`
(`arrival/arrival-scheme-env-infer/src/mcp.ts:361`).

## 5. Mind the dependency edge

A pack must depend only **down**: an env pack may stand on the engine layer
(`@here.build/arrival-inference`) but must NOT import `arrival-chain` — the edge runs
**chain → here, never back** (`arrival/arrival-scheme-env-infer/src/index.ts:6`). This is the whole reason a pack is its
own package: it isolates a dependency out of the chain core.

## 6. Root it and tree-shake when unused

Rooting the capability IS the opt-in — a scope that doesn't want it simply doesn't list it. Aim
for the pack to drop out of bundles when unrooted (the ramda pack intends `sideEffects:false`;
verify the manifest actually declares it — see [[arrival-scheme-env-ramda]]).

## 7. Document + index

Add a package reference note named exactly after the directory and link it from
[[10-reference/packages/_moc|the package index]].
