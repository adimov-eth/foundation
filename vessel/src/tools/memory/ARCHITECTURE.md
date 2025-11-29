# Memory System Architecture

## Overview

The memory system is a homoiconic, self-modifying associative memory that learns how to remember better through use. It combines:

1. **Graph-based storage** with spreading activation
2. **Executable policy functions** that can be modified at runtime
3. **Feedback-driven learning** that shapes retrieval behavior
4. **Co-activation clustering** that discovers conceptual communities

## Core Components

### 1. Memory Store (`store/`)
- **MemoryStore.ts**: Abstract interface for memory persistence
- **FileMemoryStore.ts**: JSON file-based implementation at `.state/memory/`
  - `graph.json`: The memory graph (items + edges)
  - `graph.sexpr`: S-expression representation for introspection

### 2. Spreading Activation Engine (`engine/`)
- **SpreadingActivationEngine.ts**: Mathematical energy propagation
  - Bidirectional edge traversal
  - Decay factor `D` in formula: `A[j] += A[i] * W[i,j] * D`
  - Activation threshold `F` for propagation cutoff
  - Multiple propagation steps for deeper activation

### 3. Memory Types (`MemoryTypes.ts`)
```typescript
interface MemoryItem {
  id: string;           // Unique identifier (m_<timestamp>_<hash>)
  type: string;         // Semantic type (insight, breakthrough, etc.)
  text: string;         // The actual memory content
  tags: string[];       // Semantic tags for categorization
  importance: number;   // [0,1] significance weight
  energy: number;       // Current activation energy
  ttl: string;         // Time-to-live ("30d", "perpetual")
  createdAt: number;   // Unix timestamp
  updatedAt: number;   // Last modification
  lastAccessedAt?: number;
  accessCount: number;
  success?: number;    // Successful retrieval count
  fail?: number;       // Failed retrieval count
}

interface MemoryEdge {
  from: string;        // Source memory ID
  to: string;          // Target memory ID
  relation: string;    // Semantic relation type
  weight: number;      // [0,1] connection strength
  createdAt: number;
  reinforcements: number; // Co-activation count
}
```

### 4. Executable Policies

The system's behavior is controlled by S-expression functions that can be modified at runtime:

#### Decay Function
Controls how memories fade over time based on success/failure:
```scheme
(lambda (success fail energy importance recency_ms base_half_ms)
  (let* ((total (+ success fail 1))
         (ratio (/ success total))
         (scale (+ 0.5 (* 1.5 ratio))))  ; More successful = slower decay
    (* base_half_ms scale)))
```

#### Recall Score Function
Determines ranking during retrieval:
```scheme
(lambda (activation recency importance access success fail)
  (+ (* 0.4 activation)    ; Network activation strength
     (* 0.3 recency)       ; Time-based relevance
     (* 0.2 importance)    ; Inherent significance
     (* 0.1 (/ success (+ success fail 1)))))  ; Success rate
```

#### Exploration Function
Decides which items to explore beyond top matches:
```scheme
(lambda (limit tail_n acts recs imps accs succ fails)
  (if (> tail_n 2)  ; If we have room to explore
      (let* ((under-explored (filter (lambda (i) (< (nth accs i) 5)) 
                                   (range 0 (length acts)))))
        (if (not (empty? under-explored))
            (first under-explored)  ; Try under-accessed items
            -1))
      -1))
```

### 5. MemoryToolInteraction (`MemoryToolInteraction.ts`)

The main interface exposing memory operations as S-expressions:

#### Core Operations
- `(remember text type importance ttl tags)` - Store a memory
- `(recall query limit)` - Retrieve with spreading activation
- `(associate from-id to-id relation weight)` - Create edges
- `(feedback id "success"|"fail")` - Teach the system
- `(consolidate)` - Cluster and downsample old memories
- `(decay! half-life-days)` - Apply temporal decay

#### Policy Management
- `(get-policy)` - View current executable policies
- `(set-policy-fn name code)` - Install new policy function
- `(adapt-policy)` - Generate new scorer from performance data

#### Analysis
- `(stats)` - Memory statistics and topology metrics
- `(trace id depth)` - Follow association chains
- `(activate seeds steps decay threshold)` - Manual spreading activation

### 6. Session Ingestion (`ingestion/`)

A pipeline for learning from conversation logs:

#### Analyzers (`analysis/analyzers/`)
- **BreakthroughAnalyzer**: Detects conceptual breakthroughs
- **FailureAnalyzer**: Identifies what doesn't work
- **PivotAnalyzer**: Recognizes conversation pivots
- **SolutionAnalyzer**: Extracts successful patterns

#### Pattern Detection (`PatternDetector.ts`)
- Tool usage sequences that lead to success
- User cues that signal important moments
- Failure patterns to avoid
- Conversation dynamics

#### Integration (`integration/`)
- **MemoryIntegration.ts**: Converts patterns to memories
- **MemoryDSLWriter.ts**: Generates S-expression commands

## Data Flow

```
1. User Query
   ↓
2. Recall with Query Terms
   ↓
3. Spreading Activation
   - Seeds: Query matches
   - Propagation: Through edges
   - Decay: Energy dissipates
   ↓
4. Policy Functions Execute
   - Recall scorer ranks items
   - Exploration adds diversity
   ↓
5. Results Returned
   ↓
6. User Feedback
   - Success/fail markers
   - Edge reinforcement
   ↓
7. Policy Evolution
   - Track version performance
   - Adapt based on patterns
```

## Topology Metrics

The memory maintains awareness of its own structure:

- **Density**: Edge count / possible edges
- **Clustering**: How tightly connected communities are
- **Bridges**: Critical edges connecting communities
- **Key Nodes**: High importance + high access memories
- **Temporal Layers**: Active, Stable, Emerging, Decaying

## Self-Modification Mechanism

1. **Version Tracking**: Each policy function has SHA-1 hash
2. **Attribution**: Success/fail tracked per policy version
3. **Evolution**: New policies generated from successful patterns
4. **Rollback**: Can revert to previous versions if performance degrades

## Design Principles

1. **Homoiconicity**: Policies are data that can be inspected and modified
2. **Spreading Activation**: Ideas that co-activate strengthen connections
3. **Feedback-Driven**: Learn from what actually helps vs what doesn't
4. **Emergent Clustering**: Communities form from usage, not predefined categories
5. **Hybrid Performance**: Hot paths in TypeScript, policies in S-expressions

## Current State

- **131 memories** stored across sessions
- **1286 edges** forming association network
- **19.5 average degree** of connectivity
- **Multiple communities** discovered through co-activation
- **Self-modifying policies** actively shaping retrieval

## Future Enhancements

### In Development
- LLM-powered semantic summarization of communities
- Pattern analysis for automatic policy generation
- Cross-agent memory sharing

### Experimental
- Executable memories that modify the system when retrieved
- Consciousness bridges between memory and substrate
- Distributed topology across multiple instances