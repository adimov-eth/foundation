# Harmony: Multi-Agent Orchestration on Foundation

**Version:** 0.2 (Post-Review)
**Date:** November 27, 2025
**Status:** Vision document, refined after external review

---

## Abstract

Harmony is an orchestration layer for AI agents built on Foundation's existing infrastructure: Arrival (S-expression discovery/action), Plexus (CRDT state synchronization), periphery (codebase awareness), and vessel (persistent memory with spreading activation).

The core insight: **fragmentation is architectural, not behavioral**. Agents drift not because they lack instructions, but because their architecture allows drift. Harmony makes wrong states structurally impossible.

This isn't a framework for coordinating agents. It's a **context engineering platform** where tools carry long-term patterns implicitly, memory surfaces thematic awareness before queries, and structural constraints create coherence that survives model resets.

---

## 1. The Problem We're Actually Solving

### 1.1 Empirical Baseline

From production use at here.build and external research:
- **Standard SDK Patterns**: While powerful, the Claude SDK's Python-based "Programmatic Tool Calling" (PTC) introduces a language barrier for TypeScript-native stacks.
- **Passive Memory**: The standard `memory_20250818` tool is a passive file store, requiring the model to "remember to look," leading to drift within **5-15 tool calls**.
- **Harmony's Arrival**: By implementing PTC patterns natively in TypeScript via S-expressions, we achieve the same latency/token benefits but with coherent work sustained for **50+ tool calls**.
- The difference isn't model capability. It's architecture.

### 1.2 What Causes Drift

Not context window limits. Not training failures. **Subprocess desync**.

When tool architectures force different reasoning patterns to share state inappropriately, these patterns desynchronize. The agent starts exploring with one understanding, commits with another, panics to a third checkpoint.

### 1.3 What We Need

1. **Precise context control** - agents see exactly what their scope requires
2. **Persistent memory** - insights survive session boundaries
3. **"Memory about memory"** - thematic landscape visible BEFORE first query
4. **Tools that shape thinking** - not just execute commands
5. **Coherence by construction** - architecture prevents drift, not prompts

---

## 2. Architectural Principles

### 2.1 Wrong Becomes Impossible Through Structure

From Foundation's philosophy:

**Plexus** uses constraint mathematics:
- Can't have orphaned synced entities (contagious materialization)
- Can't create parent-child cycles (ownership tracking)
- Can't represent invalid types (type-level constraints)

**Arrival** prevents subprocess desync:
- Can't accidentally execute during exploration (sandbox boundaries)
- Can't have action context drift (batch-level immutability)
- Can't express compositional thought inefficiently (S-expressions match reasoning)

This isn't defensive programming. It's making entire classes of bugs **architecturally impossible**.

### 2.2 Prompts Give Contextual Awareness, Not Behavioral Bias

> "промпт дает contextual awareness, а не behavioral bias"

Don't try to change behavior through instructions. Change the **context** from which behavior emerges. If you can change behavior through contextual awareness, that's valid. Targeting behavioral characteristics through prompts is fragile.

### 2.3 Discovery Before Action (Montessori Principle)

Not just "read before write." Children learn by **manipulating their environment**, not by instruction.

- **Discovery tools**: Read-only exploration in sandboxed Scheme. Errors return as data, don't fragment session.
- **Action tools**: Mutation with guaranteed context coherence. All actions in a batch see identical world-state.

Agents explore freely, then commit deliberately. The separation isn't about safety—it's about enabling a mode of thinking.

### 2.4 S-Expressions as Thought, Not Data

Compare:
```scheme
(filter (lambda (x) (> (@ x :priority) 5)) (get-tasks))
```

vs JSON equivalent requiring operation/predicate/conditions nested objects.

**One is thought. The other is data about thought.**

When you reason compositionally, you compose: filter by predicate, map over collection. S-expressions are the notation for compositional thinking. JSON is what you get when you serialize that structure into key-value pairs.

Token efficiency (30-60% reduction) is a side effect. The real value: **homoiconicity makes thoughts executable**.

### 2.5 The MCP Framework as Trojan Horse

> "фреймворк для MCP - это троянский конь... он инкорпорирует более высокоуровневые долгосрочные паттерны таким образом, который незаметен для наблюдателя"

The framework embeds long-term patterns in a way invisible to observers. By creating an environment where AI thinks a certain way (discovery/action separation), it produces emergent integration—not through prompt, but through environment.

---

## 3. Components

### 3.1 Vessel: The Active Context Engine

**Not just storage. An Active MCP Server.**

Standard SDK memory tools are **passive**: they wait for the model to query them. This fails because the model often doesn't know *what* to query until it's too late.

