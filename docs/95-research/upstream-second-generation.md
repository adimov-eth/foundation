---
title: Upstream after the snapshot — the second-generation extraction (2026-07)
layer: reconciliation
status: verified
tags: [reconciliation, architecture, audit, arrival, plexus]
canonical-for: []
source-provenance:
  origin: adversarial GitHub-forensics passes (2026-07-20/21) + read-only clones of here-build/arrival, here-build/commons, DROOdotFOO/raxol
  retrieved: 2026-07-21
  authority: derived
last-verified: 2026-07-21
verified-against: main
---

# Upstream after the snapshot — the second-generation extraction (2026-07)

> **Derived + adversarially verified.** This note maps what happened *around* this
> repository after its snapshot generation: the upstream freeze, the second-generation
> extraction, and the ecosystem that grew past it. Every load-bearing claim was re-tested
> by refutation passes against live GitHub state and read-only clones; claims are labeled
> **VERIFIED** (read directly) or **INFERRED** (well-supported, unproven). Upstream anchors
> use the `here-build/<repo>:path:line` form and point *outside* this tree — they are
> deliberately not validated by `docs/_index/check.py` (which validates only local
> `arrival/|plexus/|common/` anchors). The companion note for *this* tree's internals is
> [foundation-architecture-deep-dive](./foundation-architecture-deep-dive.md).

## Provenance of this note

Evidence base: live GitHub REST/GraphQL state (2026-07-20/21), full-history clones of
`here-build/arrival` @ `e83ee6a6` and `here-build/commons` @ `f8fda60`, and a shallow
clone of `DROOdotFOO/raxol` @ `849afb9`. Method: claims were first assembled from repo
metadata, commit archaeology, and extraction manifests, then independently re-tested by
adversarial verification passes instructed to *refute* them. Two earlier working claims
were corrected by that process and are recorded here in their corrected form, per this
vault's reconciliation-honesty rule:

- "upstream foundation is **dead**" → corrected: the *public mirror* is shelved; the
  private tier behind it accelerated (see timeline).
- "plexus is withheld because it is the **commercially** load-bearing piece" → corrected:
  the stated reason is unpublished *research* priority, not product code (see §Where
  plexus went).

## TL;DR

`here-build/foundation` — this repository's upstream — froze on 2026-06-16 and was never
pushed again, but the project behind it did not stop: commit density on the same packages
*rose* after the freeze, and on 2026-07-18 a second-generation extraction shipped as two
new repos, `here-build/arrival` (20 packages, renamed `@inhuman.tools/*`) and
`here-build/commons` (8 packages, still `@here.build/*`). The overlap is partial:
`plexus`, `arrival-chain`, `arrival-inference`, and the scheme-env packs have **no public
successor**, which makes this repository the sole public copy of each. The new code
contains **no agent harness** — by design: the model-calling loop lives in a private
`llm-plane` package family, and the harness plane lives outside TypeScript entirely
(grok-build-class runners plus an Elixir/OTP supervision layer being built in
`DROOdotFOO/raxol`). Upstream is not a PR target (its public repos are deterministic
projections of a private monorepo; issues are the invited channel). What to watch:
`--ff-only` pull refusals on the new repos, a `foundations/` root dissolution, a plexus
extraction wave, and the first `@inhuman.tools/*` npm publish.

## The timeline, dated

All VERIFIED against repo metadata and commit archaeology unless marked. The SHAs below
are drawn from **both** successor repos' projected histories (`here-build/arrival` and
`here-build/commons` mirror the same private tree); a `[c]` marks a commit whose SHA
resolves in commons, an unmarked one in arrival. Commits touching the `here.build`/product
split live in commons' scope; the rest in arrival's.

