# Persistent S-Expression Awareness for AI Coding Agents

**Status:** Design Document (Draft)
**Date:** 2025-11-27
**Context:** Giving Claude persistent, compositional awareness of codebases

---

## The Problem

Every session, Claude starts with no knowledge of the project. The codebase exists on disk, but Claude has no map. The result:

1. Claude reaches for `Read`/`Grep` instead of structured queries
2. Time spent re-discovering what was learned in previous sessions
3. No intuition about what exists, so no intuition about what to query
4. The tools exist but aren't used because there's no priming

**The goal isn't query capability** (we have that). **The goal is ambient awareness** - Claude starting each session already knowing the terrain.

---

## The Insight: Dynamic Tool Descriptions

When Claude connects to an MCP server, it fetches tool descriptions. These descriptions go into context. If the description is dynamic, it can contain **current state**.

```typescript
// In DiscoveryToolInteraction.ts - the mechanism already exists
const dynamic = availableFunctions.some(description =>
  typeof description === "object" && description.dynamic);

// Dynamic descriptions are:
// 1. Generated at tool fetch time (when Claude connects)
// 2. Included in the tool's inputSchema description
// 3. Therefore IN CONTEXT automatically before any queries
```

This is the only moment when an MCP server has unconditional context injection. No existing MCP server exploits this for awareness. It's a genuine innovation opportunity.

---

## The Paradigm Shift: Tools as Evaluation Contexts

**Old paradigm:**
- Tool = RPC endpoint
- Database = separate state
- Query language = way to ask questions
- Tool calls database, returns result

**Homoiconic paradigm:**
- Tool = evaluation context
- Data = S-expressions
- Query = S-expressions
- The "tool" is a Scheme REPL with awareness loaded

The `discover` tool becomes almost trivially thin:
```
(eval expr (environment-with-awareness-loaded))
```

Everything else is just Scheme. The graph-* functions are conveniences, not fundamentals. The fundamental thing is: **project structure as traversable data in the sandbox**.

---

## What Goes Into Context

### Tool Description (~500 tokens) - For Orientation

Research shows: position critical context at START (attention primacy), keep under 500 tokens, dense beats voluminous.

```
=== PROJECT AWARENESS (live, generated 2025-11-27T06:00:00Z) ===

periphery: MCP server for compositional code exploration via S-expressions

Structure:
  - discover.ts: S-expression sandbox (Discover extends DiscoveryToolInteraction)
  - entity-act.ts: context-as-specification (EntityAct extends ActionToolInteraction)
  - hypergraph.ts: free algebra for graph construction
  - catamorphism.ts: AST fold framework

Relationships:
  - CodeEntityAct, PlexusAct, TaskAct all extend EntityAct
  - Discover registers 25 functions into sandbox

Patterns:
  - "montessori-boundary": discovery reads, actions write, never mixed
  - "context-as-specification": target selector → resolved entity → actions

Recent changes: (last 24h)
  - discover.ts: added graph-* functions
  - entity-act.ts: added clone support

The project is loaded as `project`. Query examples:
  (@ project :modules)
  (filter (lambda (c) (extends? c "EntityAct")) (@ project :classes))

================================================================
```

This isn't documentation. It's **priming**. After reading this, Claude:
- Knows what exists
- Knows how things relate
- Knows what queries make sense
- Has intuitions about the codebase

### Environment Data - For Detailed Queries

The full project structure as S-expression data, loaded into the sandbox:

```scheme
(define project
  '(project "periphery"
     :root "/Users/dev/foundation/periphery"
     :generated "2025-11-27T06:00:00Z"

     (modules
       (module "discover"
         :file "src/discover.ts"
         :purpose "S-expression sandbox for code exploration"
         (classes
           (class "Discover"
             :extends "DiscoveryToolInteraction"
             :line 45
             :methods ("registerFunctions" "buildGraph" "graphSummary")))
         (functions
           (function "extractFromFile" :line 312)))

       (module "entity-act"
         :file "src/entity-act.ts"
         :purpose "Context-as-specification pattern"
         (classes
           (class "EntityAct"
             :extends "ActionToolInteraction"
             :line 23
             :methods ("resolveTarget" "executeTool")))))

     (relationships
       (extends "CodeEntityAct" "EntityAct")
       (extends "PlexusAct" "EntityAct")
       (extends "TaskAct" "EntityAct")
       (imports "discover" ("entity-act" "hypergraph" "catamorphism")))))
```

