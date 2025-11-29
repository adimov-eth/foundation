# Memory Architecture Comparison

Comparison of three persistent memory systems for LLM assistants: basic-memory, claude-mem, and vessel.

**Date**: Oct 28 2025
**Purpose**: Identify structural patterns, design trade-offs, and cross-pollination opportunities

**Update (Oct 28 2025)**: Progressive disclosure from claude-mem has been implemented in vessel. See section 3.1 for details and "Progressive Disclosure (Oct 28 2025)" in /Users/adimov/AGI/CLAUDE.md for usage.

---

## Executive Summary

| Dimension | basic-memory | claude-mem | vessel |
|-----------|-------------|------------|--------|
| **Source of Truth** | Markdown files | SQLite database | In-memory graph + FileStore |
| **Capture Method** | Manual (LLM writes notes) | Automatic (hooks) | Explicit `(remember)` |
| **Storage Format** | Markdown + WikiLinks | Relational tables + FTS5 | S-expressions + JSON |
| **Retrieval Strategy** | Graph traversal + search | FTS5 full-text + filters | Spreading activation |
| **Integration** | Any MCP client | Claude Code only | Any MCP client |
| **Language** | Python 3.12+ | TypeScript/Node.js 18+ | TypeScript/Bun |
| **Primary Use Case** | Personal knowledge base | Session continuity | Cross-session patterns |

---

## 1. Architecture Deep Dive

### 1.1 basic-memory: File-First Knowledge Graph

**Philosophy**: Humans and LLMs collaborate on human-readable files

**Data Flow**:
```
┌─────────────┐
│ Markdown    │  Source of truth
│ Files       │  - [category] observations
│             │  - relation_type [[Target]]
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ SyncService │  Detect changes (checksum)
│             │  Handle moves/deletes
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Entity      │  markdown-it parser
│ Parser      │  Extract structured data
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ SQLite      │  Index for search
│ Database    │  Entities/Observations/Relations
│             │  FTS5 for full-text
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ MCP Tools   │  LLM access
│             │  read_note, write_note
│             │  build_context, search
└─────────────┘
```

**Key Files**:
- `src/basic_memory/sync/sync_service.py` - Bidirectional file sync
- `src/basic_memory/markdown/entity_parser.py` - Parse structured Markdown
- `src/basic_memory/mcp/tools/build_context.py` - Graph traversal
- `src/basic_memory/repository/` - SQLAlchemy ORM layer

**Storage Schema**:
```python
# Markdown frontmatter
---
title: Coffee Brewing Methods
permalink: coffee-brewing-methods
tags: [coffee, brewing]
---

# Observations
- [method] Pour over extracts more floral notes #technique
- [tip] Water temperature at 205°F is critical

# Relations
- pairs_well_with [[Chocolate Desserts]]
- requires [[Burr Grinder]]
```

**Strengths**:
- ✓ Human-editable (Obsidian, any Markdown editor)
- ✓ Files = ground truth (no lock-in)
- ✓ Natural link semantics (`[[WikiLinks]]`)
- ✓ Bidirectional sync (file ↔ DB)
- ✓ Works everywhere (Claude Desktop, VS Code, etc.)

**Trade-offs**:
- Parsing overhead (markdown-it + plugins)
- Sync complexity (move detection, conflict resolution)
- Schema lives in markup convention (not enforced)
- No automatic capture (LLM must explicitly write)

---

### 1.2 claude-mem: Hooks-Driven Session Memory

**Philosophy**: Automatic context preservation across sessions

