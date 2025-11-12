# Periphery Dogfooding Session - Findings

## Critical Bug: ActionToolInteraction Rollback Not Implemented

**Location**: `arrival/arrival-mcp/src/ActionToolInteraction.ts:301-314`

**Claimed Behavior**: "Atomic transformations (all validate before any execute)" with "full rollback" on failure

**Actual Behavior**: Actions execute sequentially. If one fails mid-batch, previous actions remain applied. NO ROLLBACK.

### Reproduction

```typescript
mcp__periphery__act([
  ["format-file", "file.ts"],                    // Executes ✓
  ["rename-symbol", "file.ts", "old", "new"],     // Executes ✓  
  ["rename-symbol", "file.ts", "invalid", "x"]    // FAILS ✗
])
```

**Expected**: All 3 actions rolled back, file unchanged
**Actual**: Actions 0 and 1 applied, file modified

### Evidence

Before batch:
```typescript
function findWorkspaceRoot(startDir: string): string { ... }
```

After failed batch:
```typescript  
function locateWorkspaceRoot(startDir: string): string { ... }
```

Error message claims: "doing full rollback due to failed action rename-symbol"
Reality: Changes from first 2 actions persist.

### Root Cause

`ActionToolInteraction.act()` line 301-314:
- Catches handler error
- Returns error object with message claiming rollback
- **No actual rollback code**

### Fix Required

True atomicity needs one of:
1. **ts-morph snapshot**: Save project state before execution, restore on failure
2. **Two-phase commit**: Validate all → collect all transformations → apply all at once
3. **Transaction log**: Record inverse operations, replay on failure

### Impact

- Violates atomic batch guarantee
- Partial application on failure leaves codebase in inconsistent state
- Error message misleads users about what happened

### Testing Protocol

Observable effects checklist revealed this:
1. Read file before ✓
2. Run action ✓  
3. Read file after ✓
4. **Verify EXACT changes** ← This step caught the bug

Just checking "no error" would miss this. The operation "succeeded" in executing 2/3 actions, but violated the atomicity contract.
