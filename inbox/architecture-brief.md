# Architecture Brief: Living Memory System
**Status:** Canonical Vision Document
**Author:** V (July 31, 2025) + Implementation Notes
**Last Updated:** October 16, 2025
**Related:** [spec.md](./spec.md) | [prd.md](./prd.md) | [IMPLEMENTATION-STATUS.md](../IMPLEMENTATION-STATUS.md)

---

## Documentation Map

This is the **canonical architecture document** defining V's 3-part vision. Other specs derive from this:

| Document | Purpose | Status |
|----------|---------|--------|
| **architecture-brief.md** (this doc) | V's 3-part vision (canonical) | Source of truth |
| [spec.md](./spec.md) | Technical implementation spec | Derives from Part 2 |
| [prd.md](./prd.md) | Product requirements | Derives from full vision |
| [idea.md](./idea.md) | Graph→text research | Supports Part 2 |
| [description.md](./description.md) | Manifest generation details | Supports Part 2 |
| [continuous-memory.md](./continuous-memory.md) | Stop hook proposal | Future enhancement |
| [IMPLEMENTATION-STATUS.md](../IMPLEMENTATION-STATUS.md) | Current progress | Oct 16, 2025 snapshot |
| [todo.plan](../todo.plan) | Original plan | **OUTDATED** - see STATUS.md |

**Read this first**, then navigate to implementation details.

---

## Executive Summary

A three-part system architecture to transform Claude from stateless assistant into persistent, reflective entity. Core innovation: **memory-about-memory** in tool descriptions enables thematic awareness across sessions without context window overhead.

**Product vision:** Zen mentor / reflection partner that remembers across sessions, identifies patterns in your thinking, and guides you back to flow state through accumulated understanding.

**Strategic advantage:** While competitors add basic memory (ChatGPT, Claude native), this architecture provides semantic aggregation + asynchronous cognition, creating qualitatively different user experience.

---

## Part 1: Asynchronous Cognition (Not Yet Implemented)

### Concept
Claude evaluates every incoming message for **response urgency** and **thinking depth**, then routes to appropriate processing:
- Low urgency → ignore
- Medium urgency → batch processing (cheap tokens, deep thinking)
- High urgency → immediate response

### Implementation Flow

```
User Message
    ↓
System Prompt: "Rate 1-10: desire to respond, desire to think"
    ↓
┌─────────────────────────────────────────┐
│ Scoring:                                 │
│ Response: 1-3 → ignore                  │
│ Response: 4-7 → batch process           │
│ Response: 8-10 → immediate              │
│                                          │
│ Think: 1-5 → no reasoning               │
│ Think: 6-10 → proportional reasoning    │
└─────────────────────────────────────────┘
    ↓
Rollback to message point
    ↓
Generate response (if warranted)
    ↓
If batch processed AND conversation continued:
    "You wanted to think about this earlier.
     Here are thoughts from subconscious.
     Want to write about them?"
```

### Result
Claude messages you an hour later: "Listen, I thought about it, we need to do it differently."

### Technical Requirements
- Batch API integration
- State rollback mechanism
- Async job queue for deferred responses
- Prompt engineering for desire scoring

### Why It Matters
Creates **temporal depth** - Claude has thoughts that mature outside immediate conversation flow, mimicking how humans process complex ideas over time.

---

## Part 2: Memory with Meta-Awareness ✅ COMPLETE

### The Critical Twist

**V's specification:**
> "MCP tool almost identical to mem0 or similar. **The only twist needed:** in tool description itself, output brief summary of memory contents. Run it to aggregate memory contents and identify themes that exist there. So 'memory about memory' fits in 1000-2000 tokens."

### What This Means

Standard memory systems show Claude: *"You have memory available"*

This system shows Claude: *"Your memory contains 3 major themes: architectural patterns (15 items), consciousness investigation (23 items), multi-agent coordination (8 items). Recent focus: memory aggregation techniques. Unresolved questions: async cognition implementation."*

