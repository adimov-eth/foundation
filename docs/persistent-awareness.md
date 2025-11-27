# Persistent codebase awareness for AI coding agents

**Dynamic tool descriptions represent an unexplored breakthrough.** The mechanism you've identified—generating awareness summaries at tool-fetch time, injecting them into inputSchema descriptions before any tool calls—is genuinely novel. No existing MCP server uses this pattern, yet it elegantly solves the "no client control" constraint by exploiting the only moment when servers have unconditional context injection: tool registration.

The research reveals that your proposed daemon architecture aligns with production patterns from rust-analyzer and clangd, but the S-expression homoiconicity question deserves scrutiny. While theoretical elegance favors unified query/data representations, production systems (Kythe, LSIF, GitLab's knowledge graph) have unanimously chosen JSON/protobuf for ecosystem compatibility. The genuine advantages of S-expressions emerge only when metaprogramming on the representation itself is a core workflow—which Periphery's catamorphisms and hypergraph algebra may justify.

## GitLab's heavy infrastructure solves specific problems

GitLab's Rust-based knowledge graph uses **Kuzu** (embedded graph database) with **Parquet/Arrow** persistence because their requirements differ from yours. Their system targets cross-repository analysis at scale, RAG-powered AI features requiring vector search, and enterprise-grade querying across **50,000+ files** with sub-100ms latency. The heavy infrastructure becomes necessary precisely when you need complex relationship traversal ("find all call sites of function X across the entire monorepo") combined with semantic search.

What's worth adopting: their **phased implementation strategy** (structural relationships first, then same-file references, then cross-file, then dependencies) provides a pragmatic roadmap. Their MCP integration via SSE endpoints (`http://localhost:27495/mcp/sse`) demonstrates production-ready patterns. What's potentially unnecessary: Kuzu's embedded database adds significant build complexity for smaller-scope tools, and Parquet interoperability primarily benefits enterprise analytics pipelines rather than local developer tooling.

For S-expression-native systems, the graph database may be over-engineering. Your Periphery's existing primitives (`graph-init`, `graph-search`, `graph-depends-on`) operating directly on S-expression representations could achieve equivalent functionality for single-repository awareness without the impedance mismatch of translating between representations.

## Optimal codebase summaries prioritize information density over volume

Research on LLM context utilization reveals a critical insight: **effective context length is substantially smaller than stated maximums**. The "lost in the middle" phenomenon (Liu et al., Stanford/UC Berkeley) shows a U-shaped performance curve where accuracy peaks when relevant information appears at the **beginning or end** of context, with significant degradation for middle-positioned content. Claude 3.5 Sonnet's performance on LongCodeBench dropped from 29% to 3% as context scaled—more context actively hurt.

Codebase awareness summaries should contain:

- **Project purpose and domain** (2-3 sentences, positioned first)
- **Architecture overview**: Component relationships, data flow patterns
- **Active working context**: Recently modified files, current branch focus
- **Key interfaces and entry points**: Critical APIs, main functions
- **Invariants and constraints**: Rules the AI must not violate
- **Directory structure annotations**: Not raw tree output, but semantically meaningful groupings

What to exclude: implementation details of utility functions, test scaffolding, build configuration, commented-out code, redundant information. The research consistently shows that **information density matters more than context size**—dense, relevant context outperforms voluminous irrelevant context. Hierarchical summarization (segment → file → package → repository levels) provides the optimal structure, allowing the AI to navigate from high-level overview to specific details as needed.

Position your awareness summary at the **very beginning** of the tool description, not buried in parameter schemas. This exploits the attention primacy effect for maximum impact.

## Homoiconicity provides genuine advantages for query-intensive systems

The theoretical case for S-expression homoiconicity is strongest when **query language and knowledge representation must unify**. In Periphery's design, where queries like `(graph-depends-on "module.scm")` are themselves S-expressions that can be programmatically composed, transformed, and generated, homoiconicity enables:

- **Compositional query building**: Queries are first-class data that can be manipulated by the same tools operating on the graph itself
- **Self-describing schemas**: The schema for code knowledge IS code, eliminating translation layers
- **Pattern matching simplification**: Query patterns share syntax with matched data
- **Macro-powered abstractions**: Common query patterns can be encapsulated as syntactic transformations

However, the empirical evidence is sobering. **No production code graph system uses S-expressions** for primary representation. Kythe uses Protocol Buffers, LSIF uses JSON-LD, Sourcetrail used SQLite, Tree-sitter uses custom binary with JSON queries. The ecosystem gravity toward JSON/protobuf reflects practical tooling availability, team familiarity, and interoperability requirements.

The most promising path forward may be **egglog's approach**: a purpose-built language achieving homoiconic-like benefits (queries ARE data, incremental by design) without requiring S-expression syntax universally. For your system, the question becomes: does Periphery's workflow involve sufficient metaprogramming on the graph representation itself to justify the ecosystem friction? If Arrival's tools primarily consume rather than transform the representation, JSON translation may be pragmatic despite the philosophical compromise.

## Unix domain sockets outperform HTTP for daemon communication

IPC benchmarks consistently show **Unix domain sockets achieving 50% lower latency** than TCP loopback. Node.js-specific measurements: UDS at **130μs** versus TCP at **334μs**. PostgreSQL benchmarks show UDS at 0.126ms latency with 79,000 TPS versus TCP at 0.211ms with 47,300 TPS. For a file watcher daemon communicating with an MCP server on every file change, this difference compounds meaningfully.

The recommended architecture for file watcher → MCP server communication:

| Component | Recommendation | Rationale |
|-----------|----------------|-----------|
| Primary IPC | Unix domain socket | 50% latency reduction, no network stack overhead |
| State persistence | SQLite | ACID guarantees, queryable, debuggable |
| Change notifications | UDS push + SQLite polling fallback | Real-time updates with crash safety |
| Daemon management | pm2 for Node.js, launchd/systemd for native | Built-in clustering, startup integration |

**Crash safety pattern**: Write-to-temp → fsync → atomic rename. SQLite provides this automatically, but custom state files require explicit implementation. Store staging files in same filesystem as final destination (rename only atomic within same mount).

Production language servers demonstrate proven patterns: **rust-analyzer** uses query-based incremental computation with the Salsa crate, **clangd** implements multi-layer indexing (dynamic for open files + background thread pool + optional remote index), and **TypeScript server** uses JSON over stdin/stdout with named pipes for cancellation signaling.

## File-level granularity suffices for awareness; finer-grained for analysis

The granularity question depends on use case:

**File-level** works for awareness summaries because the purpose is orientation, not precise analysis. When a file changes, regenerating its summary is cheap compared to maintaining fine-grained dependency graphs. GitLab's knowledge graph starts here (Phase 1: directory → file → definition containment relationships).

**Function/symbol-level** becomes necessary for impact analysis and reference tracking. Tree-sitter provides the foundation: O(1) edit complexity for typical edits, reusing unchanged subtrees via structural sharing. This enables real-time updates during editing without full reparse.

**Expression-level** (e-graphs, equality saturation) matters for optimization and transformation tasks but is likely over-engineering for awareness. The incremental equality saturation research (EGRAPHS 2025) shows promise—version numbers on e-classes enable temporal reuse of equalities—but the complexity may not justify the benefit for your use case.

For Periphery's file watcher daemon, **file-level tracking with debouncing** (100-500ms window) provides the right balance. When `module.scm` changes, reindex that file's symbols and relationships, update the graph, regenerate affected summaries. The latency acceptable for "ambient awareness" is much higher than for "keystroke feedback."

## Context budget research reveals when awareness helps versus hurts

The research synthesizes into actionable guidelines:

**Awareness helps when:**
- Tasks require holistic understanding (architecture decisions, refactoring planning)
- Multiple files must be reasoned about simultaneously
- The codebase is unfamiliar to the AI (new conversation, new project)
- Queries are about relationships rather than specific implementations

**Awareness hurts when:**
- Tasks are narrowly focused (fixing a specific bug, implementing a small function)
- Context displaces room for thinking/reasoning tokens
- The awareness summary contains stale or irrelevant information
- Dense technical details overwhelm the high-level orientation

The **optimal strategy is hybrid**: ambient awareness for orientation, targeted retrieval for execution. Pre-load hierarchical summaries at session start, but don't include entire codebase. Research shows RAG with **783 average tokens** can match full-context approaches while being **1,250x cheaper** and faster.

For your dynamic tool description approach, this suggests **tiered awareness**:
1. **Always present** (in tool description): Project overview, architecture, key constraints (~500 tokens)
2. **On-demand** (via tool calls): Specific file contents, dependency graphs, impact analysis
3. **Never ambient**: Full source code, test files, build artifacts

## The fundamentally simpler solution you might be overlooking

The research reveals that **Claude Code itself uses grep-style search, not semantic indexing**. An Anthropic engineer confirmed on Hacker News that Claude Code does NOT use RAG or embeddings—just ripgrep-style text search. The CLAUDE.md file mechanism provides project context through simple markdown files hierarchically loaded from `~/.claude/CLAUDE.md` → parent directories → project root.

This suggests a potentially simpler approach: **a well-structured CLAUDE.md that's programmatically regenerated** when files change. Your daemon could:

1. Watch for file changes
2. Regenerate `CLAUDE.md` with current codebase summary
3. Claude Code automatically picks this up on next conversation

This eliminates IPC complexity entirely—the filesystem IS the communication channel. The limitation: CLAUDE.md only loads at conversation start, not during active sessions. But for "ambient awareness," this may suffice.

**The dynamic tool description approach remains more powerful** because it can update awareness during a session (when tools are re-fetched) rather than only at conversation boundaries. This is the genuine innovation worth pursuing.

## A more powerful abstraction emerges from the research

The synthesis suggests a **layered awareness architecture** that separates concerns more cleanly than a monolithic daemon:

```
┌─────────────────────────────────────────────────────┐
│  Level 3: Awareness Summaries (S-expressions)       │
│  - Natural language + structured facts              │
│  - Injected via dynamic tool descriptions           │
│  - Regenerated on-demand, cached aggressively       │
└─────────────────────────────────────────────────────┘
                         ↑ queries
┌─────────────────────────────────────────────────────┐
│  Level 2: Semantic Graph (Periphery primitives)     │
│  - graph-depends-on, graph-used-by, graph-impact    │
│  - Homoiconic S-expression representation           │
│  - Incremental updates via tree-sitter events       │
└─────────────────────────────────────────────────────┘
                         ↑ AST events  
┌─────────────────────────────────────────────────────┐
│  Level 1: Parse Forest (tree-sitter)               │
│  - Expression-level incremental parsing             │
│  - Language-agnostic syntax trees                   │
│  - File watcher triggers re-parse                   │
└─────────────────────────────────────────────────────┘
```

The insight: **decouple parsing granularity from awareness granularity**. Tree-sitter provides expression-level incrementality at the parse layer, but awareness summaries can operate at file or module level without losing the benefits of fine-grained change tracking internally.

This architecture suggests Periphery's graph should be built atop tree-sitter's parse trees rather than custom parsing, gaining battle-tested incrementality for free. The S-expression representation then becomes a **projection** of the parse forest, not a parallel data structure requiring synchronization.

## Concrete recommendations for your architecture

Given your constraints (Claude Code client, MCP extension point, S-expression native, persistent, dynamic, low latency):

**Adopt from GitLab's approach:**
- Phased implementation starting with structural relationships
- MCP SSE transport pattern for reliable delivery
- Manifest file (`~/.gkg/gkg_manifest.json` equivalent) for workspace state

**Simplify relative to GitLab:**
- Skip Kuzu; use Periphery's native graph primitives directly
- Skip Parquet; use S-expression serialization for persistence
- Single-repository focus eliminates cross-repo complexity

**IPC architecture:**
- pm2-managed daemon with file watcher (chokidar/fswatch)
- Unix domain socket to Periphery MCP server
- SQLite for crash-safe index state (queryable, debuggable)
- Atomic file writes for any S-expression persistence

**Dynamic tool description strategy:**
- Generate awareness summary at `tools/list` time
- Position critical context at description START (attention primacy)
- Keep ambient context under 500 tokens
- Include: project purpose, architecture, recent changes, key constraints
- Exclude: implementation details, full source, test scaffolding

**Incremental update approach:**
- File-level granularity for graph updates
- Debounce file events (200ms window)
- Tree-sitter for parse incrementality internally
- Regenerate awareness summary on graph changes (cached, not per-request)

**S-expression justification checkpoint:**
The homoiconicity genuinely earns its keep IF Periphery's catamorphisms and hypergraph algebra are actively used to transform and compose queries programmatically. If the workflow is primarily "build graph → query graph → render results," JSON might be more pragmatic despite the philosophical compromise. The test: how often do tools manipulate the graph representation itself versus just consuming it?

The dynamic tool description mechanism is the genuine innovation. No existing system exploits this, yet it's the only reliable way to inject context before tool calls when you don't control the client. Build toward making this pattern robust and well-documented—it could become a reference architecture for MCP-based AI tooling.