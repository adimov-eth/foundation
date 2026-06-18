# `_index/` — machine-readable fast-path

Structured maps for agents (cheap to load, derived from note front-matter + content).
See [[agent-consumption-guide]] for load order. Regenerate after editing notes.

| File | Shape | Use |
|---|---|---|
| `packages.json` | `[{name, repo_path, note, role, code_anchors[]}]` | every package: where it lives + its note |
| `symbols.json` | `[{anchor:"path:line", note, comment}]` | "where is X?" → jump to source |
| `concepts.json` | `{concept: note}` | canonical owner of each concept |
| `glossary.json` | `[{term, definition, see}]` | term lookups |
| `backlog.json` | `[{id, order, priority, slug, title, note}]` | repair items (documented, not executed) |
| `dangling-docs.json` | `[{ref, status, referenced_by, recovered_as}]` | 18 in-code doc refs (2 recoverable, 16 lost) |

Validity (last run): all JSON parse; 243/243 symbol anchors resolve to real `file:line`;
all package paths and concept notes exist; dangling-docs = 2 recoverable + 16 lost.
