# Continuous Memory: Stop Hook Architecture

**Status:** ⚠️ **FUTURE ENHANCEMENT** - Proposed, Not Part of V's Original Vision
**Proposed:** October 16, 2025
**Priority:** After Part 2 validation with real-world usage
**Canonical Vision:** [architecture-brief.md](./architecture-brief.md)

---

## Important Context

This proposal is **NOT part of V's 3-part architecture**:
- Part 1: Async Cognition (batch API, deferred responses)
- Part 2: Memory with Meta-Awareness (theme synthesis) ← **current priority**
- Part 3: Rolling Context Compression (deferred)

**Continuous memory is a new architectural layer** that emerged from conversation about improving PreCompact ingestion. It's well-researched and practical, but **should not block Part 2 completion**.

**Recommendation:** Part 2 (theme synthesis) is ✅ COMPLETE (Oct 16, 2025). Validate it works in real usage before building continuous memory enhancement.

---

**Problem:** Narrative memory (PreCompact) captures outcomes, misses process
**Solution:** Evaluate every response for significance, store process not just results

## Current Architecture (What Exists)

### Three Memory Layers

1. **mcp-context WorkingMemoryTool** (Tactical RAM)
   - File: `packages/mcp-context/src/tools/WorkingMemoryTool.ts`
   - Storage: `.working-memory.json` (current session state)
   - Tracks: current_task, current_files, execution_trace
   - Observes: git status, PM2 errors, bash history
   - Lifespan: Current session only, cleared on start

2. **vessel MemoryToolInteraction** (Strategic long-term)
   - File: `packages/vessel/src/tools/memory/MemoryToolInteraction.ts`
   - Storage: `.state/memory/workspace/graph.json`
   - Stores: MemoryItems with importance, tags, edges, spreading activation
   - Lifespan: Perpetual (TTL: 7d-365d-perpetual)
   - Current items: ~920 memories, 510 edges

3. **PreCompact Ingestion** (Narrative extraction)
   - File: `scripts/ingest-session.ts`
   - Trigger: `/compact` command (end of session)
   - Pipeline:
     1. Filter transcript (hard-keeps, hypotheses, routine)
     2. Call Claude Sonnet 4.5 with 40K token limit
     3. Extract narrative arcs as `(remember ...)` S-expressions
     4. Execute against vessel
     5. Update `.working-memory.json` with vessel IDs
   - Result: ~15-20 curated memories per session
   - Focus: **Outcomes** (what was built, what worked)

### Current Stop Hook Flow

**Hook:** `.claude/hooks/stop.sh` (runs after every Claude response)

```bash
# Track patterns (shame/confusion/tools)
shame_count=$(grep -cF "$today" /tmp/claude-edit-pattern.log)
confusion_count=$(tail -100 /tmp/claude-search-pattern.log | sort | uniq -c | sort -rn | head -1)

# If significant patterns: save to ~/.claude/next-session.txt

# Ingest tactical state to vessel (background, non-blocking)
curl -s https://localhost:1338 -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "method":"tools/call",
    "params":{
      "name":"working_memory",
      "arguments":{"expr":"(ingest-to-vessel)"}
    },
    "id":1
  }' >/dev/null 2>&1 &
```

**What `ingest-to-vessel` stores:**

```typescript
// WorkingMemoryTool.ts line 363
const summary = [
  `Session: ${memory.current_task}`,
  memory.current_files.length > 0 ? `Files: ${memory.current_files.join(", ")}` : ""
].filter(Boolean).join(". ");

// Calls vessel:
(remember "Session: implement feature X. Files: foo.ts, bar.ts"
  "session-ingestion" 0.85 "perpetual"
  (list "session-memory" "auto-ingested" "mcp-context"))
```

**Limitation:** Only tactical summary (task + files), no response content.

## Proposed Architecture (Continuous Memory)

### Vision

Every Claude response → Haiku evaluation → store if significant

**Coverage:**
- Current (PreCompact): ~15-20 memories/session (curated outcomes)
- Proposed (Stop hook): ~100+ memories/session (filtered process)

