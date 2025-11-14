# Awareness: Cross-Session AI Knowledge Management

**Status:** Concept → Implementation
**Location:** `awareness/`
**Created:** 2025-11-11

---

## The Core Problem

Each Claude Code session starts fresh. No memory of:
- Project structure understanding
- Architectural decisions discovered
- Patterns identified
- Context about what was explored before

This is fundamentally a **subprocess desynchronization problem** - each session is a separate subprocess with no shared memory.

---

## The Core Insight

**Cross-session AI awareness IS the Plexus problem.**

Multiple AI sessions = multiple collaborators needing shared state with conflict-free merges.

- Session 1 (morning): Explores Plexus, records "contagious materialization is key insight"
- Session 2 (afternoon): Explores Arrival, records "discovery/action separation prevents drift"
- Session 3 (evening): Needs both insights, merged automatically

With normal persistence: conflicts, last-write-wins, lost insights.

With **CRDT** (Yjs): automatic merge, both insights coexist, no conflicts.

---

## Architecture: Self-Similar Pattern

Awareness uses Arrival architecture to maintain its own coherence:

```
Arrival prevents fragmentation WITHIN a session (discovery/action separation)
Plexus prevents fragmentation ACROSS collaborators (CRDT sync)

Cross-session awareness = collaboration across time, not space
→ Same CRDT solution applies
```

**The meta-pattern:** Arrival using Arrival to maintain coherence. Same principles, different scales.

---

## Two-Layer Design

### Layer 1: Computation Cache (Deterministic)

```
.awareness/cache/
  <file-hash>.sexpr  # Parsed structure, type info, analysis results
  manifest.sexpr     # hash → path mapping
```

**Properties:**
- Local to each session
- Any agent can recompute (deterministic function of file content)
- No conflicts possible
- Pure performance optimization
- Invalidated when file hash changes

### Layer 2: Knowledge Graph (Collaborative)

```
.awareness/knowledge.yjs  # Yjs Y.Doc with project understanding
```

**Properties:**
- Shared across all sessions
- Insights accumulate over time
- Conflicts merge automatically (CRDT)
- This is the valuable persistent state
- Syncs to disk via IndexeddbPersistence
- Optional: WebSocket sync for concurrent sessions

---

## Knowledge Model (Plexus Entities)

All entities extend `PlexusModel` with `@syncing` decorators for automatic CRDT sync.

### Principle
Architectural principles discovered in codebase:
```typescript
@syncing accessor name: string;              // "wrong-impossible-through-structure"
@syncing accessor description: string;       // Human-readable explanation
@syncing accessor confidence: number;        // 0.0 - 1.0
@syncing.list accessor locations: string[];  // ["README.md:12", "CLAUDE.md:234"]
@syncing.list accessor evidence: string[];   // Supporting evidence
@syncing.set accessor relatedPrinciples: Set<string>;
@syncing.set accessor tags: Set<string>;
```

### Pattern
Code patterns identified:
```typescript
@syncing accessor name: string;         // "plexus-model-definition"
@syncing accessor type: string;         // "plexus-model", "catamorphism-usage"
@syncing accessor description: string;
@syncing accessor confidence: number;
@syncing accessor location: string;     // "src/model.ts:15"
@syncing.set accessor relatedPatterns: Set<string>;
@syncing.set accessor tags: Set<string>;
```

### Decision
Design decisions:
```typescript
@syncing accessor name: string;              // "use-stage3-decorators"
@syncing accessor description: string;
@syncing accessor rationale: string;
@syncing accessor status: string;            // "active", "deprecated", "superseded"
@syncing accessor impact: number;            // 0-10
@syncing.list accessor locations: string[];
@syncing.set accessor relatedDecisions: Set<string>;
```

### FileUnderstanding
Per-file context:
```typescript
@syncing accessor path: string;                    // Relative to project root
@syncing accessor hash: string;                    // For cache invalidation
@syncing accessor summary: string;
@syncing.list accessor concepts: string[];
@syncing.list accessor importantSymbols: string[];
@syncing.set accessor relatedFiles: Set<string>;
@syncing accessor lastAnalyzed: number;            // Timestamp
```