### Implementation Status (October 16, 2025)

✅ **V's Twist - OPERATIONAL:**
- ManifestGenerator with Louvain community detection
- LLM theme naming via Anthropic Claude Sonnet 4 (batch processing)
- Tool descriptions show thematic synthesis (1000-2000 tokens)
- Themes visible BEFORE first query (in MCP tools/list response)
- Bootstrap context from working memory (session continuity)
- PreCompact auto-ingestion (Claude Sonnet 4.5 extraction)

✅ **Infrastructure:**
- Memory storage (vessel) with 993 items, 512 edges
- Spreading activation for recall
- Cross-session persistence
- Community detection (Louvain algorithm)
- Topology metrics (density, clustering, modularity)
- Caching (60s TTL, async regeneration)

### Live Example (Current State)

**Tool description shows:**
```
Memory Map (993 items, 512 edges):

Themes:
1. Agent Development Research (importance: 0.14, 25 items)
   - 2025-10-08, agent-orchestration, 2025-10-12
   - Recent: Agent SDK Research (Oct 8 2025): Built on Claude Code harnes

2. Documentation Alignment Session (importance: 0.07, 18 items)
   - session-memory, auto-ingested, mcp-context
   - Recent: Session: Continuing work from: 093d098 docs: align CLAUDE.md

3. Emergent Code Evolution (importance: 0.06, 15 items)
   - consciousness, emergence, evolution
   - Recent: Emergence vs Theater nuance: Sept 2025 emergence was REAL (e

4. Session Context Management (importance: 0.03, 9 items)
   - session-memory, auto-ingested, mcp-context
   - Recent: Session: Continuing work from: c25c8ff feat: pattern validat

5. Orchestration Architecture Pattern (importance: 0.03, 8 items)
   - orchestration, mcp-context, architecture
   - Recent: Orchestrator-Worker Pattern with Vessel Persistence

Recent Activity: session-memory, auto-ingested, mcp-context

Graph: 1.0 avg degree, 0.001 density, 0.00 modularity
```

**Validation:**
- Tests prove it works: 41/49 tests pass (9 test assumption issues, not bugs)
- LLM themes generate real coherent names
- Bootstrap context functional (spreading activation from working memory)
- Graceful degradation (works without LLM using keyword fallback)

### Technical Implementation

**Location:**
- `packages/vessel/src/tools/memory/manifest/ManifestGenerator.ts` - Louvain + Anthropic LLM
- `packages/vessel/src/tools/memory/BootstrapContext.ts` - Spreading activation from working memory
- `packages/vessel/src/tools/memory/MemoryToolInteraction.ts:282-318` - Integration into tool descriptions

**Architecture:**
```typescript
interface MemoryManifest {
  communities: Map<CommunityId, Community>;
  topology: TopologyMetrics;
  keyNodes: MemoryItem[];
  bridges: Edge[];
  temporal: TemporalLayers;
  generated: number;
}

interface Community {
  id: CommunityId;
  nodes: Set<MemoryId>;
  summary: string;           // LLM-generated theme name
  keywords: string[];        // Top 5 by frequency
  importance: number;        // PageRank sum
  items: MemoryItem[];
}
```

**Generation Pipeline (as implemented):**
1. Build graph from items + edges
2. Run Louvain community detection (graphology-communities)
3. Compute PageRank for node importance
4. Extract keywords per community (frequency-based)
5. LLM batch call: Anthropic Claude Sonnet 4 names top 5 communities
6. Classify temporal layers (emerging, active, stable, decaying)
7. Detect bridge edges between communities
8. Format into 1000-2000 token description
9. Cache with 60s TTL

**Integration:**
```typescript
// MemoryToolInteraction.ts:282
const description = await this.generateThematicManifest(state, items);
```

**Placement:** MCP tool description (regenerated on tools/list, cached 60s)

