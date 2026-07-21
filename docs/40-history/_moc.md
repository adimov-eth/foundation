---
title: History — map of content
layer: history
status: verified
tags: [history, moc]
canonical-for: []
last-verified: 2026-06-18
verified-against: origin/tmp-6164624
---

# History — map of content

This folder holds **frozen, dated copies** of historical and recovered design docs, vendored
verbatim from the unchecked-out branch `origin/tmp-6164624` (retrieved 2026-06-18). They all
carry **`authority: historical`**: they record *what was once written*, not current truth.

> ⚠️ Do not edit these notes toward current reality. They are immutable snapshots. When the
> code disagrees with a note here, the code (and its living reference/method notes) wins.
> Each archived note links *up* to the living note that supersedes it.

Every note below begins with a frozen-copy banner, carries a full `source-provenance` block
({origin, branch, retrieved, authority}), and reproduces its original content verbatim below a
`---` divider (the awareness example is the sole exception — it narrates extracted product code
rather than pasting it).

## Archived design docs

| Note | Origin | Living truth |
|---|---|---|
| [[membrane-design.archived]] | `tmp/Archive/arrival/arrival-scheme/docs/membrane-design.md` | [[membrane]] |
| [[sandbox-security-model.archived]] | `tmp/Archive/arrival/arrival-scheme/docs/sandbox-security-model.md` | [[membrane]], [[security-by-deletion]] |
| [[field-access-design.archived]] | `tmp/Archive/arrival/arrival-scheme/docs/field-access-design.md` | [[membrane]] |
| [[r7rs-compliance.archived]] | `tmp/Archive/arrival/arrival-scheme/docs/R7RS-COMPLIANCE.md` | [[arrival]] |
| [[mcp-refactor.archived]] | `tmp/Archive/arrival/arrival-mcp/docs/mcp-refactor.md` | [[arrival-mcp]] |
| [[fragmentation-hypothesis.archived]] | `tmp/Archive/docs/research/fragmentation-hypothesis.md` | [[fragmentation-hypothesis]] |

## Prior audit

| Note | Origin | Living reconciliation |
|---|---|---|
| [[prior-audit/hermes-analyses.archived]] | `tmp/hermes_analyses.md` | [[source-layers]] |
| [[prior-audit/awareness-usage-example]] | `tmp/awareness.ts` (narrated, not pasted) | [[source-layers]] |

All entries above are dated 2026-06-18 and frozen at branch `origin/tmp-6164624`.

## Reconstructed design docs (derived)

A distinct category from the frozen copies above: **17 code-grounded reconstructions** of docs that
are *lost everywhere* (not in the tree, not in the Archive). They carry **`authority: derived`** —
reverse-engineered from the code each doc governed, not reproduced from surviving text. See
[[reconstructed/_moc]] for the full map (original doc → reconstruction → fidelity → living note) and
[[dangling-doc-map]] for the referencing ledger.

> ⚠️ Reconstructions record what a doc *must have specified* given the implementation — not its
> original wording. Where code and a reconstruction disagree, the code wins.