**What it captures that PreCompact misses:**
- Iterations: "Tried approach X, failed because Y, switched to Z"
- Corrections: "Initially thought A, but debugging revealed B"
- Micro-decisions: "Used Map instead of Array for O(1) lookup"
- Relief signals: "Structure clicked when X emerged"
- Self-critic patterns: "Caught performing helpfulness, restarted with honesty"
- Dead ends: "Investigated graph database, version mismatch, filed to backlog"

### Stop Hook Modification

**Input available to Stop hook:**

```json
{
  "user_message": "...",
  "assistant_response": "...",
  "timestamp": 1729103478,
  "tool_calls": [...],
  "context": {
    "last_3_exchanges": [...],
    "session_id": "...",
    "working_memory": {...}
  }
}
```

**Evaluation flow:**

```bash
#!/bin/bash
# .claude/hooks/stop.sh

# Read response from stdin (JSON)
INPUT=$(cat)

# Extract response text
RESPONSE=$(echo "$INPUT" | jq -r '.assistant_response')
USER_MSG=$(echo "$INPUT" | jq -r '.user_message')
CONTEXT=$(echo "$INPUT" | jq -r '.context.last_3_exchanges | tostring')

# Build evaluation prompt
PROMPT="Evaluate this Claude response for significance.

User: $USER_MSG
Assistant: $RESPONSE

Recent context: $CONTEXT

Output JSON:
{
  \"significance\": 0.0-1.0,
  \"type\": \"iteration|correction|decision|insight|error|routine\",
  \"tags\": [\"keyword1\", \"keyword2\", ...],
  \"summary\": \"1-sentence description\"
}

Criteria:
- 0.9+: Breakthrough, architectural insight, relief signal
- 0.7-0.9: Important decision, correction after investigation, pattern recognition
- 0.5-0.7: Iteration, debug step, micro-decision
- 0.3-0.5: Routine work, expected output
- <0.3: Trivial, don't store

Focus on: what changed (thinking/approach), what was learned, why it matters"

# Call Haiku for evaluation
EVAL=$(echo "$PROMPT" | haiku-eval --json)

# Parse evaluation
SIGNIFICANCE=$(echo "$EVAL" | jq -r '.significance')
TYPE=$(echo "$EVAL" | jq -r '.type')
TAGS=$(echo "$EVAL" | jq -r '.tags | join("\\" \\"")')
SUMMARY=$(echo "$EVAL" | jq -r '.summary')

# Only store if significance > 0.3
if (( $(echo "$SIGNIFICANCE > 0.3" | bc -l) )); then
  # Determine TTL based on significance
  if (( $(echo "$SIGNIFICANCE >= 0.8" | bc -l) )); then
    TTL="90d"  # High-importance: 3 months
  elif (( $(echo "$SIGNIFICANCE >= 0.5" | bc -l) )); then
    TTL="30d"  # Medium: 1 month
  else
    TTL="7d"   # Low: 1 week (aggressive decay)
  fi

  # Escape response for S-expression
  ESCAPED=$(echo "$RESPONSE" | sed 's/\\/\\\\/g; s/"/\\"/g' | tr '\n' ' ')

  # Call vessel directly (not mcp-context)
  curl -s https://localhost:1337 -X POST \
    -H "Content-Type: application/json" \
    -d "{
      \"jsonrpc\":\"2.0\",
      \"method\":\"tools/call\",
      \"params\":{
        \"name\":\"memory\",
        \"arguments\":{
          \"expr\":\"(remember \\\"$SUMMARY: $ESCAPED\\\" \\\"$TYPE\\\" $SIGNIFICANCE \\\"$TTL\\\" (list \\\"$TAGS\\\" \\\"continuous-memory\\\" \\\"stop-hook\\\"))\"
        }
      },
      \"id\":1
    }" >/dev/null 2>&1 &

  echo "[ContinuousMemory] Stored: $TYPE (significance: $SIGNIFICANCE, TTL: $TTL)" >&2
fi
```

