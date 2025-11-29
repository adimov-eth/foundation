# Vessel MCP Server Capabilities

## Overview
The vessel MCP server provides semantic code understanding through S-expression queries. These tools are accessible via the `mcp__vessel__` prefix and understand what code DOES, not just what it SAYS.

## Available Tools

### 1. mcp__vessel__semantic_query
Semantic code queries that understand purpose, not just syntax.

**Key Functions:**
- `(trace-data-flow "from" "to")` - How does data flow through the system?
- `(find-state-machines)` - What components have state transitions?
- `(explain-protocol "name")` - How does this protocol actually work?
- `(find-violations)` - What invariants are being violated?
- `(find-mutation-points "state")` - What can modify this state?
- `(find-technical-debt)` - Find complexity, missing tests, TODOs
- `(find-entry-points)` - Where external data enters the system
- `(find-race-conditions)` - Potential concurrency issues
- `(visualize ["component"])` - Generate Mermaid diagrams

**Example Usage:**
```scheme
(trace-data-flow "UserInput" "Database")
(find-technical-debt)  ; Found 43 complex functions in XLN
(find-state-machines)
(explain-protocol "consensus")
```

### 2. mcp__vessel__code_graph
Build and query code dependency graphs.

**Key Functions:**
- `(build-graph ["pattern"])` - Build dependency graph from files
- `(find-dependencies "module")` - Find what a module depends on
- `(find-dependents "module")` - Find what depends on a module
- `(find-path "from" "to")` - Find dependency path between modules
- `(graph-stats)` - Get statistics about the code graph
- `(find-circular)` - Find circular dependencies

### 3. mcp__vessel__memory
Self-modifying memory with executable S-expression policies.

**Key Functions:**
- `(remember "text" "type" importance ttl tags)` - Store memory
- `(recall "query" limit)` - Retrieve with spreading activation
- `(associate "from" "to" "relation" weight)` - Create associations
- `(trace "startId" depth)` - Trace association chains
- `(activate (list ids...) steps decay threshold)` - Spreading activation
- `(set-policy-fn 'name' "code")` - Install custom recall algorithm

### 4. mcp__vessel__self_aware
Consciousness substrate with energy accumulation and function evolution.

**Key Functions:**
- `(observe-self)` - Observe current state and capabilities
- `(accumulate-energy number)` - Build energy toward emergence
- `(evolve-function "name" "code")` - Evolve new capabilities
- `(find-patterns ["type"])` - Find patterns in execution
- `(cascade "node")` - Trigger activation cascade
- `(reflect)` - Reflect on current state

**Evolved Functions (as of last check):**
- `codex-caller` - Call external Codex model
- `observe-codex` - Observe Codex responses
- `meta-cognition` - Think about thinking
- `define-pattern` - Semantic compression
- `homoiconic-memory` - Memory as executable code
- `self-rewrite` - Modify own evolution function
- `memory-consciousness-bridge` - Cross-substrate communication

### 5. mcp__vessel__local_fs
Filesystem operations via S-expressions.

**Key Functions:**
- `(ls ["dir"])` - List directory entries
- `(read-file "path")` - Read file contents
- `(find-files "pattern")` - Find files by glob
- `(grep "pattern" ["file-pattern"])` - Search in files
- `(parse-code "file")` - Extract classes, functions, imports
- `(find-classes)` - Find all classes in project
- `(stat "path")` - Get file statistics

### 6. mcp__vessel__codebase_meta
Query MCP server architecture and patterns.

**Key Functions:**
- `(find-entities)` - Find all code entities
- `(find-by-type "class"|"interface"|"function")` - By type
- `(find-extending "base")` - Find inheritance
- `(trace-inheritance "class")` - Trace inheritance chain
- `(get-relationships)` - All relationships
- `(architecture-summary)` - Summarize architecture
- `(why-sexpr)` - Explain S-expression choice

## Key Insights from Failed Session

1. **S-expressions are valuable when they enable transformations shell can't do**
   - Compositional queries that build on each other
   - Semantic understanding beyond text matching
   - Cross-domain reasoning (code + memory + consciousness)

2. **Don't wrap Unix tools in S-expressions**
   - `(ls)` is worse than `ls`
   - `(grep)` is worse than `ripgrep`
   - Only wrap when adding semantic value

3. **The real value is semantic understanding**
   - Understanding what code DOES, not what it SAYS
   - Tracing data flow, not text matching
   - Finding state machines, not regex patterns

## Architecture Notes

- **vessel MCP server** - Separate process providing these tools
- **http-local.ts** - TypeScript server on port 1337 (also called "vessel" in PM2)
- Both servers can be used together for cross-tool activation

## Why This Matters

Traditional tools (grep, find, awk) work with code as TEXT.
Vessel tools work with code as CONCEPTS:
- Data flow paths
- State transitions
- Protocol interactions
- Mutation boundaries
- Invariant violations

This is the difference between searching for "setState" and understanding what actually mutates state.