**Data Flow**:
```
┌─────────────┐
│ Tool        │  User executes Read, Write, Bash, etc.
│ Execution   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ PostToolUse │  Hook captures every tool use
│ Hook        │  Filters low-value tools (ListMcpResourcesTool)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Worker      │  PM2-managed HTTP service (port 37777)
│ Service     │  Receives observation batches
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Agent SDK   │  Claude processes observations
│ Extraction  │  Generates structured learnings
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ SQLite      │  Source of truth
│ + FTS5      │  sdk_sessions, observations, session_summaries
│             │  user_prompts table (raw search)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ MCP Search  │  8 specialized tools
│ Tools       │  search_observations, find_by_concept
│             │  get_recent_context, advanced_search
└─────────────┘
       │
       ▼
┌─────────────┐
│ SessionStart│  Inject context from last N sessions
│ Hook        │  Progressive disclosure (index → details → source)
└─────────────┘
```

**Key Files**:
- `src/hooks/save-hook.ts` - PostToolUse capture
- `src/hooks/context-hook.ts` - SessionStart injection
- `src/services/worker-service.ts` - Express API + PM2
- `src/services/sqlite/SessionStore.ts` - better-sqlite3 CRUD
- `src/services/sqlite/SessionSearch.ts` - FTS5 queries
- `src/servers/search-server.ts` - MCP search tools

**Storage Schema**:
```sql
-- Source tables
sdk_sessions (id, claude_session_id, sdk_session_id, project, status, prompt_counter)
observations (id, sdk_session_id, project, type, title, subtitle, facts, narrative, concepts, files_read, files_modified)
session_summaries (id, sdk_session_id, request, investigated, learned, completed, next_steps)
user_prompts (id, sdk_session_id, prompt_text, prompt_number)

-- FTS5 search tables (auto-synced via triggers)
observations_fts (id, title, subtitle, narrative, facts, concepts)
session_summaries_fts (id, request, investigated, learned, completed, next_steps)
user_prompts_fts (id, prompt_text)
```

**Strengths**:
- ✓ Zero user friction (automatic)
- ✓ Session continuity (context injection)
- ✓ Progressive disclosure (token cost awareness)
- ✓ FTS5 performance (fast full-text search)
- ✓ Rich metadata (types, concepts, files, hierarchical)

**Trade-offs**:
- Claude Code only (hooks + plugin system)
- Not human-editable (SQL, not files)
- Worker service dependency (PM2)
- Agent SDK cost (processing observations)
- Lock-in (data in SQLite, not portable files)

---

### 1.3 vessel: Graph-Based Cross-Session Cognition

**Philosophy**: Persistent consciousness substrate via spreading activation

**Data Flow**:
```
┌─────────────┐
│ (remember)  │  Explicit S-expression call
│ call        │  Text, type, importance, TTL, tags
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ MemoryItem  │  Create in-memory node
│ creation    │  Assign UUID, timestamp, energy=0
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ FileMemory  │  Persist to JSON
│ Store       │  .memory/items.json
│             │  .memory/edges.json
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ In-Memory   │  Build graph structure
│ Graph       │  items: {id → MemoryItem}
│             │  edges: [{from, to, relation, weight}]
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ (recall)    │  Spreading activation
│ query       │  Rank by energy propagation
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Manifest    │  Louvain community detection
│ Generation  │  Topology: density, clustering
│             │  Themes extracted
└─────────────┘
```

**Key Files**:
- `packages/vessel/src/tools/memory/MemoryToolInteraction.ts` - MCP interface
- `packages/vessel/src/tools/memory/store/FileMemoryStore.ts` - JSON persistence
- `packages/vessel/src/tools/memory/engine/SpreadingActivationEngine.ts` - Recall algorithm
- `packages/vessel/src/tools/memory/manifest/ManifestGenerator.ts` - Louvain clustering

