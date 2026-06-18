---
title: Backlog item template
layer: backlog
status: verified
tags: [backlog, template]
canonical-for: []
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
---

# Backlog item template

> **This phase is documentation only. NOTHING in this backlog is executed.** No source is
> changed, no command is run, no fix is applied. The backlog records *what to do*, not a record
> of having done it. Each item is a verified observation plus a proposed fix.

Every item under `items/NN-pP-slug.md` carries this shape:

| Field | Content |
|---|---|
| **Symptom** | The observable defect, stated as what fails or what is wrong. |
| **Evidence** | One or more real `path:line` anchors, verified against the working tree at `claude/vibrant-meitner-ask7xn` on 2026-06-18. |
| **Root cause** | Why the symptom exists (the underlying mismatch). |
| **Proposed fix** | The change to make. Not made this phase. |
| **Effort** | `S` (small) · `M` (medium) · `L` (large). |
| **Risk** | `low` · `med` · `high` — blast radius / chance of regression. |

Priority prefix in the filename (`p0`–`p3`) and the [[_moc]] table set ordering:
**P0** = blocks build/install · **P1** = CI/repo integrity · **P2** = hygiene/correctness ·
**P3** = documentation debt.
