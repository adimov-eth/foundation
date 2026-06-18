---
title: Security by deletion
layer: method
status: draft
tags: [pattern, security, sandbox, membrane, scheme, arrival, agentic]
canonical-for: [security-by-deletion]
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
code-anchors:
  - arrival/arrival/src/stdlib.ts:838        # `.`/`get` host-reach verbs removed (host-language sweep)
  - arrival/arrival/src/membrane.ts:836       # readMember — own-data only, no interpreter internals
  - arrival/arrival/src/env/polyglot.ts:11    # @ / @? / @keys — the only blessed interop reads
  - arrival/arrival/README.md:158             # no filesystem/network/process/global primitives
---

# Security by deletion

> Pattern (the *why*). Reference (the *what*): [[membrane]]. Term:
> [[glossary#security-by-deletion]], [[glossary#membrane]].

## Problem

A sandbox built by *adding* checks around dangerous primitives is only as strong as the
completeness of its checks — every missed path is an escape. For an agent exploring freely in a
REPL ([[discovery-action-separation]]), any reachable host verb (`eval`, `load`, `system`,
filesystem, network) is both a security hole and a way for exploration to cause real, unintended
effects — which feeds back into [[fragmentation-hypothesis|state desync]].

## Mechanism

Don't guard the dangerous verbs — **remove them at source**. The interpreter is forked so that
host-reaching primitives simply do not exist in the Scheme-facing surface. The *only* way Scheme
reaches host data is through a narrow, audited membrane (`@` / `@?` / `@keys`) that exposes
own-data only and cannot reach interpreter internals. Absence is a stronger guarantee than a
guard: there is no codepath to miss.

## How this repo instantiates it

- The `.` / `get` host member-access verbs were **deleted** in the host-language sweep —
  `arrival/arrival/src/stdlib.ts:838` (Scheme now reaches host data only through `@`/`@?`/`@keys`).
- The membrane exposes own-data only; reading a non-record returns nil rather than leaking
  interpreter internals — `arrival/arrival/src/membrane.ts:836` (`readMember`).
- The blessed interop surface — `arrival/arrival/src/env/polyglot.ts:11` (`@` / `@?` / `@keys`).
- No filesystem / network / process / global primitives exist —
  `arrival/arrival/README.md:158`. See [[membrane]], [[arrival]].

## Why it counters drift

Deletion makes the read tier *architecturally* incapable of host effects, which is what lets
Discovery be genuinely side-effect-free in [[discovery-action-separation]]. Exploration can never
accidentally touch the host, so the explore→effect→panic cascade in the
[[fragmentation-hypothesis]] cannot start here. It also closes the security implication the
hypothesis raises: fewer boundaries to target.

## How to apply elsewhere

1. Prefer removing a capability to guarding it — make the dangerous verb non-existent in the
   agent-facing surface.
2. Funnel all host access through one narrow, audited accessor that exposes own-data only.
3. Treat "the sandbox is the set of things that exist" as the design, not "the set of things we
   remembered to block".
4. Anti-pattern: allow-by-default with denylist guards; reflective access to host objects. See
   [[transferability-guide]].