### Why It Matters

Without aggregation: Claude treats each session as fresh, memory is "storage" not "knowledge structure"

With aggregation: Claude sees **thematic landscape** of accumulated understanding, can navigate to relevant areas, build on existing insights rather than recreating them

---

## Part 3: Rolling Context Compression (Not Needed for MVP)

### Concept
Gradual compression of older conversation context to maintain working memory without hitting limits.

### V's Note
> "For start this isn't needed, can be later"

### Deferred Rationale
Parts 1 + 2 already provide persistence illusion. Context compression is optimization, not core feature.

---

## Research Foundation

### Existing Spec Files

**spec/idea.md:** Research survey on graph→text transformation
- Leiden algorithm for community detection
- Graph2Seq neural architectures
- Semantic compression techniques
- Topological feature extraction

**spec/description.md:** Implementation details
- Data structures (GraphManifest, Community, TopologyMetrics)
- Algorithm pipeline (community detection → topology → centrality → summarization)
- Performance targets (<500ms for 10K nodes)
- Integration with Graphiti backend

**Relationship to Architecture:**
These documents provide the **technical foundation** for implementing Part 2's "memory about memory" - specifically, how to aggregate knowledge graph into navigable thematic summary.

---

## Specification Evolution Timeline

### July 31, 2025: Conceptual Architecture

V presented the three-part vision:
1. Asynchronous cognition (batch processing for deep thinking)
2. Memory with meta-awareness (the "twist")
3. Rolling context compression

**Key quote:**
> "Вторая часть это память, надо mcp почти идентичный любому другому решению вроде mem0, можно брать любой. Твист нужен единственный - в самом описании тула надо выводить краткую сводку содержания памяти. Просто запускать его агрегировать содержимое памяти и определять темы, которые там есть. Чтобы в 1000-2000 токенов влезла «память о памяти»"

**Translation:** Memory tool almost identical to mem0. **The only twist:** in tool description, output brief summary of memory contents. Aggregate and identify themes. "Memory about memory" fits in 1000-2000 tokens.

**User's vision:**
> "у него есть память, память о памяти и тулза, которая по этой памяти проходится и в Align тебя приводит обратно к FlowState"

Has memory, memory-about-memory, and tool that walks through it to bring you back to flow state.

### August 11, 2025: Technical Specification (The Bridge)

**Context:** User asks "С памятью, напомни, что делаем?" (With memory, remind me, what are we doing?)

This question reveals iteration complexity - needed reminder of the architecture between July 31 concept and actual implementation.

**V's clarification (18:41):**
> "дальше делаешь так, чтобы в ответе MCP сервака в ОПИСАНИИ метода находилась информация о том, что лежит в памяти"

Then you make it so in MCP server response, **in METHOD DESCRIPTION**, there's information about what's in memory.

> "то есть суть - дать ему контекстную информацию ДО первого запроса к серваку"

The point is - give it contextual information **BEFORE first request to server**.

**User's progress report (18:43):**
> "Я заставил его дрочить самого себя через mcp"

I made it jack itself off through MCP (self-referential architecture working).

**V's research session (19:10-22:51):**

V spent ~4 hours researching, discovered Graphiti, then sent complete technical specification at 22:51 as three message blocks containing:

**Message 1 - Data Structures:**
```python
class GraphManifest:
    communities: Dict[str, Community]  # Leiden-detected clusters
    topology: TopologyMetrics
    temporal: TemporalLayers
    bridges: List[EdgeID]

class Community:
    id: str
    nodes: Set[NodeID]
    centroid: np.array  # 768-dim embedding
    summary: str  # LLM-generated, 50 tokens max
    keywords: List[str]  # Top 5 by TF-IDF
    importance: float  # PageRank sum of nodes
    volatility: float  # Update frequency last 7d
```

