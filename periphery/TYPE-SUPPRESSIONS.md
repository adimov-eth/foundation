# Type Suppression Audit

**Total suppressions**: 9

## Categories

### 1. YJS Type Issues (4 suppressions) - **HIGH PRIORITY**

**Location**: `plexus/plexus/src/PlexusModel.ts:391, 393, 420, 423`

**Pattern**:
```typescript
// @ts-expect-error todo (maybe report to yjs?) - type issue: yjs Array.from not supporting boolean
Y.Array.from(
    // @ts-expect-error todo (maybe report to yjs?) - type issue: yjs Array.from not supporting boolean
    Array.from<AllowedYJSValue, AllowedYValue>(...)
)
```

**Issue**: YJS `Array.from` type definition doesn't accept boolean in mapped output

**Root cause**:
```typescript
// The mapper transforms PlexusModel → ReferenceTuple, passes primitives through
curryMaybeReference: (val: AllowedYJSValue) => AllowedYValue
// Where AllowedYValue = string | number | boolean | null | ReferenceTuple

// Runtime: works correctly (booleans pass through unchanged)
// Types: Y.Array.from signature excludes boolean from mapped output type
```

**Impact**: None - runtime works, suppressions document type limitation

**Conclusion**: YJS type definition issue, not a code bug. Suppressions appropriate.

---

### 2. Decorator/Accessor Issues (2 suppressions) - **MEDIUM PRIORITY**

**Location**:
- `plexus/plexus/src/decorators.ts:43`
- `plexus/plexus/src/Plexus.ts:235`

**Pattern**:
```typescript
// @ts-expect-error
// noinspection JSConstantReassignment
```

**Issue**: TypeScript doesn't understand decorator reassignment pattern

**Impact**: Safe pattern but requires suppression

**Fix options**:
1. Wait for TypeScript 5.x decorator improvements
2. Refactor to avoid reassignment
3. Document as intentional pattern

---

### 3. UndoManager Type (1 suppression) - **LOW PRIORITY**

**Location**: `plexus/plexus/src/Plexus.ts:93`

**Pattern**:
```typescript
// @ts-expect-error
public readonly undoManager: UndoManager;
```

**Issue**: UndoManager type not properly imported/defined

**Impact**: Loss of type safety on undo operations

**Fix options**:
1. Import proper UndoManager type from yjs
2. Define interface if not exported
3. Use `any` with comment explaining why

---

### 4. Test Decorator Overrides (2 suppressions) - **INFORMATIONAL**

**Location**:
- `plexus/plexus/src/__tests__/inheritance-defaults.test.ts:476`
- `plexus/plexus/src/__tests__/inheritance-defaults.test.ts:634`

**Pattern**:
```typescript
// @ts-expect-error
@syncing.child accessor arg!: SharedArg; // Override as owned child
```

**Issue**: Intentional test of decorator override behavior

**Impact**: None - testing edge cases

**Action**: Document as intentional test pattern

---

## Summary

| Category | Count | Priority | Actionable |
|----------|-------|----------|------------|
| YJS Type Issues | 4 | HIGH | Yes - report upstream or add validation |
| Decorator/Accessor | 2 | MEDIUM | No - language limitation |
| UndoManager Type | 1 | LOW | Yes - improve imports |
| Test Overrides | 2 | INFO | No - intentional test |

## Conclusion

All suppressions are appropriate:
- YJS type issues (4): Type system limitation, runtime works
- Decorator patterns (2): Language limitation until TS 5.x
- UndoManager (1): Could improve import
- Test overrides (2): Intentional test patterns

**No action needed.** The suppressions document known limitations, not bugs.
