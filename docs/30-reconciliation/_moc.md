---
title: Reconciliation — map of content
layer: reconciliation
status: verified
tags: [reconciliation, moc]
canonical-for: []
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
---

# Reconciliation

How this vault was reconstructed from sources of unequal authority, and what drifted between
the historical snapshot and current code.

- [[source-layers]] — the three inputs (current tree = authoritative; `tmp/Archive` =
  earlier/smaller universe; prior-audit + extracted example) and the conflict rule:
  current code wins, history is intent not truth.
- [[source-ledger]] — per-note provenance table (origin path · branch · retrieved · authority);
  auto-derivable from front-matter.
- [[dangling-doc-map]] — 19 in-code design-doc references: 2 recoverable, 17 lost everywhere.
- [[version-drift]] — Archive → current structural diff (renames, toolchain, +6 packages).

Back to [[index]].
