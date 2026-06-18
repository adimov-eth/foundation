---
title: P1 — ci.yml checkout missing submodules:recursive
layer: backlog
status: fixed
fixed-in: claude/repair-workspace
validated-by: [".github/workflows/ci.yml"]
tags: [backlog, p1, ci, submodules]
canonical-for: []
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
---

# 03 · P1 · CI checkout does not fetch submodules

> ✅ Resolved in this repair pass (branch claude/repair-workspace). Added `submodules: recursive` to the `actions/checkout` step in `ci.yml`.

**Symptom.** The `CI` workflow checks out the repo without submodules, so the
`arrival/arrival/vendor/chibi-scheme` submodule (see
[[items/04-p1-chibi-scheme-submodule-uninit]]) is absent during build/typecheck. Any step that
needs the vendored chibi-scheme tree will fail or silently degrade. The sibling `test`
workflow does fetch submodules, so behaviour diverges between the two pipelines.

**Evidence (verified 2026-06-18).**
- `.github/workflows/ci.yml:13` — `- uses: actions/checkout@v4` with **no `with: { submodules
  }`** block.
- `.github/workflows/test.yml:16` — `submodules: recursive` (the correct pattern, present in
  the test workflow only).

**Root cause.** The `submodules: recursive` option was added to `test.yml` but never
back-ported to `ci.yml`.

**Proposed fix (not executed).** Add to the `actions/checkout@v4` step in `ci.yml`:

```yaml
      - uses: actions/checkout@v4
        with:
          submodules: recursive
```

**Effort.** S · **Risk.** low.