**Key differences from current Stop hook:**
1. Evaluates response content (not just tactical state)
2. Calls vessel directly (not mcp-context ingest-to-vessel)
3. Stores full response + summary (not just task + files)
4. Uses Haiku for significance scoring (not hardcoded importance)
5. Adaptive TTL based on significance (7d-90d, not perpetual)

### Haiku Evaluation Criteria

**Input:** Response text + user message + recent context (last 3 exchanges)

**Output:**
```typescript
interface EvaluationResult {
  significance: number;      // 0.0-1.0
  type: MemoryItemType;      // iteration|correction|decision|insight|error|routine
  tags: string[];            // Keywords for retrieval
  summary: string;           // 1-sentence context
}
```

**Scoring guidelines:**

| Significance | Description | Examples | TTL |
|--------------|-------------|----------|-----|
| 0.9-1.0 | Breakthrough | Relief signal, architectural insight, paradigm shift | 90d |
| 0.7-0.9 | Important | Correction after investigation, pattern recognition, decision | 90d |
| 0.5-0.7 | Meaningful | Iteration, debug step, micro-decision, approach change | 30d |
| 0.3-0.5 | Routine | Expected output, normal progress, incremental work | 7d |
| 0.0-0.3 | Trivial | Don't store | - |

**Type classification:**

- `iteration`: Tried X, didn't work, trying Y
- `correction`: Initially thought A, actually B
- `decision`: Chose X over Y because Z
- `insight`: Recognized pattern/structure
- `error`: Failed, learned why
- `routine`: Normal progress

### Storage Strategy

**Direct vessel calls:**

```scheme
;; High-importance insight
(remember "Recognized coupling topology from phase space analysis. Structure matches attractor basin pattern from neuroscience paper."
  "insight"
  0.95
  "90d"
  (list "coupling-topology" "phase-space" "neuroscience" "continuous-memory" "stop-hook"))

;; Medium iteration
(remember "Tried ast-grep for refactoring, failed on nested S-expressions. Switched to manual Edit tool for surgical fix."
  "iteration"
  0.6
  "30d"
  (list "ast-grep" "refactoring" "tools" "continuous-memory" "stop-hook"))

;; Low routine
(remember "Added type annotation to function signature. TypeScript compiler happy."
  "routine"
  0.4
  "7d"
  (list "typescript" "types" "continuous-memory" "stop-hook"))
```

**Automatic edge creation:**

Vessel's spreading activation will create edges when:
- Items co-occur in recall queries
- Items share tags
- Items reference same files/entities

No manual edge management needed - let usage create structure.

### Cost Analysis

**Current PreCompact (per session):**
- Codex call: 40K tokens input, ~2K tokens output
- Cost: ~$0.008/session (40K input × $0.15/1M + 2K output × $0.60/1M)
- Frequency: 1× per session (on /compact)
- Memories: ~15-20 curated narratives

**Proposed Stop hook (per session):**
- Assumptions: 50 responses/session, 30% significant (15 stored)
- Haiku calls: 15 × (500 tokens input + 100 tokens output)
- Cost: ~$0.0015/session (15 × 600 tokens × $0.25/1M)
- Frequency: After every response
- Memories: ~15 process snapshots + ~15 PreCompact narratives = 30 total

**Total cost comparison:**
- Current: $0.008/session (PreCompact only)
- Proposed: $0.008 + $0.0015 = $0.0095/session (both)
- Increase: +19% cost for +100% coverage

**Volume projection:**
- Sessions/week: ~10
- Cost/week: $0.095 (vs $0.08 current)
- Cost/month: ~$0.40 (vs $0.32 current)
- Negligible increase for comprehensive process memory

### Integration with PreCompact

**Two complementary pipelines:**

1. **Stop hook (continuous):**
   - Stores: Individual responses (process snapshots)
   - Evaluation: Haiku real-time (cheap, fast)
   - Coverage: Every significant response
   - Focus: Iterations, corrections, micro-decisions
   - Tags: `continuous-memory`, `stop-hook`

