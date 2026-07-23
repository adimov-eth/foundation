---
title: Arrival's design rationale — from the second-generation design-history sources
layer: reconciliation
status: verified
tags: [reconciliation, architecture, arrival, provenance, membrane, reader, purity, arrival]
canonical-for: []
source-provenance:
  origin: 11 real design documents in here-build/arrival:packages/arrival/docs/design-history/ (a public second-generation repo — see [[upstream-second-generation]]); language-design-foundations.md was independently located and confirmed byte-equivalent to the design-history copy
  retrieved: 2026-07-23
  authority: derived
last-verified: 2026-07-24
verified-against: main
---

# Arrival's design rationale — from the second-generation design-history sources

> **Derived + adversarially verified.** This note is not a reconstruction — every document it
> draws on is a real, original design text (not code-inferred), found in the public
> `here-build/arrival` repo at `packages/arrival/docs/design-history/`. It exists because two of
> our own code-reconstructed docs (see [[speculative-evaluation-promise-functor.reconstructed]],
> [[env-pack-capability-dag.reconstructed]]) turned out to have real originals available, and
> reading the other nine for their own sake — not as fidelity checks — surfaced the deepest
> architectural reasoning in this whole vault. Every quoted string below was independently
> re-checked against the primary source after a first draft; the pass found and fixed a range of
> issues — from silent splicing and spelling drift up to one genuinely fabricated sentence and
> one confirmed factual reversal (a stated "fix" that the source itself calls unsound) — all
> corrected in place rather than flagged and left. This maps *reasoning*, not current upstream
> code state — see [[upstream-second-generation]] for what shipped and what didn't.

These eleven documents aren't a spec of what arrival does — the code already tells you that.
They're the argument for why it's built this way, including the parts that were tried and
killed. Read together, they show a system that keeps reaching for the same move in five
unrelated contexts: push a decision from "inferred at runtime by inspecting what a thing looks
like" to "declared as data, checked before anything runs." That move shows up in the reader's
syntax registry, in the provenance vocabulary's role declarations, in the number system's
box-class dispatch, in the membrane's protocol-member dispatch, and in the capability system's
static validator. It isn't stated once and reused — each document discovers it independently,
under its own pressure. The throughline comes at the end; first, the pieces.

## The language charter: intent, platform, quirks, and the discipline of bless/recover

*Source: `language-design-foundations.md` — see [[language-design-foundations.reconstructed]] for
how our own code-derived reconstruction compares (high fidelity on mechanism, missed this entire
philosophical spine).*

arrival-scheme's reader charter starts from a three-way sort applied to every piece of surface
syntax a designer might want to add: is this **intent** ("a sequence of these", "a map from
these to those", "filter where p"), the **platform model** (real R7RS, presented as glass —
"exact, faithful, round-trips to identity, never bent"), or a **quirk** (a surface mismatch —
JSON's `true`/`false`/`null`, EDN keywords; Clojure's `[]`-as-vector and `{:k v}`-as-dict "went
further than recovery," becoming blessed literals via the 2026-07-02 amendment below, not plain
quirks)? An expert writing strict R7RS gets an **exoskeleton** — their Scheme, executed
faithfully. An LLM writing JSON-ish data gets a **zimmerframe** — held up, recovered, taught the
platform through a transparent mapping. Hiding the platform layer would be the
**straightjacket**.

The mechanism is strict ordering, not a merged grammar: R7RS + enabled SRFIs parse first,
unconditionally; the forgiving layer only engages where that pass errors or is undefined —
structurally impossible to shadow a SRFI, not merely unlikely. *"Forgiveness never overrides a
defined meaning — it catches the fall."* Every syntax element gets **BLESS** (canonical,
round-trips), **RECOVER-ONLY** (fallback, yields to any SRFI), or **NEVER STEAL** (`&`, `,` —
permanently off-limits). And *"reserved ≠ free"*: R7RS-small §7.1.1 reserves `[`, `]`, `{`, `}`,
and `|`, but SRFI-105/110 already claim them, so the truly free zone was just the `#`-family for
most of the document's life.

The `{}`/`[]` amendment (dated **2026-07-02** in the source) is the charter correcting itself
under evidence: one τ²-airline eval run produced five distinct wrong object encodings for a
single *correctly-typed* dict argument — the model erred despite having the right type, which is
the actual sting of the example — and the response wasn't a patch, it inverted the framing.
*"Meeting the model's native literal IS the zimmerframe; refusing it was the straightjacket."*
Resolved by a mode switch, not content inspection — a nearby idea (dispatch `{}`'s meaning by
odd/even element count) is named explicitly as *"the §8 clever-and-surprising trap by
textbook."* This generalizes to a four-part test any future syntax must pass: *"A rule derived
from R7RS + the reserved-zone + the fallback ordering self-corrects in every unseen case. Taste
drifts; this does not."* One elegant asymmetry: blessed literals are input-only sugar — the
printer always emits canonical `(dict ...)`/`#(...)`. And `(dict :k v ...)` itself dissolves the
alist-vs-hash debate rather than resolving it — it's just a function call, automatically
blessed-zone by being an identifier in head position.

