# Memory Manifest Generator - Implementation Summary

Created ManifestGenerator for "memory about memory" - compressing memory graphs into 500-1000 token summaries for tool descriptions.

## Files Created

### Core Implementation
- `/src/memory/manifest/ManifestGenerator.ts` - Main generator class with graph analysis
- `/src/memory/manifest/index.ts` - Public API exports
- `/src/memory/manifest/README.md` - Usage documentation
- `/src/memory/manifest/example.ts` - Working example with sample data

### Tests
- `/src/memory/manifest/__tests__/ManifestGenerator.test.ts` - Comprehensive test suite (4 tests, all passing)

## Key Features

### 1. Community Detection
Uses Louvain algorithm (graphology-communities-louvain) to detect thematic clusters:
- Groups related memories into communities
- Calculates importance (PageRank-weighted average)
- Measures volatility (recency of changes)
- Extracts keywords from tags and text
- Optional LLM-enhanced theme naming (Anthropic SDK)

### 2. Topology Analysis
Graph structure metrics (graphology-metrics):
- **Density**: How interconnected the graph is
- **Modularity**: How well-clustered (0.3-0.5 = moderate, >0.5 = high)
- **Clustering coefficient**: Local clustering strength
- **Average degree**: Connectivity per node

### 3. Temporal Layers
Time-based classification:
- **Emerging**: Created in last 24h
- **Active**: Accessed in last 7d
- **Stable**: Unchanged >30d with high energy (>0.5)
- **Decaying**: Low energy (<0.3) + not accessed >30d

### 4. Key Node Detection
PageRank centrality × energy × importance:
- Identifies most influential memories
- Ranks by combined score
- Returns top 10 with readable labels

### 5. Bridge Detection
Cross-community connections:
- Finds edges connecting different themes
- Sorts by weight
- Returns top 10 bridges

## Output Format

Compressed manifest includes:
1. Header with counts and density
2. Top 5 themes with keywords
3. Temporal state summary
4. Top 5 key nodes
5. Topology interpretation

Example output (~240 tokens for 10-item graph):
```
=== MEMORY GRAPH MANIFEST ===
Generated: 11/27/2025, 3:41:19 PM
10 items | 9 edges | density 0.100

Top Themes:
  memory / graph / memory / graph (active)
    4 items | keywords: memory, graph, louvain
  typescript / relief / that / when (stable)
    5 items | keywords: typescript, relief, code

Temporal State:
  Emerging: 3 items (last 24h)
  Active: 7 items (last 7d)
  Stable: 4 items (>30d unchanged)
  Decaying: 1 items (low energy)

Key Nodes:
  Memory graph uses Louvain communities... (importance: 0.11)
  Result monad for railway-oriented... (importance: 0.10)
  ...

Topology:
  Modularity: 0.493 (moderately clustered)
  Avg degree: 1.8
  Communities: 2
  Bridges: 0 cross-community connections
```

## Usage

### Basic (no LLM)
```typescript
import { ManifestGenerator } from '@here.build/harmony/memory/manifest';

const generator = new ManifestGenerator();
const manifest = await generator.generateManifest(items, associations);
const description = generator.formatDescription(manifest);
```

### With LLM theme naming
```typescript
import Anthropic from '@anthropic-ai/sdk';
import { ManifestGenerator } from '@here.build/harmony/memory/manifest';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const generator = new ManifestGenerator(anthropic);
const manifest = await generator.generateManifest(items, associations);
```

### In MCP tool descriptions
```typescript
export const recallTool = {
  name: "recall_memory",
  description: `Retrieve relevant memories.

${manifestDescription}

Use this context to understand coverage and gaps.`,
};
```

## Design Principles

1. **Relief-driven**: Graph operations feel natural with graphology
2. **Type-safe**: Full TypeScript types, no any
3. **Compositional**: Small, focused methods
4. **Resilient**: Handles empty graphs, missing data
5. **Optional dependencies**: Anthropic SDK is peer dependency

## Performance

- Manifest generation: O(n + m) where n=nodes, m=edges
- Louvain: O(n log n) typical
- PageRank: O(k(n + m)) where k=iterations (default 100)

For large graphs (>10k items), cache manifests and regenerate on significant changes.

## V's Core Insight

> "в самом описании тула надо выводить краткую сводку содержания памяти...
>  чтобы в 1000-2000 токенов влезла 'память о памяти'"

Instead of Claude reading entire memory graphs, we compress into "memory about memory" - a lossy but semantically rich summary that fits in tool descriptions. This enables:
- Fast awareness of memory state
- Understanding coverage vs gaps
- Guided recall decisions
- Efficient token usage

## Integration Notes

- Works with existing MemoryItem and MemoryEdge types
- Compatible with vessel memory format
- Ready for harmony package extraction
- Tested and verified (all tests passing)

## Next Steps

For full integration:
1. Hook into memory store operations
2. Regenerate manifest on significant changes (configurable threshold)
3. Inject into MCP tool descriptions
4. Consider caching strategy for large graphs
5. Optional: Add temporal trend detection (e.g., "memory growing rapidly")
