---
title: Repair backlog — map of content
layer: backlog
status: verified
tags: [backlog, moc]
canonical-for: [repair-backlog]
last-verified: 2026-06-18
verified-against: claude/repair-workspace
---

# Repair backlog

Priority-ordered. Every item carries a verified `path:line` (see [[backlog-template]] for the
item shape). Items 01–07 were **resolved on branch `claude/repair-workspace`** (see each item's
`validated-by`); items 08–10 are **newly-uncovered open items** that surfaced once the install was
fixed and CI could finally run the build/test/lint suite.

| # | Pri | State | Item | Symptom (short) | Effort | Risk |
|---|---|---|---|---|---|---|
| 01 | **P0** | fixed | [[items/01-p0-install-frozen-lockfile]] | `pnpm install --frozen-lockfile` fails — lockfile stale | L | med |
| 02 | **P0** | fixed | [[items/02-p0-ghost-workspace-packages]] | workspace lists 3 packages absent from tree | S | low |
| 03 | **P1** | fixed | [[items/03-p1-ci-submodules-recursive]] | `ci.yml` checkout missing `submodules: recursive` | S | low |
| 04 | **P1** | partial | [[items/04-p1-chibi-scheme-submodule-uninit]] | chibi-scheme submodule uninitialized | S | low |
| 10 | **P1** | open | [[items/10-p1-eslint9-flat-config-migration]] | ESLint 9 flat-config never done — `pnpm lint` repo-wide red | L | med |
| 05 | **P2** | fixed | [[items/05-p2-readme-rename-drift]] | arrival README still says `arrival-scheme` | S | low |
| 06 | **P2** | fixed | [[items/06-p2-serializer-console-error-leak]] | serializer `console.error` leaks object on circular ref | S | low |
| 08 | **P2** | open | [[items/08-p2-arrival-type-lens-test-dep]] | chain-view test reads non-extracted `arrival-type-lens` | S | low |
| 09 | **P2** | open | [[items/09-p2-arrival-chain-abort-unhandled-rejection]] | arrival-chain abort path leaves unhandled rejection | M | med |
| 07 | **P3** | fixed | [[items/07-p3-dangling-design-doc-refs]] | 18 dangling design-doc references in code | M | low |

## Legend

- **Priority** — P0 blocks build/install · P1 CI/repo integrity · P2 hygiene/correctness ·
  P3 documentation debt.
- **State** — fixed (resolved on `claude/repair-workspace`) · partial (mitigated, residue noted
  in-item) · open (newly-uncovered, not yet addressed).
- **Effort** — S small · M medium · L large.
- **Risk** — low · med · high (chance a fix regresses something).

Back to [[index]].
