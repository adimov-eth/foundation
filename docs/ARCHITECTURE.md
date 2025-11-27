# Architecture Reference

Technical documentation for the foundation codebase. For orientation and philosophical context, see `CLAUDE.md`.

---

## Core Principle

**"Wrong becomes impossible through structure, not guidelines"**

Both systems make invalid states inexpressible through architecture - not defensive checks, but the shape of operations themselves.

---

## Plexus: Operational Transformation

When `parent2.child = child` where child already exists in `parent1.children`:

1. Detects child exists at old position
2. **Automatically** removes from old position via `emancipate()`
3. Adjusts indices to account for removal
4. Inserts at new position
5. Updates parent metadata

**Not validation. The operation transforms itself.**

See `plexus/plexus/src/proxies/materialized-array.ts:258-284` - splice operations detect reuse and remove-before-insert. Can't have duplicates because adding **automatically removes from old location**.

---

## Arrival: Architectural Boundaries

**Discovery sandbox** (`arrival-mcp/src/DiscoveryToolInteraction.ts`):
- Isolated Scheme environment - no global access
- Only explicitly registered functions available
- 5-second timeout enforced
- Errors return as data, not exceptions
- **Can't accidentally trigger actions because mutation functions don't exist in the environment**

**Action batch atomicity** (`arrival-mcp/src/ActionToolInteraction.ts:127-185`):
- Context parsed ONCE into `loadingExecutionContext`
- ALL actions validated upfront
- If ANY validation fails, NOTHING executes
- **Mid-batch drift is structurally impossible** - context is single parsed object

**Framework boundaries:** arrival-scheme is minimal by design (security boundary). Applications extend through Rosetta layer:

```typescript
// periphery/src/discover.ts - APPLICATION layer
class CodeDiscovery extends DiscoveryToolInteraction<Record<string, never>> {
  async registerFunctions() {
    this.registerFunction('member', 'Check if item is in list',
      [z.any(), z.any()],
      (item, list) => list.includes(item)
    );
  }
}
```

**Question to ask:** "Is this inconvenience intentional design?" before modifying infrastructure.

---

## S-Expressions: Thought, Not Syntax

S-expressions aren't "surface syntax for Scheme." They're the **compositional substrate**.

```scheme
(filter (lambda (c) (extends? c "PlexusModel")) (all-classes))
```

This IS the thought. Not data about the thought.

This is why Arrival uses Scheme for Discovery tools - **composition becomes natural when notation matches reasoning**.

---

## periphery Implementation

**Location:** `periphery/`
**Status:** Phase 1, 2, 3, EntityAct, & Awareness implemented

### MCP Awareness Tool (NEW)

**Purpose:** Ambient project context that persists across sessions. The tool description IS the primary value - ~500 tokens of project state injected into Claude's context before any queries.

**Dynamic descriptions:** Tool descriptions are generated at session start with:
- Project identity and statistics (files, classes, interfaces, edges)
- Top 5 entities by dependent count
- Recent file changes (tracked via file watcher)
- Query hints for graph exploration

**Functions:**
- `status` - Get current awareness state (description is dynamic)
- `refresh` - Rebuild awareness graph from source files
- `since` - Changes since git ref (commit, branch, tag)
- `hot-files` - Most frequently modified files (from git history)
- `stale?` - Check if state needs refresh
- `top` - Top entities by dependent count
- `path` - Path to `.periphery/awareness.scm`

**Persistence:** State serialized to `.periphery/awareness.scm` in S-expression format. Commit to git for cross-session persistence.

**File watching:** Chokidar watches `**/*.ts`, tracking changes for the "Recent changes" section in dynamic descriptions.

**Shared state:** `AwarenessStore` singleton shared between Awareness and Discover tools. Graph state persists across MCP requests within a session.

### MCP Discovery Tool