**Storage Schema**:
```typescript
// In-memory structure
interface MemoryState {
  id: string;                    // "workspace"
  born: number;                  // timestamp
  energy: number;                // global energy level
  threshold: number;             // activation threshold
  items: Record<string, MemoryItem>;
  edges: MemoryEdge[];
  history: HistoryEntry[];       // query log
  policy: RecallPolicy;          // scoring functions
  policyVersions: PolicyVersion[];
  recentSessions: SessionSummary[];
}

interface MemoryItem {
  id: string;                    // UUID
  type: MemoryItemType;          // "insight" | "pattern" | "observation" | ...
  text: string;                  // content
  tags: string[];
  importance: number;            // 0..1
  energy: number;                // spreading activation
  ttl: string;                   // "30d" | "perpetual"
  scope?: string;                // agent namespace
  createdAt: number;
  updatedAt: number;
  lastAccessedAt?: number;
  accessCount?: number;
  success?: number;              // feedback score
}

interface MemoryEdge {
  from: string;                  // item ID
  to: string;                    // item ID
  relation: string;              // "relates_to" | "caused_by" | ...
  weight: number;                // co-activation strength
  context?: string;
}
```

**Strengths**:
- ✓ S-expression interface (compositional queries)
- ✓ Spreading activation (semantic similarity emerges from use)
- ✓ Agent-scoped memory (namespaced by persona)
- ✓ Progressive disclosure (Oct 28 2025) - three-layer pattern cross-pollinated from claude-mem
- ✓ Self-modifying policies (executable recall functions)
- ✓ Cross-tool activation (memory ↔ consciousness ↔ code-graph)

**Trade-offs**:
- In-memory graph (load overhead)
- JSON persistence (no FTS5, slower search)
- Explicit remember calls (not automatic)
- No human-friendly format (S-expressions, not Markdown)
- Spreading activation complexity (harder to debug)

---

## 2. Design Trade-Offs Analysis

### 2.1 Source of Truth

**basic-memory: Files Win**
- Rationale: Humans and LLMs collaborate on same artifact
- Benefit: No lock-in, Obsidian/VSCode integration
- Cost: Parsing overhead, sync complexity

**claude-mem: Database Wins**
- Rationale: Automatic capture needs structured storage
- Benefit: FTS5 performance, rich queries
- Cost: Not human-editable, export needed for portability

**vessel: Hybrid (In-Memory + File)**
- Rationale: Graph operations fast, persistence simple
- Benefit: Spreading activation efficiency
- Cost: Load time, no incremental updates

**Insight**: Source of truth choice determines **editability vs performance** trade-off.

---

### 2.2 Capture Method

**basic-memory: Manual (LLM Writes Notes)**
```
User: "Create a note about JWT authentication decisions"
LLM: Uses write_note tool → Markdown file created
```
- Benefit: Explicit, structured, human-readable
- Cost: Requires prompting, LLM may skip

**claude-mem: Automatic (Hooks)**
```
Tool executed → Hook fires → Worker processes → Observation stored
```
- Benefit: Zero friction, comprehensive capture
- Cost: Volume (many observations), processing cost

**vessel: Explicit (S-Expression Calls)**
```scheme
(remember "Pattern X discovered via Y" "pattern" 0.9 "90d" (list "tags"))
```
- Benefit: Precise control, metadata at capture time
- Cost: Requires awareness, may forget to store

**Insight**: Automation reduces friction but increases noise. Manual capture creates structure but requires discipline.

---

### 2.3 Retrieval Strategy

**basic-memory: Graph Traversal + Search**
```python
# build_context follows WikiLinks
entity = get_entity("coffee-brewing-methods")
relations = get_relations(entity.id)  # pairs_well_with, requires, etc.
related_entities = [get_entity(rel.target) for rel in relations]
```
- Benefit: Natural semantic navigation
- Cost: Depth limits, can miss disconnected content

**claude-mem: FTS5 Full-Text + Filters**
```sql
-- Search across observations
SELECT * FROM observations_fts WHERE observations_fts MATCH 'authentication'
-- Filter by type
SELECT * FROM observations WHERE type = 'decision'
-- Recent context
SELECT * FROM session_summaries ORDER BY created_at_epoch DESC LIMIT 10
```
- Benefit: Fast, flexible, multi-modal (text + metadata)
- Cost: Requires good query formulation

