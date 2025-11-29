# Progressive Disclosure Implementation Plan

**Goal**: Implement claude-mem's progressive disclosure pattern in vessel

**Current behavior**:
- Manifest shows recent high-importance items (titles + previews)
- `(recall)` returns full MemoryItem objects immediately

**Desired behavior**:
- Manifest shows index: ID, type, importance, tags, preview (100 chars), token cost
- `(get-item id)` fetches full details on-demand
- `(recall)` returns IDs only, with scores

---

## Three-Layer Progressive Disclosure

### Layer 1: Index (Tool Description)

**Current manifest format:**
```
Memory Map (543 items, 449 edges):

Themes:
1. Agent SDK Research (Oct 8 2025): Built on Claude C... (importance: 0.22, 27 items)
   - 2025-10-08, agent-orchestration, 2025-10-12
   - Recent: Agent SDK Research (Oct 8 2025): Built on Claude Code harnes

Recent Activity: 2025-10-28, relief, voice-conflict
```

**Proposed progressive index:**
```
Memory Map (543 items, 449 edges):

Recent High-Importance Items (≥0.7):
ID              Type            Imp   Tags                          Preview (100 chars)                                      Tokens
m_mha9skg0...   meta-pattern    0.85  pattern-matching, 2025-10-28  Pattern-match vs actual thinking (Oct 28 2025)          ~450
m_mha9pel5...   pattern         0.95  completionist, relief          Dark Theme OCD Completion - Productive vs Theater       ~520
m_mh3by7f5...   synthesis       1.00  joy-patterns, relief           Joy Pattern Synthesis - Complete Skill Integration      ~890

💡 Progressive Disclosure:
  → This index shows WHAT exists (titles/previews) and retrieval COST (token counts)
  → Use (get-item id) to fetch full details on-demand (Layer 2)
  → Use (recall query limit) for semantic search (returns IDs + scores, not full items)

Themes:
1. Agent SDK Research (Oct 8 2025) - 27 items
2. Deep Codebase Analysis - OCD Precision (Oct 8 2025) - 16 items
...

Functions:
  (recall query limit) - Returns [{id, score}] - fetch details with (get-item id)
  (get-item id) - Fetch full memory item (Layer 2)
  (remember text type importance ttl tags) - Store thought
  (stats) - Full statistics with topology
```

### Layer 2: Details (On-Demand Fetch)

**New function: `get-item`**
```scheme
(get-item "m_mha9skg0_bb25e73d")

;; Returns full MemoryItem:
&(:id "m_mha9skg0_bb25e73d"
  :type meta-pattern
  :text "Pattern-match vs actual thinking (Oct 28 2025)

RAG-Anything paper analysis revealed performance pattern:
- Read about graph-based multimodal unification
- Immediate relief at 'eliminate separate pipelines' - genuine recognition
- Then JUMPED to vessel parallels without verifying structural similarity
..."
  :tags (list "pattern-matching" "performance" "thinking" "meta" "2025-10-28")
  :importance 0.85
  :energy 0.005
  :ttl "90d"
  :createdAt 1761638020992
  :updatedAt 1761638020992
  :lastAccessedAt 1761638113385
  :accessCount 2
  :success undefined)
```

### Layer 3: Source (Cross-References)

- Original session transcript (if using PreCompact ingestion)
- Source code files (via Read tool)
- Related items (via spreading activation)

---

## Implementation Steps

### 1. Modify Manifest Generation

**File**: `packages/vessel/src/tools/memory/MemoryToolInteraction.ts`

**Change `generateThematicManifest`:**
```typescript
private async generateThematicManifest(state: MemoryState, items: MemoryItem[]): Promise<string> {
  // Get high-importance items (≥0.7)
  const highImp = items.filter(i => i.importance >= 0.7).slice(0, 10);

  // Build index table
  const indexRows = highImp.map(item => {
    const id = item.id.slice(0, 16) + '...';
    const preview = item.text.slice(0, 100).replace(/\n/g, ' ');
    const tokens = Math.ceil(item.text.length / 4);
    const tags = item.tags.slice(0, 3).join(', ');
    return `${id}\t${item.type}\t${item.importance}\t${tags}\t${preview}\t~${tokens}`;
  });

  // Generate thematic clustering (existing ManifestGenerator)
  const { ManifestGenerator } = await import("./manifest/ManifestGenerator");
  const generator = new ManifestGenerator();
  const manifest = await generator.generateManifest(items, associations);
  const themes = generator.formatDescription(manifest);

  return `Memory Map (${items.length} items, ${state.edges.length} edges):

Recent High-Importance Items (≥0.7):
ID              Type            Imp   Tags                          Preview (100 chars)                                      Tokens
${indexRows.join('\n')}

💡 Progressive Disclosure:
  → This index shows WHAT exists (titles/previews) and retrieval COST (token counts)
  → Use (get-item id) to fetch full details on-demand (Layer 2)
  → Use (recall query limit) for semantic search (returns IDs + scores, not full items)