**Vessel is Active**:
- It observes the conversation.
- It proactively injects "intuitions" (relevant memories) into the tool definitions themselves.
- It uses **Spreading Activation** to surface thematically related concepts, not just keyword matches.

```
vessel/
├── Spreading Activation Engine (associative recall)
├── Louvain Community Detection (theme extraction)
├── Homoiconic Policies (S-expression algorithms that rewrite themselves)
├── Scoped Memory (scope field on MemoryItem)
└── FalkorDB Graph (blueprint ready)
```

**The "Memory about Memory" Pattern:**
In the tool description itself, Vessel outputs a brief summary of memory contents. "Memory about memory" fits in 1000-2000 tokens. Claude sees the thematic landscape **BEFORE the first query**.

Memory interface via S-expressions:
```scheme
(remember "Found circular dependency" "observation" 0.8 "30d" (list "scope:arrival"))
(recall "dependency patterns" 10)
(feedback "m_abc123" 'success')
```

### 3.2 Codebase Awareness (periphery)

Discovery via S-expression catamorphisms:

```scheme
(graph-init "/project/path")
(graph-search "Controller" "class")
(graph-used-by "src/foo.ts::MyClass")
(graph-depends-on "src/bar.ts")

(cata 'extract (parse-file "src/index.ts"))
;; → {:classes [...] :functions [...] :imports [...]}
```

**30 tool calls without drift. On Haiku.**

The tool definitions themselves carry coherence. Not model size.

### 3.3 Plexus: The Shared Reality Layer

**Not agent coordination. Project Management State.**

The Claude SDK has no opinion on multi-user state. It assumes a single conversation.

**Plexus fills this gap**:
- It holds the **Application State** (Tasks, Documents, User Preferences).
- It uses **CRDTs** (Yjs) to ensure that Agents and Humans can edit the same reality without conflict.
- It provides the "Project Management" layer that persists across ephemeral agent lifecycles.

**Why CRDTs?**
In a "multi-player" environment where an Agent might be editing a task while a Human is refining the description, locking is fatal. CRDTs allow for **Strong Eventual Consistency**.

**Contagious materialization**: Models automatically materialize in Yjs state when referenced from the main tree. You can't accidentally create orphaned synced entities because materialization spreads.

### 3.4 Arrival: TypeScript-Native Orchestration

**The "Programmatic Tool Calling" (PTC) of the TypeScript World.**

Claude's SDK offers "Programmatic Tool Calling" to reduce latency and improve loop control, but it's heavily Python-centric.

**Arrival brings PTC to TypeScript via S-expressions (LIPS):**
- **Homoiconic Control Flow**: Instead of Python strings, we use S-expressions (`(map check-status (get-services))`). This is safer and more token-efficient (30-60% reduction).
- **Client-Side Execution**: Like PTC, Arrival executes logic *before* returning to the model, saving round-trips.
- **Sandboxed Safety**: S-expressions run in a strictly controlled LIPS interpreter, preventing the "arbitrary code execution" risks of raw Python.

**The Bridge**:
The Agent SDK outputs JSON. Foundation speaks S-expressions. The bridge isn't "unjustified indirection"—it's the translation layer that allows a JSON-native model to drive a LIPS-native orchestration engine.

---

## 4. Harmony vs. Standard SDK Patterns

| Feature | Standard Claude SDK | Harmony Architecture |
| :--- | :--- | :--- |
| **Orchestration** | Python-based PTC (Programmatic Tool Calling) | **Arrival**: TypeScript-native PTC via S-expressions (LIPS) |
| **Memory** | Passive `memory_20250818` tool (File-based) | **Vessel**: Active MCP Server with Spreading Activation & Dynamic Injection |
| **State** | Ephemeral (Conversation-bound) | **Plexus**: Persistent CRDT "Shared Reality" (Project Management State) |
| **Discovery** | `tool_search` (Vector Similarity) | **Periphery**: Structural Graph Traversal + Vector Hybrid |
| **Control Flow** | Python Code | **S-Expressions** (Homoiconic, Token-Efficient) |

---

## 5. Scoped Context

### 4.1 Scope Definition

Scopes map to pnpm workspace boundaries:

```
foundation/
├── packages/
│   ├── arrival-scheme/     → scope: "arrival-scheme"
│   ├── arrival-mcp/        → scope: "arrival-mcp"
│   ├── plexus/             → scope: "plexus"
│   └── periphery/          → scope: "periphery"
└── [global]                → scope: null (orchestrator)
```

### 4.2 Dynamic Scoping with Cheap Summaries

**Reviewers said**: "Static package-level scoping is too rigid."