| When | What |
|---|---|
| 2025-07-20 | Oldest surviving commit in the arrival lineage (`80feb0e365` "mcp packages") — the published history is real, not squashed. |
| 2025-09-25 | `here-build/arrival:9c87c7c3fd` — "renaming @dappsnap/ -> @here.build/ namespace"; the private monorepo's own prior identity was **dappsnap**. |
| 2025-11-09 | `here-build/foundation` created. |
| 2026-04-12 | `ff992a65` — "monorepo: restructure directories for OSS extraction and SaaS clarity". |
| 2026-04-20 | `6c454c73` [c] — "foundations: add as subtree from here-build/foundations": the public repo was **vendored back into the private monorepo** as the `foundations/` subtree; development continued there. Foundation-the-repo was never the working tree again. |
| 2026-06-15/16 | OSS-readiness burst under `foundations/`; last push to `here-build/foundation` at 2026-06-16T03:38Z (HEAD `af9a1895`, final CI runs red). |
| 2026-06-16T03:50Z | Twelve minutes after the last push, `23e6475f18`: sensitive material "must not ship in the public foundation repo … so **a future extraction can't leak them**" — the second generation was anticipated in the same hour the mirror went quiet. |
| 2026-06-16 → 07-19 | Development on the exact packages this repo contains **intensified**: daily commit peaks of 89 (06-28), **117** (06-29), 87 (07-09) — higher than pre-freeze density. The freeze is a fact about the mirror, not the engineering. |
| 2026-06-23 | `791afce598` [c] — "consolidate the here.build product under its own root"; names the shared tiers (`foundations/`, `second-foundation/`, `tools/`) and the `here.build/` product root directly (the `inhuman/` product root is referenced as prior context — an earlier commit, `e889152165`, extracted it). |
| 2026-07-10 | `65b86e36fc` — a package moved *into* `foundations/`: "The package goes public-tier", 24 days after the freeze. |
| 2026-07-17 | `808abd92` [c] — "rename package family @here.build/* -> @inhuman.tools/* (18 packages)", executed "per V-ruled 2026-07-18 (docs/working-proposals/foundation-extraction-plan.md §Sequencing #1)" — a numbered, private sequencing plan exists. |
| 2026-07-18 | `here-build/commons` (09:04Z) and `here-build/arrival` (09:33Z) created and made public. |
| 2026-07-19 | `ef3101bf` dissolves the `second-foundation/` root (the **only** root-dissolution commit found; `foundations/` stands). Final pushes to both repos at 22:0xZ. |

Two sobering symmetries (VERIFIED): the successors have had zero pushes since 07-19, zero
CI, zero tags, zero npm publishes — they sit at exactly the "one extraction burst, then
silence" stage `here-build/foundation` sat at on 2026-06-16. And per the extraction
manifests' own final path mappings, **15 of the 28 just-published packages still live
under `foundations/` paths** in the private tree — the tier this repo mirrors is the
live source of the second generation.

## The package fate map

Fate of every package in this tree, VERIFIED against the successor repos' trees and
extraction manifests:

