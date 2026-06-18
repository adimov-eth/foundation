---
title: Workplan DAG Audit — 2026-06-09 (reconstructed)
layer: history
status: in-review
tags: [history, reconstructed, arrival, oracle, audit, workplan, dag]
canonical-for: []
source-provenance:
  origin: docs/audit-2026-06-09-workplan-dag.md
  branch: lost — not in tree nor origin/tmp-6164624 Archive
  retrieved: reconstructed 2026-06-18
  authority: derived
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
code-anchors:
  - arrival/arrival/src/oracle/scanner.ts:12  # the audit back-reference (Track O §2)
  - arrival/arrival/src/oracle/scanner.ts:1   # Layer S scanner header
  - arrival/arrival/src/oracle/scanner.ts:11  # O1 self-sufficient on comment depth
  - arrival/arrival/src/oracle/contract.ts:13 # Track A / Track B split
  - arrival/arrival/src/oracle/index.ts:8     # Σ (O2) and T (O3) attach later
  - arrival/arrival/src/oracle/sigma.ts:1     # Layer Σ (O2)
---

> ⚠️ **RECONSTRUCTION — not the original.** The original `docs/audit-2026-06-09-workplan-dag.md` is lost everywhere (see [[dangling-doc-map]]). This note is reverse-engineered from the code it governed, anchored to `file:line`. Fidelity: **medium** (an audit/workplan: much of its content is process and findings, only partially evidenced by code). It records what the doc *must have specified* given the implementation — not its original wording, nor rationale not evidenced in code.

# Workplan DAG Audit — 2026-06-09 (reconstructed)

## What the document was

The only surviving code reference is in `scanner.ts:11-13`, which cites it as
**"The integration plan (docs/audit-2026-06-09-workplan-dag.md, Track O §2)"**. So the document was
an **integration plan / workplan** structured as a **DAG of work tracks**, dated 2026-06-09. The
cited section is **Track O §2** — the work track for the [[arrival]] oracle (the constraint kernel,
see [[constraint-kernel-spec.reconstructed]]). The "DAG of work" it analyzed is the **dependency graph of oracle
build tracks and their staged nodes** (O0 → O1 → O2/Σ → O3/T).

> Audit-finding vs code: the document's *existence, type, date, and the Track-O §2 decision below*
> are code-evidenced (`scanner.ts:11-25`). The wider workplan (other tracks, scheduling, the full
> node DAG, the audit's findings on what was complete/blocked) is **not recoverable from code**.

## The work-track DAG it examined

The oracle is built as a staged DAG, named across the oracle sources:

- **O0** — the conformance corpus: arrival's S impl must agree with sift's reference `prefix-oracle.ts`
  on every shared structural field (`scanner.ts:30`, `:53`; `contract.ts:8`). This is the gate the
  later nodes build against.
- **O1** — the structural scanner (Layer S). The plan's Track O §2 decision (below) is about O1.
- **O2 / Σ** — bound-symbol masking, "attaches later" (`index.ts:8`, `sigma.ts:1`).
- **O3 / T** — types (`expectedType`/`produces`), "lands behind the same surface" later
  (`index.ts:8-10`, `scanner.ts:30-32`).

The Track A / Track B split (arrival implements, sift consumes) is the cross-track edge
(`contract.ts:13-15`) — evidence the workplan's DAG spanned both projects.

## The decisive Track O §2 finding (code-evidenced)

`scanner.ts:11-25` quotes the plan's Track O §2 directly and acts on it. The audited decision:

> **O1 "can be self-sufficient on comment depth" and "carry its own nesting counter (as the
> prototype does)"** (`scanner.ts:12-13`).

i.e. the workplan analyzed whether the oracle's O1 node should **reuse the existing `Lexer` FSM** or
be an **independent single-pass scanner**, and concluded the latter. The scanner header records the
verified reason that vindicates the plan (`scanner.ts:13-25`):

- The oracle is **defined on truncated input** (EOF is its normal case), but the real `Lexer`
  (`src/Lexer.ts`) **throws `Unterminated`** on exactly the truncated prefixes the oracle must report
  gracefully — e.g. `(foo "abc` (Lexer throws; oracle must report `{inString:true}`) and `#| open`
  (Lexer throws; oracle must report `{inComment:true}`) (`scanner.ts:14-18`).
- A bare paren inside an unterminated string is **data, not structure** — the oracle must know that,
  and the Lexer cannot tell because it crashes before yielding state (`scanner.ts:19-21`).
- Therefore O1 **ports the proven single-pass semantics of sift's `prefix-oracle.ts`** (the S-only
  reference) directly, carrying its own nesting counters (paren depth `depth`, block-comment depth
  `blockComment`) rather than the Lexer (`scanner.ts:21-25`, implemented `scanner.ts:98-197`).
- The genuinely-shared, non-crashing machinery it **does** reuse from arrival is `specials.names()`
  (the reader-macro set) — the plan's "share `specials.names()`" item (`scanner.ts:24-25`, `:51-57`).

This single-pass independence is what the scanner implements: `scan` is its own pure O(n) pass with
self-owned counters for string/comment/block-comment/paren state (`scanner.ts:92-222`), explicitly
NOT the Lexer FSM (`scanner.ts:10`).

## What the audit must have specified (inference)

Given the Track O §2 content, the workplan-DAG audit most plausibly specified, per track/node:
the node's **dependency edges** (what it builds on — e.g. O1 gates O2/O3; O0 gates all), its
**build-or-reuse decisions** (here: build-O1-independent vs reuse-Lexer), and its **acceptance gate**
(here: O0 corpus agreement with `prefix-oracle.ts`). The remainder of the DAG and the audit's
status findings are **not recoverable from code**.
