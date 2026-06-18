---
title: Cross-cutting concepts (map of content)
layer: reference
status: in-review
tags: [reference, cross-cutting, moc]
canonical-for: []
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
---

# Cross-cutting concepts

Canonical homes for mechanics that span >1 package. Package notes
([[10-reference/packages/_moc]]) describe only *their participation* and link here.
Each note links its "why" to a pattern in [[20-method/pattern-catalogue|patterns]] (reference =
*what*, method = *why*).

| Note | Owns (`canonical-for`) | Pattern (why) | Primary packages |
|---|---|---|---|
| [[crdt-state-model]] | crdt-state-model, shadow-main-doc, liminality, materialization | [[20-method/patterns/batch-context-immutability]] | plexus |
| [[membrane]] | membrane | [[20-method/patterns/security-by-deletion]] | arrival |
| [[determinism-and-effects]] | infer-store, single-flight, effect-log | [[20-method/patterns/content-addressed-effects]] | arrival-inference, arrival-chain |
| [[provenance-model]] | eval-trace, region-tree, reverse-chain-slice | [[20-method/patterns/provenance-as-first-class]] | arrival-provenance |
| [[s-expressions-vs-json]] | s-expressions, rosetta | [[20-method/patterns/sexpr-over-json]] | arrival-serializer, arrival-sweet, arrival-chain-view, arrival |
| [[discovery-action-tiers]] | discovery-action-tiers | [[20-method/patterns/discovery-action-separation]] | arrival-mcp |

See also [[architecture-overview]] for monorepo shape and dependency direction.