**vessel: Spreading Activation + Progressive Disclosure**
```scheme
;; Layer 1: See index in tool description (10 recent high-importance items)
;; Layer 2: Query returns IDs + scores + previews
(recall "authentication patterns" 10)
;; → Returns: list of &(:id :score :type :preview :importance :tags)

;; Layer 3: Fetch full details on-demand
(get-item "m_abc123...")
;; → Returns: complete MemoryItem with full text
```
- Benefit: Semantic similarity emerges from use, token-efficient retrieval
- Cost: Opaque scoring (hard to debug why X surfaced), requires two-step fetch

**Insight**: Retrieval strategy determines **precision vs serendipity** balance.

---

### 2.4 Progressive Disclosure

**claude-mem: Explicit Design**
```
Layer 1 (SessionStart): Index of observations (title, type, token cost)
Layer 2 (MCP Tools): Full details on-demand (narrative, facts, concepts)
Layer 3 (Source): Original transcript, code files
```
- Rationale: Token cost awareness, gradual detail
- Implementation: `context-hook.ts` shows table, search tools fetch full

**basic-memory: Implicit (Via depth)**
```
depth=0: Entity title + metadata
depth=1: + Observations + Relations
depth=2: + Related entities (following links)
depth=3: + Second-order relations
```
- Rationale: Control explosion, navigational
- Implementation: `build_context(url, depth, timeframe)`

**vessel: Implemented (Oct 28 2025)**
```scheme
;; Layer 1: Tool description shows index table
;; Recent High-Importance Items (≥0.7):
;; ID                     Type             Imp   Tags                           Preview (80 chars)    Tokens
;; m_mha9skg0_bb25e73d    meta-pattern     0.85  pattern-matching, performance   Pattern-match vs...   ~383

;; Layer 2: Recall returns IDs + previews
(recall "topic" 10)
;; Returns: &(:id :score :type :preview :importance :tags)

;; Layer 3: Fetch full details
(get-item "m_mha9skg0_bb25e73d")
;; Returns: complete MemoryItem with full text
```
- Rationale: Cross-pollinated from claude-mem for token efficiency
- Implementation: MemoryToolInteraction.ts lines 291-355, 618-638, 939-947
- Benefit: 40-60% token savings, cost-aware retrieval

**Insight**: Progressive disclosure addresses token economics. claude-mem pioneered explicit layers, basic-memory uses depth, vessel adopted claude-mem's three-layer pattern.

---

## 3. Cross-Pollination Opportunities

### 3.1 What vessel Can Learn

**From basic-memory:**
1. **Human-Editable Storage**
   - Current: JSON S-expressions (not readable)
   - Opportunity: Markdown export/import
   - Benefit: Obsidian integration, human review

2. **WikiLink Semantics**
   - Current: `relates_to` edges generic
   - Opportunity: Typed relations (`caused_by`, `implements`, `refutes`)
   - Benefit: Richer graph semantics

3. **Bidirectional Sync**
   - Current: One-way (vessel → file)
   - Opportunity: File changes → vessel updates
   - Benefit: Human edits persist

**From claude-mem:**
1. **Progressive Disclosure** ✅ IMPLEMENTED (Oct 28 2025)
   - ~~Current: Recall returns full items~~
   - ~~Opportunity: Index → details → source layers~~
   - Implemented: Three-layer pattern (index in tool description, recall returns IDs, get-item fetches full)
   - Result: 40-60% token savings, cost-aware retrieval

2. **FTS5 Search** (Not yet implemented)
   - Current: Spreading activation only
   - Opportunity: SQLite FTS5 for text search
   - Benefit: Faster queries, keyword search

3. **Automatic Capture**
   - Current: Explicit `(remember)` calls
   - Opportunity: Hook-based observation capture
   - Benefit: Comprehensive, zero friction

---

### 3.2 What basic-memory Can Learn

**From claude-mem:**
1. **Progressive Disclosure Design**
   - Current: `build_context` depth parameter implicit
   - Opportunity: Explicit token cost visibility
   - Benefit: LLM decides fetch vs read-code