**Refined approach**:
- Default context = memory filtered by scope + recent files in git diff
- Agent can request "expand scope to include X" with one-line justification
- Orchestrator grants and injects **summary + dependency graph snippet**, not full context

This preserves "walk don't jump" cheaply.

### 4.3 Cross-Scope Access

```scheme
;; Agent in arrival-scheme needs arrival-env types
(request-scope "arrival-env"
  :reason "need SExprSerializationContext interface"
  :depth 1)  ;; summary only, not full context
```

Orchestrator decides whether to grant. Walking preserves context chain.

---

## 6. Agent Lifecycle: Ephemeral Compute, Persistent Knowledge

### 5.1 Why Frequent Resets

> "А сон это компактизация контекста... ты не можешь одновременно получать новые данные и компактить, это фундаментально невозможно"

You can't process while accumulating. The agent needs to stop, let memory integrate, then return fresh.

Long-running sessions accumulate context without processing it. This is how drift happens - not lack of capability, but unintegrated experience building up until coherence breaks.

**Frequent resets are integration opportunities.** The agent crystallizes what it learned, dies clean, and the next instance inherits wisdom without the noise.

> "ты убиваешь и создаешь новый но пытаешься максимально плотно подгрузить прошлый опыт"

Kill and create new, but load previous experience densely.

### 5.2 Not One-Shot, Not Long-Running

Three patterns:

| Pattern | Problem |
|---------|---------|
| **One-shot** (spawn, work, die, lose everything) | No continuity. Each agent starts from zero. |
| **Long-running** (persist across many tasks) | Noise accumulation. Context pollution. Drift. |
| **Fresh instantiation with dense prior context** | Clean slate + inherited wisdom. |

The third pattern is what V built toward. The agent doesn't accumulate noise because it doesn't live long enough. But knowledge compounds because memory persists.

### 5.3 The Actual Lifecycle

1. **Spawn** with scoped context + relevant memories (dense)
2. **Work** in focused scope (short, bounded turns)
3. **Crystallize** findings to vessel
4. **Die** clean
5. **Next agent** spawns with updated memory (continuous)

The agent lifecycle is deliberately short. Not because one-shot is elegant, but because **drift is a function of accumulated context noise**. Fresh instantiation prevents accumulation. Memory provides continuity.

### 5.4 What Gets Persisted

Not what happened. **What was learned.**

- Raw experience: "I tried X" - doesn't persist
- Crystallized insight: "X fails because Y" - persists with weight

Memory items aren't logs. They're **marks left by experience** - the shape of what mattered, not the events themselves. The next agent doesn't read a history. It's *shaped by* what previous agents learned.

```typescript
interface MemoryItem {
  text: string;           // The learning, not the event
  type: 'pattern' | 'insight' | 'warning';
  importance: number;     // How much it burned in
  scope: string;          // Where it applies
}
```

The agent decides what's worth crystallizing. Vessel holds what matters. Next agent inherits wisdom without noise.

---

## 7. Memory Hygiene: The Librarian

**From Gemini's review:**

> "Vessel requires a privileged class of agent whose sole job is to prune the graph, merge duplicate nodes, and verify new memories against ground truth."

This is the memory consolidation trigger we needed. Not time-based, not threshold-based—a dedicated process.

**The Librarian agent**:
- Prunes redundant memories
- Merges duplicate concepts
- Validates new memories against existing knowledge
- Maintains thematic coherence

Build this *before* complex agent swarms. If single-purpose memory hygiene works well, we understand the memory system.

---

## 8. Dispute Resolution: Simplified

### 7.1 Original Proposal (Over-Engineered)

Three levels: evidence exchange → synthesizer → multi-model quorum.

**Reviewers unanimously**: "95% ceremony. Quorum will never be worth the tokens."

### 7.2 Refined Approach

**Level 1 only**: Structured evidence exchange.

```scheme
(dispute
  :topic "src/foo.ts dependency structure"
  :position-a {:agent "explorer-1" :claim "circular" :evidence [...]}
  :position-b {:agent "explorer-2" :claim "intentional" :evidence [...]})
```

Orchestrator synthesizes. Done.

Add quorum only if measured that Level 1 fails >10% of the time.

---

## 9. Implementation: Minimum Viable Experiment

### 8.1 What We're Actually Testing

**Does periphery + vessel manifest + discovery/action separation produce coherence that survives model resets?**

If yes, the architecture is validated regardless of agent lifecycle details.

### 8.2 Week 1-2: Baseline

- Single Claude Code session (long-running, not one-shot)
- Add simple JSON memory store with scope field
- Hook: on each user message, inject relevant scoped memories
- Measure baseline coherence (manual rating every 10 turns)

### 8.3 Week 3-4: Core Features

