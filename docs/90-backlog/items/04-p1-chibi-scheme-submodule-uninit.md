---
title: P1 — chibi-scheme submodule uninitialized
layer: backlog
status: fixed
fixed-in: pending-pr
validated-by:
  - git submodule update --init --recursive
  - git submodule status
tags: [backlog, p1, submodules, vendor]
canonical-for: []
last-verified: 2026-06-18
verified-against: repair/extraction-hygiene
---

# 04 · P1 · chibi-scheme submodule is uninitialized

**Status.** Fixed operationally by documenting/bootstraping recursive submodule checkout; the
pinned submodule commit is unchanged.

**Original symptom.** The vendored `chibi-scheme` submodule was registered but not checked out.
Its working-tree directory existed but was empty, so anything depending on the vendored Scheme
implementation had nothing to read.

**Original evidence.**

```text
-97faa0bf2d123c558d7ab79216906567c44cb03c arrival/arrival/vendor/chibi-scheme
```

The leading `-` means the submodule was not initialized.

**Root cause.** The submodule was present in `.gitmodules`, but the working tree and one CI
workflow were checked out without `--recurse-submodules` / `submodules: recursive`.

**Fix applied.**

- Local bootstrap command verified:

  ```bash
  git submodule update --init --recursive
  git submodule status
  ```

- CI parity fixed in [[items/03-p1-ci-submodules-recursive]].
- `CLAUDE.md` now documents the bootstrap command for agents and humans.

**Validation.**

```text
 97faa0bf2d123c558d7ab79216906567c44cb03c arrival/arrival/vendor/chibi-scheme (0.7.3-1889-g97faa0bf)
```

**Effort.** S · **Risk.** low.
