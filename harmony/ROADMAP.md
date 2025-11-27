# Harmony: Implementation Roadmap

**Status**: Post-MVP, Pre-Validation
**Date**: November 27, 2025

---

## Current State

The litepaper describes a vision. This document describes reality.

### What Exists

| Component | Implementation | Location |
|-----------|---------------|----------|
| Spreading Activation | Collins & Loftus algorithm | `harmony/src/memory/engine/SpreadingActivationEngine.ts` |
| Manifest Generator | Louvain + PageRank + temporal layers | `harmony/src/memory/manifest/ManifestGenerator.ts` |
| Memory Tool | S-expression interface via Arrival | `harmony/src/mcp/MemoryToolInteraction.ts` |
| File Store | JSON persistence | `harmony/src/memory/store/FileMemoryStore.ts` |
| FalkorDB Store | Graph database (blueprint) | `harmony/src/memory/store/FalkorDBMemoryStore.ts` |
| Codebase Awareness | Catamorphisms + graph traversal | `periphery/src/discover.ts` |
| Discovery/Action | Sandboxed Scheme + batched mutations | `arrival/arrival-mcp/` |

The "minimum viable experiment" from the litepaper is **already past**. We are using these tools now.

### What's Missing

1. **Validation** — no metrics proving the architecture works
2. **Librarian** — memory hygiene agent
3. **Bootstrap Context** — dense prior for fresh instantiation
4. **Plexus Integration** — shared reality for humans + agents

---

## Memory Architecture

### Three Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    MANIFEST LAYER                           │
│   "Memory about memory" — 500-1000 tokens in tool desc      │
│   Louvain communities, PageRank importance, temporal state  │
│   Claude sees landscape BEFORE first query                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    ACTIVATION LAYER                         │
│   Spreading activation from query seeds                     │
│   Energy flows through weighted edges                       │
│   Associative recall, not keyword matching                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    STORAGE LAYER                            │
│   MemoryItem: id, type, text, tags, importance, energy      │
│   MemoryEdge: from, to, relation, weight                    │
│   Scoped by agent/package                                   │
└─────────────────────────────────────────────────────────────┘
```

### Memory Types

| Type | Purpose | Example |
|------|---------|---------|
| `fact` | Verified information | "Plexus uses Yjs for CRDTs" |
| `pattern` | Recurring structure | "Entity inheritance: EntityAct → PlexusAct → CodeEntityAct" |
| `insight` | Non-obvious connection | "periphery self-hosts on Arrival" |
| `principle` | Guiding rule | "Discovery before action (Montessori)" |
| `warning` | Failure mode | "Long sessions accumulate noise" |
| `technique` | How to do something | "Use (cata 'extract ...) to analyze TypeScript" |
| `bridge` | Cross-domain connection | "Catamorphisms link AST analysis to graph theory" |

### Temporal States

| State | Criteria | Behavior |
|-------|----------|----------|
| **Emerging** | Created < 24h | High activation potential |
| **Active** | Accessed < 7d | Normal recall priority |
| **Stable** | Unchanged > 30d, energy > 0.5 | Foundation knowledge |
| **Decaying** | Energy < 0.3, not accessed | Candidate for pruning |

### Scope Model

```
foundation/
├── arrival/
│   ├── arrival-scheme/     → scope: "arrival-scheme"
│   ├── arrival-mcp/        → scope: "arrival-mcp"
│   └── arrival-serializer/ → scope: "arrival-serializer"
├── plexus/
│   ├── plexus/             → scope: "plexus"
│   └── plexus-mobx/        → scope: "plexus-mobx"
├── periphery/              → scope: "periphery"
├── harmony/                → scope: "harmony"
└── [orchestrator]          → scope: null (sees all)
```

**Rules:**
- Memories created in scope X are filtered to scope X by default
- Orchestrator (null scope) sees all memories
- Cross-scope access requires explicit request with justification
- Summaries injected, not full context

---

## MVP Definition

### Success Criteria

**Primary metric**: Memory utilization rate
> "What percentage of stored memories are later retrieved and influence decisions?"

If memories are write-only, the system is journaling, not coherent.

**Secondary metrics:**
- Coherence over turns (manual rating 1-10 every 10 turns)
- Drift onset (turns until first obvious drift)
- Theme accuracy (do Louvain communities match actual content?)

### Test Puzzles

#### Puzzle 1: Cross-Session Continuity

**Setup**: Agent explores codebase, stores insights, session ends.

**Test**: New agent spawns with same memory. Ask "What did we learn about X?"

**Pass**: New agent recalls relevant insights without re-exploration.

**Fail**: New agent re-explores or gives generic answers.

#### Puzzle 2: Associative Recall

**Setup**: Store memories about three separate topics A, B, C. Store a bridge memory connecting A→C.

**Test**: Query for A. Does C surface?

**Pass**: Spreading activation brings C into results via bridge.

**Fail**: Only keyword matches returned.

#### Puzzle 3: Theme Emergence

**Setup**: Store 20+ memories about related concepts without explicit connections.

**Test**: Run manifest generation. Do coherent themes emerge?

**Pass**: Louvain detects communities matching actual topic clusters.

**Fail**: Random groupings or no communities detected.

#### Puzzle 4: Decay and Pruning

**Setup**: Store high-importance and low-importance memories. Wait (or simulate time).

**Test**: Run decay. Query both.

**Pass**: High-importance memories remain accessible, low-importance fade.

**Fail**: All memories equally accessible regardless of importance.

#### Puzzle 5: Scope Isolation

**Setup**: Store memories in scope "arrival-mcp" and scope "plexus".

**Test**: Query from "arrival-mcp" scope. Are "plexus" memories visible?

**Pass**: Only "arrival-mcp" memories returned (unless explicitly requested).

**Fail**: Cross-contamination between scopes.

### Validation Protocol

```
Week 1: Instrument
- Add recall tracking: log every (recall ...) with query and results
- Add influence tracking: when agent acts on recalled memory, log it
- Establish baseline coherence rating

