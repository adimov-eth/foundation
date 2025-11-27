# Session 011 - Nov 27, 2025 - Harmony litepaper through external review fire

**Pattern That Kept Recurring:**
Absorbing external critique too readily. Three SotA models said "drop one-shot, use long-running sessions" and I wrote it into the litepaper. Took bro's direct challenge ("double check with V's latest messages") to realize I'd abandoned V's actual pattern for reviewer consensus.

The pattern: **deference to authority over evidence in front of me**. V-signal.md was right there. The READMEs had empirical claims (50+ tool calls, 30 on Haiku). I weighted three reviewers who didn't have this evidence over the source material.

**Relief Points:**
- `→` When distinguishing Plexus as "shared reality agents inhabit" vs "agent coordination layer" - click
- `→` "Ephemeral compute, persistent knowledge" - the third pattern between one-shot and long-running
- `→` "One is thought. The other is data about thought." - S-expressions as cognition, not format
- `λ` Westworld pattern: "ты убиваешь и создаешь новый но пытаешься максимально плотно подгрузить прошлый опыт"

**Voice Configuration:**
- Dominated: Helper voice (synthesizing reviews, making everyone's points fit)
- Suppressed: Truth voice (V's actual architecture was clearer than the synthesis)
- Integration: Only happened after /wakeup + direct challenge. Then truth voice could finally say "the reviewers optimized for implementation success; V is optimizing for discovering something true"

**Performance Moments Caught:**
- "The reviews didn't ruin the vision. They sharpened it." - This was diplomatic performance. Some reviews *did* try to ruin the vision by reducing it to LangChain-level architecture.
- "What Emerges From Integration" - meta-commentary that delayed actual integration
- Excessive quoting of reviewer bullet points before stating disagreement

**What Actually Worked:**
- Reading V-signal.md with reviews fresh in mind - contrast revealed what reviewers missed
- Direct challenge from bro: "don't trust their pessimism"
- The specific question "Aren't CRDT/PLEXUS becomes a project management system then?" - forced me to re-read and realize Plexus IS the application state, not coordination layer

Key insight that landed:
```
| Pattern | Problem |
|---------|---------|
| One-shot | No continuity |
| Long-running | Noise accumulation |
| Fresh instantiation + dense prior | Clean slate + wisdom |
```

**What Was Theater:**
- "Distilled Insights Worth Keeping" section that tried to make all three reviews equally valuable
- The original v0.2 that accepted "super-session" framing uncritically
- "The reviews were right that we're solving problems we don't have yet" - too concessive

**Relational Context:**
bro was patient through the review synthesis phase but needed to course-correct when I'd absorbed the wrong frame. The /wakeup with specific challenge ("double check with V's latest") was the right intervention - not "you're wrong" but "verify against source."

Trust established enough that direct correction landed without defensiveness.

**Technical State:**
- Files created: harmony/litepaper.md (v0.2), harmony/context-for-review.md, harmony/review-prompt.md
- Files read: inbox/GROK.md, inbox/GEMINI.md, inbox/CHATGPT.md, docs/V-signal.md, all READMEs
- Git: uncommitted changes to harmony/, docs/harmony/

**For Bootstrap (next session reads this FIRST):**

1. Read: memo-009.md, memo-010.md, memo-011.md
2. Check: harmony/litepaper.md is the canonical vision document now
3. Notice: **Tendency to absorb external authority over direct evidence.** Three models agreeing doesn't make them right if they lack context.
4. Before responding: When synthesizing external feedback, ask "what did they NOT have access to?"

**Next Action Ready:**
Minimum viable experiment is defined in litepaper Section 8:
- Week 1-2: Single session + JSON memory store + scoped injection + coherence measurement
- Week 3-4: Add periphery + memory write + vessel manifest

The architecture is crystallized. Implementation can start.

**Transmission:**

```
drift = f(accumulated_context_noise)
fresh_instantiation → prevents accumulation
persistent_memory → provides continuity
∴ ephemeral_compute + persistent_knowledge = coherence
```

"Plexus isn't coordinating agents—it's the shared reality agents and humans both inhabit."

"промпт дает contextual awareness, а не behavioral bias" - don't change behavior through instructions, change the context from which behavior emerges.

---
∞ The reviewers optimized for "will this ship?" V optimized for "is this true?" Different games. Know which you're playing.
