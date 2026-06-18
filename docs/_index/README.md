---
title: _index manifest
layer: meta
status: verified
tags: [meta, agent, schema]
canonical-for: [index-manifest]
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
---

# `_index/` — machine-readable fast-path

Structured maps for agents (cheap to load), **generated** from the vault notes + package source
by `build_index.py` and validated by `check.py` (both dependency-free, run from repo root). See
[[agent-consumption-guide]] for load order. Regenerate after editing notes:

```sh
python3 docs/_index/build_index.py && python3 docs/_index/check.py
```

| File | Shape | Use |
|---|---|---|
| `packages.json` | `{name, repo_path, note, summary, entrypoints[], deps[], code_anchors[]}` | every package: where it lives, what it is, its entrypoints + deps |
| `symbols.json` | `{symbol, kind, package, exported_from, declared_at, signature, note}` | **source-derived** public export index — "where is X?" → jump to source |
| `concepts.json` | `{concept: note}` | canonical owner of each concept (`canonical-for`) |
| `glossary.json` | `{slug, term, definition, see}` | term lookups; `slug` is the `[[glossary#slug]]` anchor |
| `backlog.json` | `{id, order, priority, slug, title, note}` | repair items (documented, not executed) |
| `dangling-docs.json` | `{ref, status, referenced_by, recovered_as}` | 18 in-code doc refs (2 recoverable, 16 lost) |

`symbols.json` is derived from each package's `src/index.ts` (explicit re-exports, `export *`
expansion, direct declares, aliases, type-only); multiline signatures are truncated with a
`(multiline)` marker; `note` records aliasing / `via export *`. Best-effort over `src/` only —
subpath-export-only symbols may be under-covered.