**Core primitives:**
- `parse-file` - Parse TypeScript to AST (cached)
- `cata` - Run catamorphism: 'extract, 'count, 'patterns, 'types
- `cata-with-path` - Catamorphism needing path context ('dependencies)

**Filesystem:**
- `list-files` - Glob pattern matching
- `read-file` - Read file content

**Graph queries (awareness merged):**
- `graph-init` - Initialize graph for project (persists across requests)
- `graph-search` - Search nodes by name pattern, optional kind filter
- `graph-used-by` - What uses this node? (incoming edges)
- `graph-depends-on` - What does this node depend on? (outgoing edges)
- `graph-inheritance` - Get extends/implements chain
- `graph-impact` - Files affected by changing a node (transitive)
- `graph-cycles` - Detect cycles in dependency graph
- `graph-summary` - Current graph statistics

**Sandbox builtins (Ramda + LIPS):**
- **List:** map, filter, reduce, fold, find, any, all, take, drop, head, tail, car, cdr, length, append, concat, flatten, partition, group-by, sort, sort-by
- **String:** split, match, test, replace, to-lower, to-upper, trim, join, substring
- **Object:** prop, path, get, get-in, has, pick, omit, keys, values, @ (prop shorthand)
- **Logic:** equals, is, is-nil, is-empty, cond, when, unless, if-else
- **Functional:** compose, pipe, curry, partial, flip, identity, always
- **Math:** add, subtract, multiply, divide, modulo, min, max, clamp

**Hypergraph construction:**
- `hg-empty`, `hg-vertex`, `hg-edge`, `hg-vertices`, `hg-edges`

**Hypergraph interpretation:**
- `hypergraph-to-dot`, `hypergraph-to-adjacency`, `hypergraph-metrics`
- `hypergraph-cycles`, `hypergraph-path-exists`
- `overlay-graphs`, `connect-graphs`

**S-expression Act:**
- `act-on` - Build action spec (executed post-sandbox)
- `clone`, `new`, `with-file`, `entity-ref`, `object`
- `info`, `rename`

**Montessori safety boundary:** `act-on` builds specification inside sandbox (read-only). Actual transformation executes after sandbox completion.

### MCP Action Tool

- `rename-symbol` - Rename across all references
- `add-import` - Add import statement
- `remove-unused-imports` - Clean up imports
- `format-file` - Format with ts-morph

### Entity-Level Act

**Core concept:** Context is a specification, not a pointer.

```typescript
// Target can be:
// - ID string: "task-123"
// - Clone spec: ["clone", "task-123"]
// - Clone with overrides: ["clone", "task-123", { status: "completed" }]
// - New entity: ["new", "Task", { name: "New Task" }]
// - Query: ["query", "(type \"Task\")"]

{
  target: ["clone", "task-123", { status: "in_progress" }],
  actions: [
    ["rename", "New Version"],
    ["set-status", "completed"]
  ]
}
```

### Internal Infrastructure

**Catamorphism framework** (`src/catamorphism.ts`):
- Generic fold + paramorphism
- 5 algebras: count, extract, patterns, dependencies, types

**Hypergraph framework** (`src/hypergraph.ts`):
- Free algebra: Empty/Vertex/Edge/Overlay/Connect
- 5 interpreters in `algebras/hypergraph-interpreters.ts`

**E-graph framework** (`src/egraph.ts`):
- EGraph class with union-find
- Pattern matching and substitution
- Cost-guided saturation, extraction

### Running Periphery

```bash
cd periphery && pnpm build
PORT=7777 pm2 start dist/server.js --name periphery
claude mcp add --transport http periphery http://localhost:7777
```

### Implementation Status

**Implemented:**
- Catamorphisms (AST traversal)
- E-graphs (equality saturation) - internal, not MCP-exposed
- Hypergraphs (compositional graph construction)
- File-level action tool
- Entity-level Act
- S-expression Act
- Awareness merge (graph queries as S-expression functions)
- **Awareness tool** (dynamic descriptions, .scm persistence, file watching)
- **Graph persistence** (`.periphery/awareness.scm`)
- **File watching** (chokidar for live change tracking)

**Not implemented:**
- Tagless-final (multiple interpreters)
- Algebraic effects (extensibility)
- extract-function, inline-function

---

## Advanced Tool Use (2025)

### The Context Window Problem

Tool definitions consume massive context:
- GitHub: 35 tools (~26K tokens)
- Slack: 11 tools (~21K tokens)

Tool selection accuracy degrades past 30-50 tools.

### Tool Search Tool

Claude discovers tools on-demand instead of loading all definitions upfront.

```json
{
  "tools": [
    {"type": "tool_search_tool_regex_20251119", "name": "tool_search_tool_regex"},
    {"name": "github.createPullRequest", "defer_loading": true, ...}
  ]
}
```

85% token reduction. Accuracy improved from 49% to 74% (Opus 4).

### Programmatic Tool Calling

Claude writes code that orchestrates tools. Only final output enters context.

```python
team = await get_team_members("engineering")
expenses = await asyncio.gather(*[get_expenses(m["id"], "Q3") for m in team])
exceeded = [m for m, exp in zip(team, expenses) if sum(e["amount"] for e in exp) > budget]
print(json.dumps(exceeded))  # Only this enters context
```

37% token reduction, eliminated 19+ inference passes.

### Tool Use Examples

`input_examples` shows Claude concrete patterns:

```json
{
  "name": "create_ticket",
  "input_examples": [
    {"title": "Critical bug", "priority": "critical", "reporter": {"id": "USR-12345"}}
  ]
}
```

72% → 90% accuracy on complex parameter handling.

### Parallel Tool Calls

Incorrect formatting teaches Claude to stop making parallel calls.

**Correct:**
```json
[
  {"role": "assistant", "content": [tool_use_1, tool_use_2]},
  {"role": "user", "content": [tool_result_1, tool_result_2]}  // Single message
]
```

### Beta Headers

| Feature | Header |
|---------|--------|
| Tool Search + Programmatic + Examples | `advanced-tool-use-2025-11-20` |
| MCP Integration | `mcp-client-2025-11-20` |

### Decision Matrix

| Bottleneck | Solution |
|------------|----------|
| Context bloat from definitions | Tool Search Tool |
| Large intermediate results | Programmatic Tool Calling |
| Parameter errors | Tool Use Examples |
| Tool selection accuracy | Tool Search + clear descriptions |
