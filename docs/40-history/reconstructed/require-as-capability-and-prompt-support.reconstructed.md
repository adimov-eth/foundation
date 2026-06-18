---
title: require as Capability and .prompt Support (reconstructed)
layer: history
status: in-review
tags: [history, reconstructed, arrival-chain, loader, capability]
canonical-for: []
source-provenance:
  origin: docs/working-proposals/require-as-capability-and-prompt-support-2026-06-15.md
  branch: lost — not in tree nor origin/tmp-6164624 Archive
  retrieved: reconstructed 2026-06-18
  authority: derived
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
code-anchors:
  - arrival/arrival-chain/src/loader-extensions.ts:1   # file-type resolver registry, module header
  - arrival/arrival-chain/src/loader-extensions.ts:28  # RESOLVERS: suffix → resolver-verb NAME
  - arrival/arrival-chain/src/loader-extensions.ts:49  # registerExtension, conflict-throws
  - arrival/arrival-chain/src/loader-extensions.ts:62  # lookupExtensionResolver, longest-suffix
  - arrival/arrival-chain/src/loader-extensions.ts:90  # defineRegisterExtensionRosetta (bootstrap)
  - arrival/arrival-chain/src/loader-extensions.ts:102 # sealRegisterExtension (throwing stub)
  - arrival/arrival-chain/src/loader.ts:389            # registry overlay + late-bind in require
  - arrival/arrival-chain/src/packs/ext-prompt.ts:33   # ext/prompt capability + prelude register
---

> ⚠️ **RECONSTRUCTION — not the original.** The original `docs/working-proposals/require-as-capability-and-prompt-support-2026-06-15.md` is lost everywhere (see [[dangling-doc-map]]). This note is reverse-engineered from the code it governed, anchored to `file:line`. Fidelity: **high** — `loader-extensions.ts` carries unusually dense design comments (lines 1–26 plus per-function docs) that name this proposal and its §7 directly. It records what the doc *must have specified* given the implementation — not its original wording, nor rationale not evidenced in code.

# require as Capability and .prompt Support (reconstructed)

The proposal added a **file-type resolver registry** behind the `(require/register-extension)` verb, and used it to make `.prompt` (dotprompt) a *capability-granted* file type rather than a loader builtin. It is part of [[arrival-chain]]'s `require` loader (see [[require-import-loader.reconstructed]] for the loader proper). The dense module header at `loader-extensions.ts:1-26` and the §7 references at `loader-extensions.ts:7` and `loader.ts:389` are the primary evidence.

## §1 — What a file-type extension is

An "extension" is **not a verb-pack to assemble** — it is a *resolver*, whose only contract is a function `(contents, filepath) → value` (`loader-extensions.ts:3-5`). Registering one is therefore just mutating a table keyed by file-suffix → the **NAME** of the resolver verb that handles it (`loader-extensions.ts:28-32`):

```
const RESOLVERS = new Map<string, string>();   // ".prompt" → "ext/prompt/resolve"
```

## §2 — By-name, late-bound, per-env resolution (the core idea)

The table stores the resolver verb's **name**, not its value (`loader-extensions.ts:10-16`). On hitting a `.X` file, `require` looks the name up in the **current env** and calls it (`loader.ts:389-407`):

```
const resolverName = lookupExtensionResolver(path);
const registered = resolverName === undefined ? undefined : env.get(resolverName, { throwError: false });
if (typeof registered === "function") result = await registered(contents, { path });
```

Consequences the doc must have argued:

- A resource-armed resolver (e.g. `.prompt` → `prompt/compile`/`ext/prompt/resolve`, which closes over the infer resource) picks up the **calling env's** resource — no captured closure, no cross-run leak through the process-global table (`loader-extensions.ts:11-14`).
- An env that **never rooted the owning capability** simply has no binding for the name, so requiring that extension errors. "**Global vocabulary, per-scope capability**" (`loader-extensions.ts:16`).
- The registry overlay **wins over** the loader's built-in table when the verb is bound; when the suffix is registered but the verb is *not* bound in this env, resolution **falls through** to the built-in handler table (`loader.ts:389-407`). Once a suffix is removed from `defaultResolvers`, that fallthrough naturally errors — which *is* the scoping guarantee.