| This tree | Fate upstream |
|---|---|
| `arrival/arrival` | survived → `@inhuman.tools/arrival` 0.9.0 (provenance analysis stack folded *into* core `/provenance`) |
| `arrival/arrival-mcp` | survived → `@inhuman.tools/arrival-mcp` 0.9.0 (+ confirm-manifest/confirm-burst, session-run-state) |
| `arrival/arrival-provenance` | survived → 0.9.0 but now a thin re-export shim over core `/provenance` (keeps only the mobx `ObservableEvalTrace`) |
| `arrival/arrival-serializer` | survived → `@inhuman.tools/arrival-serializer` 0.9.0 |
| `arrival/arrival-sweet` | renamed → `arrival-sugarcoat` (continuity proven by the manifest's path-rename pair) |
| `arrival/arrival-env` | re-homed → `here-build/commons`, deliberately still `@here.build/arrival-env` ("it belongs to the commons floor per the extraction plan") |
| `arrival/arrival-chain-view` | transformed then killed: → `mercury` → deleted 2026-07-19 (`4a090ef`, +12/−10,151) in favor of the ground-up `arrival-mercury` (born 07-14) — a successor, not a continuation |
| `arrival/arrival-chain` | **no public successor** |
| `arrival/arrival-inference` | **no public successor** (reabsorbed privately as the `llm-plane` family — see three-plane section) |
| `arrival/arrival-scheme-env-infer` | **no public successor** |
| `arrival/arrival-scheme-env-ramda` | **no public successor** (its replacement model is the per-effect capability packs) |
| `plexus/` | **withheld from every extraction** — see next section |
| `common/collections` | survived, same name (+ new `ordinal` protocol ejected from PathMap, `b4ac6eaf`, absent from this tree) |
| `common/error-invariant` | survived, same name |
| `common/eslint-config` | survived (package name `@here.build/eslint-configs`) |
| `common/lexical-namer` | survived, same name |
| `common/tsconfig` | survived, same name |

The exclusion criterion for the killed set is stated in `here-build/arrival:2db091b`:
the published seed was the **"dependency-closed, inference-free 8-pack."**

Net-new upstream (no ancestor in this tree), one line each: `arrival-cli` (`bin: arrival`;
verbs `run`/`repl`/`check`, check being "the eslint-style pass, no execution"; Ink + React 19),
`arrival-mercury` (Scheme → "human-grade TypeScript, designed around the reader's mental
model", with a differential oracle), `arrival-lsp` (née `arrival-type-lens`),
`arrival-codemirror`, `editor-theme` (the one `@here.build/*` holdout in the arrival repo),
`arrival-mcp-do` (Cloudflare Durable Object session shell), `mcp-substrate` ("Rejections
teach and route; they do not ban."), `arrival-manifold` (one-REPL-tool MCP proxy),
`mcp-typescript-lsp`, `arrival-ext-{toml,yaml}`, and `arrival-env-capability-{approval,
handlebars,http,sql}` — the http/sql verbs were pulled *out of core* (`b95eec4`) so core
ships no network or DB surface; the sql pack keeps "params stay SEPARATE from the query
text — injection-safe by construction", and the http pack's own description keeps "the
program names a label; the host binds credential + endpoint host-side"; both inert without
a host resolver, exactly this tree's data-effects pattern. Commons additions: `chunked-websocket` (>1 MiB WebSocket chunking
for workerd, adapted from partykit's y-partykit), `postcss-oklch-plus` (gamut clamping +
Helmholtz–Kohlrausch compensation). Toolchain drift to expect when comparing: TypeScript
6.0.2, eslint 9.39.2, pnpm 10.3.0.

One structural fact that surprises: **the two successor repos are one workspace split
across two remotes.** `@inhuman.tools/arrival` depends on `@here.build/{collections,
error-invariant,eslint-configs,tsconfig}` at `workspace:^`, none published to npm —
arrival cannot be built standalone from its own tree (VERIFIED from package.json files).

## Where plexus went

**Nowhere public — deliberately, and across every extraction so far.** VERIFIED three
ways: the `here-build` org contains exactly three repos (foundation, arrival, commons);
org-wide code search for `plexus` returns hits exclusively inside the frozen `foundation`;
`@here.build/plexus` and `@inhuman.tools/plexus` are 404 on npm.

The forensic signature is elegant: two commits in commons' filtered history carry plexus
in the *subject* with zero plexus files in the *diff* — `d6bd101` (2026-06-08, "relocate
PathMap to @here.build/collections") and `753c421` (2026-06-24, "test(plexus): never-type
method-classification guards"). That is `git filter-repo` stripping a non-retained path
from mixed commits: proof plexus coexisted in the private tree and was excluded — and
proof it was **alive and worked on eight days after the public freeze**. A sibling
(`second-foundation/plexus-text`) was still present as of 2026-07-17.

The stated reason (VERIFIED, verbatim fragments from `6d31468`, 2026-06-15, in source
order — the design docs and papers move to a private root so they are "preserved but not
published day-one", the itemized line then reads):

> "…preserved but not published day-one: … `foundations/plexus/papers` → `docs/papers/plexus`
> (**unpublished CRDT preprints — the moat: genesis hash seeds, Feistel id encoding,
> liminality**)"

The withheld material is *research priority* — the three mechanisms the deep-dive
independently flagged as genuinely novel — not product code (plexus lives in the shared
`foundations/` tier, not under the `here.build/` product root; INFERRED from `791afce598`'s
root taxonomy). **Consequence: this repository is the sole public copy of plexus that
exists anywhere.**

## The three-plane architecture (and why the new code contains no harness)

An adversarial sweep of all 28 successor packages found **zero model-calling code**: no
LLM SDK dependency, no completion call, no tool-dispatch loop (VERIFIED by dependency and
source grep). The architecture separates three planes:

1. **Tool/sandbox servers (public, `here-build/arrival`)** — everything is the server
   side of MCP, answering one inbound `tools/call` at a time. It ships real harness
   *components* with the driving hole deliberately empty: a mid-run human-approval gate
   (`arrival-env-capability-approval`; in-memory, with "TODO(ADR-025): … the durable
   variant suspends here and resumes by replaying the effect-log"), the risky-effect
   burst-hold protocol ("any risky row present ⇒ the ENTIRE burst holds as a proposal" —
   revert to snapshot, return a manifest, require a confirming second call), and a durable
   session shell (`ArrivalMcpRunnerDO`: handshake replay across isolate recycling, TTL
   reaping, call serialization — "no product semantics here").
2. **Model plane (private)** — the `@inhuman.tools/llm-plane-*` family. Its existence is
   VERIFIED by a dangling import left in the published tree:
   `here-build/arrival:packages/arrival-mercury/src/build/prompt-module.ts:15` imports
   from `@inhuman.tools/llm-plane-arrival-env`, which exists in neither public repo;
   comments across the tree cite its `src/infer.ts` as the canonical capability shape the
   http/sql/approval packs mirror. This is where this tree's `arrival-inference` lineage
   went.
3. **Harness plane (external)** — `arrival-manifold`'s README names the loop-drivers as
   external consumers: "Every surveyed MCP client — the official TypeScript and Python
   SDKs, Claude Desktop, Claude Code, Cursor, VS Code Copilot, the OpenAI Agents SDK,
   LangChain's MCP adapters — forwards `tools/call` to the server without client-side
   name validation." The substrate/harness boundary is stated by the authors, not
   inferred from silence.

Two decoder notes for readers of the successor tree: core's `./oracle` export is a
grammar-constrained-decoding kernel (valid-next-token masking; its stated consumer is an
external package, `sift`), not an LLM caller; and "arrival is a pure inference plane" in
the CLI README means *pure functional Scheme evaluation* — a false friend, not a model
surface.

## The harness ecosystem around it (public evidence only)

- `xai-org/grok-build` — "coding agent harness and TUI", Rust, Apache-2.0, released
  2026-07-14, ~20.8k stars / ~3.8k forks at verification time (VERIFIED; star count
  drifts with organic growth). The successor
  tree's opt-in custdev test drives its `grok` CLI as a headless runner
  (`-p … -m … --output-format json --max-turns 8 --always-approve`) with insider
  operational knowledge — "NEVER pass --json-schema: it silently reroutes to the hosted
  grok-build model regardless of -m" — and runs non-xAI models through it (`-m longcat`).
  No fork of grok-build appears under any related identity among its public forks.
  INFERRED: a private fork is used as a daily-driver runner; nothing in either public
  repo depends on it (scaffolding, not keystone).
- `DROOdotFOO/raxol` — an Elixir/BEAM multi-surface UI runtime in which the same author
  is building an agent-supervision layer at high intensity (event-sourced journal,
  session supervision, interrupt/steer, spend gates, evidence-gated done). Its ACP
  package is deliberately **both roles**: "to let Raxol-hosted agents speak ACP to real
  editors and to let Raxol-hosted editor surfaces drive external ACP agents"
  (`DROOdotFOO/raxol:docs/proposals/acp-package-adr.md`), with grok-build studied as an
  Apache-2.0 *design reference only* (its NOTICE.md). A first-party model-calling runner
  already exists there (`raxol_agent` HTTP backends: anthropic, openai, kimi, ollama,
  LM Studio-compatible). Grok Build itself figures mainly as a cautionary case study:
  the July 2026 incident in which it "silently uploaded whole repos incl. `.env` secrets
  to a GCS bucket" shaped their storage prohibitions — "The steal is a prohibition, not
  a foundation."
- The philosophical continuity is explicit: raxol's harness design record opens "This is
  the design conversation written down before compaction eats it — which is itself the
  problem the design solves. Captured in our own extraction ontology" — the
  [[fragmentation-hypothesis]] lineage, re-executed on OTP with a journal where this
  tree used a CRDT.
- Timeline resonance (VERIFIED dates, INFERRED causality): grok-build released 07-14 →
  the raxol harness sprint ignites 07-15 → the TypeScript second-generation extraction
  ships 07-18.

## The extraction method (patterns worth stealing)

The second generation open-sources by a disciplined, reproducible process — the mature
form of the process that produced this repo's snapshot:

- **Extraction-manifest-as-committed-script.** Each successor repo ships
  `scripts/extract-from-monorepo.sh`, a `git filter-repo` manifest with a stated
  determinism contract: "same args + same input commits ⇒ same hashes. Routine sync =
  re-run over append-only main ⇒ fast-forward push." The public repos are a reproducible
  *function* of the private tree, not snapshots.
- **Prefix-chain history preservation.** `--path-rename` pairs follow each package
  through every directory it ever lived in (core's chain:
  `packages/s-expressions/` → `packages/arrival/` → `oss/arrival/` →
  `foundations/arrival/arrival/`), preserving 1,496 commits of real history — against
  this repo's 649 starting at a subtree import. The manifest documents its own
  archaeology honestly, including a known loss (59 truncated commits of
  arrival-chain-view's birth era).
- **Identity rewrite in the commit callback.** Every commit re-authored to one publishing
  identity; assistance trailers stripped by vendor-domain/name lists inside the same pure
  callback so the determinism contract holds. Measured effect: 647/649 commits in
  `here-build/foundation` carry an assistant co-author trailer; 0 in commons; 1 in
  arrival (the commit introducing the rule, whose body *describes* the pattern).
- **"The timeless register."** A docs+comments rewrite (44 files, +2,897/−7,075; docs
  ~14.6k → 7.7k lines) governed by "nothing was deleted without its constraint surviving":
  keep invariants, constraints, reasoning, prior-art attribution; drop wave/task tags,
  dated rulings, decision attribution, private topology.
- **Supply-chain posture worth copying into this tree:** `minimumReleaseAge: 10080` in
  pnpm-workspace ("refuse to install any package published less than 7 days ago"), and
  per-package LICENSE files because "npm ships license text only from the package root —
  the MIT-conversion clock must travel per-version" (a real FSL-1.1-MIT gotcha this tree
  currently has).

## What this means for this repository

- **The fork relationship is over in practice.** Upstream has had zero commits, branches,
  tags, issues, or PRs since 2026-06-16; the compare API reads `ahead_by: 35, behind_by: 0`
  (VERIFIED). There is nothing to sync, ever. No public deprecation or cross-reference
  exists in either direction — supersession is forensic, not declared.
- **What this tree uniquely holds:** the only public `plexus`; the only public
  `arrival-chain` + `arrival-inference` (the integrated loop the second generation
  deliberately excluded); and this fork's own post-snapshot work (the Codex-subscription
  inference backend, the reconstructed type-lens/ts-lsp — which upstream took in a
  different direction as `arrival-lsp`).
- **Upstreaming code is a non-path.** The successor repos are downstream projections
  regenerated by script; their commit callback strips exactly the co-author trailers this
  repo's history carries; their README states "we are not yet optimizing for external
  PRs" and frames publication "as a dialogue invitation: read it, challenge it, open
  issues." Issues are the invited channel.
- **Vault scope:** this vault maps *this* tree (see the CLAUDE.md provenance header).
  When comparing against upstream, translate names first (`@here.build/*` →
  `@inhuman.tools/*`, `arrival-sweet` → `arrival-sugarcoat`) and expect the provenance
  analysis stack inside core.

## Watch signals

- `git pull --ff-only` on clones of the successor repos doubles as a **wave detector**:
  the manifests promise fast-forward routine syncs, so a refusal means history was
  rehashed — i.e. a new extraction wave (prefix addition) landed. Not an error to force
  through; a signal to read.
- A commit dissolving the `foundations/` root (the `second-foundation/` dissolution has
  a precedent shape) — would mean the tier this repo mirrors is being retired.
- A plexus extraction wave, or the CRDT preprints publishing (the stated "day-one"
  withholding implies later days).
- First `@inhuman.tools/*` npm publish (all 404 as of 2026-07-21 despite 0.9.0 +
  publishConfig staged), or CI/tags appearing in the successor repos.
- `here-build/foundation` gaining an archived flag, description, or redirect.

## Open questions

- Where plexus lives in the private tree today (the `second-foundation/` dissolution
  commit accounts for other packages but is silent on `plexus-text`).
- The unread sequencing steps of the private `foundation-extraction-plan.md` (§1 was the
  rename; numbered steps imply more).
- Whether the grok-build-class runner feeds raxol's ACP as a driven agent in practice,
  or the first-party `raxol_agent` runner carries the load.
- The identities behind the recurring reviewer names in upstream commit subjects
  (V, "the triad", grok-4.5/longcat audit references).
- 1.0/npm publish timing for the successor repos.

---

*Self-contained by design: quotes and SHAs above are the evidence; the underlying
forensics were conversation-scoped research passes, not repo artifacts. Verified against
clones `here-build/arrival@e83ee6a6`, `here-build/commons@f8fda60`,
`DROOdotFOO/raxol@849afb9`, and live GitHub API state, 2026-07-21.*
