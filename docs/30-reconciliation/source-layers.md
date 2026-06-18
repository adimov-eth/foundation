---
title: Source layers
layer: reconciliation
status: verified
tags: [reconciliation, provenance, method]
canonical-for: [source-layers]
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
---

# Source layers

This vault is reconstructed from three inputs of unequal authority. Knowing which layer a
claim comes from is the difference between current truth and historical intent.

## The three inputs

### 1. Current working tree — AUTHORITATIVE

The checked-out tree at `claude/vibrant-meitner-ask7xn` (HEAD `af9a189`). This is the only
source that describes the code **as it actually is today**. Every factual `path:line` anchor
in the reference layer is verified against this tree. When this vault says "what exists", it
means this layer.

Current package universe: 11 `arrival/*` packages, 5 `common/*` packages, `plexus`.

### 2. `tmp/Archive` on branch `origin/tmp-6164624` — EARLIER, SMALLER universe

A frozen snapshot recovered from `git show origin/tmp-6164624:tmp/Archive/…`. It is **not**
present in the working tree; it lives only on that branch. It predates the current refactor and
describes a smaller world:

- Only **5 arrival packages**: `arrival` (then named `arrival-scheme`), `arrival-env`,
  `arrival-mcp`, `arrival-serializer`, and the original `arrival/arrival` dir.
  (`git ls-tree origin/tmp-6164624 tmp/Archive/arrival/`.)
- It **predates** the packages that now carry the system's most important seams:
  `arrival-chain`, `arrival-inference`, `arrival-provenance`, `arrival-sweet`,
  `arrival-chain-view`. The Archive has nothing to say about any of them.
- It still uses the pre-refactor layout: `commons/`, `configs/*`, the `arrival-scheme`
  package name. See [[version-drift]] for the full diff.

What this layer is good for: **recovering frozen design docs** that the current code still
references but no longer ships (e.g. `membrane-design.md`, `sandbox-security-model.md` —
these survive in the Archive and are re-vendored into `40-history/`). What it **cannot** do:
speak to any of the six newer packages or any design decision made after the snapshot.

### 3. `tmp/hermes_analyses.md` + `tmp/awareness.ts` — prior audit & extracted example

Also recovered from `origin/tmp-6164624:tmp/`.

- `tmp/hermes_analyses.md` — a prior deep-research audit of the repo. It independently
  identified the same headline defect this vault's backlog leads with: "`pnpm install
  --frozen-lockfile` fails: the lockfile is stale and references old/missing packages."
  Treated as corroborating evidence, never as primary truth. Re-vendored as
  `40-history/prior-audit/hermes-analyses.archived.md`.
- `tmp/awareness.ts` — an extracted product-usage example (Plexus Studio presence tracking
  built on Yjs Awareness). A real consumption example of the `plexus` surface, useful for the
  method layer. Re-vendored as `40-history/prior-audit/awareness-usage-example.md`.

## The conflict rule

> **When sources conflict, current code wins. History is intent, not truth.**

A design doc in the Archive describes what someone *meant* to build at snapshot time. The
working tree describes what *is*. If a `membrane-design.archived.md` claim contradicts
`arrival/arrival/src/membrane.ts`, the code is correct and the archived doc is stale by
definition — that is why historical notes are frozen and never edited to current truth
(see [[conventions]] "Canonical-here policy"). Living notes link *down* to history; history
never overrides up.

## See also

- [[40-history/_moc]] — the re-vendored historical docs themselves.
- [[dangling-doc-map]] — in-code references to design docs, scored recoverable vs lost.
- [[version-drift]] — the structural Archive→current diff.
- [[source-ledger]] — per-note provenance table.