## Why no IO: the dataflow-algebra argument

*Source: `why-no-io-dataflow-algebra.md` — the missing argument in our own
[[purity-pass-plan.reconstructed]], which correctly stated the premise but never had access to
this reasoning.*

Why does the runtime refuse `set!`, `display`, `read`, `call/cc` outright, no opt-in? Because
arrival is a real, conformance-checked R7RS subset (checked against chibi's actual test suite),
not a bespoke pure DSL — *"there is no DSL manual because the manual is the Scheme report."* The
payoff: arrival-chain reimplements on any conforming R7RS by defining roughly ten seam symbols;
on vanilla R7RS you get a plain pipeline library, on arrival proper the same ten symbols become
the provenance-preserving membrane.

The actual argument is an algebra — seven pipeline transformations (Reorder, Fuse, Dedup/CSE,
Parallelize, Cache, Replay, Cull), each licensed *only* because purity holds. *"Every row is the
same theorem at a different scale."* The negative-space case is what makes it real: one
`(display x)` doesn't degrade a rewrite, it kills it outright — *"one effect anywhere poisons
the rewrites everywhere downstream of it... purity is not a local property you can sprinkle —
it is a global invariant you either hold or don't."* That is why IO is removed unconditionally
rather than gated behind a flag.

The sharpest move: provenance and referential transparency are named as **the same invariant,
not two**. *"Provenance is the claim 'this value came from exactly these inputs, here.'
Referential transparency is the claim 'this value may be substituted for its defining
expression, anywhere.' These are the same fact."* Mutation breaks provenance directly and
substitution as a consequence; dynamics/IO break substitution directly and provenance as a
consequence. Effects aren't eliminated, just relocated to a functional-core/imperative-shell
boundary — inputs enter as already-constructed values at the edge ("the pipeline never
*performs* the read; it *receives* the value"), and outputs are values the graph produces that
the host decides whether/when to persist or send. That split is *why*, per the source, *"the
capability surface (MCP) 'wraps intent, not impact': agents name the value they want, the host
owns the effect of materializing it."*

## The provenance architecture

*Sources: `execution-plan-wireframe.md`, `callback-track-graphs.md`, `provenance-vocabulary-v2.md`,
`provenance-design-challenges.md`, `provenance-lineage.md`. This is where the design effort
clearly went deepest, and where our vault has the least prior coverage — see
[[provenance-model-reference.reconstructed]] and [[provenance-region-model-plan.reconstructed]]
for our reconstructions of the *earlier* trace.ts-era model these documents evolve past.*

**The wireframe.** The old design cost roughly 150 bytes plus a Set *per reduction* — tying
trace memory to wall-clock runtime rather than program size. Not a theoretical worry: a
46,000-iteration loop produced a **186MB heap dump against a 128MB isolate budget**. The fix:
evaluate the AST once, statically, into a graph recording only where control or data actually
forks (mux/fan/source/opaque/binder-cycle); everything **classifier-pure** between forks
collapses into one edge — `(+ (* x x) 5)` is one provenance edge, not four. Licensed by the
purity invariant, not just convenient. A runtime **port log** then records only membrane
crossings, with run-length aggregation for loops — steady-state iteration is O(1), not growing
with time. Crucially, `AValue.provenance` — the eager per-value Set the sift seal grounds
security on — is **not** what this optimizes away: *"Retiring it is a security regression — the
sift seal grounds on per-leaf stamps — and its memory cost is illusory (sets share by
reference)."* The blowup was entirely on the trace side, the one-`Invocation`-per-reduction
model whose sets grow trace heaps with runtime.

**Wires as data.** A wire is a quoted, unevaluated, closed lambda expression whose free-variable
set *is* its ingress list. This does four jobs at once: drift becomes unrepresentable, not just
audited; the two layers literally *are* an abstract-interpretation Galois connection — *"the
Galois connection is the DEFINITION of the two layers, not an imported analogy"*; loops unroll
lazily from their own unevaled fixpoint; and wires become content-addressable ("the Unison
move"). Because arrival is homoiconic, replay collapses to `(apply wire recorded-ingress)` — no
bespoke replay engine, the existing evaluator *is* the replay mechanism. Validated against a
conservation generator that builds programs with expected id-sets by construction — a free
oracle — asserting two independent interpretations agree.

**Tracks.** A host verb (map/filter/reduce) opens a region owning tracks, one per callback
invocation — sealed ingress, a never-stored interior (replayed on demand), one egress.
Composition depends on declared role: element-transformers run parallel with zero inter-track
edges; accumulators chain egress→ingress (the *only* sanctioned inter-track edge); effects are
terminal. The confinement theorem is scoped precisely: *"It is NOT behavioral noninterference"*
— an effect track's side effects genuinely happen; what's bounded is that anything it captures
still counts toward the region's provenance cone. Structural, not policed: total immutability,
no call/cc ("the classical region-escape channel," deliberately unimplemented), region doors
closing every historical escape pattern. *"Take either invariant away and the escape channel
reopens."* A genuine unification: region=task, track=unit-of-work, and the
`{started, completed}` counters *are* the port-record stream — progress UI and post-hoc replay
are the same code path invoked at different moments.

**Declared vocabulary.** None of the above is buildable statically unless roles are known ahead
of time. Two rejected alternatives, named directly: a runtime-stamped marker (invisible to a
static evaluator) and a heuristic guess (silently misclassifies). Declaring role as data closes
both failure modes. A declared role contradicting its contract shape **throws at assembly
time** — *"the drift alarm's door teaches the mismatch"* — which is exactly what makes the
tracks' composition rules trustworthy rather than aspirational.

**Challenges and lineage.** The system is disciplined about scope: replay stability is staked on
"replay from frozen port payloads," explicitly *not* re-execution determinism — two separate
test suites exist (stamp-level, replay-level) specifically because one can stay green while the
other breaks. The loop-aggregation trick trades a true minimal-cone claim for an honest widened
one at loop nodes. And the lineage document supplies the deepest single claim in the whole
cluster: none of arrival's mechanisms are original — Kahn networks, Tofte–Talpin regions,
delimited continuations, hygiene, semirings are all borrowed, separately-owned ideas. *"Every
ingredient has an owner. The recipe does not."* Two re-aims are genuinely striking: Kahn's
determinacy theorem normally licenses *scheduling freedom*; arrival runs it backwards to license
*replay*. Delimited continuations normally let a boundary be *captured*; arrival uses the same
primitive as a *seal* where capture is forbidden. And the fact that makes every re-aim sound
simultaneously: *"The eliminated-dynamics constraint (no `set!`, no IO) is what makes every one
of the re-aims sound; that single language decision is the keystone the whole intersection
stands on."* All of this runs inside a hard, named deployment constraint: *"full provenance for
a ~1000-SLOC program inside one 128MB Durable Object with CPU caps and mid-run eviction."* (The
wireframe document above names this same 128MB memory ceiling its "isolate" budget — one
physical limit, two documents' vocabulary for it.)

## The value system: numbers and membrane egress

*Sources: `arrival-one-number-rework.md`, `arrival-egress-membrane-exit.md`.*

Two documents sharing one principle with the vocabulary work above: **a value's semantic
identity must never be legitimately re-derivable by inspecting its current shape.**

Exactness is purely a box-class distinction, never a payload type. The safe-operand invariant —
every `AExact` payload is a safe integer — is enforced at exactly three ingress gates (parser,
membrane `fromJS`, op minting); given that, a post-op `isSafeInteger` check is a *sound*
exactness gate for `+`/`-`/`×` chains specifically because a true result ≥2^53 can never round
back into safe range. A separate law governs the encode/decode boundary: *"encode never invents
exactness — `wantExact` is computed from the coerced operands' boxes and threaded to the
result, never re-derived from what the result looks like."* This law is what the **rejected**
bigint-rational alternative would have violated — with bigint as the exact face, "codec encode
edges re-derive exactness from value shape," producing `(exact? (floor 2.5))` → `#t`; arrival's
actual shipped behavior is `(exact? (floor 2.5))` → `#f`, one of the pinned rows the law
protects. BigInt rationals were rejected on four grounds at once — can't be `WeakMap`-wrapped
(fights the membrane), can't be hashed (no persisted chain artifact could carry one anyway),
duplicates ~230 lines of numeric surface, and reopens exactly this encode-edge bug.

The membrane-egress fix distinguishes two things that look similar: serialization projection (a
closure → `#<procedure>`, fine) versus membrane crossing (must stay live and callable-back). The
actual defect was nested containers — a lambda inside a dict silently went inert, and silently
*specifically because* a string is wire-safe, so no downstream check ever fired. The rejected
fix (thread a `wrapCallable?` param through recursion) fails on a real subtlety: the proxy cache
is one-per-box, forever — a parameter baked into that cache makes behavior depend on whichever
caller egressed the box *first*. *"Same box → same proxy, forever"* and *"projection depends on
options"* are jointly unsatisfiable over one cache slot. The governing law that resolves it,
stated exactly: **"Bare = (box). Membrane = (box, mode, SCOPE). Gated = (gate, box)"** — three
different projections, three differently-shaped identity slots, "nothing less (staleness),
nothing more (spurious identity churn)." Widening only to `(box, mode)` — the tempting minimal
fix — would still be unsound, because *"a `(box, mode)`-forever cache is unsound once exits pin
scopes: it would either resurrect wrappers pinned to a CLOSED scope for a later invocation of
the same crossing... or pin DETACHED wrappers into the very slot a live crossing shares — the
first-caller-wins defect reintroduced on the scope axis."* Scope has to be a real key dimension,
not just mode.

## What was tried and rejected, and what evolved

*Sources: `halfbaked-existence-review.md`, `symbol-define-static-program-validation.md` — see the
[[speculative-evaluation-promise-functor.reconstructed]] end-note for the exact commits (dated
2026-06-25 and 2026-07-08) that discovered and then formally killed this design.*

**AHalfBaked** — a lazy carrier letting a filter/map fan report a narrowing cardinality interval
so a monotone branch could fire before the fan fully settled — wasn't killed for not working. It
had a producer and its own dedicated test suite. It died on a structural fact: container egress
crosses via synchronous Proxy `get` traps, and JS has no async trap variant, so a live carrier
reaching that boundary has exactly two paths through, both destructive. *"The carrier does not
survive contact with synchronous egress."* What makes the rejection disciplined rather than just
a deletion: *"`AHalfBaked` is gone: the carrier, its producer wiring, and its dedicated tests no
longer exist. The capability it was chasing... is real, and moves forward as an acceptance
criterion for struct-fact wires... in `execution-plan-wireframe.md`."* The tests didn't survive
— the capability did, rebuilt static.

**Capability vocabulary** is the constructive mirror. A `prelude:` opaque string became
individually contracted, hash-identified `symbol.define`/`symbol.defineSyntax` declarations,
making a program statically validatable before evaluation — missing bindings become first-class
graph nodes, and "cascade fusion" collapses one root cause referenced seven times into one
diagnostic instead of seven ("one missing `fs` key disabling `require` + `require/extension`,
referenced 7 times, is ONE diagnostic with 7 sites — never 7 diagnostics"). A separate rule in
the same pass — the "did you mean" suggestion channel — is where the agent-trust framing
actually lives: *"'did you mean X' may only offer names that would themselves validate under the
present grants and config... a suggestion that immediately re-errors on the next round-trip
destroys agent trust faster than no suggestion."*

## The throughline

**Declared, not inferred, is the load-bearing pattern** — discovered independently in the
reader's syntax registry, the provenance vocabulary, the number system's box dispatch, and the
membrane's protocol dispatch. Four documents, one sentence, restated under new pressure each
time.

**Provenance and referential transparency are one invariant, not two** — the deepest claim in
the set. Banning mutation and banning dynamics aren't two decisions that happen to overlap;
they're the same principle proven in both directions.

**The system is unusually honest about the scope of its own guarantees, and treats that honesty
as engineering, not just writing.** Not full noninterference — value-egress confinement. Not
re-execution determinism — replay from frozen payloads. *"The drift alarm catches
contradictions, not lies."* A reader needs the narrow true claim, not the broad appealing one,
to avoid depending on a guarantee that was never made.

**One language decision is the keystone under almost everything above it** — eliminating
`set!`/`call/cc` is what lets a dozen borrowed PL theorems hold simultaneously of one
interpreter, argued from provenance theory on one side and the optimizer on the other, meeting
in the middle. "No IO" isn't a sandboxing default both happen to benefit from — it's the thing
both are built on top of.

**The system amends itself under evidence and deletes working code to protect invariants, both
through named, checked process rather than taste.** Formal argument is never trusted alone —
there's always a generator or checker built to falsify it.

## Cross-references

[[upstream-second-generation]] · [[foundation-architecture-deep-dive]] ·
[[speculative-evaluation-promise-functor.reconstructed]] ·
[[env-pack-capability-dag.reconstructed]] · [[purity-pass-plan.reconstructed]] ·
[[language-design-foundations.reconstructed]] · [[provenance-model-reference.reconstructed]] ·
[[provenance-region-model-plan.reconstructed]]