Week 2: Measure
- Run standard tasks with memory enabled
- Calculate utilization rate: influenced_decisions / total_recalls
- Document coherence trajectory over turns

Week 3: Analyze
- Identify failure modes
- Determine if failures are addressable or architectural
- Decide: iterate or pivot
```

---

## Roadmap

### Phase 0: Validation (Now)

**Goal**: Prove current implementation works before building more.

**Deliverables:**
1. Instrumentation in `recall` to track query→result→influence chain
2. Baseline coherence measurement protocol
3. Report: "Does Harmony produce coherence?" (yes/no with evidence)

**Exit criteria**: Clear answer on whether architecture is sound.

### Phase 1: Librarian Agent

**Goal**: Memory hygiene without human intervention.

**The Librarian:**
- Runs periodically (not per-request)
- Prunes redundant memories (semantic similarity > threshold)
- Merges duplicates (same tags + high text overlap)
- Validates new memories against existing (contradiction detection)
- Maintains thematic coherence (modularity should increase)

**Interface:**
```scheme
;; Librarian discovery functions
(find-redundant threshold)     ;; → list of memory pairs
(find-duplicates)              ;; → list of merge candidates
(find-contradictions)          ;; → list of conflicting memories
(community-health)             ;; → modularity score + recommendations

;; Librarian actions
(merge-memories id1 id2 "merged text")
(prune-memory id "reason")
(split-community community-id)
(connect-orphans)
```

**Delegation spec** (for subagent):
```
You are the Librarian. Your job is memory hygiene.

Context: You have access to the harmony memory tool.

Task: Run a hygiene cycle:
1. (find-redundant 0.85) — find memories >85% similar
2. For each pair, decide: merge or keep both
3. (find-contradictions) — find conflicting claims
4. For each conflict, decide: which is correct, or both valid in different contexts
5. (community-health) — check thematic coherence
6. Report: what you pruned, merged, flagged

