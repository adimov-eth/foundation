---
title: Reconstructed design docs — map of content
layer: history
status: in-review
tags: [history, reconstructed, moc]
canonical-for: []
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
---

# Reconstructed design docs — map of content

This folder holds **code-grounded reconstructions** of the design docs that were referenced from
the source tree but are **lost everywhere** — not in the working tree and not in the
`origin/tmp-6164624` Archive (see [[dangling-doc-map]]). They carry **`authority: derived`**:
unlike the [[40-history/_moc|vendored historical copies]] (which reproduce real surviving text),
these are *reverse-engineered from the code each doc governed*, anchored to `file:line`.

> ⚠️ **These are reconstructions, not originals.** Each records what its doc *must have specified*
> given the implementation — never the original wording, and never rationale not evidenced in code.
> Every note carries a prominent banner, a `derived` provenance block, and (where it was a plan/audit)
> an explicit "not recoverable from code" ledger. When code and a reconstruction disagree, the code
> (and its living reference/method note) wins.

**Fidelity legend:** **high** = the mechanism is present in code, often with dense comments;
**medium** = a point-in-time plan/audit, recovered as "what the resulting code shows was decided";
**low** = the governed concept is largely outside this extraction (partial stub).

## The 17 reconstructions

| Reconstruction | Original lost doc | Anchored from | Fidelity | Living note |
|---|---|---|---|---|
| [[arrival-chain-spec.reconstructed]] | `docs/spec/arrival-chain.md` | `AValue.ts:8,95`, `index.ts:25` | high (§5) / low (rest) | [[provenance-model]] |
| [[provenance-model-reference.reconstructed]] | `docs/foundations/arrival-scheme/reference/provenance-model.md` | `arrival-provenance/src/trace.ts:25` | high | [[provenance-model]] |
| [[trace-provenance-idempotence-fix.reconstructed]] | `docs/working-proposals/trace-provenance-idempotence-fix-2026-06-04.md` | `arrival-provenance/src/trace.ts:350` | medium | [[provenance-model]] |
| [[provenance-region-model-plan.reconstructed]] | `docs/working-proposals/provenance-region-model-plan-2026-06-02.md` | `trace-to-regions.ts:54`, `region-boundaries.ts:3` | high | [[provenance-model]] |
| [[language-design-foundations.reconstructed]] | `docs/foundations/arrival-scheme/language-design-foundations.md` | `arrival/README.md:20,139` | high | [[arrival]], [[membrane]] |
| [[boxing-track-plan.reconstructed]] | `docs/plan-2026-06-10-boxing-track.md` | `values/SchemeVector.ts:13`, `SchemeBytevector.ts:10` | medium | [[arrival]] |
| [[purity-pass-plan.reconstructed]] | `docs/plan-2026-06-11-purity-pass.md` | `env/core.ts:41`, `stdlib.ts:1092` | medium | [[determinism-and-effects]] |
| [[speculative-evaluation-promise-functor.reconstructed]] | `docs/working-proposals/speculative-evaluation-promise-functor-2026-06-05.md` | `values/HalfBaked.ts:3`, `bridge.ts:196` | high | [[arrival]] |
| [[env-pack-capability-dag.reconstructed]] | `docs/working-proposals/env-pack-capability-dag-2026-06-13.md` | `env/kernel.ts:7` | high | [[discovery-action-tiers]] |
| [[constraint-kernel-spec.reconstructed]] | `docs/CONSTRAINT-KERNEL-SPEC.md` (cited `sift/docs/…`) | `oracle/index.ts:4` | high | [[arrival]] |
| [[workplan-dag-audit.reconstructed]] | `docs/audit-2026-06-09-workplan-dag.md` | `oracle/scanner.ts:12` | medium | [[arrival]] |
| [[require-as-capability-and-prompt-support.reconstructed]] | `docs/working-proposals/require-as-capability-and-prompt-support-2026-06-15.md` | `arrival-chain/src/loader-extensions.ts:7` | high | [[arrival-chain]] |
| [[require-import-loader.reconstructed]] | `docs/working-proposals/todo/require-import-loader.md` | `arrival-chain/src/loader.ts:9` | high | [[arrival-chain]] |
| [[arrival-sweet-extension-design.reconstructed]] | `docs/working-proposals/arrival-sweet-extension-design-ideation-2026-06-15.md` | `reader/curly-infix.ts:12` | high | [[arrival-sweet]] |
| [[lexical-js-naming.reconstructed]] | `docs/proposals/in-flight/lexical-js-naming.md` | `arrival-chain-view/src/names.ts:3,95` | high | [[arrival-chain-view]] |
| [[arrival-resources.reconstructed]] | `docs/proposals/in-flight/arrival-resources.md` | `arrival-mcp/src/resources/index.ts:3` | high | [[arrival-mcp]] |
| [[ref-wiring-via-componentdataquery.reconstructed]] | `docs/proposals/in-flight/ref-wiring-via-componentdataquery.md` | `plexus/…/entity-keyed-map-references.test.ts:3` | low (stub) | [[crdt-state-model]] |

## Method

Each reconstruction was produced by opening the referencing site, reading the comment + the
implementation it points to, then reading the surrounding subsystem — every claim re-anchored to a
real `path:line` on `claude/vibrant-meitner-ask7xn`. Plan/audit docs separate code-evidenced facts
from "not recoverable from code." The originals remain lost; this recovers their *content shape*, not
their text. See [[dangling-doc-map]] for the full referencing ledger.
