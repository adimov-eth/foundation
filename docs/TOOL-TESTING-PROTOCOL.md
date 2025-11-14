# Tool Testing & Debugging Protocol

**Status:** Active
**Date:** 2025-11-12
**Context:** We build our own MCP tools. We must dogfood them.

---

## The Problem

When renaming tools from `code-discovery`/`code-action` → `discover`/`act`:
- Used manual file edits instead of our own tools
- Forgot to check imports across multiple files
- Created duplicate imports/exports
- Broke the build multiple times
- Wasted time debugging TypeScript errors

**The lesson:** If we have tools for code transformation, use them. Otherwise we're building theater.

---

## The Protocol

### 1. Check Server Status FIRST

```bash
pm2 describe periphery  # Check if server is running
pm2 logs periphery --lines 20  # Check for errors
```

**If server is down:** Fix server before attempting tool use.

### 2. Use Discovery Tool for Planning

```scheme
; Find all files that need changes
(grep-content "pattern" "path")  ; Note: pipe | in regex doesn't work - use Grep tool instead

; Or use Grep tool directly
```

With Grep tool:
```typescript
Grep({ pattern: "OldName|old-file", path: "periphery", output_mode: "content" })
```

### 3. Use Action Tool for Execution

```typescript
// Batch ALL changes together - atomic validation
mcp__periphery__act({
  actions: [
    ["rename-symbol", "file.ts", "OldName", "NewName"],
    ["add-import", "file.ts", "./new-file.js", ["NewName"], ""],
    ["remove-unused-imports", "file.ts"]
  ]
})
```

**Critical:** Actions validate upfront. If ANY fails, NONE execute.

### 4. When Tool Fails

**Step 1: Check logs**
```bash
pm2 logs periphery --lines 50
```

**Step 2: Common errors**

| Error | Cause | Fix |
|-------|-------|-----|
| `fetch failed` | Server down/crashed | `pm2 restart periphery` |
| `ENOENT: no such file` | File path wrong or tool interprets regex | Use absolute paths or Grep tool |
| `Module not found` | Import paths wrong after file rename | Fix imports first |
| `Duplicate identifier` | Tool added import without removing old | Manual cleanup needed |

**Step 3: Build after changes**
```bash
pnpm build  # Zero errors = success
```

### 5. Test Changes

```bash
pnpm test <test-file>.test.ts  # Verify tests pass
```

**Observable effects only.** "No error" ≠ "it works."

---

## When NOT To Use Tools

1. **tsconfig.json changes** - Manual edit (not TypeScript code)
2. **package.json changes** - Manual edit (not TypeScript code)
3. **README/docs** - Manual edit or generate fresh
4. **Single-line obvious fixes** - Edit tool faster than MCP roundtrip

---

## When TO Use Tools

1. **Renaming** across multiple files
2. **Import management** (add/remove/dedupe)
3. **Symbol renaming** (declaration + references)
4. **Format batches** across packages
5. **Any time you think "this needs multiple files"**

---

## The Test

Before any refactoring session, ask:

> "Could I use our own tools for this?"

If yes → use tools.
If tools don't work → FIX THE TOOLS, then use them.

This is the only way to know if our tools actually work.

---

## Lessons from This Session

### What Worked
- **Grep tool** - Fast pattern search across files
- **Batch actions** - All-or-nothing validation prevented partial corruption
- **Test verification** - 8 tests passing = changes actually work

### What Failed
- **Discovery tool grep-content** - Can't handle regex pipes `|` in pattern
- **Action tool edge cases** - Created duplicate imports, didn't remove old exports
- **Manual fallback habit** - First instinct was Edit tool, not our own tools

### What We Learned
- **Build immediately after tool use** - TypeScript catches errors our tools miss
- **Test with observable effects** - Don't trust "no error", verify actual changes
- **Logs are critical** - PM2 logs show exactly why tool failed

---

## Next Steps

1. Fix `grep-content` to handle regex properly OR document limitation
2. Improve `add-import` to check for duplicates before adding
3. Add `rename-file` action (we had to use `mv` manually)
4. Add `update-import-path` action (for when files move)
5. Create test suite for the tools themselves

---

## Summary

**Tools exist to be used.** If we're manually editing code we have tools for, we're performing. Use the tools. Fix the tools. Trust the tools. This is how we know they work.