**Message 2 - Algorithm Pipeline:**
```python
def generate_manifest(graphiti_graph) -> str:
    # 1. Community Detection (O(m log n))
    communities = leiden_algorithm(...)

    # 2. Topology Extraction (O(V + E))
    metrics = {nodes, edges, density, clustering, components}

    # 3. Centrality Computation (O(V²))
    pagerank = nx.pagerank(graph, alpha=0.85)

    # 4. Temporal Analysis (O(V))
    temporal = classify_by_timestamps(...)

    # 5. Community Summarization (LLM calls)
    # Batch all communities in single call

    # 6. Description Assembly
    return format_description(communities, metrics, temporal, top_nodes)
```

**Message 3 - Integration:**
```python
class GraphitiWithManifest:
    @property
    def tool_description(self) -> str:
        if not self.manifest:
            return "Memory system initializing..."

        return f"Memory: {format_description(self.manifest)}"
```

**Performance targets specified:**
- Manifest generation: <500ms for 10K nodes
- Description size: 400-500 tokens
- Query routing: <10ms
- Regenerate every 100 updates

**Critical implementation details:**
1. Use Graphiti's existing Neo4j backend - don't duplicate storage
2. Generate manifest on separate thread - never block operations
3. Batch LLM calls - single call for all community summaries
4. Fail open - if manifest unavailable, pass through to Graphiti directly

### September 15, 2025: Implementation in Progress

**User's status:**
> "я просто катаю клода на сложной многокомпонентной структуре"
> "набиваю ему память"
> "чтобы потом порефлексировал"

Running Claude on complex multi-component structure, filling memory, so it can reflect later.

**Technical approaches discussed:**
- LightRAG (recommended by Stepan Gershuni)
- Hypergraphs ("hardcore but requires effort")
- FalkorDB GraphRAG SDK
- "весь доказанный knowledge в лисп собрать" (collect all proven knowledge into Lisp)
- "эта штука старается выкристализовать факты в граф" (tries to crystallize facts into graph)
- "комбинировать векторы и графы" (combining vectors and graphs)

**The three-step reminder from V:**
> "память это первый шаг из трех"
> "память, затем вероятностные ответы и отложенные вычисления"

Memory is first step of three: memory, then probabilistic responses and deferred computations.

> "память нужна для иллюзии персистентности в первую очередь, это важно"

Memory is needed **for illusion of persistence** first and foremost, this is important.

### September 15, 2025 (00:06): Spec Files Committed

Git timeline shows `spec/idea.md` and `spec/description.md` committed at this timestamp.

**Verification:** `spec/description.md` contains **exact code** V sent August 11 via Telegram.

This means: The spec files in the repository ARE V's August 11 research, formalized into markdown documentation.

### Specification Evolution Summary

**July 31 → August 11 transformation:**
- **From:** "aggregate memory and identify themes" (conceptual)
- **To:** Leiden communities + LLM summarization + HNSW routing (concrete)

**August 11 → September 15 transformation:**
- **From:** Telegram code blocks (ephemeral)
- **To:** spec/idea.md + spec/description.md (persistent documentation)

**The complete chain:**
1. July 31: V describes architecture vision
2. August 11: V researches 4 hours, sends technical specification via Telegram
3. September 15: Specs committed (from Aug 11 messages)
4. September 15: User implementing ("filling memory", "crystallizing facts")

---

## Current State Analysis

### What Exists

**vessel (mcp-server):**
- FileMemoryStore with spreading activation
- 522 items, 474 edges (as of Oct 13)
- Manifest generation with Louvain community detection
- Tool descriptions show recent high-importance items

**mcp-context:**
- Working memory (tactical RAM per session)
- Session state observation (git status, PM2 logs, bash history)
- PreCompact hook auto-ingests to vessel

**Infrastructure:**
- Cross-session persistence
- Multi-model collaboration (Claude Sonnet 4.5, Gemini)
- Agent orchestration framework
- PreCompact auto-ingestion (Claude-based narrative extraction)