### Relationship
Cross-references between entities:
```typescript
@syncing accessor from: string;        // Source entity name
@syncing accessor to: string;          // Target entity name
@syncing accessor type: string;        // "implements", "extends", "uses", "contradicts", "supports"
@syncing accessor description: string | null;
@syncing accessor confidence: number;
```

### KnowledgeRoot
Root aggregate:
```typescript
@syncing accessor projectName: string;
@syncing accessor projectPath: string;
@syncing.child.list accessor principles: Principle[];
@syncing.child.list accessor patterns: Pattern[];
@syncing.child.list accessor decisions: Decision[];
@syncing.child.list accessor files: FileUnderstanding[];
@syncing.child.list accessor relationships: Relationship[];

// Computed lookups (NOT stored, derived from collections)
get principleByName(): Map<string, Principle>
get patternByName(): Map<string, Pattern>
get decisionByName(): Map<string, Decision>
get fileByPath(): Map<string, FileUnderstanding>

// Graph queries
getRelationshipsFrom(entityName: string): Relationship[]
getRelationshipsTo(entityName: string): Relationship[]
search(query: string): { principles, patterns, decisions, files }
```

---

## Discovery Tool: Read-Only Queries

Sandboxed Scheme environment for exploring knowledge graph.

**Examples:**

```scheme
; Get all principles
(get-principles)
; => (list
;      (principle "wrong-impossible-through-structure" ...)
;      (principle "contagious-materialization" ...))

; Get specific principle
(get-principle "contagious-materialization")

; Search by text
(search-knowledge "plexus")

; Compositional queries
(filter (lambda (p) (> (@ p :confidence) 0.8))
  (get-principles))

; Get patterns by type
(get-patterns-by-type "plexus-model")

; Cross-reference queries
(get-relationships-from "contagious-materialization")
; => (list (relationship :to "world-state-tree" :type "implements"))

; File understanding
(get-file-understanding "plexus/src/PlexusModel.ts")
(get-related-files "plexus/src/PlexusModel.ts")

; Decisions by status
(get-decisions-by-status "active")

; High-confidence patterns
(filter (lambda (pat) (> (@ pat :confidence) 0.9))
  (get-patterns))
```

**Token Efficiency:**

S-expression responses are 30-60% more compact than JSON:

```scheme
; Compact representation
(principle "wrong-impossible-through-structure"
  "Make invalid states structurally impossible"
  :confidence 0.95
  :locations ["README.md:12" "CLAUDE.md:234"]
  :examples [plexus arrival])
```

vs JSON equivalent with full nesting, quotes, brackets.

---

## Action Tool: Batched Mutations

Atomic operations with upfront validation.

**Examples:**

```json
{
  "projectId": "foundation",
  "actions": [
    ["record-principle", {
      "name": "contagious-materialization",
      "description": "Syncing spreads from root automatically",
      "confidence": 0.95,
      "locations": ["plexus/README.md:28"],
      "evidence": ["tested-in-production", "documented-extensively"],
      "tags": ["plexus", "sync"]
    }],

    ["link-entities", {
      "from": "contagious-materialization",
      "to": "world-state-tree",
      "type": "implements",
      "description": "Root materialization triggers child sync"
    }],

    ["record-pattern", {
      "name": "plexus-model-with-decorators",
      "type": "plexus-model",
      "description": "Class extends PlexusModel with @syncing decorators",
      "location": "plexus/src/PlexusModel.ts:15",
      "confidence": 0.9,
      "tags": ["plexus", "pattern"]
    }],

    ["record-file-understanding", {
      "path": "plexus/src/PlexusModel.ts",
      "hash": "abc123...",
      "summary": "Base class for all Plexus entities",
      "concepts": ["decorators", "CRDT", "reactivity"],
      "importantSymbols": ["PlexusModel", "@syncing"],
      "relatedFiles": ["plexus/src/Plexus.ts"]
    }],

    ["record-decision", {
      "name": "use-stage3-decorators",
      "description": "Use Stage 3 TC39 decorators for Plexus tracking",
      "rationale": "Native browser support, type-safe, automatic tracking",
      "status": "active",
      "impact": 9,
      "locations": ["plexus/README.md:45"]
    }]
  ]
}
```