Querying is just Scheme:
```scheme
;; All classes extending EntityAct
(filter (lambda (c) (eq? (@ c :extends) "EntityAct"))
        (flatten (map (lambda (m) (@ m :classes)) (@ project :modules))))

;; Modules with more than 2 classes
(filter (lambda (m) (> (length (@ m :classes)) 2))
        (@ project :modules))

;; What does discover import?
(@ (find (lambda (r) (eq? (@ r :from) "discover"))
         (@ project :relationships :imports))
   :targets)
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Periphery MCP Server (single pm2-managed process)          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐ │
│  │ File Watcher │───▶│ Graph State │───▶│ .periphery/     │ │
│  │ (chokidar)   │    │ (in-memory) │    │ awareness.scm   │ │
│  └─────────────┘    └─────────────┘    └─────────────────┘ │
│         │                  │                               │
│         │                  ▼                               │
│         │          ┌─────────────────┐                     │
│         │          │ Dynamic Tool    │                     │
│         │          │ Description     │                     │
│         │          │ (~500 tokens)   │                     │
│         │          └─────────────────┘                     │
│         │                  │                               │
│         ▼                  ▼                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Sandbox Environment                     │   │
│  │  - `project` bound to current awareness data         │   │
│  │  - Standard Scheme + registered functions            │   │
│  │  - Convenience helpers (extends?, imports?, etc.)    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Single process, not daemon + server.** The state survives via .scm persistence. On restart, load from file. File watcher keeps state live during operation.

---

## The .scm File Format

### Why .scm?

1. **Readable** - Human can inspect awareness state
2. **Loadable** - Direct `(load "awareness.scm")` into sandbox
3. **Homoiconic** - Same format as queries, no translation layer
4. **Diffable** - Git-friendly, changes are meaningful
5. **Composable** - Can be manipulated with same tools that query it

### File Structure

```
.periphery/
├── awareness.scm      # Current project state as S-expression
├── awareness.scm.bak  # Previous version (for rollback)
└── cache/
    └── parsed/        # Cached ts-morph parse results (optional)
```

### awareness.scm Contents

```scheme
;; Auto-generated by Periphery - do not edit manually
;; Generated: 2025-11-27T06:00:00Z
;; Source: /Users/dev/foundation/periphery

(define awareness
  '((meta
      :project "periphery"
      :root "/Users/dev/foundation/periphery"
      :generated "2025-11-27T06:00:00Z"
      :files 49
      :classes 36
      :functions 18)

    (structure
      (module "discover" ...)
      (module "entity-act" ...)
      ...)

    (relationships
      (extends ...)
      (imports ...)
      (contains ...))

    (patterns
      (pattern "montessori-boundary" ...)
      (pattern "context-as-specification" ...))

    (history
      (change "2025-11-27T05:30:00Z" "src/discover.ts" :added "graph-* functions")
      (change "2025-11-26T22:00:00Z" "src/entity-act.ts" :added "clone support"))))
```

---

## Update Mechanics

### File Watching

```typescript
import chokidar from 'chokidar';

// Watch source files
const watcher = chokidar.watch('src/**/*.ts', {
  ignored: /node_modules|dist|__tests__/,
  persistent: true,
  ignoreInitial: true,
});

// Debounce rapid changes (200ms window)
let debounceTimer: NodeJS.Timeout;
watcher.on('all', (event, path) => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    updateAwareness(path, event);
  }, 200);
});
```

### Incremental Updates

When a file changes:
1. Remove old contribution (nodes + edges from that file)
2. Re-parse the changed file
3. Extract new contribution
4. Update in-memory state
5. Regenerate awareness.scm
6. Next tool description fetch gets new state

File-level granularity is sufficient. Per-expression updates are over-engineering for awareness (not for real-time editing support, but that's a different use case).

### Persistence

```typescript
// On state change
async function persistAwareness(state: AwarenessState): Promise<void> {
  const scm = serializeToSExpression(state);
  const tempPath = '.periphery/awareness.scm.tmp';
  const finalPath = '.periphery/awareness.scm';

  // Atomic write: temp → fsync → rename
  await fs.writeFile(tempPath, scm);
  await fs.fsync(tempPath);
  await fs.rename(tempPath, finalPath);
}

