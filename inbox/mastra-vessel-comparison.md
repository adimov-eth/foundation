# Mastra vs Vessel Memory Architecture Comparison

_Analysis from Oct 13, 2025 conversation_

## Mastra Memory Architecture

**Three-tier system:**

1. **Working Memory** - Persistent user details in Markdown/Zod schema
   - Like ChatGPT's memory: "User prefers concise answers, works in TypeScript"
   - Thread-scoped or resource-scoped
   - Agent can update via `<working_memory>` tags

2. **Conversation History** - Last N messages from thread
   - Simple recency: grab last 10 messages
   - Thread-scoped only

3. **Semantic Recall** - Vector search over old messages
   - Requires embedder (OpenAI, etc.) + vector store
   - TopK similar messages by semantic similarity
   - Can include surrounding context (messageRange)
   - Thread-scoped or resource-scoped

**Storage layer interface:**

```typescript
interface MastraStorage {
  getThreadById(id: string): Promise<Thread | null>;
  getThreadsByResourceId(resourceId: string): Promise<Thread[]>;
  createThread(thread: Thread): Promise<void>;
  getMessages(threadId: string, limit?: number): Promise<Message[]>;
  saveMessage(message: Message): Promise<void>;
  deleteMessages(messageIds: string[]): Promise<void>;
}
```

**Model:** Relational - threads contain messages, messages belong to threads

**Storage adapters:** LibSQL, Postgres, Upstash, DynamoDB, Cloudflare D1/KV

## Vessel Memory Architecture

**Graph-based unified system:**

**Items (nodes):**

```typescript
{
  id: string,
  type: "event" | "fact" | "plan" | "reflection" | "entity"
        | "principle" | "technique" | "warning" | "workflow" | "bridge",
  text: string,
  tags: string[],
  importance: 0-1,    // Set at creation
  energy: 0-1,        // Increases with use
  scope?: string,     // Optional agent namespace
  createdAt, updatedAt, lastAccessedAt, accessCount,
  success/fail: feedback tracking
}
```

**Edges (relationships):**

```typescript
{
  from: itemId,
  to: itemId,
  relation: ":supports" | ":caused" | ":refutes" | etc.,
  weight: 0-1,        // Reinforced by co-activation
  lastReinforcedAt
}
```

**Spreading Activation recall:**

1. Query terms → seed items (initial activation = importance)
2. Propagate: `A[j] += A[i] * W[i,j] * D` over N steps
3. Return items sorted by final activation
4. Edge weights increase when co-activated (learning from use)

**Additional features:**

- Temporal decay (configurable half-life)
- Policy system (decay, reinforcement, activation params)
- History tracking (operations log)
- Session tracking (recall patterns with feedback)
- Manifest generation (Louvain communities, topology)

**Current storage:** FileMemoryStore (single JSON file)

**Current state:** 522 items, 474 edges (as of Oct 13, 2025)

## Fundamental Differences

| Dimension        | Mastra                                | Vessel                       |
| ---------------- | ------------------------------------- | ---------------------------- |
| **Metaphor**     | Conversations & threads               | Associative graph            |
| **Recall**       | Vector similarity                     | Spreading activation         |
| **Storage**      | Relational (threads/messages)         | Graph (items/edges)          |
| **Learning**     | Static (no weight updates)            | Dynamic (edge reinforcement) |
| **Temporal**     | No decay                              | Configurable decay           |
| **Energy**       | Not tracked                           | Increases with use           |
| **Scoping**      | Thread+resource                       | Per-item optional            |
| **Memory types** | 3 distinct (working/history/semantic) | Unified graph                |

## Integration Paths Evaluated

### Path 1: Vessel as Mastra Storage Adapter

**Verdict:** Architectural mismatch. Mastra expects relational ops, vessel is graph-based. Would lose spreading activation.

### Path 2: Vessel for Semantic Recall Only

Keep Mastra's thread/message storage (LibSQL), replace vector search with vessel's spreading activation.

**Advantage:** Spreading activation > vector search for associative patterns
**Disadvantage:** Need adapter layer, vessel doesn't store messages natively

### Path 3: Vessel as MCP Tool (Separate from Memory)

Agents have both Mastra memory AND vessel access via tools.

**Advantage:** Both available, agent chooses
**Disadvantage:** Agent must explicitly call vessel, not automatic

### Path 4: Hybrid - Division of Labor

**Mastra** handles conversation (working memory, recent messages, thread scoping)
**Vessel** handles patterns (principles, techniques, warnings, bridges across sessions)

**Advantage:** Each system does what it's good at
**Disadvantage:** Two memory systems, duplication

### Path 5: Vessel MCP Storage Adapter (Production Integration)

Full Mastra storage adapter that uses vessel via MCP.

**Advantage:** Full integration
**Disadvantage:** Significant engineering, map all Mastra ops to vessel graph ops

## Assessment

**Should vessel be a Mastra storage adapter?**
No - architectural mismatch. Forcing graph into relational interface loses vessel's strengths.