## §3 — Registration shape, idempotence, conflict

`registerExtension(ext, resolverName)` normalizes the suffix to leading-dot form (`"hbs"` and `".hbs"` both → `".hbs"`, `loader-extensions.ts:41-43`) and coerces a quoted-symbol-or-string name argument (`loader-extensions.ts:36-38`). It is **idempotent for an identical (suffix, name) mapping** (the same capabilities always register the same names across runs) but a **different name for an already-claimed suffix throws** a legible error — never silent last-write-wins (`loader-extensions.ts:49-60`). Two capabilities claiming `.hbs` differently is treated as a real configuration bug.

Lookup is by **longest matching suffix**, so `.spec.json` can beat `.json` (`loader-extensions.ts:62-75`); returns `undefined` when nothing matches, leaving the caller to decide error vs. builtin fallthrough.

## §4 — Prelude-only registration, sealed mid-run (the capability-grant rationale)

`require/register-extension` is bound **only while capability preludes evaluate** (bootstrap) via `defineRegisterExtensionRosetta` (`loader-extensions.ts:90-98`). Once the env is handed to user code, `sealRegisterExtension` replaces it with a **throwing stub** (`loader-extensions.ts:102-109`). A running program therefore **cannot teach the loader a new file type mid-run**.

The doc framed this as the **wrong-state-impossible guarantee**, not a missing feature (`loader-extensions.ts:18-26`): a `.prompt`/`.hbs` resolver is a **capability grant** (it can run inference, read templates), not user data, so only a capability's prelude may install one. The verb name is `"require/register-extension"` (`loader-extensions.ts:78`); a test-only `__resetExtensionRegistryForTest()` clears the process-global table between cases (`loader-extensions.ts:113-115`).

## §5 / §7 — .prompt as the first real capability resolver

`.prompt` (dotprompt) is **not** a loader builtin: sealing one needs the **infer** resource (and, for an agentic `mcp:` prompt, MCP), so it is registered by the `ext/prompt` capability whose resolver closes over `this.configuration.{infer,mcp}` (`packs/ext-prompt.ts:1-9`, `:33-50`). Its prelude is exactly:

```
(require/register-extension ".prompt" "ext/prompt/resolve")
```

(`packs/ext-prompt.ts:49`). The resolver returns `{ kind: "value", value: sealedProc }`; `require`'s `jsToScheme` passes the native proc through untouched, so the call site binds it `(define run-x (require "x.prompt"))` and runs it `(run-x key :k v …)` (`packs/ext-prompt.ts:30-47`, and the value-path note at `loader.ts:409-419`). An env that never rooted `ext/prompt` has no `ext/prompt/resolve` binding, so requiring a `.prompt` there is a clean unbound-name error — never a silent ⊥ (`packs/ext-prompt.ts:6-9`). A bare loader deliberately ships **no `.prompt` fallback** in `defaultResolvers` (`loader.ts:250-254`).

The output schema is evaluated **lazily** against the live run env at the proc's first call (`packs/ext-prompt.ts:10-14`) — the deferral that lets prompt-sealing live as a capability rather than as loader-core plumbing.

## What is NOT recoverable from code

- The proposal's section numbering beyond §7 (only §7 is cited from code; §1–§6 above are reconstructed from the implementation, not from surviving headings).
- The original rationale prose / alternatives-considered. The `prompt/compile` verb name mentioned in the header comment (`loader-extensions.ts:12`) differs from the shipped `ext/prompt/resolve` (`packs/ext-prompt.ts:23`) — the comment likely predates the final binding name; both are recorded here.

See also [[require-import-loader.reconstructed]], [[arrival-chain]], [[arrival-mcp]].
