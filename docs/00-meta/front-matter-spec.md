---
title: Front-matter spec
layer: meta
status: verified
tags: [meta, conventions, schema]
canonical-for: [front-matter-schema]
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
---

# Front-matter spec

Every note begins with YAML front-matter. Fields:

| Field | Required | Values / shape | Purpose |
|---|---|---|---|
| `title` | yes | string | human title |
| `layer` | yes | `reference \| method \| meta \| reconciliation \| history \| backlog` | which layer |
| `status` | yes | `draft \| in-review \| verified` | authoring state |
| `tags` | yes | list (from [[tag-taxonomy]]) | retrieval |
| `canonical-for` | yes | list of concept slugs this note OWNS (may be empty) | duplication guard |
| `source-provenance` | history/derived only | `{origin, branch, retrieved, authority}` | where it came from |
| `last-verified` | yes | ISO date | when claims were last checked |
| `verified-against` | yes | git ref/branch | what they were checked against |
| `code-anchors` | reference notes | list of `path:line` (key symbols/seams) | feeds `_index/symbols.json` |

`authority`: `authoritative` (current code) · `historical` (frozen Archive copy) · `derived`
(synthesized from sources).

## Example (reference note)

```yaml
---
title: arrival-inference
layer: reference
status: verified
tags: [package, arrival, inference, cross-cutting]
canonical-for: []
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
code-anchors:
  - arrival/arrival-inference/src/infer-store.ts:94   # Cell single-flight
  - arrival/arrival-inference/src/registry.ts:16      # ModelRouter
---
```

## Example (vendored historical note)

```yaml
---
title: Membrane design (archived)
layer: history
status: verified
tags: [history, arrival, membrane, security]
canonical-for: []
source-provenance:
  origin: tmp/Archive/arrival/arrival-scheme/docs/membrane-design.md
  branch: origin/tmp-6164624
  retrieved: 2026-06-18
  authority: historical
last-verified: 2026-06-18
verified-against: origin/tmp-6164624
---
```