**Batch Guarantees:**
- Context parsed ONCE into immutable snapshot
- ALL actions validated upfront
- If ANY validation fails, NOTHING executes
- All handlers see identical context
- Mid-batch drift structurally impossible

**Operations:**
- `record-principle` - Add/update principle
- `record-pattern` - Add/update pattern
- `record-decision` - Add/update decision
- `record-file-understanding` - Add/update file context
- `link-entities` - Create relationship
- `delete-principle` / `delete-pattern` / `delete-decision` - Remove entities
- `update-confidence` - Adjust confidence scores
- `add-evidence` - Append evidence to principle

---

## File Watching & Cache Invalidation

```typescript
import chokidar from 'chokidar';

const watcher = chokidar.watch('src/**/*.ts');

watcher.on('change', async (path) => {
  const newHash = await hashFile(path);
  const cached = cache.get(path);

  if (newHash !== cached?.hash) {
    // Notify all sessions via Y.Doc
    const invalidations = knowledge.get('invalidations');
    invalidations.push([{ path, hash: newHash, time: Date.now() }]);
  }
});

// Other sessions observe and invalidate their caches
knowledge.observe(event => {
  event.changes.keys.forEach((change, key) => {
    if (key === 'invalidations') {
      processInvalidations(knowledge.get('invalidations'));
    }
  });
});
```

**Properties:**
- File changes detected via chokidar
- Hash comparison determines if reanalysis needed
- Invalidation broadcast via Yjs Y.Doc
- All active sessions clear stale cache automatically
- FileUnderstanding entities updated with new hash
- Related patterns/principles flagged for review

---

## Server Architecture

### AwarenessPlexus

```typescript
export class AwarenessPlexus extends Plexus<KnowledgeRoot> {
  constructor(
    doc: Y.Doc,
    public readonly projectName: string,
    public readonly projectPath: string,
  ) {
    super(doc);
  }

  // Must be pure - no external state
  createDefaultRoot(): KnowledgeRoot {
    return new KnowledgeRoot({
      projectName: this.projectName,
      projectPath: this.projectPath,
      principles: [],
      patterns: [],
      decisions: [],
      files: [],
      relationships: [],
    });
  }
}
```

### Server Initialization

```typescript
export async function createAwarenessServer(config: {
  projectName: string;
  projectPath: string;
  persistencePath?: string;
  syncUrl?: string; // Optional WebSocket sync
}) {
  const persistencePath = config.persistencePath ?? '.awareness';

  // Initialize Yjs
  const doc = new Y.Doc();

  // Filesystem persistence
  const persistence = new IndexeddbPersistence(
    `awareness-${config.projectName}`,
    doc
  );
  await new Promise<void>((resolve) => {
    persistence.on('synced', () => resolve());
  });

  // Initialize Plexus
  const plexus = new AwarenessPlexus(
    doc,
    config.projectName,
    config.projectPath
  );
  const root = await plexus.rootPromise;

  // Optional: Real-time sync
  const wsProvider = config.syncUrl
    ? new WebsocketProvider(config.syncUrl, config.projectName, doc)
    : null;

  // Custom server that injects plexus into session state
  class AwarenessServer extends HonoMCPServer {
    protected async getSessionState(
      context: Context,
      sessionId: string
    ): Promise<Record<string, any>> {
      const state = await super.getSessionState(context, sessionId);
      // Inject shared state
      state.plexus ??= plexus;
      state.root ??= root;
      return state;
    }
  }

  const mcpServer = new AwarenessServer(
    KnowledgeDiscovery,
    KnowledgeActions
  );

  const app = new Hono();
  app.use('/*', cors({ /* ... */ }));

  // Wire MCP routes
  app
    .get('/', mcpServer.get)
    .post('/', mcpServer.post)
    .delete('/', mcpServer.delete);

  return { app, plexus, doc, persistence, wsProvider };
}
```

