---
title: Repair backlog — map of content
layer: backlog
status: verified
tags: [backlog, moc]
canonical-for: [repair-backlog]
last-verified: 2026-06-18
verified-against: repair/extraction-hygiene
---

# Repair backlog

Priority-ordered. Every item carries a verified `path:line` or command transcript (see
[[backlog-template]] for the item shape). Fixed items stay here as reconciliation evidence; they
are not deleted.

| # | Pri | State | Item | Symptom (short) | Effort | Risk |
|---|---|---|---|---|---|---|
| 01 | **P0** | fixed | [[items/01-p0-install-frozen-lockfile]] | stale lockfile blocked `pnpm install --frozen-lockfile` | L | med |
| 02 | **P0** | fixed | [[items/02-p0-ghost-workspace-packages]] | workspace listed 3 packages absent from tree | S | low |
| 03 | **P1** | fixed | [[items/03-p1-ci-submodules-recursive]] | `ci.yml` checkout missed `submodules: recursive` | S | low |
| 04 | **P1** | fixed | [[items/04-p1-chibi-scheme-submodule-uninit]] | chibi-scheme submodule needed recursive checkout/bootstrap | S | low |
| 05 | **P2** | fixed | [[items/05-p2-readme-rename-drift]] | arrival README still says `arrival-scheme` | S | low |
| 06 | **P2** | fixed | [[items/06-p2-serializer-console-error-leak]] | serializer `console.error` leaks object on circular ref | S | low |
| 07 | **P3** | fixed | [[items/07-p3-dangling-design-doc-refs]] | dangling design-doc references in code | M | low |
| 08 | **P1** | fixed | [[items/08-p1-lint-debt-after-install-repair]] | `turbo lint` now exits 0 with package-local legacy-debt suppressions | L | med |
| 09 | **P1** | fixed | [[items/09-p1-arrival-chain-view-type-lens-test]] | restored minimal type-lens fixture for `arrival-chain-view` bite tests | M | med |
| 10 | **P1** | fixed | [[items/10-p1-timing-sensitive-tests-under-load]] | replaced abort/fanout wall-clock gates with structural assertions | S | med |

## Legend

- **Priority** — P0 blocks build/install · P1 CI/repo integrity · P2 hygiene/correctness ·
  P3 documentation debt.
- **State** — `fixed` means repaired and validated in `repair/extraction-hygiene`; `open` means
  still planned in this repair branch.
- **Effort** — S small · M medium · L large.
- **Risk** — low · med · high (chance a fix regresses something).

Back to [[index]].
