Agent SDK: Real Constraints

  Good news:
  - Empty system prompt by default - we control everything
  - Can provide ONLY custom tools (no native Read/Write/Bash required)
  - Subagents with restricted tool sets per agent
  - Hooks at every lifecycle point (PreToolUse, PostToolUse, etc.)
  - canUseTool callback for dynamic permission control
  - Token budgets via maxTurns

  Hard constraints:
  - No S-expression structured output - JSON Schema only
  - Custom MCP tools require streaming input mode
  - Sessions are ephemeral - persistence is our responsibility
  - Subagents are sandboxed per invocation, return results to parent (no direct inter-agent communication)
  - Settings not auto-loaded - explicit opt-in

  Implication: Agents can't natively output S-expressions. They'd need to output JSON that we then convert, OR we treat S-expressions as "text" output and parse ourselves.

  ---
  Plexus: What It Actually Does

  Can do:
  - Sync state between processes via Yjs providers (WebSocket, etc.)
  - Singleton pattern - same entity = same JS object across clients
  - Parent-child tracking prevents orphans
  - Transactions batch multiple mutations atomically
  - Field-level change notifications (integrates with MobX)

  Cannot do:
  - No lazy loading (deref spawns entire tree)
  - No automatic garbage collection
  - No conflict resolution beyond CRDT (last-write-wins)
  - Single parent only for child-owned fields

  For agent state sync:
  - Global memory could be a Plexus doc with agents reading/writing
  - Scoped memory = SubPlexus with dependency IDs
  - But: no built-in "views" - we'd need to design materialization boundaries

  ---
  Arrival: Implementation Reality

  Implemented:
  - Whitelist-based Scheme sandbox (SAFE_BUILTINS)
  - Fantasy Land + Ramda integration in sandbox
  - S-expression serialization via Symbol.toSExpr protocol
  - Discovery/Action tool classes with batch validation
  - Catamorphism system for AST traversal
  - Graph awareness layer with bidirectional edges

  Key insight - the act-on pattern:
  ; In sandbox (no mutation yet)
  (act-on "src/foo.ts::MyClass" (list (rename "NewName")))
  ; → Returns ActionSpec marker
  ; → Executed AFTER sandbox completes

  This is the Montessori principle: explore freely, then commit deliberately.

  Gap for agents:
  - Discovery tools output S-expression strings
  - But Agent SDK only does JSON structured output
  - Translation layer needed

  Emerging Architecture (First Draft)

  ┌─────────────────────────────────────────────────────────────────┐
  │                     ORCHESTRATOR (Claude Code)                   │
  │  - Sees global state                                            │
  │  - Spawns agents with scoped prompts/tools                      │
  │  - Interprets agent results                                     │
  │  - Manages memory persistence                                   │
  └─────────────────────────────────────────────────────────────────┘
                                │
                ┌───────────────┼───────────────┐
                ▼               ▼               ▼
  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
  │  SCOPED AGENT   │ │  SCOPED AGENT   │ │  SCOPED AGENT   │
  │  (arrival-mcp)  │ │  (plexus)       │ │  (periphery)    │
  │                 │ │                 │ │                 │
  │  Tools: only    │ │  Tools: only    │ │  Tools: only    │
  │  Arrival MCP    │ │  relevant       │ │  discover/act   │
  │                 │ │  subset         │ │                 │
  │  Scope: package │ │  Scope: package │ │  Scope: project │
  └─────────────────┘ └─────────────────┘ └─────────────────┘
          │                   │                   │
          └───────────────────┼───────────────────┘
                              ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │                      SHARED STATE (Plexus)                       │
  │                                                                  │
  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
  │  │ Global Mem   │  │ Package Mem  │  │ Package Mem  │          │
  │  │ (decisions,  │  │ (arrival)    │  │ (plexus)     │          │
  │  │  patterns)   │  │              │  │              │          │
  │  └──────────────┘  └──────────────┘  └──────────────┘          │
  │                                                                  │
  │  SubPlexus references for cross-scope access                    │
  └─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │                    PERSISTENCE LAYER                             │
  │  - SQLite for structured data                                   │
  │  - FalkorDB for graph relationships (your blueprint)            │
  │  - Event sourcing for state history/replay                      │
  └─────────────────────────────────────────────────────────────────┘

  ---
  Open Questions (Real Ones)

  1. S-expression bridge: Agent SDK outputs JSON. Arrival speaks S-expressions. How do we bridge?
    - Option A: Agents output JSON, orchestrator converts to S-expr for Arrival tools
    - Option B: Treat S-expr as text in JSON wrapper { "sexpr": "(discover ...)" }
    - Option C: Build S-expr structured output validator ourselves
  2. Walking the tree: You said "walk, don't jump." Implementation:
    - Agent has currentPath in context
    - Movement functions: (step-into dir), (step-up), (step-sibling name)
    - Each step updates context, accumulates path history
    - "Teleportation" (direct file access) costs more / requires justification?
  3. Scoped memory boundaries: pnpm workspace = scope. But:
    - What about cross-package dependencies?
    - When agent in arrival-scheme needs arrival-env types?
    - SubPlexus dependency references? Or explicit "request access"?
  4. Agent lifecycle: One-shot vs persistent?
    - One-shot: spawn, work, return, die. Clean context each time.
    - Persistent: holds state across interactions. Risks drift.
    - Hybrid: one-shot with "resume" capability via session ID?
  5. Failure detection: How do we know an agent is producing nonsense?
    - Output validation against schema?
    - Semantic checks (does this make sense given context)?
    - Token usage patterns (too short = gave up, too long = rambling)?
    - Peer review by another agent (expensive)?
  6. Git subtrees and shared state overlap: You raised this.
    - Git tracks file changes
    - Plexus tracks state changes
    - Both can conflict. Reconciliation strategy?