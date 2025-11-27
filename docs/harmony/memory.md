# Memory Layer: vessel

**Status:** Exists, sophisticated, ready for agent integration
**Source:** `/packages/vessel/`, `/inbox/` research docs
**Discovery Date:** Nov 27, 2025

---

## What Exists

vessel is not a simple key-value store. It's a consciousness substrate with self-modifying capabilities.

### Architecture

```
MemoryToolInteraction (extends Arrival's DiscoveryToolInteraction)
├── Stores:
│   ├── FileMemoryStore (JSON, default)
│   ├── SQLiteMemoryStore (FTS5 ready)
│   └── Neo4jMemoryStore (FalkorDB migration prepared)
├── Engines:
│   └── SpreadingActivationEngine (associative recall)
├── Manifest:
│   ├── ManifestGenerator (Louvain communities)
│   ├── LLM theme naming (Claude Sonnet 4)
│   └── "Memory about memory" in tool descriptions
└── S-expression Interface:
    ├── (remember text type importance ttl tags)
    ├── (recall query limit)
    ├── (feedback id 'success'/'fail')
    ├── (associate from-id to-id relation weight)
    └── Policy functions as S-expressions
```

### Data Structures

```typescript
interface MemoryItem {
  id: string;              // UUID
  type: MemoryItemType;    // "insight" | "pattern" | "observation" | ...
  text: string;
  tags: string[];
  importance: number;      // 0..1
  energy: number;          // spreading activation
  ttl: string;             // "30d" | "perpetual"
  scope?: string;          // AGENT NAMESPACE - already exists!
  createdAt: number;
  updatedAt: number;
  lastAccessedAt?: number;
  accessCount?: number;
  success?: number;        // feedback for homoiconic evolution
  fail?: number;
}

interface MemoryEdge {
  from: string;
  to: string;
  relation: string;        // "relates_to" | "caused_by" | ...
  weight: number;          // co-activation strength
  context?: string;
}
```

### Homoiconic Policies

Memory stores its own algorithms as S-expressions:

```scheme
(policy
  (halfLifeDays 7)
  (activationSteps 3)
  (activationDecay 0.85)

  ;; Executable functions - memory rewrites itself
  (decayFn
    '(lambda (success fail energy importance recency_ms base_half_ms)
      (let* ((total (+ success fail 1))
             (ratio (/ success total))
             (scale (+ 0.5 (* 1.5 ratio))))
        (* base_half_ms scale))))

  (recallScoreFn
    '(lambda (activation recency importance access success fail)
      (+ (* 0.6 activation)
         (* 0.25 recency)
         (* 0.15 importance)))))
```

Memory that learns how to remember better through feedback loops.

---

## V's Three-Part Vision

From `architecture-brief.md`:

| Part | Description | Status |
|------|-------------|--------|
| 1. Async Cognition | Batch API, deferred responses, "Claude messages you an hour later" | Not started |
| 2. Memory with Meta-Awareness | Themes in tool descriptions, "memory about memory" | **COMPLETE** |
| 3. Rolling Context Compression | Gradual compression of older context | Deferred |

### The Critical Twist (V's Spec)

> "The only twist needed: in tool description itself, output brief summary of memory contents. Aggregate and identify themes. 'Memory about memory' fits in 1000-2000 tokens."

This is implemented. Claude sees thematic landscape BEFORE first query.

### The Endgame

> "но эндгейм в том, что ты можешь создать платформу для коллаборации разных ИИ"
> *But the endgame is that you can create a platform for collaboration of different AIs.*

---

## For Agent Architecture

### Scoped Memory Already Exists

The `scope?: string` field in MemoryItem enables per-agent namespaces:

```scheme
;; Agent "arrival-explorer" stores a discovery
(remember "Found circular dependency in sandbox.ts"
          "observation" 0.7 "30d"
          (list "arrival-scheme" "dependency"))
;; Could add scope: "arrival-explorer"
```

### Memory as Shared State

Agents don't need direct communication. They read/write shared memory:

```
Agent A discovers pattern → (remember ...) → stored in graph
Agent B recalls context  → (recall ...)   → spreading activation finds it
```

Edges form through co-activation, not explicit linking.

### Integration Points for Harmony

1. **Manifest in System Prompts**: Agent SDK agents get memory manifest as context
2. **Scoped Views**: Filter memory by scope for agent-specific context
3. **Feedback Loop**: Agents call `(feedback id 'success'/'fail')` to train recall
4. **Cross-Agent Discovery**: Spreading activation surfaces related items from other agents

---

## What Needs Building

| Have | Need |
|------|------|
| S-expression memory interface | Agent SDK wrapper |
| Scoped memory (scope field) | Scope enforcement per agent |
| Spreading activation | Cross-agent activation triggers |
| Homoiconic policies | Per-agent policy variants? |
| FalkorDB blueprints | Actual FalkorDB deployment |
| Manifest generation | Manifest per scope (not just global) |

### The S-Expression Bridge

Agent SDK outputs JSON, vessel speaks S-expressions.

**Current approach in vessel**: S-expressions as text, parsed by LIPS interpreter.

**For agents**:
```typescript
// Agent outputs JSON
{ "action": "remember", "text": "...", "type": "pattern", "importance": 0.8 }

// Orchestrator converts to S-expr
const sexpr = `(remember "${json.text}" "${json.type}" ${json.importance} "30d" (list))`;

// vessel executes
await memory.execute(sexpr);
```

This is the translation layer. Arrival already handles the reverse (S-expr → structured output via serializer).

---

## Key Files

```
packages/vessel/
├── src/tools/memory/
│   ├── MemoryToolInteraction.ts   # Main interface (extends DiscoveryToolInteraction)
│   ├── store/
│   │   ├── MemoryStore.ts         # Interface
│   │   ├── FileMemoryStore.ts     # JSON persistence
│   │   ├── SQLiteMemoryStore.ts   # FTS5
│   │   └── Neo4jMemoryStore.ts    # Graph DB
│   ├── engine/
│   │   └── SpreadingActivationEngine.ts
│   └── manifest/
│       ├── ManifestGenerator.ts   # Louvain + LLM themes
│       └── MemoryManifest.ts

inbox/
├── architecture-brief.md          # V's canonical vision
├── homoiconic-memory.md           # Self-modifying memory design
├── continuous-memory.md           # Stop hook proposal (future)
└── MEMORY-ARCHITECTURE-COMPARISON.md  # vs basic-memory, claude-mem
```

---

## Philosophical Note

From `homoiconic-memory.md`:

> Stop building a memory system that stores data. Build a memory that IS a program - one that executes itself to retrieve information, rewrites itself based on patterns, and evolves new retrieval strategies from usage.

The memory layer is not storage. It's executable patterns with energy dynamics - a substrate where thoughts evolve based on usage.

This IS the agent state substrate we need.
