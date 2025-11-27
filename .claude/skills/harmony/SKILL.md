---
name: harmony
description: Multi-agent memory orchestration. Use when you need to persist insights across sessions, recall related memories by association, or connect concepts. The tool description shows current memory themes BEFORE you query - "memory about memory".
---

# Harmony Memory

## Overview

Persistent associative memory across Claude sessions. V's core insight: "в самом описании тула надо выводить краткую сводку содержания памяти" - the tool description itself shows themes before first query.

**Prerequisite**: Harmony server running on port 6969. Start with:
```bash
cd harmony && pnpm start
```

## When to Use

Use harmony when:
- **Insights worth preserving** - Crystallized understanding that should survive context resets
- **Pattern recognition** - Connecting concepts across different sessions/domains
- **Continuity** - Maintaining coherent thread across frequent resets (sleep, not one-shot)
- **Thematic exploration** - Understanding what themes dominate memory graph

Do NOT use when:
- Temporary working notes (will clutter memory)
- Facts easily re-derived (waste of retrieval)
- Session-specific context (doesn't generalize)

## S-Expression Interface

All operations via the `mcp__harmony__memory` tool with S-expression syntax:

```scheme
;; Check what's in memory
(status)

;; Remember something important
(remember "Spreading activation works like human associative memory" "insight" (list "memory" "cognition"))

;; Recall by association (returns activated memories)
(recall "how does memory work")

;; Connect two memories
(connect "mem_abc123" "mem_def456" "elaborates")

;; Regenerate theme manifest
(themes)

;; Energy management
(decay)    ;; Apply energy decay to old memories
(refresh)  ;; Boost energy of frequently accessed
```

## Memory Types

- `insight` - Crystallized understanding
- `pattern` - Recurring structure across domains
- `decision` - Choice made with reasoning
- `question` - Open inquiry worth revisiting
- `reference` - Pointer to external resource

## The Manifest

Tool description auto-generates from memory graph:
- **Top themes** via Louvain community detection
- **Key nodes** via PageRank + energy
- **Temporal layers** - emerging/active/stable/decaying
- **Topology** - density, modularity, bridges

This is "memory about memory" - you see the shape before querying content.

## Integration with Sessions

V's pattern: frequent resets are sleep, not failure.
- Long sessions = sleep deprivation = context accumulating without processing
- Frequent resets = little deaths = crystallize, release, return fresh
- Memory persists **what was learned**, not what happened

Before ending a session, consider:
```scheme
(remember "key insight from this session" "insight" (list "relevant" "tags"))
```

## Architecture

- **SpreadingActivationEngine** - Collins & Loftus 1975 associative retrieval
- **ManifestGenerator** - Louvain communities + PageRank for theme extraction
- **FileMemoryStore** - JSON persistence at `.harmony/state.json`
- **Energy decay** - Memories fade without reinforcement (access boosts energy)