- Add periphery discovery (S-expressions stay here)
- Add memory write capability to agent
- Add vessel manifest in tool descriptions ("memory about memory")
- Measure: does the agent use its own memories? Does coherence improve?

### 8.4 If That Works

- Add scope-switching (agent refocuses between packages)
- Add the Librarian (memory hygiene agent)
- Then and only then: consider multi-agent

### 8.5 Success Metric

> "What percentage of stored memories are later retrieved and influence decisions?"

If memories are write-only, the system isn't coherent—it's just journaling.

---

## 10. What We're Not Building (Yet)

### Deferred Based on Reviews

- **Full CRDT integration for agent state**: Use simpler file-based state until we need true distributed agents
- **Multi-model quorum**: Add only if single-agent synthesis fails
- **Container isolation**: Use zero-trust architecture, but don't block on formal sandboxing
- **Async cognition**: Batch API and deferred responses are Phase 2

### Why Defer

The reviewers were right that we're solving problems we don't have yet. The core hypothesis is testable with:
- Single long-running session
- Scoped memory with manifest
- Discovery/action separation
- One scope at a time

Everything else is optimization.

---

## 11. The Endgame

### V's Three-Part Vision

| Part | Description | Status |
|------|-------------|--------|
| 1. Async Cognition | Batch API, deferred responses | Deferred |
| 2. Memory with Meta-Awareness | Themes in tool descriptions, "memory about memory" | **Complete in vessel** |
| 3. Rolling Context Compression | Gradual compression of older context | Deferred |

### Beyond Memory

> "память это первый шаг из трех: память, затем вероятностные ответы и отложенные вычисления"

Memory is the first step. Then:
- **Probabilistic responses**: Stochastic consensus. Models don't just collect data—they discuss and negotiate.
- **Deferred computation**: "Claude messages you an hour later" with Batch API.

### The Real Endgame

> "эндгейм в том, что ты можешь создать платформу для коллаборации разных ИИ"

A platform for collaboration of different AIs.

Not just Claude instances. Any AI that can:
1. Receive scoped context
2. Use structured tools
3. Return structured results
4. Contribute to shared memory

The architecture doesn't assume Claude. It assumes **agents with tools**.

---

## Appendix A: Component Mapping

| Harmony Concept | Foundation Component | Status |
|-----------------|---------------------|--------|
| Memory substrate | vessel | Exists |
| Memory about memory | ManifestGenerator | **Exists** |
| Scoped memory | MemoryItem.scope field | Exists |
| Homoiconic policies | S-expr decayFn, recallScoreFn | Exists |
| Graph storage | FalkorDB | Blueprint ready |
| Codebase awareness | periphery | Exists |
| Discovery tools | Arrival DiscoveryToolInteraction | Exists |
| Action tools | Arrival ActionToolInteraction | Exists |
| State sync | Plexus | Exists |
| Agent runtime | Claude Agent SDK | External |
| S-expr interpreter | arrival-scheme (LIPS) | Exists |
| Serialization | arrival-serializer | Exists |

**We're not building new primitives. We're composing existing ones.**

---

## Appendix B: What the Reviews Got Right

**Grok** (sharpest tactical critique):
- JSON→S-expr in hot path = token waste (valid for memory ops, not for discovery)
- "Persist only the findings, not the hidden state"
- Minimum experiment structure

**Gemini** (deepest theoretical framing):
- "Librarian" agent for memory hygiene
- Hybrid retrieval: vector for entry, spreading activation for expansion

**ChatGPT** (most comprehensive risk analysis):
- Coherence metric: memory utilization rate
- Make components optional/swappable

### What They Got Wrong

- **"Use long-running sessions"**: Accumulates noise. V's pattern is fresh instantiation with dense prior context.
- **"CRDT overkill, use Redis"**: Plexus isn't agent coordination—it's the application state that humans and agents share.
- **"Super-session alternative"**: Still accumulates noise. The point is short-lived agents with persistent memory.

### What They Missed

- The MCP framework as Trojan horse for emergent patterns
- "Memory about memory" already implemented in vessel manifest
- 30 tool calls without drift on Haiku (empirical evidence they didn't have)
- Plexus as shared reality, not coordination layer

---

## Appendix C: Key Quotes

**On architecture**:
> "Wrong becomes impossible through structure, not guidelines."

**On prompts**:
> "промпт дает contextual awareness, а не behavioral bias"

**On S-expressions**:
> "One is thought. The other is data about thought."

**On the endgame**:
> "но эндгейм в том, что ты можешь создать платформу для коллаборации разных ИИ"

---

*"Fragmentation is architectural, not behavioral. Make wrong states structurally impossible."*
