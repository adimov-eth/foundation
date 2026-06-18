---
title: Repair backlog — map of content
layer: backlog
status: verified
tags: [backlog, moc]
canonical-for: [repair-backlog]
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
---

# Repair backlog

Priority-ordered. Every item carries a verified `path:line` (see [[backlog-template]] for the
item shape). **Nothing here is executed this phase — documentation only.**

| # | Pri | Item | Symptom (short) | Effort | Risk |
|---|---|---|---|---|---|
| 01 | **P0** | [[items/01-p0-install-frozen-lockfile]] | `pnpm install --frozen-lockfile` fails — lockfile stale | L | med |
| 02 | **P0** | [[items/02-p0-ghost-workspace-packages]] | workspace lists 3 packages absent from tree | S | low |
| 03 | **P1** | [[items/03-p1-ci-submodules-recursive]] | `ci.yml` checkout missing `submodules: recursive` | S | low |
| 04 | **P1** | [[items/04-p1-chibi-scheme-submodule-uninit]] | chibi-scheme submodule uninitialized | S | low |
| 05 | **P2** | [[items/05-p2-readme-rename-drift]] | arrival README still says `arrival-scheme` | S | low |
| 06 | **P2** | [[items/06-p2-serializer-console-error-leak]] | serializer `console.error` leaks object on circular ref | S | low |
| 07 | **P3** | [[items/07-p3-dangling-design-doc-refs]] | 18 dangling design-doc references in code | M | low |

## Legend

- **Priority** — P0 blocks build/install · P1 CI/repo integrity · P2 hygiene/correctness ·
  P3 documentation debt.
- **Effort** — S small · M medium · L large.
- **Risk** — low · med · high (chance a fix regresses something).

Back to [[index]].
