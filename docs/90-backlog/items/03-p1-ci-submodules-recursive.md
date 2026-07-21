---
title: P1 — ci.yml checkout missing submodules:recursive
layer: backlog
status: fixed
fixed-in: pending-pr
validated-by:
  - python3 -c "assert 'submodules: recursive' in open('.github/workflows/ci.yml').read()"
tags: [backlog, p1, ci, submodules]
canonical-for: []
last-verified: 2026-06-18
verified-against: repair/extraction-hygiene
---

# 03 · P1 · CI checkout does not fetch submodules

**Status.** Fixed in `pending-pr`.

**Original symptom.** The `CI` workflow checked out the repo without submodules, while the sibling
`Test` workflow did fetch submodules. That made pipeline checkout behavior diverge and left
`arrival/arrival/vendor/chibi-scheme` absent during CI build/typecheck/lint.

**Original evidence.**

- `.github/workflows/ci.yml` used `actions/checkout@v4` with no `with: submodules` block.
- `.github/workflows/test.yml` already used `submodules: recursive`.

**Root cause.** The recursive submodule checkout option was added to `test.yml` but not to
`ci.yml`.

**Fix applied.** Added recursive submodule checkout to the `CI` workflow:

```yaml
      - uses: actions/checkout@v4
        with:
          submodules: recursive
```

**Validation.**

```bash
python3 - <<'PY'
from pathlib import Path
p = Path('.github/workflows/ci.yml').read_text()
assert 'submodules: recursive' in p
print('ci submodule checkout ok')
PY
```

**Effort.** S · **Risk.** low.