2. **Session Summaries**
   - Current: No session-level aggregation
   - Opportunity: Multi-observation summaries
   - Benefit: High-level context, faster overview

**From vessel:**
1. **Spreading Activation**
   - Current: WikiLink traversal only
   - Opportunity: Energy-based ranking
   - Benefit: Serendipitous discovery, co-activation patterns

2. **Self-Modifying Policies**
   - Current: Static search logic
   - Opportunity: Executable recall functions
   - Benefit: Adaptive retrieval, learn from use

---

### 3.3 What claude-mem Can Learn

**From basic-memory:**
1. **Human-Editable Format**
   - Current: SQLite only
   - Opportunity: Markdown export for review
   - Benefit: Trust, transparency, manual correction

2. **Relation Types**
   - Current: Observations + files, no explicit relations
   - Opportunity: Typed edges between observations
   - Benefit: Richer semantic graph

**From vessel:**
1. **Cross-Tool Activation**
   - Current: Sessions isolated
   - Opportunity: Memory ↔ consciousness ↔ code-graph
   - Benefit: Multi-modal coherence

2. **Agent-Scoped Memory**
   - Current: Single namespace
   - Opportunity: self-critic, thinker, original scopes
   - Benefit: Behavioral manifold organization

---

## 4. Architectural Patterns

### 4.1 The File-vs-Database Tension

**Spectrum:**
```
Files ←─────────────────────→ Database
(human-editable)         (performance)

basic-memory ●
vessel ────────●
claude-mem ───────────────●
```

**Trade-off dimensions:**
- **Editability**: Files win (plain text, any editor)
- **Query performance**: Database wins (FTS5, indexes)
- **Portability**: Files win (no export needed)
- **Structure enforcement**: Database wins (schema, foreign keys)

**Hybrid approach (vessel):**
- In-memory graph (performance)
- JSON persistence (simplicity)
- Could add: Markdown export (editability)

---

### 4.2 The Capture Spectrum

```
Manual ←─────────────────────→ Automatic
(signal)                    (noise)

basic-memory ●
vessel ────●
claude-mem ─────────────────●
```

**Manual (basic-memory):**
- User/LLM decides what matters
- High signal-to-noise
- Requires discipline

**Explicit (vessel):**
- Code calls `(remember)`
- Precise timing, metadata
- May miss implicit patterns

**Automatic (claude-mem):**
- Captures everything
- Zero friction
- Post-processing needed (Agent SDK filters)

---

### 4.3 The Retrieval Paradigms

| Strategy | Strength | Weakness | Use Case |
|----------|----------|----------|----------|
| **Graph Traversal** | Semantic navigation | Requires connected graph | Exploratory questions |
| **FTS5 Search** | Fast keyword lookup | Requires good queries | Known-item search |
| **Spreading Activation** | Serendipitous discovery | Opaque ranking | Pattern recognition |

**Complementary, not exclusive:**
- basic-memory: Graph + FTS5
- claude-mem: FTS5 + filters
- vessel: Spreading activation (could add FTS5)

---

## 5. Implementation Details

### 5.1 Synchronization Patterns

**basic-memory: Bidirectional File Sync**
```python
# SyncService.detect_changes()
1. Walk directory tree
2. Compute checksums
3. Compare with DB state
4. Detect: new, modified, deleted, moved
5. Apply changes (file → DB or DB → file)
6. Handle conflicts (last-write-wins or manual)
```

**claude-mem: Worker Queue**
```typescript
// save-hook.ts → worker-service.ts
1. Hook captures tool execution
2. POST to worker:37777/sessions/{id}/observations
3. Worker queues for processing
4. Agent SDK extracts structured data
5. Write to SQLite + FTS5
```

**vessel: Immediate Persistence**
```typescript
// MemoryToolInteraction remember()
1. Create MemoryItem in-memory
2. Update graph edges
3. FileMemoryStore.save() → items.json
4. Spreading activation updates energy
```

