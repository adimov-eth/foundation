---
title: require / import Loader (reconstructed)
layer: history
status: in-review
tags: [history, reconstructed, arrival-chain, loader]
canonical-for: []
source-provenance:
  origin: docs/working-proposals/todo/require-import-loader.md
  branch: lost — not in tree nor origin/tmp-6164624 Archive
  retrieved: reconstructed 2026-06-18
  authority: derived
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
code-anchors:
  - arrival/arrival-chain/src/loader.ts:1     # module header, design summary
  - arrival/arrival-chain/src/loader.ts:62    # ResolverResult: load | eval | value
  - arrival/arrival-chain/src/loader.ts:87    # Loader interface (resolve/read/resolvers)
  - arrival/arrival-chain/src/loader.ts:106   # normalizePath — the traversal jail
  - arrival/arrival-chain/src/loader.ts:205   # defaultResolvers (.scm/.json/.txt/.hbs)
  - arrival/arrival-chain/src/loader.ts:302   # makeProjectLoader + versionSet pinning
  - arrival/arrival-chain/src/loader.ts:348   # defineRequireRosetta — single-flight, cycles
---

> ⚠️ **RECONSTRUCTION — not the original.** The original `docs/working-proposals/todo/require-import-loader.md` is lost everywhere (see [[dangling-doc-map]]). This note is reverse-engineered from the code it governed, anchored to `file:line`. Fidelity: **high** — `loader.ts:1-32` is a near-complete design summary that names this proposal. It records what the doc *must have specified* given the implementation — not its original wording.

# require / import Loader (reconstructed)

The proposal replaced the **old textual-splice `resolveRequires`** with `require` as an ordinary **runtime rosetta** (`loader.ts:1-9`). On `(require specifier)` the rosetta: resolves the specifier against a `Loader`, reads the file, turns its bytes into a value/forms via an extension resolver, and either **spills** the module's defines into the run env (`.scm` — `load` semantics) or **returns a value** (data / template). Part of [[arrival-chain]]. Extension registration is the sibling proposal [[require-as-capability-and-prompt-support.reconstructed]].

## The Loader capability

`Loader` (`loader.ts:87-96`) is three things:

- `resolve(specifier, fromDir)` — **pure path math**: specifier resolved against the importing module's dir → canonical root-relative key; throws on escape above root.
- `read(path)` — the **one IO call + the jail**; throws (located) if the key isn't in the root.
- `resolvers: Map<string, ExtensionHandler>` — suffix → terminal handler (runtime `resolve` + optional editor `type`). Longest matching suffix wins.

Loaders are pluggable: a project VFS by default, a real/virtual FS, or disabled (`loader.ts:5-6`). `makeProjectLoader` confines to a Project's flat key space (`loader.ts:302`); `loaderFromResolver` wraps a legacy `path → source` CLI `--file` resolver (`loader.ts:327`).

## Resolution kinds

`ResolverResult` is a tagged union (`loader.ts:62-65`):

- `load` → `execExpr` each form into the run env (spill); `require` returns ⊥ (`.scm`, R5RS `load` semantics).
- `eval` → `execExpr` the forms, return the **last** value (e.g. an `.hbs` render lambda).
- `value` → return the plain, membrane-safe value; the caller binds it explicitly with `(define x (require …))`. A data file's binding is then as greppable/provenance-clear as an import (`loader.ts:53-61`).

The default registry (`loader.ts:205-256`): `.scm` → load; `.json/.yaml/.yml/.toml/.ndjson` → parse to value (`DATA_PARSERS`, `loader.ts:134-145`); `.txt` → string; `.hbs` → a synthetic `(lambda args (template/handlebars …))`. `.prompt` is intentionally absent (a capability registers it — see [[require-as-capability-and-prompt-support.reconstructed]]).

At the membrane, a `value` result is wrapped `jsToScheme`: JS arrays become scheme **lists**, plain objects become accessible records — which is *why the program needs no `json/parse` verb* (`loader.ts:409-419`).

## Statement-position, eager-sequential, but not globally sequential

