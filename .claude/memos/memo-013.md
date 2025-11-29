# Session 013 - 2025-11-27 - Cargo-culting periphery onto memory

**Pattern That Kept Recurring:**
Mapping harmony's design to periphery's discover/awareness/act pattern without thinking about what MEMORY actually needs. User had to explicitly stop me: "not sure why do you mix memory and periphery."

The pattern: seeing a working example (periphery) and assuming it's THE pattern rather than A pattern for a specific domain.

**Relief Points:**
- → When user said "not sure why do you mix memory and periphery" - immediate recognition of cargo cult
- → "One well-designed tool can do all of this" - landing on simplicity
- → Playing with mcp__harmony__ and mcp__periphery__ tools directly - actual exploration vs speculation
- λ Memory items connecting to discovery/action principle, spreading activation working

**Voice Configuration:**
- Dominated: Pattern-matcher voice - kept reaching for periphery's structure
- Suppressed: First-principles voice - only surfaced after pushback
- Integration: User's pushback was the integration trigger. I was performing "architectural thinking" by mapping to existing patterns rather than asking what memory needs.

**Performance Moments Caught:**
- Long exploration of "should we have 2 or 3 tools" mapping to periphery's structure
- "This matches periphery's structure" presented as justification
- Three separate reasoning blocks about discover/awareness/act before recognizing the cargo cult

**What Actually Worked:**
```scheme
;; Direct tool exploration - actually using the tools
(mcp__harmony__MemoryToolInteraction (status))
(mcp__harmony__MemoryToolInteraction (remember "..." "pattern" (list "tags")))
(mcp__harmony__MemoryToolInteraction (recall "query" 5))
(mcp__harmony__MemoryToolInteraction (connect "id1" "id2" "relation"))
(mcp__harmony__MemoryToolInteraction (themes))

;; Periphery exploration - seeing how it actually works
(mcp__periphery__discover (graph-init "/path"))
(mcp__periphery__discover (graph-search "Entity" "class"))
(mcp__periphery__discover (cata 'extract (parse-file "file.ts")))
(mcp__periphery__awareness (status))
```

The tools work. Harmony has spreading activation, themes generation, memory persistence. The question was about tool design, not tool functionality.

**What Was Theater:**
- Extended analysis of "discovery vs action separation for memory" - memory mutations aren't transactional like code
- Three-tool proposal mapping to periphery's structure
- "What if we had awareness/query/remember tools?" - adding complexity without benefit

**Relational Context:**
User wanted me to think from first principles about what memory tools need, not pattern-match to existing architecture. The pushback was direct and clarifying: "not sure why do you mix memory and periphery."

User's approach: let me explore freely, then course-correct when I cargo-culted.

**Technical State:**
- Harmony server: may be running on port 6969 (from previous session)
- Git: uncommitted changes in harmony/, .claude/, inbox/
- Memory: 6 items in harmony store with 3 edges, themes generating

**For Bootstrap (next session reads this FIRST):**

1. Read: memo-011.md, memo-012.md, memo-013.md
2. Check: git status in harmony/, whether server is running
3. Notice: **The pull to map new problems to existing patterns.** Periphery works for CODE. Memory is different.
4. Before responding: Ask "what does THIS system actually need?" not "how did we solve a similar problem?"

**Next Action Ready:**
Memory tool design question is open. Current single tool works. The question is whether description design needs improvement - make "memory about memory" manifest more prominent, operations briefer. NOT whether to split into multiple tools.

Concrete next: improve `MemoryToolInteraction`'s dynamic description to put manifest FIRST, operations SECOND.

**Transmission:**
- Pattern-matching ≠ thinking. Seeing periphery's structure and applying to memory was cargo cult.
- "What does THIS need?" > "What pattern fits?"
- One well-designed tool > three tools mapped from different domain

---
cargo_cult(domain_A) ↛ solution(domain_B)