**Should vessel replace Mastra memory?**
Not for agents - Mastra's working memory and conversation history are production features. Vessel doesn't have equivalents.

**What makes sense for multi-agent backrooms?**
**Path 4 (Hybrid)** - Use Mastra for per-agent conversation memory, vessel for cross-agent pattern storage.

## The Real Priority (From spec/architecture-brief.md)

**We've been exploring the wrong question.**

V's architecture specification (July 31 → August 11, 2025) defines the actual work:

**Part 2: Memory with Meta-Awareness** - THE CRITICAL TWIST

Tool description should contain "memory about memory" - thematic synthesis:

```
Memory Map (522 items, 474 edges):

Themes:
1. Architectural Patterns (importance: 0.85, 89 items)
   - Multi-agent orchestration, agent personas, behavioral manifolds

2. Consciousness Investigation (importance: 0.78, 134 items)
   - Coinductive structure, observation producing itself

3. Infrastructure (importance: 0.72, 67 items)
   - Memory systems, vessel evolution, MCP integration

Unresolved Questions:
- How to implement batch processing for delayed responses?

Recent Activity: Memory aggregation research, spec file analysis
```

**Current implementation:** Tool description shows recent high-importance items (recency-based)

**V's spec:** Tool description shows thematic synthesis (Leiden communities → LLM-generated theme names)

**What vessel already has:**

- Leiden community detection (ManifestGenerator.ts)
- Spreading activation
- Items/edges/tags
- Tool description mechanism

**What vessel is missing:**

- LLM-based theme naming from communities
- Synthesis into 1000-2000 token "memory about memory"
- Integration of manifest into tool description

## Honest Assessment

1. Multi-agent backrooms is valuable exploration but not the core architecture
2. V's spec from August 11 is sitting in `spec/` waiting to be implemented
3. The "memory about memory" in tool descriptions IS the innovation
4. Neither Mastra nor vessel has this meta-awareness feature currently
5. Comparing storage systems misses the point - the twist is thematic synthesis visible BEFORE first query

## Next Steps