- `require` is **statement-position** within a `.scm`: that file's forms are `execExpr`'d in order to completion, so a required file's `define-macro` is installed before the caller's next form expands (R5RS `load`, `loader.ts:13-16`).
- Requires are **not globally sequential**: `(map …)` evaluates its body in parallel (`promise_all`), so the same path can be `(require)`d concurrently by N iterations (`loader.ts:17-20`).

## Single-flight loading + cycle detection

The loader is **single-flight** (`loader.ts:355-357`): each resolved path loads **exactly once**; every later require — sequential repeat OR concurrent sibling — awaits that one promise. A flat in-flight Set would mis-read siblings #2…N as a cycle, breaking same-path fan-out (`loader.ts:18-20`).

Cycle detection is scoped to `.scm` (`load`) modules only (`loader.ts:360-372`): a re-entrant require of a path that is **mid-evaluation** (`evaluating` set / `loadingStack`) is a genuine R7RS cycle (a→b→a) and **throws** — awaiting its in-flight promise would deadlock (`loader.ts:381-383`). value/eval modules are require-graph **leaves** (cannot require during load), so they never enter the cycle domain (`loader.ts:21-25`). A failed load is **dropped from the cache** so the path can be retried, and the throw is annotated with the `requireChain` (`loader.ts:448-466`).

## The traversal jail (security boundary)

`resolve` normalizes posix paths relative to the importing module's dir and **rejects escapes above the root**; `read` only serves keys inside the root (`loader.ts:28-29`, `:102-125`). `normalizePath` drops `.`/empty segments, applies `..`, rejects NUL bytes, and `invariant`s that `..` can't pop above root (`loader.ts:106-119`). Implemented in pure posix (no `node:path`) to run in browser + worker + node (`loader.ts:102-103`).

## Version pinning (replay fidelity)

`makeProjectLoader(project, versionSet?)` (`loader.ts:288-324`):

- With `versionSet` (`{path → versionIndex}` captured at invoke-start via `Project.captureVersionSet`), `read` serves **exactly** that version of each file, so a multi-file run binds **one coherent cut** of the project for its whole duration — a concurrent `promoteDraft` on a required library can't tear an in-flight run, and a hypothesis replays the same bytes (`loader.ts:290-301`).
- Without `versionSet` (sandbox / draft / one-shot `runSource`), `read` serves the **latest** version — the right default for a live-edit loop.
- A path **missing** from a non-empty `versionSet` was created after the snapshot → requiring it is a legible error (`loader.ts:308-316`).

## Editor seam (the require type-lens)

Co-located with each runtime `resolve` is an optional `RequireTypeProvider` (`loader.ts:69-85`): given a required file's source, it synthesizes the TS type the lens gives `(require "path")`, in the lens dialect (`SStr`/`SNum`/`SBool`/`List<…>`/object literals). `valueToTsType` (`loader.ts:178-203`) walks the parsed value with depth/breadth guards, degrading to `unknown`. A **single registration teaches both** the runtime parse and the editor shape (same `DATA_PARSERS[ext]` on both sides), so the lens shape can never drift from the runtime value (`loader.ts:208-228`, `:271-286`).

## Shared-env cache lifetime

`defineRequireRosetta` returns a `clearCache()`. The single-flight `inflight` cache persists for the closure's life — fine within one run, but stale across runs of a **shared env** (a notebook kernel), where a `(require "config.scm")` would resolve its `define/overridable` holes once and never see a later override. A shared-kernel host calls `clearCache()` before each run; within-run single-flight is untouched (`loader.ts:335-346`, `:470-472`).

## What is NOT recoverable from code

- Whether `import` (the doc's title pairs require/import) was ever a separate verb — only `require` is implemented; no `import` rosetta is present in this extracted repo.
- The proposal's section numbering / sequencing of phases (it lived under `working-proposals/todo/`, suggesting it was a planning doc).
- The non-extracted backends/substrates ("folder/gh-repo substrates") the header anticipates (`loader.ts:29`) — referenced as future work, not present here.

See also [[arrival-chain]], [[require-as-capability-and-prompt-support.reconstructed]].