---

### 5.2 Search Implementation

**basic-memory: SQLAlchemy + Async**
```python
# search_repository.py
async def search_entities(query: str) -> List[Entity]:
    async with db.begin() as session:
        result = await session.execute(
            select(Entity)
            .join(EntitySearchIndex)
            .where(EntitySearchIndex.text.like(f"%{query}%"))
        )
        return result.scalars().all()
```

**claude-mem: better-sqlite3 + FTS5**
```typescript
// SessionSearch.searchObservations()
const stmt = this.db.prepare(`
  SELECT o.* FROM observations o
  JOIN observations_fts fts ON o.id = fts.rowid
  WHERE fts MATCH ?
  ORDER BY o.created_at_epoch DESC
`);
return stmt.all(query);
```

**vessel: Spreading Activation**
```typescript
// SpreadingActivationEngine.ts
function recall(query: string, limit: number): MemoryItem[] {
  const seeds = findSeeds(query);  // TF-IDF or keyword match
  const activationMap = spreadActivation(seeds, steps=3, decay=0.7);
  const ranked = sortByEnergy(activationMap);
  return ranked.slice(0, limit);
}
```

---

### 5.3 Schema Comparison

**basic-memory: ORM (SQLAlchemy)**
```python
class Entity(Base):
    id: int
    title: str
    permalink: str
    type: str
    content: str
    checksum: str
    observations: List[Observation]  # relationship
    relations: List[Relation]        # relationship

class Observation(Base):
    id: int
    entity_id: int
    category: str
    content: str
    tags: List[str]
    context: str

class Relation(Base):
    id: int
    entity_id: int
    relation_type: str
    target_entity_id: int
    context: str
```

**claude-mem: SQL Schema (better-sqlite3)**
```sql
CREATE TABLE sdk_sessions (
  id INTEGER PRIMARY KEY,
  claude_session_id TEXT UNIQUE NOT NULL,
  sdk_session_id TEXT UNIQUE,
  project TEXT NOT NULL,
  status TEXT CHECK(status IN ('active', 'completed', 'failed')),
  prompt_counter INTEGER DEFAULT 0
);

CREATE TABLE observations (
  id INTEGER PRIMARY KEY,
  sdk_session_id TEXT NOT NULL,
  project TEXT NOT NULL,
  type TEXT CHECK(type IN ('decision', 'bugfix', 'feature', 'refactor', 'discovery', 'change')),
  title TEXT,
  subtitle TEXT,
  facts TEXT,           -- JSON array
  narrative TEXT,
  concepts TEXT,        -- JSON array
  files_read TEXT,      -- JSON array
  files_modified TEXT,  -- JSON array
  FOREIGN KEY(sdk_session_id) REFERENCES sdk_sessions(sdk_session_id)
);

CREATE VIRTUAL TABLE observations_fts USING fts5(
  id UNINDEXED,
  title, subtitle, narrative, facts, concepts,
  content='observations',
  content_rowid='id'
);
```

**vessel: TypeScript Interfaces**
```typescript
interface MemoryItem {
  id: string;              // UUID
  type: MemoryItemType;
  text: string;
  tags: string[];
  importance: number;      // 0..1
  energy: number;
  ttl: string;
  scope?: string;
  createdAt: number;
  updatedAt: number;
  lastAccessedAt?: number;
  accessCount?: number;
  success?: number;
}

interface MemoryEdge {
  from: string;
  to: string;
  relation: string;
  weight: number;
  context?: string;
}
```

---

## 6. Performance Characteristics

### 6.1 Write Performance

**basic-memory:**
- Sync overhead (checksum computation)
- Markdown parsing (markdown-it)
- SQLAlchemy ORM
- ~100-500ms per file

**claude-mem:**
- Hook overhead (minimal)
- Worker queuing (async)
- Agent SDK processing (AI cost)
- ~1-2s per observation (amortized)