// On startup
async function loadAwareness(): Promise<AwarenessState> {
  const scmPath = '.periphery/awareness.scm';
  if (await fs.exists(scmPath)) {
    const scm = await fs.readFile(scmPath, 'utf-8');
    return parseFromSExpression(scm);
  }
  // Cold start: build from scratch
  return buildAwarenessFromSource();
}
```

---

## The Experience

### Session Start

1. Claude Code connects to Periphery MCP
2. Periphery generates tool description with current awareness summary
3. Claude receives description, it's now in context
4. Claude reads: "periphery has 5 modules, Discover extends DiscoveryToolInteraction, patterns include montessori-boundary..."
5. Claude now has intuitions about the codebase

### During Session

Claude can:
```scheme
;; Quick orientation (data already loaded)
(@ project :modules)

;; Specific queries
(filter (lambda (c) (extends? c "EntityAct")) (@ project :classes))

;; Impact analysis
(@ (find-class "EntityAct") :dependents)

;; Or use convenience functions if preferred
(graph-search "EntityAct" 'class)
```

### File Changes Mid-Session

1. Developer edits src/discover.ts
2. Chokidar detects change
3. Periphery updates in-memory state
4. Next tool call gets fresh data in environment
5. (Tool description only updates on reconnect, but environment data is always current)

---

## What's Still Missing

### 1. Cross-Session Learning

The awareness captures **structure** but not **learnings**. What Claude discovered about the codebase in previous sessions is lost.

Options:
- Session notes in awareness.scm (history section)
- Separate learnings.scm file
- Integration with future Memory Tool

### 2. Multi-Project Awareness

Current design is single-project. For monorepos or multi-project workspaces:
- Multiple awareness.scm files?
- Unified workspace awareness?
- Project switching mechanism?

### 3. Staleness Detection

How does Claude know if awareness is stale vs current?
- Timestamp in description
- Hash of source files
- Explicit "awareness-status" query

### 4. Attention Budget

500 tokens for description is a guideline. Need to:
- Measure actual impact on Claude's attention
- Tune density vs coverage trade-off
- Possibly hierarchical: summary in description, details on-demand

### 5. Convenience Helpers

What helper functions should be pre-registered?
- `(extends? class parent)` - Check inheritance
- `(imports? module target)` - Check imports
- `(dependents-of entity)` - Who uses this?
- `(dependencies-of entity)` - What does this use?
- `(find-class name)`, `(find-module name)` - Lookup by name

Or: are these unnecessary if the data structure is good?

---

## Implementation Plan

### Phase 1: Basic Persistence (Day 1)

1. Add awareness.scm generation to existing graph-init
2. Load from awareness.scm on startup
3. Measure cold start vs warm start times

### Phase 2: File Watching (Day 2)

1. Add chokidar watcher
2. Implement incremental updates
3. Debounce rapid changes
4. Atomic persistence

### Phase 3: Dynamic Descriptions (Day 3)

1. Modify Discover to generate dynamic description
2. Include awareness summary (~500 tokens)
3. Test with Claude Code connection

### Phase 4: Environment Integration (Day 4)

1. Load awareness data into sandbox as `project`
2. Add convenience helpers
3. Update CLAUDE.md with query examples

### Phase 5: Refinement (Ongoing)

1. Tune description content based on usage
2. Add cross-session learning if needed
3. Measure and optimize performance

---

## Open Questions

1. **Should awareness.scm be committed to git?**
   - Pro: Team shares same awareness base
   - Con: Generated file, merge conflicts

2. **How much structure vs summary?**
   - Full AST-level detail?
   - Module/class level sufficient?
   - Configurable depth?

3. **Natural language in awareness?**
   - Pure structure (machine-optimal)?
   - Include purpose/description fields (human-readable)?
   - LLM-generated summaries?

4. **Relationship types to track?**
   - extends, implements, imports (structural)
   - calls, references (behavioral)
   - contains (hierarchical)
   - all of the above?

---

## The Bet

We're betting that:

1. **Ambient awareness beats query capability** - Knowing the terrain matters more than powerful search
2. **S-expressions are the right format** - Homoiconicity earns its keep through compositional queries
3. **Dynamic descriptions are underexplored** - No one else is using this injection point
4. **500 tokens is enough for orientation** - Dense summary beats comprehensive dump

If we're right, Claude will naturally reach for structured queries instead of Read/Grep, because it will have intuitions about what to query.

---

## References

- memo-008: Awareness Merge design
- GitLab knowledge-graph: Production patterns (Kuzu, Parquet)
- Research: "Lost in the middle" attention patterns
- Research: Context budget optimization
- DiscoveryToolInteraction.ts: Dynamic description mechanism