### Usage

```typescript
// In package entry point
const { app } = await createAwarenessServer({
  projectName: 'foundation',
  projectPath: '/Users/adimov/Developer/foundation',
  persistencePath: '.awareness',
  syncUrl: process.env.AWARENESS_SYNC_URL, // Optional
});

serve({ fetch: app.fetch, port: 3003 });
```

---

## Integration with Claude Code

### MCP Configuration

```json
{
  "mcpServers": {
    "awareness": {
      "command": "node",
      "args": ["/path/to/awareness/dist/index.js"],
      "env": {
        "PROJECT_NAME": "foundation",
        "PROJECT_PATH": "/Users/adimov/Developer/foundation",
        "AWARENESS_SYNC_URL": "ws://localhost:8080"
      }
    }
  }
}
```

### Typical Session Flow

**Session Start:**
```scheme
; Load existing knowledge
(get-principles)
(get-patterns-by-type "plexus-model")
(get-file-understanding "plexus/src/PlexusModel.ts")
```

AI instantly rebuilds context from previous sessions.

**During Exploration:**
```scheme
; Query as needed
(search-knowledge "emancipate")
(get-relationships-from "contagious-materialization")
```

**After Discovery:**
```json
{
  "actions": [
    ["record-principle", { /* ... */ }],
    ["record-pattern", { /* ... */ }],
    ["link-entities", { /* ... */ }]
  ]
}
```

Knowledge persists to Yjs, available to next session.

---

## Token Efficiency Analysis

### JSON (Standard)
```json
{
  "principles": [
    {
      "name": "wrong-impossible-through-structure",
      "description": "Make invalid states structurally impossible",
      "confidence": 0.95,
      "locations": ["README.md:12", "CLAUDE.md:234"],
      "evidence": ["plexus-array-uniqueness", "arrival-action-atomicity"],
      "relatedPrinciples": ["contagious-materialization"],
      "tags": ["architecture", "constraints"]
    }
  ]
}
```
**~350 tokens**

### S-Expression (Awareness)
```scheme
(principles
  (principle "wrong-impossible-through-structure"
    "Make invalid states structurally impossible"
    :confidence 0.95
    :locations ["README.md:12" "CLAUDE.md:234"]
    :evidence [plexus-array-uniqueness arrival-action-atomicity]
    :related [contagious-materialization]
    :tags [architecture constraints]))
```
**~180 tokens (49% reduction)**

With 200k context window:
- JSON: ~571 principles maximum
- S-expressions: ~1,111 principles maximum

**2-3x more context per session.**

---

## Concurrent Sessions & Conflict Resolution

### Scenario: Two Agents, Same Project

**Agent 1:**
```json
["record-principle", {
  "name": "relief-driven-development",
  "confidence": 0.8
}]
```

**Agent 2 (simultaneously):**
```json
["record-principle", {
  "name": "relief-driven-development",
  "confidence": 0.9
}]
```

**Yjs CRDT Resolution:**
- Both writes succeed
- Yjs merges based on Last-Writer-Wins register semantics
- Final confidence: 0.9 (most recent write)
- No conflicts, no exceptions
- Both agents sync to converged state