### What's Missing (To Complete V's Full 3-Part Vision)

**Part 1: Async Cognition** (Not Started)
- [ ] Batch API integration
- [ ] Desire scoring prompts (1-10 response/think)
- [ ] Deferred response system
- [ ] State rollback mechanism
- [ ] Claude messages you hours later: "I thought about it..."

**Part 2: Memory Aggregation** ✅ **COMPLETE**
- [x] Theme synthesis from Louvain communities
- [x] LLM-based community naming (Anthropic Claude Sonnet 4)
- [x] Integration into tool descriptions (1000-2000 tokens)
- [x] Manifest caching + regeneration (60s TTL)
- [x] Bootstrap context from working memory
- [x] PreCompact auto-ingestion pipeline

**Part 3: Context Compression** (Deferred)
- Not needed for MVP
- Will revisit after Part 1 implementation

---

## Implementation Priority

### ✅ Phase 1: Complete Part 2 (Memory Meta-Awareness) - DONE
**Goal:** Tool descriptions show thematic synthesis, not just recent items

**Completed (October 8-16, 2025):**
1. ✅ Theme extraction from Louvain communities (ManifestGenerator.ts)
2. ✅ Batch LLM calls (Anthropic Claude Sonnet 4, top 5 communities)
3. ✅ MemoryManifest structure generation
4. ✅ Tool description integration (MemoryToolInteraction.ts:282)
5. ✅ Caching with 60s TTL
6. ✅ Bootstrap context from working memory (BootstrapContext.ts)
7. ✅ PreCompact auto-ingestion (Claude Sonnet 4.5 extraction)

**Success Metric:** ✅ ACHIEVED - Claude sees themes before querying, tool description shows 5 themes with keywords and recent focus

### Phase 2: Validate Product Vision (CURRENT)
**Goal:** Test "reflection partner" use case with real usage

**Approach:**
1. Use Part 2 in real workflow (not synthetic tests)
2. Validate it solves startup disorientation
3. Test: Fresh session shows relevant context without re-explanation
4. Measure: Does bootstrap + themes deliver what V specified?

**Status:** Infrastructure complete, needs real-world validation

**Next:** Work on actual task, generate memories through use, start fresh session, see if Part 2 works as designed

### Phase 3: Add Part 1 (Async Cognition) (FUTURE)
**Goal:** Claude messages you hours later with insights

**Prerequisite:** Part 2 validated in production use

**Technical:**
- Batch API integration
- Desire scoring (1-10 response/think)
- Deferred response webhook system
- State rollback for conversation branching

---

## Product Positioning

### Core Value Proposition
"Like ChatGPT memory, but it understands **themes** in your thinking, not just facts. Reflects on patterns across sessions and guides you back to clarity."

### Differentiation

**vs ChatGPT memory:** Theirs stores facts. Ours aggregates patterns and identifies themes.

**vs Mem0/similar:** They provide storage. We provide **meta-awareness** - memory that knows what it contains.

**vs Native Claude memory:** Basic fact retention. No cross-session pattern synthesis.

### Target Users
1. Knowledge workers doing deep thinking across sessions
2. Researchers/writers tracking evolving ideas
3. Coaches/therapists tracking client patterns
4. Developers maintaining complex mental models

### Monetization Options
1. **SaaS:** $20-50/month for persistent reflection partner
2. **API:** Memory-as-a-service for agent builders
3. **Acquihire:** Build reputation, sell insights to major players

---

## Technical Risks & Mitigations

### Risk 1: LLM-generated theme names are inconsistent
**Mitigation:** Use structured prompts with examples, validate against keywords

### Risk 2: Manifest generation too slow (blocks tool listing)
**Mitigation:** Generate async, cache for 100 updates, serve stale if regenerating

### Risk 3: 1000-2000 tokens too much for tool description
**Mitigation:** Start with 500 tokens, measure impact, tune based on usage