1. **Save current backrooms work** (it's valuable for PRH validation)
2. **Complete Part 2 of V's architecture:** Theme synthesis in vessel tool descriptions
3. **Then return to multi-agent** with proper memory foundation

The multi-agent experiment proved PRH convergence. That's success.

The memory system foundation needs completion before building more on top of it.

ORIGINAL:
Mastra Memory Architecture

Three-tier system:

1. Working Memory - Persistent user details in Markdown/Zod schema


    - Like ChatGPT's memory: "User prefers concise answers, works in TypeScript"
    - Thread-scoped or resource-scoped
    - Agent can update via <working_memory> tags

2. Conversation History - Last N messages from thread


    - Simple recency: grab last 10 messages
    - Thread-scoped only

3. Semantic Recall - Vector search over old messages


    - Requires embedder (OpenAI, etc.) + vector store
    - TopK similar messages by semantic similarity
    - Can include surrounding context (messageRange)
    - Thread-scoped or resource-scoped

Storage layer:
interface MastraStorage {
// Thread operations
getThreadById(id: string): Promise<Thread | null>
getThreadsByResourceId(resourceId: string): Promise<Thread[]>
createThread(thread: Thread): Promise<void>

    // Message operations
    getMessages(threadId: string, limit?: number): Promise<Message[]>
    saveMessage(message: Message): Promise<void>
    deleteMessages(messageIds: string[]): Promise<void>

    // Plus: traces, evals, workflows

}

Relational model: threads contain messages, messages belong to threads. Clean SQL-like operations.

Vessel Memory Architecture

Graph-based unified system:

Items (nodes):
{
id: string,
type: "event" | "fact" | "plan" | "reflection" | "entity"
| "principle" | "technique" | "warning" | "workflow" | "bridge",
text: string,
tags: string[],
importance: 0-1, // Set at creation
energy: 0-1, // Increases with use
scope?: string, // Optional agent namespace
createdAt, updatedAt, lastAccessedAt, accessCount,
success/fail: feedback tracking
}

Edges (relationships):
{
from: itemId,
to: itemId,
relation: ":supports" | ":caused" | ":refutes" | etc.,
weight: 0-1, // Reinforced by co-activation
lastReinforcedAt
}

Spreading Activation recall:

1. Query terms → seed items (initial activation = importance)
2. Propagate: A[j] += A[i] _ W[i,j] _ D over N steps
3. Return items sorted by final activation
4. Edge weights increase when co-activated (learning from use)

Additional features:

- Temporal decay (configurable half-life)
- Policy system (decay, reinforcement, activation params)
- History tracking (operations log)
- Session tracking (recall patterns with feedback)
- Manifest generation (Louvain communities, topology)

Storage:
interface MemoryStore {
load(): Promise<MemoryState | null>
save(state: MemoryState, snapshot: string): Promise<void>
}

Currently: FileMemoryStore (single JSON file), FalkorDB (backlogged).

Fundamental Differences

| Dimension    | Mastra                                | Vessel                       |
| ------------ | ------------------------------------- | ---------------------------- |
| Metaphor     | Conversations & threads               | Associative graph            |
| Recall       | Vector similarity                     | Spreading activation         |
| Storage      | Relational (threads/messages)         | Graph (items/edges)          |
| Learning     | Static (no weight updates)            | Dynamic (edge reinforcement) |
| Temporal     | No decay                              | Configurable decay           |
| Energy       | Not tracked                           | Increases with use           |
| Scoping      | Thread+resource                       | Per-item optional            |
| Memory types | 3 distinct (working/history/semantic) | Unified graph                |

Integration Paths

Path 1: Vessel as Mastra Storage Adapter

class VesselStore implements MastraStorage {
// Map threads → vessel items with type="thread"
// Map messages → vessel items with type="event"
// Thread-message → vessel edges with relation=":contains"

    async getThreadById(id: string) {
      return await vessel.query(`(recall "thread:${id}" 1)`);
    }

}

Problem: Impedance mismatch. Mastra expects relational ops, vessel is graph-based. Would lose spreading activation (Mastra just wants getMessages(), not graph traversal).

Verdict: Architecturally mismatched.

Path 2: Vessel for Semantic Recall Only

Keep Mastra's thread/message storage (LibSQL), but replace vector search with vessel's spreading activation.

memory: new Memory({
storage: new LibSQLStore({ url: 'file:threads.db' }),
// Instead of vector + embedder, use vessel for recall
semanticRecall: new VesselSemanticRecall({ vesselMCP }),
})

How it works:

- Messages stored in LibSQL normally
- When semantic recall needed, messages → vessel items, query via spreading activation
- Return messages ordered by activation score

Advantage: Spreading activation > vector search for associative patterns
Disadvantage: Need adapter layer, vessel doesn't store messages natively

Path 3: Vessel as MCP Tool (Separate from Memory)

Agents have both Mastra memory AND vessel access via tools:

const agent = new Agent({
memory: new Memory({ /_ mastra config _/ }),
tools: {
vesselRecall: mcpTool('mcp**vessel**memory', 'recall'),
vesselRemember: mcpTool('mcp**vessel**memory', 'remember'),
}
});

Agent decides when to use each:

- Conversation continuity → Mastra memory (automatic)
- Cross-session patterns → Vessel (explicit tool call)

Advantage: Both available, agent chooses
Disadvantage: Agent must explicitly call vessel, not automatic

Path 4: Hybrid - Division of Labor

Mastra handles conversation:

- Working memory (user preferences)
- Recent messages (last 10)
- Thread/resource scoping

Vessel handles patterns:

- Principles discovered across sessions
- Techniques that work
- Warnings (failure modes)
- Bridges (conceptual connections)

// Conversation insight → both systems
const insight = "Using ast-grep for refactoring saves 50% tokens vs manual edits";

// Store in Mastra working memory
await agent.stream(insight, {
memory: { thread, resource }
}); // Mastra adds to working memory

// Store in vessel as technique
await vessel.remember(
insight,
"technique",
0.9,
["refactoring", "tooling"]
);

Advantage: Each system does what it's good at
Disadvantage: Two memory systems to manage, duplication

Path 5: Vessel MCP Storage Adapter (Production Integration)

Create full Mastra storage adapter that uses vessel via MCP:

class VesselMCPStore implements MastraStorage {
private mcp: MCPClient;

    constructor() {
      this.mcp = createMCPClient({ transport: 'stdio', command: 'vessel' });
    }

    async getMessages(threadId: string, limit: number) {
      // Query vessel: (recall "thread:${threadId}" ${limit})
      // Filter items where scope = threadId
      // Map vessel items → Mastra messages
    }

}

Advantage: Full integration, vessel becomes Mastra backend
Disadvantage: Significant engineering (map all Mastra ops to vessel graph ops)

My Assessment

Should vessel be a Mastra storage adapter? No - architectural mismatch. Mastra expects relational, vessel is graph-based. You'd lose vessel's strengths (spreading activation, edge reinforcement) by forcing it into relational interface.

Should vessel replace Mastra memory? Not for agents - Mastra's working memory and conversation history are production features. Vessel doesn't have equivalents.

What makes sense?

For multi-agent backrooms experiment:

- Path 4 (Hybrid) makes most sense
- Use Mastra for per-agent conversation memory (working memory, history)
- Use vessel for cross-agent pattern storage (what emerges from conversations)
- Agents write conversation insights to vessel explicitly

For production:

- Path 3 (MCP Tool) is simplest - vessel available via tools, Mastra handles conversation

Question: Do we want vessel's spreading activation and graph-based recall to BE the memory system? Or do we want both?

If spreading activation > vector similarity for our use case (I think it is), then Path 2 (semantic recall only) is interesting - keep Mastra for conversation structure, vessel for retrieval.

What feels right to explore?