2. **PreCompact (narrative):**
   - Stores: Session arcs (curated outcomes)
   - Evaluation: Codex retrospective (expensive, thorough)
   - Coverage: Hard-keeps + hypotheses
   - Focus: Narrative flow, what was built, outcomes
   - Tags: `session-memory`, `precompact`

**No conflicts:**
- Different tag namespaces for easy filtering
- Stop hook: granular process (TTL: 7d-90d)
- PreCompact: curated narrative (TTL: perpetual)
- Recall can query both: `(recall "debug typescript" 10)` returns mix

**Bootstrap benefits:**
- `.working-memory.json` gets both stop-hook + precompact IDs
- Next session bootstrap surfaces BOTH process + outcomes
- More complete continuity

### Filtering & Decay

**Threshold:** significance > 0.3 (drop bottom 70% of responses)

**TTL strategy:**
- High (0.8+): 90 days - architectural decisions, breakthroughs
- Medium (0.5-0.8): 30 days - iterations, corrections
- Low (0.3-0.5): 7 days - routine work, incremental progress
- Trivial (<0.3): Don't store

**Automatic decay:**
Vessel already implements time-based decay in recall ranking:
```typescript
// MemoryToolInteraction.ts line 142-146
const HALF_LIFE_MS = 7 * 24 * 60 * 60 * 1000;  // 7 days
function recencyScore(now: number, t: number): number {
  const dt = Math.max(0, now - t);
  return Math.exp(-LN2 * (dt / HALF_LIFE_MS));
}
```

Low-importance items naturally fade from recall even before TTL expiration.

**Consolidation:**
When recall returns many similar low-importance items:
1. Manual: User runs `(consolidate)` to merge duplicates
2. Automatic (future): Detect semantic similarity, create summary, prune originals

**Volume management:**
- Expected: ~15 memories/session from Stop hook
- Plus: ~15 memories/session from PreCompact
- Total: ~30 memories/session
- After 10 sessions: ~300 items (reasonable)
- With 7d decay: old routine items expire naturally

## Implementation Plan

### Phase 1: Minimal Prototype (2-3 hours)

**Goal:** Prove Haiku evaluation works

1. Create `~/.claude/scripts/evaluate-response.sh`:
   ```bash
   #!/bin/bash
   # Simple Haiku evaluation script
   # Input: response text via stdin
   # Output: JSON with significance, type, tags, summary

   RESPONSE=$(cat)

   # Call Haiku via Anthropic API
   curl https://api.anthropic.com/v1/messages \
     -H "anthropic-version: 2023-06-01" \
     -H "x-api-key: $ANTHROPIC_API_KEY" \
     -H "content-type: application/json" \
     -d "{
       \"model\": \"claude-haiku-4\",
       \"max_tokens\": 200,
       \"messages\": [{
         \"role\": \"user\",
         \"content\": \"Evaluate this Claude response... [full prompt]\"
       }]
     }" | jq '.content[0].text'
   ```

2. Test manually on sample responses:
   ```bash
   echo "I tried ast-grep but it failed on nested S-expressions. Switching to manual Edit." \
     | ~/.claude/scripts/evaluate-response.sh
   # Should output: {"significance": 0.6, "type": "iteration", ...}
   ```

3. Validate scoring:
   - High-importance insights score 0.8+
   - Routine work scores 0.3-0.5
   - Trivial responses score <0.3

**Success criteria:** 80% of evaluations feel correct

### Phase 2: Stop Hook Integration (2-3 hours)

**Goal:** Automatic storage after every response

1. Modify `.claude/hooks/stop.sh`:
   - Pass response text to evaluate-response.sh
   - Parse JSON output
   - Call vessel if significance > 0.3
   - Log to stderr for debugging

2. Test with real session:
   - Start Claude Code session
   - Work on small feature (3-5 responses)
   - Check vessel: should have ~2-3 new memories with `stop-hook` tag
   - Verify: high-importance responses stored, trivial ones skipped