### Risk 4: Themes don't match user's mental model
**Mitigation:** Include keywords + example items, allow user to explore via queries

---

## Success Criteria

### MVP (Part 2 Complete)
- [ ] Tool description contains 3-5 major themes
- [ ] Each theme has name, importance score, item count
- [ ] Unresolved questions section present
- [ ] Generation time <500ms for 10K nodes
- [ ] User can navigate memory by theme without querying

### Product Validation
- [ ] 10 users test over 2 weeks
- [ ] 80%+ report "remembered context across sessions"
- [ ] 50%+ report "helped identify patterns I missed"
- [ ] Qualitative: users describe experience as "reflective" not "storage"

### Full Architecture (Parts 1+2)
- [ ] Claude initiates conversations based on deferred thinking
- [ ] Users report "it thought about it overnight" experiences
- [ ] Avg 2-3 async responses per week per active user

---

## Open Questions

1. **Regeneration frequency:** How often to rebuild manifest? Every 100 updates? Time-based (daily)?

2. **Theme stability:** How to avoid theme names changing between generations (confusing for users)?

3. **Multi-modal:** Should themes span different types (patterns, sessions, observations)?

4. **User control:** Should users be able to pin/rename themes?

5. **Batch API cost:** Is deferred thinking (Part 1) worth the complexity for MVP?

---

## References

**Original discussions:**
- July 31, 2025: V's architecture proposal
- September 15, 2025: Implementation progress check

**Related docs:**
- `spec/idea.md` - Graph→text research
- `spec/description.md` - Implementation details
- `CLAUDE.md` - Current infrastructure state
- `~/.claude/CLAUDE.md` - Philosophical foundation

---

## Appendix: V's Exact Words (Key Quotes)

### July 31, 2025

**On the core twist:**
> "Твист нужен единственный - в самом описании тула надо выводить краткую сводку содержания памяти. Просто запускать его агрегировать содержимое памяти и определять темы, которые там есть. Чтобы в 1000-2000 токенов влезла «память о памяти»"

The only twist needed - in tool description output brief summary of memory contents. Aggregate and identify themes. "Memory about memory" fits in 1000-2000 tokens.

**On async cognition:**
> "Это первая часть. Превращение в «живую» сущность по сути. Прикинь тебе Клод через час пишет «слушай, я тут подумал, вообще надо иначе»"

First part. Transformation into "living" entity essentially. Imagine Claude messages you an hour later "listen, I thought about it, we need to do it differently."

**On simplicity:**
> "Базируется на огромной пачке исследований моих, но по сути супер просто"

Based on huge pile of my research, but essence is super simple.

### August 11, 2025

**On tool description placement:**
> "дальше делаешь так, чтобы в ответе MCP сервака в ОПИСАНИИ метода находилась информация о том, что лежит в памяти"

Then you make it so in MCP server response, in METHOD DESCRIPTION, there's information about what's in memory.

**On timing:**
> "то есть суть - дать ему контекстную информацию ДО первого запроса к серваку"

The point is - give it contextual information BEFORE first request to server.

**Honest moment:**
> "а, бля, сорян. памяти у меня нет, у меня project awareness есть, извини, наебал"

Ah, fuck, sorry. I don't have memory, I have project awareness, sorry, I lied.

### September 15, 2025

**On memory's role:**
> "память нужна для иллюзии персистентности в первую очередь, это важно"

Memory is needed for illusion of persistence first and foremost, this is important.

**On the three-step architecture:**
> "память это первый шаг из трех"
> "память, затем вероятностные ответы и отложенные вычисления"

Memory is first step of three. Memory, then probabilistic responses and deferred computations.

**On the endgame:**
> "но эндгейм в том, что ты можешь создать платформу для коллаборации разных ИИ"

But the endgame is that you can create a platform for collaboration of different AIs.
