# Memo 008: Awareness Merge - S-Expression Graph Queries

**Date:** 2025-11-27
**Status:** In Progress
**Context:** Merging standalone awareness MCP server into discovery sandbox

## The Problem

We built two separate systems:
1. **periphery/discover** - S-expression sandbox for cata/hypergraph queries
2. **awareness/** - HTTP MCP server for persistent graph queries

They should be one thing. Discovery queries should compose with graph queries naturally:

```scheme
;; This should work
(filter
  (lambda (cls) (> (length (used-by cls)) 5))
  (search "Controller"))
```

## Current State

### What exists in awareness/ (standalone MCP server, port 7778):
- `ProjectGraph` class with ts-morph extraction
- `ProjectWatcher` for file watching (chokidar)
- Graph state: `Map<string, GraphNode>`, `GraphEdge[]`, `HyperGraph`
- 12 query tools: search, depends_on, used_by, inheritance, impact, cycles, path, etc.
- JSON output via HTTP

### What exists in periphery/discover:
- S-expression sandbox (LIPS Scheme)
- `parse-file`, `cata`, hypergraph construction
- `act-on` for transformations
- Already has ts-morph Project/SourceFile caching
- S-expression output

## Target Architecture

### Option A: Embed graph in Discover class

```typescript
class Discover extends DiscoveryToolInteraction<DiscoveryContext> {
    // Existing
    private projects: Map<string, Project>;
    private sourceFiles: Map<string, SourceFile>;

    // NEW: Graph state (from awareness)
    private graphNodes: Map<string, GraphNode>;
    private graphEdges: GraphEdge[];
    private graphBuilt: boolean = false;

    async registerFunctions() {
        // ... existing functions ...

        // NEW: Graph functions
        this.registerFunction('build-graph', ...);
        this.registerFunction('search', ...);
        this.registerFunction('used-by', ...);
        this.registerFunction('depends-on', ...);
        this.registerFunction('inheritance-chain', ...);
        this.registerFunction('impact-of', ...);
    }
}
```

**Pros:**
- Single sandbox, natural composition
- S-expression output for all queries
- Reuses existing ts-morph cache

**Cons:**
- Graph state per-request (not persistent across calls)
- No file watching (need rebuild each session)

### Option B: Shared graph singleton with S-expr wrapper

```typescript
// Singleton graph manager
const graphManager = new ProjectGraphManager();

class Discover {
    async registerFunctions() {
        this.registerFunction('graph-init', async (projectPath) => {
            await graphManager.init(projectPath);
            return graphManager.getSummary();
        });

        this.registerFunction('search', (pattern, kind?) => {
            return graphManager.search(pattern, kind);
        });
    }
}
```

**Pros:**
- Persistent graph across MCP calls
- Can add file watcher
- Memory efficient (single graph instance)

**Cons:**
- Global state (but that's what we want for awareness)

### Option C: Graph as lazy-built from cata results

```scheme
;; Build graph on-demand from cata extractions
(define (build-project-graph files)
  (let* ((extracts (map (lambda (f) (cata 'extract (parse-file f))) files))
         (classes (flatten (map (lambda (e) (@ e :classes)) extracts)))
         (edges (flatten (map extract-edges extracts))))
    (make-graph classes edges)))

;; Then query it
(used-by (car (search graph "EntityAct")))
```

**Pros:**
- Pure S-expression, no special infrastructure
- Compositional by construction

**Cons:**
- Rebuilds on each call (slow for large projects)
- No persistence

## Recommended: Option B with GitLab-inspired persistence

### Phase 1: S-expression interface (immediate)

Add to discover.ts:
```typescript
// Graph state - singleton across requests
private static graphState: {
    nodes: Map<string, GraphNode>;
    edges: GraphEdge[];
    projectRoot: string | null;
    lastBuild: number;
} | null = null;

// Register S-expr functions
this.registerFunction('graph-init', ...);
this.registerFunction('graph-search', ...);
this.registerFunction('graph-used-by', ...);
this.registerFunction('graph-depends-on', ...);
this.registerFunction('graph-inheritance', ...);
this.registerFunction('graph-impact', ...);
this.registerFunction('graph-cycles', ...);
```

### Phase 2: Persistence (later, GitLab-inspired)

Learn from GitLab's knowledge-graph:
- **Parquet files** for node/edge storage (Arrow for zero-copy)
- **Kuzu** embedded graph DB for complex queries
- **String interning** (`ArcIntern<String>`) for memory efficiency

For TypeScript, equivalent would be:
- **SQLite** with FTS5 for search
- **LevelDB** or **LMDB** for key-value node storage
- Or just **JSON files** with mmap for simplicity

### Phase 3: Live updates (later)

- File watcher (chokidar) detects changes
- Incremental update: remove old file's nodes/edges, add new
- Debounce rapid changes

## Graph Schema (from awareness/)

```typescript
type NodeKind = 'file' | 'class' | 'interface' | 'function' | 'method' | 'variable';
type EdgeKind = 'imports' | 'extends' | 'implements' | 'calls' | 'references' | 'contains';

interface GraphNode {
    id: string;           // "file.ts::ClassName" or "file.ts"
    kind: NodeKind;
    name: string;
    filePath: string;
    line?: number;
}

interface GraphEdge {
    from: string;
    to: string;
    kind: EdgeKind;
}
```

## S-Expression API Design

```scheme
;; Initialize graph for project
(graph-init "/path/to/project")
; => {:files 52 :classes 44 :edges 286}

;; Search nodes by name pattern
(graph-search "Entity" :kind 'class)
; => ((&(:id "entity-act.ts::EntityAct" :kind class :name "EntityAct" ...)) ...)

;; What extends/uses this node?
(graph-used-by "src/entity-act.ts::EntityAct")
; => ((&(:node ... :edge {:kind extends})) ...)

;; What does this node depend on?
(graph-depends-on "src/discover.ts")
; => ((&(:node ... :edge {:kind imports})) ...)

;; Inheritance chain
(graph-inheritance "src/code-entity-act.ts::CodeEntityAct")
; => (CodeEntityAct EntityAct ActionToolInteraction)

;; Impact analysis
(graph-impact "src/entity-act.ts::EntityAct")
; => ("entity-act.ts" "code-entity-act.ts" "plexus-act.ts" ...)

;; Cycles
(graph-cycles)
; => (("code-entity-act.ts" "discover.ts" "code-entity-act.ts"))
```

## Composition Examples

```scheme
;; Find classes with many dependents (hot spots)
(define (hot-spots threshold)
  (filter
    (lambda (cls) (> (length (graph-used-by (@ cls :id))) threshold))
    (graph-search ".*" :kind 'class)))

;; Find circular dependencies
(define (circular-imports)
  (filter
    (lambda (cycle) (every (lambda (n) (ends-with? n ".ts")) cycle))
    (graph-cycles)))

;; Refactoring impact
(define (safe-to-change? entity-id)
  (let ((impacted (graph-impact entity-id)))
    (< (length impacted) 5)))
```

## Implementation Steps

1. **Add static graph state to Discover class**
   - Singleton pattern (static field)
   - Lazy initialization on first `graph-init`

2. **Port extraction logic from awareness/project-graph.ts**
   - `extractFromFile()` function
   - Node/edge type definitions
   - Reuse existing ts-morph Project cache

3. **Register S-expression functions**
   - `graph-init`, `graph-search`, `graph-used-by`, etc.
   - All return S-expression data (not JSON)

4. **Test on periphery itself**
   ```scheme
   (graph-init ".")
   (graph-search "Discover")
   (graph-used-by "src/discover.ts::Discover")
   ```

5. **Update CLAUDE.md** with new functions

6. **Optional: Add persistence**
   - Save graph to `.periphery/graph.json` on build
   - Load from cache if exists and files unchanged

## Files to Modify

- `periphery/src/discover.ts` - Add graph state + functions
- `periphery/src/index.ts` - Export graph types if needed
- `CLAUDE.md` - Document new functions

## Files to Eventually Remove

- `awareness/` - Entire package becomes obsolete once merged

## Open Questions

1. **Graph scope**: Per-project or workspace-wide?
   - Start with per-project (matches `graph-init` call)

2. **Memory limits**: What if project has 10k files?
   - GitLab uses Parquet/Kuzu for this
   - For now: just fail gracefully, optimize later

3. **Call graph extraction**: Currently not implemented
   - Would need AST traversal for call sites
   - Add in Phase 2

## Why S-expressions Matter Here

The whole point is composition. JSON APIs force:
```
call awareness_search("Entity") → result1
call awareness_used_by(result1[0].id) → result2
call awareness_impact(result1[0].id) → result3
```

S-expressions enable:
```scheme
(let ((entities (graph-search "Entity")))
  (map (lambda (e)
         (list (@ e :name)
               (length (graph-used-by (@ e :id)))
               (graph-impact (@ e :id))))
       entities))
```

One expression. The query IS the composition.

## Self-Reminder

You keep reaching for Read/Grep instead of discovery.

**Force yourself**: Next session, use `(graph-search ...)` and `(cata 'extract ...)` for ALL code exploration. If it's painful, that's data about what's missing.

The tool should serve the thought, not the other way around.
