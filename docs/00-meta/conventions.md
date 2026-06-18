---
title: Vault conventions
layer: meta
status: verified
tags: [meta, conventions]
canonical-for: [vault-conventions, file-tree-contract, naming-convention]
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
---

# Vault conventions

This vault is **agent-first**: optimized for autonomous-agent consumption, human-browsable
second. These rules are the contract every note obeys.

## Naming

- Folders: `NN-kebab/` — the numeric prefix fixes reading order and explorer sort.
- Notes: `kebab-case.md`. Per-folder map-of-content note: `_moc.md` (sorts to top).
- Package reference notes are named **exactly after the package directory** so links are
  predictable: `arrival-chain.md`, `common-collections.md` (the `common/` packages are prefixed
  `common-`). Vault home: `index.md`.
- Vendored historical docs keep their original filename + `.archived.md` suffix (frozen copies).

## The file-tree contract

These note names are **fixed**. Author notes may link to any name below before its target is
finalized; links must resolve by the end of the link-reconciliation pass.

```
CLAUDE.md  (repo root, agent entry point)
docs/index.md
docs/_index/{packages,symbols,concepts,glossary,backlog,dangling-docs}.json
docs/00-meta/{conventions,front-matter-spec,agent-consumption-guide,glossary,tag-taxonomy,_moc}.md
docs/10-reference/{architecture-overview,_moc}.md
docs/10-reference/packages/{plexus,arrival,arrival-chain,arrival-inference,arrival-provenance,
  arrival-chain-view,arrival-sweet,arrival-mcp,arrival-serializer,arrival-env,
  arrival-scheme-env-infer,arrival-scheme-env-ramda,common-collections,common-error-invariant,
  common-lexical-namer,common-eslint-config,common-tsconfig,_moc}.md
docs/10-reference/cross-cutting/{crdt-state-model,membrane,determinism-and-effects,
  provenance-model,s-expressions-vs-json,discovery-action-tiers,_moc}.md
docs/20-method/{fragmentation-hypothesis,pattern-catalogue,operating-as-agentic-framework,
  transferability-guide,_moc}.md
docs/20-method/patterns/{discovery-action-separation,sexpr-over-json,batch-context-immutability,
  content-addressed-effects,provenance-as-first-class,security-by-deletion}.md
docs/50-playbooks/{add-a-provider-backend,add-a-syncing-field,run-a-pipeline,author-an-mcp-tool,
  trace-and-read-provenance,add-a-scheme-env-pack,_moc}.md
docs/30-reconciliation/{source-layers,source-ledger,dangling-doc-map,version-drift,_moc}.md
docs/40-history/{membrane-design,sandbox-security-model,field-access-design,r7rs-compliance,
  mcp-refactor,fragmentation-hypothesis}.archived.md
docs/40-history/{_moc}.md
docs/40-history/prior-audit/{hermes-analyses.archived,awareness-usage-example}.md
docs/90-backlog/{backlog-template,_moc}.md
docs/90-backlog/items/NN-pP-slug.md
```

## Canonical-here policy (the duplication guard)

Every concept has **exactly one** canonical home; everything else links to it.

- **Terms** → [[glossary]] (one line each). Never redefine a term inline; link `[[glossary#term]]`.
- **Cross-cutting mechanics** (CRDT, membrane, effects, provenance, S-expr bridge,
  Discovery/Action) → canonical in `10-reference/cross-cutting/*`. Package notes describe only
  *that package's participation* and link out.
- **The "why"** of a mechanic → canonical in `20-method/patterns/*`. Each cross-cutting note
  links to its pattern and back (Layer-1 ↔ Layer-2 spine: reference = *what*, method = *why*).
- **Historical docs** (`40-history/`) are never edited to current truth. Living notes link
  *down* to them ("superseded by [[…]]; original [[…archived]]").

Enforcement: each concept appears in exactly one note's `canonical-for` front-matter field. The
link-reconciliation pass asserts this.

## Anchoring facts

Every factual claim about the code carries a `path:line` anchor (e.g.
`arrival/arrival-inference/src/infer-store.ts:94`). Reference notes collect these in the
`code-anchors` front-matter field so `_index/symbols.json` can be derived mechanically. Claims
that cannot be verified against the working tree are marked **(unverified)**.

## Layers

- `layer: reference` — what exists (Layer 1).
- `layer: method` — why it works / transferable (Layer 2).
- `layer: meta | reconciliation | history | backlog` — supporting.