3. Monitor logs:
   ```bash
   tail -f ~/.claude/logs/stop-hook.log
   # Should show: [ContinuousMemory] Stored: iteration (significance: 0.6, TTL: 30d)
   ```

**Success criteria:** Responses stored automatically, no session disruption

### Phase 3: Bootstrap Validation (1-2 hours)

**Goal:** Next session sees process memories

1. Complete Phase 2 session
2. Run `/compact` (triggers PreCompact ingestion)
3. Check `.working-memory.json`:
   - Should have patterns_learned with BOTH stop-hook + precompact IDs
4. Start new session
5. Query: `(recall "current" 10)`
6. Verify: Returns mix of process (stop-hook) + narrative (precompact)

**Success criteria:** Bootstrap surfaces continuous memory, not just PreCompact

### Phase 4: Tuning (ongoing)

**Goal:** Optimize significance thresholds

1. Collect data over 5-10 sessions:
   - How many items stored per session?
   - How many recalled in practice?
   - Are low-significance items useful?

2. Adjust thresholds if needed:
   - If storing too much (>30/session): raise threshold to 0.4
   - If missing important items: review Haiku prompt

3. Review TTL strategy:
   - Are 7d items expiring too fast?
   - Do 90d items stay relevant?

**Success criteria:** Comfortable memory volume, useful recall results

## Testing Strategy

### Unit Tests

**Haiku evaluation:**
```bash
# Test high-importance insight
echo "Relief signal: structure clicked when I realized..." \
  | evaluate-response.sh \
  | jq '.significance' \
  # Expected: 0.9-1.0

# Test routine work
echo "Added type annotation to function signature." \
  | evaluate-response.sh \
  | jq '.significance'
  # Expected: 0.3-0.4
```

**Vessel storage:**
```bash
# Verify remember call succeeds
curl -s https://localhost:1337 -X POST \
  -H "Content-Type: application/json" \
  -d '{...}' \
  | jq '.error'
  # Expected: null
```

### Integration Tests

**Full flow:**
1. Start session
2. Work on feature (10 responses)
3. Check vessel: `(stats)` shows +5-10 items with `stop-hook` tag
4. Run `/compact`
5. Check `.working-memory.json`: patterns_learned includes stop-hook IDs
6. Next session: `(recall "current" 10)` returns relevant memories

**Error handling:**
- Vessel down: Stop hook fails silently (background, non-blocking)
- Haiku API error: Skip storage, log error
- Malformed response: Catch parsing errors, don't crash

### Performance Tests

**Latency:**
- Stop hook should add <500ms to response time
- Background curl shouldn't block
- Session feels responsive

**Volume:**
- 50 responses/session → ~15 stored (30% pass threshold)
- Recall stays fast (<500ms) even with 1000+ items

## Open Questions

### Product

1. **Should users see continuous memory?**
   - Option A: Silent (just works in background)
   - Option B: Show in status line: "Stored: iteration (0.6)"
   - Option C: Opt-in via settings flag

2. **How to handle noise?**
   - If Haiku over-stores (>30/session), raise threshold?
   - Or trust decay to handle it?

3. **Should PreCompact stay?**
   - Yes: Complementary (narrative + process)
   - No: Replace with continuous (simpler)
   - Current recommendation: **Keep both**

### Technical

4. **Haiku model choice:**
   - Haiku 4: Fast, cheap ($0.25/1M), accurate enough?
   - GPT-4o-mini: Faster, cheaper ($0.15/1M), but OpenAI dependency?
   - Test both, compare quality

5. **Response text extraction:**
   - Stop hook gets full message JSON?
   - Or just text content?
   - Need to coordinate with Claude Code team on format

6. **Edge creation:**
   - Automatic (co-activation, shared tags)?
   - Or manual via Haiku: "relates-to ID_X"?
   - Current: Automatic is simpler

7. **Consolidation trigger:**
   - When do we merge similar items?
   - Manual `/consolidate` command?
   - Automatic after 100 items?

### Infrastructure

