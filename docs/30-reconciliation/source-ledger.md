---
title: Source ledger
layer: reconciliation
status: verified
tags: [reconciliation, provenance]
canonical-for: [source-ledger]
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
---

# Source ledger

Every vendored or derived historical note in this vault, traced to its origin. All rows were
retrieved on **2026-06-18** from branch **`origin/tmp-6164624`** via `git show
origin/tmp-6164624:<origin>`. Existence of each origin path verified with `git cat-file -e`.

`authority`: `historical` = frozen Archive copy, never edited to current truth ·
`derived` = synthesized from a prior-audit source. See [[source-layers]] for the layer model.

| Vault note | Origin path (on branch) | Branch | Retrieved | Authority |
|---|---|---|---|---|
| [[40-history/membrane-design.archived\|membrane-design]] | `tmp/Archive/arrival/arrival-scheme/docs/membrane-design.md` | origin/tmp-6164624 | 2026-06-18 | historical |
| [[40-history/sandbox-security-model.archived\|sandbox-security-model]] | `tmp/Archive/arrival/arrival-scheme/docs/sandbox-security-model.md` | origin/tmp-6164624 | 2026-06-18 | historical |
| [[40-history/field-access-design.archived\|field-access-design]] | `tmp/Archive/arrival/arrival-scheme/docs/field-access-design.md` | origin/tmp-6164624 | 2026-06-18 | historical |
| [[40-history/r7rs-compliance.archived\|R7RS-COMPLIANCE]] | `tmp/Archive/arrival/arrival-scheme/docs/R7RS-COMPLIANCE.md` | origin/tmp-6164624 | 2026-06-18 | historical |
| [[40-history/mcp-refactor.archived\|mcp-refactor]] | `tmp/Archive/arrival/arrival-mcp/docs/mcp-refactor.md` | origin/tmp-6164624 | 2026-06-18 | historical |
| [[40-history/fragmentation-hypothesis.archived\|fragmentation-hypothesis]] | `tmp/Archive/docs/research/fragmentation-hypothesis.md` | origin/tmp-6164624 | 2026-06-18 | historical |
| [[40-history/prior-audit/hermes-analyses.archived\|hermes_analyses.md]] | `tmp/hermes_analyses.md` | origin/tmp-6164624 | 2026-06-18 | derived |
| [[40-history/prior-audit/awareness-usage-example\|awareness.ts]] | `tmp/awareness.ts` | origin/tmp-6164624 | 2026-06-18 | derived |

## Note

This table is currently hand-authored, but it is fully redundant with the
`source-provenance: {origin, branch, retrieved, authority}` front-matter block carried by each
vendored note (see [[front-matter-spec]]). Once every `40-history/*` note carries that block,
this ledger can be **auto-derived** by scanning front-matter — the link-reconciliation pass
should regenerate it rather than trusting the hand copy.