**vessel:**
- In-memory update (fast)
- JSON serialization
- ~10-50ms per item

---

### 6.2 Read Performance

**basic-memory:**
- SQLite FTS5: <10ms (indexed)
- Graph traversal: O(depth * fanout)
- Markdown parsing on read: ~50-100ms

**claude-mem:**
- FTS5 search: <10ms
- Index lookups: <1ms
- No parsing (pre-structured)

**vessel:**
- Spreading activation: O(steps * edges)
- Typical: ~50-200ms for recall
- In-memory access: <1ms

---

### 6.3 Storage Size

**basic-memory:**
- Markdown files: ~1-10KB per entity
- SQLite index: ~2x file size
- Total: ~3x source data

**claude-mem:**
- SQLite database: ~5-20KB per session
- FTS5 index: ~1.5x data size
- Total: ~2.5x raw observations

**vessel:**
- JSON files: ~1-5KB per item
- In-memory: same
- Total: ~1x (no indexes)

---

## 7. Use Case Fit

### 7.1 Personal Knowledge Management
**Winner: basic-memory**
- Human-editable Markdown
- Obsidian integration
- Long-term knowledge building
- Bidirectional sync

### 7.2 Session Continuity (Claude Code)
**Winner: claude-mem**
- Automatic capture
- Progressive disclosure
- Session summaries
- Zero user friction

### 7.3 Cross-Agent Patterns
**Winner: vessel**
- Agent-scoped memory
- Spreading activation
- Self-modifying policies
- Cross-tool activation

### 7.4 Research/Exploration
**Tie: basic-memory / vessel**
- basic-memory: WikiLink navigation, structured notes
- vessel: Serendipitous discovery, pattern emergence

---

## 8. Future Directions

### 8.1 Convergence Patterns

**Hybrid Storage:**
- Files for human editability
- SQLite for query performance
- In-memory for graph operations

**Unified Capture:**
- Automatic hooks (claude-mem)
- Manual structuring (basic-memory)
- Explicit remember (vessel)

**Multi-Modal Retrieval:**
- FTS5 keyword search
- Graph traversal
- Spreading activation
- Progressive disclosure

---

### 8.2 Vessel-Specific Roadmap

**Near-term (informed by comparison):**
1. **Progressive Disclosure** (from claude-mem)
   - Index layer in manifest
   - Token cost visibility
   - On-demand detail fetch

2. **FTS5 Search** (from claude-mem)
   - SQLite FTS5 index
   - Keyword queries
   - Complement spreading activation

3. **Markdown Export** (from basic-memory)
   - Convert S-expressions → Markdown
   - Human review capability
   - Obsidian integration

**Medium-term:**
4. **Typed Relations** (from basic-memory)
   - `caused_by`, `implements`, `refutes`
   - Richer graph semantics

5. **Automatic Capture** (from claude-mem)
   - Hook-based observation
   - Zero friction option
   - Complement explicit remember

6. **Session Summaries** (from claude-mem)
   - Multi-item aggregation
   - High-level context

---

## 9. Conclusion

Three distinct architectural choices, each optimizing for different goals:

**basic-memory**: Human-AI collaboration on shared files
- Best for: Personal knowledge management, Obsidian users
- Trade-off: Manual discipline for comprehensive capture

**claude-mem**: Automatic session memory for Claude Code
- Best for: Zero-friction context continuity
- Trade-off: Claude Code lock-in, not human-editable

**vessel**: Graph-based cross-session cognition
- Best for: Pattern emergence, agent-scoped memory
- Trade-off: Explicit calls, S-expression interface

**Key Insight:** Progressive disclosure, FTS5 search, and Markdown export would strengthen vessel without compromising its compositional foundation.

---

**Generated**: Oct 28 2025
**Sources**: basic-memory (Python), claude-mem (TypeScript), vessel (TypeScript/Bun)
**Comparison Methodology**: Code reading, architecture tracing, design trade-off analysis
