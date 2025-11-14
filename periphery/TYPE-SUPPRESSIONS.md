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

**Issue**: YJS `Array.from` doesn't properly support boolean types

**Impact**: Type safety gap in array initialization - booleans might not serialize correctly

**Fix options**:
1. Report to YJS maintainers
2. Create wrapper type that coerces booleans
3. Add runtime validation

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

## Next Steps

1. **Immediate**: Add runtime validation for boolean arrays in YJS serialization
2. **Short-term**: Report boolean type issue to YJS maintainers
3. **Long-term**: Monitor TypeScript 5.x decorator support