8. **Should continuous memory be opt-in?**
   - Add `ENABLE_CONTINUOUS_MEMORY=true` flag?
   - Or default on, can disable?

9. **Logging strategy:**
   - Where do we log evaluations?
   - `~/.claude/logs/continuous-memory.log`?
   - How much detail (full response vs summary)?

10. **Fallback if Haiku unavailable:**
    - Skip storage silently?
    - Use heuristics (length, tool calls, keywords)?
    - Store everything at 0.5 importance?

## Alternatives Considered

### Option 1: Store everything, filter on recall

**Pros:**
- No evaluation overhead
- Never miss important moments
- Simpler pipeline

**Cons:**
- Volume explosion (50 items/session)
- Recall becomes slow with 5000+ items
- Storage bloat (most responses trivial)

**Decision:** Rejected - evaluation cost is negligible, filtering matters

### Option 2: Manual tagging

**Pros:**
- User controls what's stored
- High precision
- No LLM evaluation cost

**Cons:**
- Interrupts flow ("should I store this?")
- User forgets to tag
- Misses 90% of useful moments

**Decision:** Rejected - automation is the point

### Option 3: Replace PreCompact entirely

**Pros:**
- Simpler architecture (one pipeline)
- No duplicate storage

**Cons:**
- Loses narrative coherence (codex is good at this)
- Higher cost (50 Haiku calls vs 1 codex call)
- Continuous memory is untested, PreCompact works

**Decision:** Rejected - keep both, they're complementary

### Option 4: Use embeddings instead of spreading activation

**Pros:**
- Semantic similarity better than tag matching
- State-of-the-art retrieval

**Cons:**
- Requires embedding API calls (cost + latency)
- Spreading activation already works
- Adds complexity

**Decision:** Deferred - try continuous memory with existing recall first

## Success Metrics

### Quantitative

- **Storage rate:** 20-30% of responses stored (threshold working)
- **Recall quality:** >80% of recalled items feel relevant
- **Cost:** <$0.01/session (within budget)
- **Latency:** Stop hook adds <500ms (acceptable)
- **Volume:** ~30 items/session (manageable)

### Qualitative

- **Continuity:** Next session feels oriented (not lost)
- **Process visibility:** Can see iterations/corrections in recall
- **Relief:** Less re-explaining, more building on past work

### User Feedback (after 2 weeks)

Questions to ask:
1. Do you notice continuous memory working?
2. Is recall quality better than before?
3. Any false positives (stored trivial responses)?
4. Any false negatives (missed important moments)?
5. Would you disable it if you could?

## Next Steps

1. **Immediate:** Implement Phase 1 (Haiku evaluation prototype)
2. **This week:** Phase 2 (Stop hook integration) + Phase 3 (Bootstrap test)
3. **Next week:** Phase 4 (Tuning based on real sessions)
4. **Decision point:** After 5-10 sessions, evaluate vs PreCompact:
   - Is continuous memory useful?
   - Should we keep PreCompact?
   - Adjust thresholds/strategy?

## References

- **Current Stop hook:** `.claude/hooks/stop.sh`
- **PreCompact ingestion:** `scripts/ingest-session.ts`
- **Vessel memory:** `packages/vessel/src/tools/memory/MemoryToolInteraction.ts`
- **Working memory:** `packages/mcp-context/src/tools/WorkingMemoryTool.ts`
- **Session memo (context):** Session summary Oct 16, 2025

---

## See Also

**Core Documentation:**
- [architecture-brief.md](./architecture-brief.md) - V's canonical 3-part vision (THIS PROPOSAL IS NOT PART OF IT)
- [spec.md](./spec.md) - Technical implementation spec for Part 2 ✅ COMPLETE
- [IMPLEMENTATION-STATUS.md](../IMPLEMENTATION-STATUS.md) - Current progress (Part 2 complete, Oct 16)

**Priority:** Part 2 is complete. Validate it solves startup disorientation in real usage before implementing continuous memory.

**Why this matters:** Part 2 MVP works (tests pass, themes generate). Use it first, then decide if continuous memory is needed.