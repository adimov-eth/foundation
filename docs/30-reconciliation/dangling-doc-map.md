---
title: Dangling doc map
layer: reconciliation
status: verified
tags: [reconciliation, dangling-docs, backlog]
canonical-for: [dangling-doc-map]
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
---

# Dangling doc map

The pre-repair source tree referenced **19 design docs** that no longer shipped in the tree. Each
reference was an in-code comment pointing at a `docs/…` path that did not exist at that path.
Every referencing `path:line` below was verified by `grep` against the working tree on
2026-06-18, then fixed in [[90-backlog/items/07-p3-dangling-design-doc-refs]]. This note is the
historical reconciliation ledger, not a list of currently dangling refs.

> 📐 **Recovery:** all **17** lost docs below now have **code-grounded reconstructions** — each
> reverse-engineered from the code it governed and anchored to `file:line` — under
> [[reconstructed/_moc]] (`authority: derived`: *reconstructions, not originals*; they record what
> each doc *must have specified* given the implementation, not its original text).

Status legend:
- **RECOVERABLE** — the doc survives in `tmp/Archive` on `origin/tmp-6164624` and has been
  re-vendored into `40-history/`. The in-code refs now point at the archived copies.
- **LOST EVERYWHERE** — not in the tree and not in the Archive; the snapshot predates it
  (see [[source-layers]]). It survives only as the inline comment that names it.

## RECOVERABLE (2)

| Referenced doc | Referencing code (verified) | Recovered as |
|---|---|---|
| `docs/membrane-design.md` | `arrival/arrival/src/membrane.ts:15` | [[40-history/membrane-design.archived\|membrane-design.archived]] |
| `docs/sandbox-security-model.md` | `arrival/arrival/src/interop-access.ts:14` | [[40-history/sandbox-security-model.archived\|sandbox-security-model.archived]] |

## LOST EVERYWHERE (17)

The 17 lost docs survived only as inline comments. Pre-repair referencing `path:line` anchors were
verified by grep on 2026-06-18 before the comments were repointed to this ledger.

| Referenced doc | Referencing code (verified) |
|---|---|
| `docs/foundations/arrival-scheme/language-design-foundations.md` | `arrival/arrival/README.md:20` (also `:139`) |
| `docs/foundations/arrival-scheme/reference/provenance-model.md` | `arrival/arrival-provenance/src/trace.ts:25` |
| `docs/spec/arrival-chain.md` | `arrival/arrival/src/index.ts:25` (also `arrival/arrival/src/values/AValue.ts:8`, `:95`) |
| `docs/plan-2026-06-10-boxing-track.md` | `arrival/arrival/src/values/SchemeVector.ts:13` (also `SchemeBytevector.ts:10`) |
| `docs/plan-2026-06-11-purity-pass.md` | `arrival/arrival/src/env/core.ts:41` (also `arrival/arrival/src/stdlib.ts:1092`) |
| `docs/working-proposals/speculative-evaluation-promise-functor-2026-06-05.md` | `arrival/arrival/src/values/HalfBaked.ts:3` (also `arrival/arrival/src/bridge.ts:196`) |
| `docs/working-proposals/trace-provenance-idempotence-fix-2026-06-04.md` | `arrival/arrival-provenance/src/trace.ts:350` |
| `docs/working-proposals/provenance-region-model-plan-2026-06-02.md` | `arrival/arrival-provenance/src/trace-to-regions.ts:54` (also `region-boundaries.ts:3`) |
| `docs/working-proposals/env-pack-capability-dag-2026-06-13.md` | `arrival/arrival/src/env/kernel.ts:7` |
| `docs/working-proposals/arrival-sweet-extension-design-ideation-2026-06-15.md` | `arrival/arrival/src/reader/curly-infix.ts:12` |
| `docs/proposals/in-flight/lexical-js-naming.md` | `arrival/arrival-chain-view/src/names.ts:3` (also `:95`) |
| `docs/proposals/in-flight/arrival-resources.md` | `arrival/arrival-mcp/src/resources/index.ts:3` |
| `docs/proposals/in-flight/ref-wiring-via-componentdataquery.md` | `plexus/src/__tests__/2-entity-lifecycle/entity-keyed-map-references.test.ts:3` |
| `docs/audit-2026-06-09-workplan-dag.md` | `arrival/arrival/src/oracle/scanner.ts:12` |
| `docs/working-proposals/todo/require-import-loader.md` | `arrival/arrival-chain/src/loader.ts:9` |
| `docs/working-proposals/require-as-capability-and-prompt-support-2026-06-15.md` | `arrival/arrival-chain/src/loader-extensions.ts:7` |
| `docs/CONSTRAINT-KERNEL-SPEC.md` (cited as `sift/docs/…`) | `arrival/arrival/src/oracle/index.ts:4` |

## Why so many are lost

The 17 lost docs cluster in `arrival-chain`, `arrival-provenance`, `arrival-sweet`,
`arrival-chain-view`, `arrival-mcp/resources`, and the `oracle`/`env` subsystems of `arrival` —
all of which postdate the `origin/tmp-6164624` snapshot. The Archive is a smaller, earlier
universe and simply never contained them. See [[source-layers]] input #2.
