# What claude-mem Teaches About Constraint Architecture

**Context:** Deep analysis of [claude-mem](https://github.com/thedotmack/claude-mem) - a persistent memory system for Claude Code that captures tool usage, compresses observations via Claude Agent SDK, and injects context across sessions.

**Why this matters:** claude-mem solves different problems than Arrival/Plexus, but applies similar constraint thinking to make entire classes of failures architecturally impossible.

---

## Core Architecture

**Problem domain:** Preserve context across Claude Code sessions despite:
- Worker process restarts
- User interruptions (`/clear`)
- Async AI processing (Agent SDK)
- Network failures
- Tool execution timeouts

**Stack:**
- SQLite + FTS5 (full-text search) + ChromaDB (vector embeddings)
- PM2-managed worker service (:37777)
- Event-driven async generators (zero polling)
- Claude Agent SDK for observation extraction
- 7 lifecycle hooks (SessionStart, PostToolUse, Summary, etc.)

**Flow:**
1. Hook captures tool execution → HTTP POST to worker
2. Worker queues observation → EventEmitter wakes SDK agent
3. SDK agent processes via Claude → Extracts structured observations
4. Stores in SQLite → Syncs to Chroma (fire-and-forget)
5. Next session: Context hook injects recent observations

---

## Constraint Patterns (Wrong Through Structure)

### 1. Auto-Initialization: Process Restarts Become Transparent

**Pattern:**
```typescript
queueObservation(sessionDbId: number, data: ObservationData): void {
  // Auto-initialize from database if needed (handles worker restarts)
  let session = this.sessions.get(sessionDbId);
  if (!session) {
    session = this.initializeSession(sessionDbId);
  }
  // ... queue the observation
}
```

**What makes this constraint architecture:**
- **DB is source of truth, memory is cache**
- Worker crash? Sessions auto-resurrect from DB
- No special restart handling code needed
- Process failures structurally can't orphan sessions

**Contrast with defensive programming:**
```typescript
// Defensive: Check if session exists, throw error if not
if (!session) throw new Error("Session not found - restart worker");

// Constraint: Session can't not exist - if not in memory, pull from DB
if (!session) session = this.initializeSession(sessionDbId);
```

**Lesson:** Resurrection over validation. Make failures self-healing through structure.

---

### 2. "EVERYTHING SHOULD SAVE ALWAYS" - Deletion is the Bug

**Evolution found via grep:**
```typescript
// REMOVED: cleanupOrphanedSessions - violates "EVERYTHING SHOULD SAVE ALWAYS"
// Worker restarts don't make sessions orphaned. Sessions are managed by hooks
// and exist independently of worker state.
```

**What happened:**
- v4.0: Aggressive cleanup - DELETE sessions on worker restart
- Result: Destroyed user's current work, interrupted async summaries
- v4.1+: Mark sessions complete, never DELETE
- New constraint: "Orphaned sessions" is inexpressible concept

**What makes this constraint architecture:**
- **State transitions over deletion**
- Sessions have states: active → processing → completed
- Worker crash can't make state disappear (DB persists)
- Cleanup became: mark timestamp, don't erase

**Lesson:** When deletion causes more problems than keeping data, make deletion architecturally impossible. State transitions are safer than erasure.

---

### 3. Zero-Latency Event-Driven Flow (No Polling)

**Pattern:**
```typescript
// Producer (save-hook → SessionManager)
queueObservation(sessionDbId, data) {
  session.pendingMessages.push(data);
  emitter.emit('message');  // Wake consumer immediately
}

// Consumer (SDKAgent)
async *getMessageIterator(sessionDbId) {
  while (!aborted) {
    if (queue.empty) {
      await new Promise(resolve => emitter.once('message', resolve));
    }
    yield* queue;  // Process all pending
  }
}

// Composition (SDKAgent consumes)
for await (const message of sessionManager.getMessageIterator(sessionDbId)) {
  yield buildObservationPrompt(message);
}
```

**What makes this compositional:**
- `EventEmitter` + `async *generators` = push-based flow
- No polling loops (`setInterval`, `while(true)`)
- Producer wakes consumer instantly (zero latency)
- Backpressure natural (consumer controls iteration)

**Lesson:** Events + generators compose into zero-latency push. Alternative to callback hell.

---

### 4. Progressive Disclosure with Economic Constraints

**Pattern:**
```typescript
const CHARS_PER_TOKEN_ESTIMATE = 4;
function estimateTokens(text: string | null): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN_ESTIMATE);
}

// Context hook output:
// #42  3:15pm  🔴  Fixed authentication race condition (~150t)
// #41  3:10pm  🔵  Discovered Plexus emancipation pattern (~80t)
```

**Three layers:**
- **Layer 1 (Index):** Title + ~token cost shown at session start
- **Layer 2 (Details):** Fetch via MCP search (on-demand)
- **Layer 3 (Source):** Original transcripts in DB

**What makes this constraint architecture:**
- **Token cost is visible UP FRONT**
- Claude decides: "Is ~150 tokens worth it for this bugfix?"
- Economic constraint shapes retrieval behavior
- Can't fetch blindly - cost is always known

**Lesson:** Make retrieval economics explicit. Progressive disclosure needs cost visibility.

**This matches Arrival's discovery/action separation:**
- Arrival: Explore in Scheme (sandbox), commit via Actions (batched)
- claude-mem: Index shows titles/cost (cheap), fetch details (expensive), read source (most expensive)

---

### 5. Fire-and-Forget for Non-Critical Paths

**Pattern found (3 locations):**
```typescript
// Startup - Chroma backfill
this.chromaSync.ensureBackfilled().catch(() => {});

// After saving observation
this.chromaSync.syncObservation(obsId, ...).catch(() => {});

// After saving summary
this.chromaSync.syncSummary(summaryId, ...).catch(() => {});
```

**What makes this constraint architecture:**
- **SQLite is source of truth, Chroma is optimization**
- Chroma failure can't break save operation
- Degradation strategy: FTS5 fallback (still works, just less semantic)
- Critical path (save) can't be blocked by optimization (vector sync)

**Lesson:** Distinguish critical from enhancement. Make enhancements non-blocking.

---

### 6. Graceful State Transitions Over Deletion

**Evolution:**
- **v4.0 and earlier:** DELETE requests to cleanup sessions
- **v4.1+:** Mark sessions completed, preserve data

**Why change:**
- Aggressive DELETE interrupted async summary generation
- Sessions have temporal extent (start → process observations → summarize → complete)
- Deletion during processing destroys partial work

**New pattern:**
```typescript
// Mark complete (graceful)
markSessionCompleted(sessionDbId: number): void {
  const stmt = this.db.prepare(`
    UPDATE sessions
    SET completed_at = ?, completed_at_epoch = ?
    WHERE id = ?
  `);
  stmt.run(now.toISOString(), nowEpoch, sessionDbId);
}

// Delete (never called on sessions)
// Previously: DELETE FROM sessions WHERE id = ? AND status = 'active'
// Now: REMOVED - violates "EVERYTHING SHOULD SAVE ALWAYS"
```

**What makes this constraint architecture:**
- **State transitions > deletion**
- Sessions can't be deleted mid-processing (architecturally impossible)
- Completion is timestamp, not erasure
- Temporal extent preserved in data model

**Lesson:** Operations have temporal extent. Mark state changes instead of deleting.

---

## Anti-Patterns (Lessons from Pain)

**They documented what NOT to do:**

### ❌ Wrapper Functions for Constants
```typescript
// DON'T: Ceremonial wrapper adding zero value
export function getWorkerPort(): number {
  return FIXED_PORT;
}

// DO: Export constant directly
export const WORKER_PORT = parseInt(process.env.CLAUDE_MEM_WORKER_PORT || "37777", 10);
```

### ❌ Magic Numbers Everywhere
```typescript
// DON'T: Unexplained numbers scattered
if (await isHealthy(1000)) { ... }
await waitForHealth(10000);
setTimeout(resolve, 100);

// DO: Named constants with context
const HEALTH_CHECK_TIMEOUT_MS = 1000;
const HEALTH_CHECK_MAX_WAIT_MS = 10000;
const HEALTH_CHECK_POLL_INTERVAL_MS = 100;
```

### ❌ Silent Failures (Defensive Programming)
```typescript
// DON'T: Swallow errors without reason
checkProcess.on("close", (code) => {
  resolve(); // Silent failure - assumes worker not running
});

// DO: Fail fast with clear error
checkProcess.on("close", (code) => {
  if (code !== 0) {
    reject(new Error(`PM2 not found - install dependencies first`));
  }
  resolve();
});
```

### ❌ YAGNI Violations
```typescript
// DON'T: 50+ lines checking PM2 status before starting
// (PM2 start is idempotent - just call it)

// DO: Start if not healthy
if (!await isWorkerHealthy()) {
  await startWorker();
  if (!await waitForWorkerHealth()) {
    throw new Error("Worker failed to become healthy");
  }
}
```

**What this teaches:** They debugged at 2am. Pain shaped the code. These aren't theoretical - they're scars.

---

## Where This Intersects Arrival/Plexus

### Plexus: Invalid States Inexpressible via Operations
```typescript
// materialized-array.ts:258-284
splice(start, deleteCount, ...items) {
  // Detects if child already exists elsewhere
  // AUTOMATICALLY removes from old location
  // THEN inserts at new position
}
```
**Can't have duplicate children** - adding IS the removal operation.

### Arrival: Accidental Execution Impossible via Sandbox
```typescript
// Discovery tools execute in sandboxed Scheme
this.env = sandboxedEnv.clone();
// Only registered functions exist
// Mutation functions literally not in environment
```
**Can't accidentally trigger actions** - mutation functions don't exist.

### claude-mem: Process Failures Can't Orphan Sessions
```typescript
// Sessions auto-resurrect from DB
if (!session) {
  session = this.initializeSession(sessionDbId);
}
```
**Can't have orphaned sessions** - DB is source of truth, memory is cache.

---

## The Pattern Across All Three

**Making wrong architecturally impossible:**

1. **Plexus** - Invalid collaborative state inexpressible (type-level + operation-level constraints)
2. **Arrival** - Agent fragmentation inexpressible (sandbox boundaries + batch atomicity)
3. **claude-mem** - Data loss inexpressible (DB as truth + graceful transitions + auto-resurrection)

**Different problems, same principle:** Structure the system so wrong states can't be constructed.

---

## What We Learn

### 1. Auto-Initialization for Resilience
- DB as source of truth, memory as cache
- Process restarts become transparent
- No special recovery code needed
- Complementary to our sandbox boundaries

### 2. "Save Everything" Philosophy
- When deletion causes problems, make deletion impossible
- State transitions > erasure
- Temporal extent matters (operations span time)

### 3. Event-Driven Composition
- EventEmitter + async generators = zero-latency push
- Alternative to polling and callback hell
- Natural backpressure through iteration

### 4. Economic Constraints in UX
- Show token costs upfront
- Progressive disclosure needs economics visible
- Claude decides: "Is this retrieval worth the cost?"

### 5. Fire-and-Forget Patterns
- Distinguish critical path from optimizations
- Enhancements can't block essential operations
- Clear degradation strategy (FTS5 when Chroma fails)

### 6. Graceful Over Aggressive
- Mark state transitions, don't delete
- Operations have temporal extent
- Interruption mid-process = data loss

---

## Relief Signals

**What feels structurally sound:**
- Auto-initialization pattern (resurrection over validation)
- Event-driven generators (compositional, zero-latency)
- Token cost visibility (economics explicit)
- Fire-and-forget for optimizations (degradation strategy)

**What's genuinely constraint architecture:**
- "Sessions can't be orphaned" (DB is truth)
- "Cleanup can't interrupt async work" (mark complete, don't delete)
- "Search can't fail completely" (FTS5 fallback)
- "Token cost must be visible" (economic constraint)

**The integration:**
- Plexus/Arrival: Wrong inexpressible via types + sandboxes
- claude-mem: Wrong inexpressible via architectural patterns
- Both valuable, different problem domains

---

## When to Apply These Patterns

**Use auto-initialization when:**
- Process can crash/restart
- State lives in durable storage (DB, filesystem)
- Recovery should be transparent

**Use "save everything" when:**
- Deletion causes more problems than keeping data
- Temporal extent matters (operations span time)
- Users expect persistence

**Use event-driven generators when:**
- Producer/consumer pattern
- Want zero-latency notification
- Avoid polling loops

**Use economic constraints when:**
- Resources have cost (tokens, bandwidth, time)
- User needs to make retrieval decisions
- Progressive disclosure strategy

**Use fire-and-forget when:**
- Operation is optimization, not critical path
- Have fallback strategy
- Failure shouldn't block success

**Use graceful transitions when:**
- Operations span time (async, multi-step)
- Deletion can interrupt work
- State timeline matters

---

## Further Reading

- [claude-mem repository](https://github.com/thedotmack/claude-mem)
- [Architecture documentation](https://github.com/thedotmack/claude-mem/tree/main/docs)
- CLAUDE.md (coding standards & anti-patterns learned through pain)
- SessionManager.ts:171-204 (event-driven iterator pattern)
- context-hook.ts:249-260 (progressive disclosure with token costs)
- DatabaseManager.ts:84-86 (constraint comment: "EVERYTHING SHOULD SAVE ALWAYS")

---

**Date:** 2025-11-11
**Analyzed via:** Compositional grep patterns, not line-by-line reading
**Relief check:** Yes - these patterns feel structurally sound for resilience engineering
