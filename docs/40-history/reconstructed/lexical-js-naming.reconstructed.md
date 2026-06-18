---
title: Lexical JS Naming (reconstructed)
layer: history
status: in-review
tags: [history, reconstructed, arrival-chain-view, lexical-namer, projection]
canonical-for: []
source-provenance:
  origin: docs/proposals/in-flight/lexical-js-naming.md
  branch: lost — not in tree nor origin/tmp-6164624 Archive
  retrieved: reconstructed 2026-06-18
  authority: derived
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
code-anchors:
  - arrival/arrival-chain-view/src/names.ts:1     # cleanName = v1 base of the ladder
  - arrival/arrival-chain-view/src/names.ts:78    # cleanName: scheme ident → JS ident
  - arrival/arrival-chain-view/src/names.ts:93    # nameCandidates: the is<Symbol> ladder rung
  - arrival/arrival-chain-view/src/names.ts:103   # nameCandidates impl (predicate → isFoo)
  - arrival/arrival-chain-view/src/names.ts:125   # elementName: plural collection → singular
  - arrival/arrival-chain-view/src/names.ts:150   # destructureTuple: param[N] → [head, …]
  - common/lexical-namer/src/index.ts:1           # the collision-resolution upgrade target
  - common/lexical-namer/src/index.ts:384         # resolveLexicalNames (scope tree)
---

> ⚠️ **RECONSTRUCTION — not the original.** The original `docs/proposals/in-flight/lexical-js-naming.md` is lost everywhere (see [[dangling-doc-map]]). This note is reverse-engineered from the code it governed, anchored to `file:line`. Fidelity: **high** for the implemented `cleanName` "v1 base of the ladder" (`names.ts:1-13` names the doc twice and quotes its terms); **medium** for the full collision-resolving namer (the doc's "T100" / "ladder" / "rung" language survives in comments, but the scope-aware resolver that consumes the ladder is explicitly *not yet wired in* — task #76). It records what the doc *must have specified* given the implementation — not its original wording.

# Lexical JS Naming (reconstructed)

The proposal defined how **scheme identifiers map to legal, lexical JS names** in the [[arrival-chain-view]] projection (scheme → JS). The implemented `names.ts` is explicitly **"v1 — the `cleanName` base of the ladder defined in `docs/proposals/in-flight/lexical-js-naming.md`"** (`names.ts:1-7`); the full collision-resolution upgrade is to slot in [[common-lexical-namer]] without touching the lowering pass (`names.ts:8-13`).

## The naming ladder (the doc's central structure)

The doc described a **friendly-name ladder**: a preference-ordered list of JS-name candidates a collision resolver tries in turn before falling to a `_N` postfix (`names.ts:92-102`). The ladder rungs evidenced in code:

1. **Tier 1 — `cleanName`** (always first). A pure, total, deterministic scheme→JS transform (`names.ts:71-90`):
   - `->` → `-to-` (`string->list` → `stringToList`, `:81`)
   - drop predicate `?` and mutate `!` markers — they carry no JS meaning (`run-predict` → `runPredict`, `set-x!` → `setX`, `:82`)
   - strip earmuff `*` from `*globals*` (`:83`)
   - any other punctuation → separator `-` (`:84`)
   - kebab/snake → camel (`:85`)
   - drop trailing separators (`:86`); empty → `_` (`:86`); leading digit → `_`-prefixed (`:87`); JS reserved word → `name_` (`:88`, against the `RESERVED` set, `:19-69`)
2. **Tier 2 — `is<Symbol>`** (the named "rung"). A predicate `foo?` whose base doesn't already read as a boolean gets `isFoo` as its second candidate (`names.ts:93-112`). Rationale in the doc, preserved in comment: when `foo` is already taken (a loop var shadows the predicate — `picked` shadows `picked?` in gepa-full), the resolver picks the readable `isFoo`, not `foo_2` (`names.ts:96-101`). Skipped when the base already starts with a boolean verb (`hasChildren`, not `isHasChildren`, `:107-108`).
3. **Fallback — `_N` postfix** (the bottom of the ladder, `names.ts:95`). Deferred to the scope-aware resolver.

A note pins the "T100" property: because `cleanName` is **position-independent and pure**, for a **collision-free program** (every example chain so far) it is *exactly* the name the full namer would assign at T100 (`names.ts:4-7`).

## Collision resolution — designed, not yet wired

The doc anticipated a **collision-resolution upgrade**: running [[common-lexical-namer]] over a **scope tree** so two bindings that clean to the same JS name in overlapping scopes get a deterministic `${name}_${postfix}` (`names.ts:8-12`). It "slots in here without touching the lowering pass — it only changes what `cleanName` returns per binding." Tracked as **its own task** / **task #76** (`names.ts:12-13`, `:101-102`); the doc deferred to the lexical-namer package **SPEC §7** (`names.ts:13`).

The target resolver exists in [[common-lexical-namer]]: `resolveLexicalNames` resolves a tree of nested scopes with reservations propagating down the parent chain, siblings independent, deterministic JS-friendly tie form `${name}_${postfix}` (`lexical-namer/src/index.ts:1-27`, `:384`, and the JS-ident `resolveTie` note at `:250-253`). The wiring from `names.ts`'s `nameCandidates` ladder into that resolver is **not present** in this extracted repo — `nameCandidates` returns the ladder; nothing in chain-view consumes it through `resolveLexicalNames` yet.

## Adjacent naming heuristics (in scope of the projection)

Two more pure helpers the projection uses, both citing the same lowering concerns:

- **`elementName`** (`names.ts:114-135`): a readable **singular** element name for a collection node, turning `examples.map((__x) => …)` into `examples.map((example) => …)`. Fires only when the collection name is genuinely plural (`examples` → `example`, `(:scores c)` → `score`); returns `null` for singular bases; never returns `acc` (reserved for the reduce accumulator).
- **`destructureTuple`** (`names.ts:140-162`): the namer's **tuple solver** — if `param` is consumed only as `param[N]` literal indices, returns an array-destructuring pattern + rewritten body (`pair[1]` → `[first, second]` + `second`; index-0-only → `[head]`). Returns `null` when the param is ever used whole. v1 works on the lowered body **string**; a `param[N]` inside a string literal is the known limit (`:148-149`).

## What is NOT recoverable from code

- The doc's own section numbering (only "SPEC §7" of the *lexical-namer* package is cited; the JS-naming proposal's internal sections are not).
- The full ladder beyond tiers 1–2 + postfix — code evidences exactly `[base]` and `[base, isBase]` (`names.ts:103-111`); any additional designed rungs are not implemented here.
- The scope-tree integration design ("task #76") — referenced as future work; the connecting code is absent from this extraction.

See also [[arrival-chain-view]], [[common-lexical-namer]].
