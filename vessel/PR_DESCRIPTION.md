## Session Memory Ingestion: Execute Mode, Stable Store, Robust Parsing

What changed
- Execute wiring: SessionIngester → MemoryIntegration → MemoryToolInteraction now executes real DSL calls, storing memories and edges in the shared state.
- Stable memory path: FileMemoryStore no longer depends on CWD. Defaults to `packages/vessel/.state/memory` anchored via `import.meta.url`; override with `MEMORY_STATE_DIR`.
- Robust JSONL parsing: Handles Claude variations (tool_result content as array/string), safe `tool_use` detection, and message content guards.
- Guarded generation: No crashes on missing `breakthrough` contexts, missing `failure_loop.errorMessages`, or non-string tags.
- Edge safety: `associate` uses a numeric weight fallback to avoid NaN.
- CLI/Types: Formats `report|json|sexpr`; added `ingest:smoke` script; fixed analyzer/type mismatches; compiles clean.

Why
- Previously, `--execute` was a no-op. DSL ran in a sandbox without memory functions; nothing persisted.
- Memory path was CWD-sensitive, creating accidental split states.
- Real Claude JSONL logs include shapes that broke naive parsing.

How to validate
- Typecheck
  - `cd packages/vessel && bun run typecheck`

- Dry-run (human-readable)
  - `bun run ingest ~/.claude/logs/`

- JSON result
  - `bun run ingest --format json --output ingest.json ~/.claude/logs/`

- S-expression script
  - `bun run ingest --format sexpr --output ingest.sexpr ~/.claude/logs/`

- Execute on your project logs
  - `bun run ingest --execute /Users/adimov/.claude/projects/-Users-adimov-AGI/*.jsonl`
  - Inspect state: `packages/vessel/.state/memory/graph.sexpr` for new `(remember ...)` / `(associate ...)` entries.

- Smoke test (isolated state)
  - `bun run ingest:smoke`
  - Uses `MEMORY_STATE_DIR` to write to `packages/vessel/.state/test-memory-smoke/graph.sexpr`

Notes
- Memory types: ingestion uses extended types like `principle|technique|warning|workflow|bridge`. Memory accepts free-form string types; we can broaden the union or document this explicitly.
- Environment: set `MEMORY_STATE_DIR=/tmp/memory-state` to redirect persistence for tests/CI.
- Out of scope: ledger/config file loader (can be added later).

Impact
- End-to-end ingestion is functional: patterns → memories/edges are persisted in the same store the MCP server uses.