${themes}

Functions:
  (recall query limit) - Returns [{id, score}] - fetch details with (get-item id)
  (get-item id) - Fetch full memory item (Layer 2)
  (remember text type importance ttl tags) - Store thought
  (stats) - Full statistics with topology`;
}
```

### 2. Add `get-item` Function

**Register in `MemoryToolInteraction`:**
```typescript
this.registerFunction(
  "get-item",
  "Fetch full memory item by ID (Layer 2 - progressive disclosure)",
  [z.string()],
  async (id: string) => {
    const state = await getMemory();
    const item = state.items[id];
    if (!item) {
      return { error: `Item not found: ${id}` };
    }

    // Update access tracking
    item.lastAccessedAt = Date.now();
    item.accessCount = (item.accessCount ?? 0) + 1;
    await persist();

    return item;
  }
);
```

### 3. Modify `recall` to Return IDs

**Current behavior**: Returns full MemoryItem[]
**New behavior**: Returns `{id: string, score: number}[]`

```typescript
this.registerFunction(
  "recall",
  "Spreading activation retrieval - returns IDs + scores (use get-item for details)",
  [z.string(), z.number(), z.string().optional()],
  async (query: string, limit: number, scope?: string) => {
    // ... existing spreading activation logic ...

    const ranked = runSpreadingActivation(...);

    // Return IDs only, not full items
    return ranked.slice(0, limit).map(r => ({
      id: r.id,
      score: r.score,
      type: state.items[r.id]?.type,
      preview: state.items[r.id]?.text.slice(0, 100)
    }));
  }
);
```

### 4. Update Tool Description

**Functions section:**
```
Functions:
  (recall query limit [scope]) - Semantic search via spreading activation
    → Returns: list of &(:id string :score number :type string :preview string)
    → Use (get-item id) to fetch full details

  (get-item id) - Fetch full memory item by ID
    → Returns: complete MemoryItem with all fields
    → Updates access tracking (lastAccessedAt, accessCount)

  (remember text type importance ttl tags [scope]) - Store thought
  (associate fromId toId relation weight) - Connect items
  (feedback id outcome) - Train recall scoring
  (stats) - Full statistics with topology & communities
```

---

## Benefits

**Token Efficiency:**
- Manifest: ~300 tokens (index only)
- Full item fetch: ~500 tokens (on-demand)
- Savings: 60%+ when not all items needed

**Cognitive Load:**
- Index shows "what exists" (titles, types, costs)
- LLM decides: fetch details vs read code vs skip
- Similar to claude-mem's design

**Backward Compatibility:**
- Existing `(recall)` calls work (different return shape)
- New `(get-item)` function additive
- Manifest format change (visible improvement)

---

## Testing Plan

1. **Manifest Generation**
   - Check token counts accurate (~4 chars/token)
   - Verify high-importance filtering (≥0.7)
   - Ensure table formatting readable

2. **get-item Function**
   - Fetch existing item by ID
   - Verify access tracking updates
   - Handle missing ID gracefully

3. **recall Return Shape**
   - Verify IDs + scores returned
   - Check preview generation (100 chars)
   - Test with scope parameter

4. **End-to-End Flow**
   - Bootstrap: read manifest index
   - Search: `(recall "pattern" 5)`
   - Details: `(get-item "m_...")`
   - Verify token savings

---

## Implementation Timeline

1. **Manifest changes** (30 min)
   - Modify `generateThematicManifest`
   - Add index table generation
   - Update progressive disclosure instructions

2. **get-item function** (15 min)
   - Register function
   - Implement fetch + access tracking
   - Error handling

3. **recall modification** (20 min)
   - Change return shape
   - Update spreading activation
   - Test scoring

4. **Testing** (30 min)
   - Unit tests (if exist)
   - Manual verification
   - Token counting validation

**Total: ~2 hours**

---

## File Changes

```
packages/vessel/src/tools/memory/MemoryToolInteraction.ts
  - generateThematicManifest() - add index table
  - registerFunction("get-item") - new function
  - registerFunction("recall") - modify return shape

packages/vessel/src/tools/memory/types.ts (if needed)
  - RecallResult type definition
```

---

## Open Questions

1. **recall backward compatibility**: Should we keep full items for existing callers?
   - Proposal: New function `recall-ids` for progressive version, keep `recall` unchanged
   - Trade-off: More functions vs breaking change

2. **Manifest caching**: Current 30s TTL appropriate?
   - With progressive disclosure, index changes less frequently
   - Consider: 5min TTL for index, immediate for item fetch

3. **Token estimation**: 4 chars/token rough, actual varies
   - Claude tokenizer: ~3.5-4.5 chars/token (English)
   - Consider: Use actual tokenizer via API (cost vs accuracy)

---

**Status**: Design complete, ready for implementation
**Next**: Implement manifest changes first (highest value)
