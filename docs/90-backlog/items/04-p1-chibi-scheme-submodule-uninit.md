---
title: P1 — chibi-scheme submodule uninitialized
layer: backlog
status: partial
fixed-in: claude/repair-workspace
validated-by: [".github/workflows/ci.yml", "CLAUDE.md"]
tags: [backlog, p1, submodules, vendor]
canonical-for: []
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
---

# 04 · P1 · chibi-scheme submodule is uninitialized

> ✅ Resolved in this repair pass (branch claude/repair-workspace). CI now inits it (`ci.yml` + `test.yml` `submodules: recursive`) and CLAUDE.md documents the local bootstrap; the gitlink itself is unchanged (init is a checkout, not a commit) — hence `partial`.

**Symptom.** The vendored `chibi-scheme` submodule is registered but not checked out. Its
working-tree directory exists but is empty, so anything depending on the vendored Scheme
implementation has nothing to read.

**Evidence (verified 2026-06-18).**
- `git submodule status` →
  `-97faa0bf2d123c558d7ab79216906567c44cb03c arrival/arrival/vendor/chibi-scheme`. The leading
  `-` means the submodule is **not initialized**.
- `.gitmodules` declares it:
  `path = arrival/arrival/vendor/chibi-scheme`,
  `url = https://github.com/ashinn/chibi-scheme.git`.
- `ls arrival/arrival/vendor/chibi-scheme/` → empty directory (no files).

**Root cause.** The submodule was added to `.gitmodules` but the working tree was checked out
without `--recurse-submodules`, and CI does not init it either (see
[[items/03-p1-ci-submodules-recursive]]).

**Proposed fix (not executed).** Run `git submodule update --init --recursive`, and document
the requirement in the repo setup instructions / `CLAUDE.md`. Fixing
[[items/03-p1-ci-submodules-recursive]] covers the CI side.

**Effort.** S · **Risk.** low.
