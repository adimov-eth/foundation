# Working in this repo

The open-sourced **headless engine** of here.build — `plexus` (Yjs-backed reactive replication),
`arrival` (a sandboxed-Scheme agent/LLM stack), shared `common/` infra. pnpm + turbo monorepo;
build is deps-first (`pnpm install` then `pnpm build`, or `pnpm --filter <pkg>... build`).

**Read the code, not the framing.** The public READMEs and disclaimers are written for an outside
audience and understate the actual ambition. Trust the source and the in-code "war story" comments
(dated, with commit hashes) over the marketing surface — when a comment says a thing is "NOT a
security fence" or names *why* a feature was excluded, it's the truest sentence on the page.

**This is a deliberate cut.** Whole packages were carved out; the `pnpm-lock.yaml` importers name
ones absent from disk. The public code sometimes implements a contract for a consumer that isn't
here. When you reason about removed intent, say so, and verify any claim against the present source —
grep before asserting a symbol exists.

**Verify before you conclude.** This codebase holds soundness as a theorem to defend, not a feature
to demo. Match that bar: re-open the cited file, run the test, adversarially check — and report what
you verified vs. inferred. "Tested" means a green run.