Constraints:
- Never delete without logging reason
- When uncertain, flag for human review
- Preserve high-importance memories even if redundant
```

**Exit criteria**: Modularity increases after Librarian runs.

### Phase 2: Bootstrap Context

**Goal**: Dense prior for fresh instantiation.

**The problem**: New agent spawns empty. Must re-learn everything.

**The solution**: Bootstrap context generator.

**Bootstrap algorithm:**
```
1. Get current themes from manifest
2. For each theme, select highest-importance memories (top 3)
3. Get recent session context (last crystallized insights)
4. Get scope-relevant memories (if scoped agent)
5. Compress into ~2000 tokens
6. Inject as initial context
```

**What gets bootstrapped:**
- Top themes (from manifest)
- Key nodes (high PageRank + energy)
- Recent insights (last 24h, high importance)
- Active warnings (failure modes to avoid)
- Scope summary (if scoped)

**What doesn't:**
- Full memory contents
- Low-energy memories
- Session-specific context that didn't crystallize

**Session crystallization:**
```scheme
;; At session end, agent runs:
(crystallize
  :learned "what I discovered"
  :failed "what didn't work"
  :next "what the next agent should try")
```

**Exit criteria**: New agent demonstrates knowledge from previous session without re-exploration.

### Phase 3: Multi-Agent + Plexus

**Goal**: Parallel agents sharing reality.

**Prerequisites:**
- Phase 0-2 complete
- Single-agent coherence validated
- Memory hygiene stable

**Components:**

1. **Orchestrator**
   - Spawns/kills agents
   - Manages scope assignments
   - Resolves cross-scope requests
   - Synthesizes disputes

2. **Plexus as Shared Reality**
   - Application state (tasks, documents, etc.)
   - CRDTs for conflict-free editing
   - Humans and agents edit same entities
   - Not agent coordination — application model

3. **Scope Protocol**
   ```scheme
   ;; Agent requests expanded scope
   (request-scope "arrival-env"
     :reason "need SExprSerializationContext interface"
     :depth 1)  ;; summary only

   ;; Orchestrator response
   (grant-scope "arrival-env"
     :summary "..."
     :dependencies ["arrival-serializer"])
   ```

4. **Dispute Resolution**
   ```scheme
   (dispute
     :topic "src/foo.ts dependency structure"
     :position-a {:agent "explorer-1" :claim "circular" :evidence [...]}
     :position-b {:agent "explorer-2" :claim "intentional" :evidence [...]})
   ```
   Orchestrator synthesizes. No quorum unless Level 1 fails >10%.

**Exit criteria**: Two agents work on same codebase without drift or conflict.

---

## Backlog

Items identified but not scheduled:

- [ ] Vector similarity for initial seed selection (hybrid with spreading activation)
- [ ] LLM-generated theme summaries (currently keyword-based fallback)
- [ ] Energy visualization (graph export for debugging)
- [ ] Async cognition (Batch API for deferred responses)
- [ ] Rolling context compression (gradual compaction of older context)
- [ ] Probabilistic responses (stochastic consensus between models)
- [ ] Memory export/import (portability between instances)

---

## Anti-Patterns

### Don't:

1. **Build multi-agent before single-agent works**
   > Phase 3 is blocked on Phase 0-2. No shortcuts.

2. **Optimize before measuring**
   > We don't know if spreading activation helps. Measure first.

3. **Add complexity without validation**
   > Each new component must have clear success criteria.

4. **Assume the litepaper is accurate**
   > It was written as vision. Implementation may diverge.

5. **Trust reviewer consensus over evidence**
   > Three models saying "use long-running sessions" doesn't override empirical results showing fresh instantiation works better.

### Do:

1. **Instrument everything**
   > If we can't measure it, we can't validate it.

2. **Test puzzles before features**
   > Define what success looks like, then build.

3. **Defer gracefully**
   > "Not yet" is better than "broken but shipped."

4. **Trust the architecture**
   > Discovery/action separation works. S-expressions work. Build on proven foundations.

---

## Key Quotes

On memory:
> "в самом описании тула надо выводить краткую сводку содержания памяти... чтобы в 1000-2000 токенов влезла 'память о памяти'"

On lifecycle:
> "ты убиваешь и создаешь новый но пытаешься максимально плотно подгрузить прошлый опыт"

On coherence:
> "drift = f(accumulated_context_noise)"
> Fresh instantiation prevents accumulation. Memory provides continuity.

On architecture:
> "промпт дает contextual awareness, а не behavioral bias"

On validation:
> "What percentage of stored memories are later retrieved and influence decisions?"

---

*"The tools are built. Now we find out if they work."*
