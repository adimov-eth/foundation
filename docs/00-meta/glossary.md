---
title: Glossary
layer: meta
status: in-review
tags: [meta, glossary]
canonical-for: [glossary]
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
---

# Glossary

Canonical one-line definitions. Notes link here (`[[glossary#term]]`) instead of redefining.
Each term points to the note that develops it.

## CRDT / Plexus

- **CRDT** — Conflict-free Replicated Data Type; data that merges deterministically across peers. → [[crdt-state-model]]
- **Yjs** — the CRDT library Plexus is layered on. → [[crdt-state-model]]
- **Plexus** — the instance that owns a document root and orchestrates sync/undo/liminality. → [[plexus]]
- **PlexusModel** — base class whose `@syncing` fields *are* the CRDT state. → [[plexus]]
- **`@syncing`** — decorator marking a class/field as replicated. → [[plexus]]
- **shadow doc / main doc** — Plexus's two-Y.Doc architecture: working copy (shadow) vs committed store (main). → [[crdt-state-model]]
- **liminality** — holding ephemeral gesture writes on a shadow doc, committed as one atomic delta / undo step. → [[crdt-state-model]]
- **virtual genesis** — deterministic, content-addressed spawning of conflict-free child entities. → [[plexus]]
- **materialization** — writing a model's state into the Yjs CRDT layer. → [[crdt-state-model]]

## Arrival — Scheme & membrane

- **arrival-scheme** — the sandboxed Scheme interpreter (package `@here.build/arrival`), forked from LIPS. → [[arrival]]
- **membrane** — the JS↔Scheme boundary exposing own-data only; the `@` interop form. → [[membrane]]
- **security-by-deletion** — sandboxing by removing host-reaching verbs (`eval`, `load`, …) at source. → [[security-by-deletion]]
- **rosetta** — automatic JS↔Scheme value conversion + `defineRosetta` for registering JS fns. → [[arrival]]
- **HalfBaked** — lazy Promise carrier used in speculative evaluation. → [[arrival]]
- **flat-trampoline evaluator** — generator-based, stack-safe evaluator (no recursion/promise chains). → [[arrival]]
- **S-expression** — symbolic expression; the Lisp data/code form. → [[s-expressions-vs-json]]

## Arrival — inference substrate

- **InferStore** — content-keyed single-flight cache for `(infer …)` calls. → [[determinism-and-effects]]
- **single-flight** — identical in-flight requests share one backend call. → [[determinism-and-effects]]
- **content-keyed cache** — cache key = content tuple `[model, prompt, schema, cacheKey]`. → [[content-addressed-effects]]
- **effect membrane / effect-log** — record/replay seam for external effects (infer/http/sql content-keyed; mcp positional). → [[determinism-and-effects]]
- **ModelRouter** — maps a model id/spec to a backend (`StaticRouter`, `LayeredRouter`, …). → [[arrival-inference]]
- **backend** — provider adapter (anthropic/openai/openrouter/ollama/vercel). → [[arrival-inference]]
- **agentic loop** — JS-side tool-call loop driving multi-turn inference. → [[arrival-inference]]
- **config-as-code** — per-run knobs shipped as a `config.scm` required by the entry program. → [[arrival-chain]]

## Arrival — provenance

- **EvalTrace / Invocation** — append-only observable record of an evaluation. → [[provenance-model]]
- **provenance** — per-value lineage set, computed at boundaries. → [[provenance-as-first-class]]
- **region tree / statechart / forest** — render-models derived from a trace. → [[provenance-model]]
- **reverse-chain slice** — sound program slice via Perera–Cheney uneval (invert the forward cone). → [[provenance-model]]

## Arrival — MCP & projection

- **MCP** — Model Context Protocol. → [[discovery-action-tiers]]
- **DiscoveryTool** — read tier: a sandboxed Scheme REPL over a capability's symbols. → [[arrival-mcp]]
- **ActionTool** — mutation tier: a validated batch of typed actions. → [[arrival-mcp]]
- **McpEnvCapability** — the shared env (symbols/config/resources) both tiers derive from. → [[arrival-mcp]]
- **Discovery/Action separation** — exploring without side effects vs mutating in immutable-context batches. → [[discovery-action-separation]]
- **sweet-expression** — readable surface for Scheme (`xs.map{ it * 2 }`), bidirectional. → [[arrival-sweet]]
- **chain-view** — deterministic projection of a chain program into JS/Python. → [[arrival-chain-view]]

## Meta / project

- **FSL-1.1-MIT** — Functional Source License; converts to MIT 2 years after release. → [[architecture-overview]]
- **fragmentation hypothesis** — agent drift as architecture-induced subprocess desync. → [[fragmentation-hypothesis]]
- **source layers** — current code (authoritative) / Archive / prior-audit, the three inputs to this vault. → [[source-layers]]
- **dangling doc ref** — an in-code reference to a design doc absent from the repo. → [[dangling-doc-map]]