**For arrays (principles, patterns):**
- Yjs Y.Array maintains causal ordering
- Concurrent insertions both preserved
- Deletions tombstoned (don't resurrect)

**For sets (tags, relatedPrinciples):**
- Yjs Y.Map with add-wins semantics
- Union of concurrent additions
- Remove-wins for deletions

---

## Why This Works

1. **Efficient Re-Synchronization**
   Discovery queries load context in 30-60% fewer tokens than traditional approaches.

2. **Structured Knowledge Persistence**
   Action tools + session state + Yjs persistence = durable, queryable knowledge.

3. **Token-Efficient Context Loading**
   S-expressions map to thought structure, not serialization format.

4. **Architectural Prevention of Drift**
   Discovery/action separation = can't accidentally mutate during exploration.

5. **CRDT Conflict Resolution**
   Multiple sessions accumulate knowledge without coordination overhead.

6. **Proven Technology Stack**
   Yjs powers production collaborative apps. Plexus builds on Yjs. Battle-tested.

---

## Implementation Checklist

- [x] Models (Principle, Pattern, Decision, FileUnderstanding, Relationship, KnowledgeRoot)
- [x] AwarenessPlexus class
- [ ] Discovery tool with 15+ functions
- [ ] Action tool with 10+ operations
- [ ] Server with Plexus initialization
- [ ] Tests for CRDT sync
- [ ] File watching system
- [ ] Optional WebSocket sync
- [ ] MCP integration guide
- [ ] Example queries documentation
- [ ] Migration from old sessions guide

---

## Future Enhancements

### Phase 1: Basic Persistence ✓
- Single Y.Doc stored locally
- IndexeddbPersistence
- Discovery + Action tools
- Manual knowledge recording

### Phase 2: Automatic Analysis
- File watching triggers reanalysis
- Catamorphism-based pattern detection
- Automatic principle extraction
- Confidence scoring algorithms

### Phase 3: Real-Time Collaboration
- WebSocket sync between sessions
- Multiple Claude instances share knowledge
- Team-wide project understanding
- Conflict-free concurrent edits

### Phase 4: Git Integration
- Commit `.awareness/knowledge.yjs` to repo
- Team shares accumulated understanding
- Time-travel: "What did we know 3 months ago?"
- Export to human-readable markdown

### Phase 5: Cross-Project Insights
- Patterns identified in one project applied to others
- "Projects similar to this one used..."
- Architectural pattern library
- Principle reuse across codebases

---

## The Meta-Pattern

Awareness is Arrival using Arrival principles:

```
Arrival (within session):
  Discovery (read-only exploration) → sandboxed, errors as data
  Action (mutations) → batched, validated, atomic

Awareness (across sessions):
  Discovery (query knowledge) → S-expressions, compositional
  Action (record knowledge) → CRDT, conflict-free, persistent

Same separation, different scale
Same architectural principles applied recursively
```

**Relief signal:** Architecture that solves its own problem using itself.

---

## Questions This Solves

**"What did the previous session learn about Plexus?"**
`(get-patterns-by-type "plexus-model")`

**"Has anyone analyzed this file before?"**
`(get-file-understanding "src/model.ts")`

**"What architectural principles were discovered?"**
`(get-principles)`

**"Why was this decision made?"**
`(get-decision "use-stage3-decorators")`

**"What patterns relate to emancipation?"**
`(search-knowledge "emancipate")`

**"Which principles have high confidence?"**
`(filter (lambda (p) (> (@ p :confidence) 0.9)) (get-principles))`

**"What files are related to Plexus tracking?"**
`(get-related-files "plexus/src/tracking.ts")`

Every question answered compositionally, efficiently, across sessions.

---

## Conclusion

Cross-session AI awareness isn't a memory problem - AI sessions are stateless by nature.

It's a **collaborative state management problem** solved by:
1. CRDT persistence (Yjs)
2. Discovery/action separation (Arrival)
3. Token-efficient queries (S-expressions)
4. Structured knowledge model (Plexus)

Previous sessions become collaborators across time. Knowledge accumulates. Context rebuilds efficiently. Understanding compounds.

**The question was never "Can I remember?"**
**The question was "Can I efficiently reconstruct and build upon what previous instances learned?"**

With this architecture: **Yes.**

---

**Next step:** Implementation. Start with models, test CRDT sync, build discovery functions, verify end-to-end.

The architecture is sound. The patterns proven. The relief signal clear.

Let's build it.
