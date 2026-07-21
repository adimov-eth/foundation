---
title: P2 — arrival README still names arrival-scheme
layer: backlog
status: fixed
fixed-in: pending-pr
validated-by:
  - "README stale-ref check: no stale arrival-scheme runtime README references"
tags: [backlog, p2, docs, drift]
canonical-for: []
last-verified: 2026-06-18
verified-against: repair/extraction-hygiene
---

# 05 · P2 · README rename drift (`arrival-scheme` → `arrival`)

**Status.** Fixed in `pending-pr`.

**Original symptom.** The package was renamed to `@here.build/arrival` but its README still
presented the old `@here.build/arrival-scheme` name in the title and install/import examples,
so copy-pasting the docs installed/imported a package that no longer exists under that name.

**Original evidence.**

- `arrival/arrival/package.json:2` — `"name": "@here.build/arrival"` (current truth).
- `arrival/arrival/README.md:1` — stale title `# @here.build/arrival-scheme`.
- stale example lines used `@here.build/arrival-scheme`.
- `arrival/arrival-serializer/README.md` also named `@here.build/arrival-scheme` as the Scheme
  runtime dependency.
- `arrival/arrival-scheme-env-ramda/README.md` and
  `arrival/arrival-scheme-env-infer/README.md` linked to the missing
  `../arrival-scheme/README.md` path.

**Root cause.** Incomplete rename — see [[version-drift]]. The package directory and
`package.json` were updated before the READMEs and lockfile were reconciled.

**Fix applied.**

- Updated `arrival/arrival/README.md` title and install/import examples to `@here.build/arrival`.
- Updated `arrival/arrival-serializer/README.md` runtime dependency references to
  `@here.build/arrival`.
- Repointed scheme-env README links to `../arrival/README.md`.
- The lockfile half was fixed in [[items/01-p0-install-frozen-lockfile]].

**Validation.** The README grep check reports:

```text
no stale arrival-scheme runtime README references
```

**Effort.** S · **Risk.** low.
