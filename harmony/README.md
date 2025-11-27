# Harmony

Multi-agent memory orchestration with thematic awareness.

## Core Insight

V's "memory about memory" - tool descriptions show emergent themes BEFORE the first query, providing ambient context.

## Architecture

- **Memory Graph**: Items + edges with spreading activation for associative recall
- **Manifest Generation**: Statistical clustering (Louvain communities) + temporal layers
- **Dynamic Descriptions**: Live state embedded in tool descriptions (~500-1000 tokens)
- **Persistence**: File-based JSON for development, FalkorDB for production

## MCP Server

The harmony MCP server exposes memory operations to Claude Code and other MCP clients.

### Starting the Server

```bash
cd harmony
pnpm build
pnpm start
```

Server runs on `http://localhost:3001` by default (set `PORT` env var to override).

### Adding to Claude Code

```bash
claude mcp add --transport http harmony http://localhost:3001
```

### Memory Storage

Memories are stored in `.harmony/state.json` at workspace root:
- Auto-discovered by walking up to find `.git` or `pnpm-workspace.yaml`
- Override with `HARMONY_STATE_DIR` environment variable

### Available Tools

#### `memory` Tool

S-expression interface for memory operations:

**Query Operations:**
- `(status)` - Show memory status, themes, recent items
- `(recall "query" [limit])` - Semantic search with spreading activation
- `(themes)` - Get thematic synthesis

**Mutation Operations:**
- `(remember "text" "type" ["tags"] [importance] [scope])` - Store memory
- `(connect "from-id" "to-id" "relation" [weight])` - Create association
- `(decay [half-life-days])` - Apply energy decay

**Maintenance:**
- `(refresh)` - Force manifest regeneration

**Memory Types:**
- `event` - What happened
- `fact` - Declarative knowledge
- `plan` - Intentions, goals
- `reflection` - Meta-cognition
- `entity` - Domain objects
- `principle` - Rules, heuristics
- `technique` - How-to knowledge
- `warning` - Caveats, gotchas
- `workflow` - Multi-step processes
- `bridge` - Connections between domains
- `pattern` - Recurring structures
- `insight` - Emergent understanding

## Example Usage

```scheme
; Check status
(status)

; Store memories
(remember "Implemented spreading activation engine" "event"
          ["harmony" "implementation"] 0.8)

(remember "Energy decay follows exponential curve" "principle"
          ["memory" "theory"] 0.9)

; Create associations
(connect "m_1234_abcd" "m_5678_efgh" "implements" 0.7)

; Query memories
(recall "spreading activation" 5)

; Get themes
(themes)
```

## Development

```bash
# Build
pnpm build

# Type check
pnpm typecheck

# Test
pnpm test

# Run server
pnpm dev
```

## Implementation Status

- ✅ Memory graph (items, edges, scopes)
- ✅ Spreading activation engine
- ✅ File-based persistence
- ✅ Manifest generation (statistical clustering)
- ✅ Dynamic tool descriptions
- ✅ MCP server (HTTP transport)
- ✅ S-expression interface
- 🚧 LLM-generated community summaries
- 🚧 FalkorDB integration
- 🚧 Policy evolution
- 🚧 Multi-agent coordination

## References

- [ARCHITECTURE.md](../docs/ARCHITECTURE.md) - System architecture
- [Spreading Activation](src/memory/engine/SpreadingActivationEngine.ts) - Associative recall
- [Manifest Generator](src/memory/manifest/ManifestGenerator.ts) - Thematic synthesis
- [MCP Tool](src/mcp/MemoryToolInteraction.ts) - Tool implementation
