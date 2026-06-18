---
title: Membrane design (archived)
layer: history
status: verified
tags: [history, arrival, membrane, security]
canonical-for: []
source-provenance:
  origin: tmp/Archive/arrival/arrival-scheme/docs/membrane-design.md
  branch: origin/tmp-6164624
  retrieved: 2026-06-18
  authority: historical
last-verified: 2026-06-18
verified-against: origin/tmp-6164624
---

> ⚠️ Frozen historical copy — possibly outdated; current truth in [[membrane]].

---

# Membrane Design: JS ↔ Scheme Value Crossing

## Core Philosophy: Abstraction, Not Integration

**This interpreter abstracts from JavaScript rather than integrates with it.**

The Scheme runtime is designed to be a portable language that can be migrated to other host environments (Python, Rust, etc.). Scheme code written for this interpreter should be:

1. **Host-agnostic** - No awareness of whether it's running on JS, Python, or Rust
2. **Portable** - Migration scripts for Plexus should work identically across runtimes
3. **Pure** - Side effects happen through well-defined Scheme procedures, not JS interop

### Transparent but Impenetrable

The membrane is **invisible to Scheme code**. There are:

- ❌ No `js-wrap` / `js-unwrap` procedures
- ❌ No `js-object?` / `js-function?` type predicates
- ❌ No way to detect or manipulate wrapper types from Scheme
- ❌ No raw JS object access

Values cross the boundary **automatically** and Scheme code works with them as native values. The membrane is purely an **implementation detail** of the TypeScript/JavaScript host.

### Why This Matters

When we port the interpreter to Rust (via wasm or native), Scheme code continues working unchanged. The membrane pattern isolates host-specific concerns from the language semantics.

```scheme
;; This code works identically whether the host is JS, Python, or Rust
(define (process-data items)
  (map transform items))
```

---

## Prior Art

This design follows well-established patterns used in production language implementations:

| Implementation | Pattern | What We Took |
|----------------|---------|--------------|
| **Mark Miller's E Language** | Original membrane pattern | WeakMap identity cache, "wet/dry" terminology |
| **Tom Van Cutsem** | JS membrane with Proxies | Bidirectional WeakMap, shadow targets concept |
| **cljs-bean** | O(1) thin wrappers, lazy access | **Primary inspiration** - wrap don't convert |
| **GraalVM Polyglot** | `InteropLibrary` protocol | Type-checking messages: `isNumber()`, `hasMembers()` |
| **PyO3 (Python↔Rust)** | `IntoPy`/`FromPyObject` traits | Per-type conversion protocol |
| **Salesforce observable-membrane** | Read/write tracking | Future: Rosetta reactivity hooks |
| **SES (Secure ECMAScript)** | `harden()`, Compartments | Inspiration for sandboxing |

**Nothing here is novel.** We're applying the standard membrane pattern that has been refined over 20+ years of language interop research.

### Key Sources
- Mark Miller's PhD thesis "Robust Composition" (2006)
- Tom Van Cutsem's "Membranes in JavaScript" - https://tvcutsem.github.io/js-membranes
- cljs-bean library - https://github.com/mfikes/cljs-bean
- GraalVM InteropLibrary - https://www.graalvm.org/truffle/javadoc/com/oracle/truffle/api/interop/InteropLibrary.html
- PyO3 conversion traits - https://pyo3.rs/main/conversions/traits.html

---

## Definitions

Before diving into design decisions, we define the key terms and predicates used throughout.

### `nil` - The Empty List

```typescript
// From src/types.ts
class Nil {
  toString(): string { return "()"; }
  valueOf(): undefined { return undefined; }
}
export const nil = new Nil();
```

`nil` is a singleton representing the empty list `()`. It's falsy in Scheme boolean context.

### `isSchemeValue()` - Recognizing Scheme Types

```typescript
function isSchemeValue(value: unknown): boolean {
  if (value === nil) return true;
  if (value instanceof Pair) return true;
  if (value instanceof SchemeSymbol) return true;
  if (value instanceof SchemeString) return true;
  if (value instanceof SchemeCharacter) return true;
  if (value instanceof SchemeExact) return true;
  if (value instanceof SchemeInexact) return true;
  if (value instanceof QuotedPromise) return true;
  if (value instanceof Macro) return true;
  if (value instanceof Syntax) return true;
  if (value instanceof LambdaContext) return true;
  if (value instanceof Environment) return true;
  // Wrappers are also Scheme values
  if (value instanceof SchemeJSObject) return true;
  if (value instanceof SchemeJSFunction) return true;
  return false;
}
```

This predicate prevents double-wrapping - if something is already a Scheme value, `fromJS()` returns it as-is.

### `isBytevectorLike()` - Binary Data Types

```typescript
function isBytevectorLike(value: unknown): boolean {
  if (value instanceof Uint8Array) return true;
  if (value instanceof ArrayBuffer) return true;
  if (value instanceof DataView) return true;
  if (typeof Buffer !== "undefined" && value instanceof Buffer) return true;
  return false;
}
```

These types pass through without wrapping and work with polymorphic bytevector operations.

---

## Design Decisions

### Decision 1: Primitives Pass Through (No Wrapping)

Following GraalVM, PyO3, and Miller's membranes: **primitives cross the boundary directly**.

```typescript
// These JS values enter Scheme WITHOUT wrapping:
typeof value === "boolean"   // → boolean (as-is)
typeof value === "number"    // → number (as-is)
typeof value === "string"    // → string (as-is)
typeof value === "bigint"    // → bigint (as-is)
typeof value === "symbol"    // → symbol (as-is) - JS symbols, not SchemeSymbol
value === null               // → nil
value === undefined          // → nil
```

**Rationale**:
- JS primitives are immutable, no identity concerns
- Zero overhead for the most common values
- ClojureScript learned this: wrapping primitives is pure waste
- JS `Symbol` values are immutable with built-in identity, safe to pass through

### Decision 2: Thin Wrappers, Not Deep Conversion (cljs-bean approach)

**Don't** recursively convert object graphs. **Do** create O(1) lazy wrappers.

```typescript
// BAD: Deep conversion (like clj->js)
function fromJS(obj) {
  return {
    ...Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, fromJS(v)])  // Recursive!
    )
  };
}

// GOOD: Thin wrapper (like cljs-bean)
class SchemeJSObject {
  constructor(readonly source: object) {}  // O(1)

  get(key: string): SchemeValue {
    return fromJS(this.source[key]);  // Convert lazily on access
  }
}
```

**Rationale** (from cljs-bean benchmarks):
- Wrapper creation: O(1) vs O(n) for deep conversion
- Most properties never accessed - why convert them?
- Original object preserved intact for identity

### Decision 3: WeakMap Identity Cache

Same JS object must always produce the same wrapper (required for `eq?`).

```typescript
const jsToWrapper = new WeakMap<object, SchemeValue>();

function fromJS(value: unknown): SchemeValue {
  if (typeof value !== "object" || value === null) {
    return value;  // Primitives pass through
  }

  // Check cache first
  const cached = jsToWrapper.get(value);
  if (cached) return cached;

  // Create wrapper and cache
  const wrapper = createWrapper(value);
  jsToWrapper.set(value, wrapper);
  return wrapper;
}
```

**Rationale** (from Miller/Van Cutsem):
- Identity preservation: `(eq? x x)` must hold
- WeakMap allows GC when no references remain
- Standard solution used by every membrane implementation

**Note**: Arrays and bytevector-like types bypass the cache because they pass through directly - identity is preserved by returning the same JS object, not by caching wrappers.

### Decision 4: Per-Class `[TO_JS]` Protocol (PyO3-style)

Each wrapper knows how to unwrap itself. No central switch statement.

```typescript
const TO_JS = Symbol.for("scheme.toJS");

// Each class implements its own unwrap
class SchemeJSObject {
  [TO_JS]() { return this.source; }
}

class SchemeJSFunction {
  [TO_JS]() { return this.source; }
}

// Generic unwrap just checks for the symbol
function toJS(value: unknown): unknown {
  if (value && typeof value === "object" && TO_JS in value) {
    return (value as any)[TO_JS]();
  }
  return value;  // Native Scheme types or primitives
}
```

**Rationale** (from PyO3 `FromPyObject`):
- Open for extension - new wrapper types just implement `[TO_JS]`
- No need to modify central `toJS()` function
- Type-safe: each class knows its source type

---

## Architecture

### The Boundary

```
┌─────────────────────────────────────────────────────────────┐
│                      JavaScript World                        │
│  functions, objects, arrays, Uint8Array, Blob, etc.         │
└─────────────────────────────┬───────────────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │     MEMBRANE      │
                    │  fromJS() / toJS()│
                    │  WeakMap cache    │
                    └─────────┬─────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│                       Scheme World                           │
│  Pair, SchemeSymbol, SchemeString, wrappers, etc.           │
└─────────────────────────────────────────────────────────────┘
```

### What Crosses How

| JS Type | Crosses As | Notes |
|---------|------------|-------|
| `boolean` | boolean | Pass through |
| `number` | number | Pass through |
| `string` | string | Pass through |
| `bigint` | bigint | Pass through |
| `symbol` | symbol | Pass through (JS Symbol, not SchemeSymbol) |
| `null` | nil | Convert |
| `undefined` | nil | Convert |
| `Function` | `SchemeJSFunction` | Lazy wrapper |
| `Array` | `Array` | Pass through (shared mutation) |
| `Uint8Array` | `Uint8Array` | Pass through (polymorphic bytevector ops) |
| `ArrayBuffer` | `ArrayBuffer` | Pass through (polymorphic bytevector ops) |
| `Promise` | `Promise` | Pass through (use `'>` for QuotedPromise) |
| `object` | `SchemeJSObject` | Lazy wrapper |

| Scheme Type | Crosses As | Notes |
|-------------|------------|-------|
| `boolean` | boolean | Pass through |
| `number` | number | Pass through |
| `string` | string | Pass through |
| `nil` | null | Convert |
| `SchemeString` | string | `.valueOf()` |
| `SchemeSymbol` | SchemeSymbol | Keep as-is (JS can use `.toString()`) |
| `SchemeCharacter` | string | `.valueOf()` |
| `SchemeExact` | bigint or number | `.valueOf()` |
| `SchemeInexact` | number | `.valueOf()` |
| `Pair` | Pair | Keep as-is (JS can work with it) |
| `QuotedPromise` | Promise | `.valueOf()` returns inner Promise |
| `SchemeJSObject` | object | `[TO_JS]()` returns source |
| `SchemeJSFunction` | Function | `[TO_JS]()` returns source |

### Entry Points (JS → Scheme)

| Entry Point | Action |
|-------------|--------|
| `env.set(name, value)` | `fromJS(value)` |
| JS function returns to Scheme | `fromJS(result)` |
| Property access on wrapped object | `fromJS(obj[prop])` |
| Callback invocation | `args.map(fromJS)` |

### Exit Points (Scheme → JS)

| Exit Point | Action |
|------------|--------|
| Scheme value passed to JS function | `toJS(value)` |
| `env.get()` from JS | Return as-is (let JS handle) |
| Return to JS caller | `toJS(result)` |

---

## Property Access (Host-Provided Values)

When the host environment provides structured data to Scheme code, property access uses the existing `.` syntax:

```scheme
;; Access property on a record/object
(. data "name")

;; Method-style call (if the value is callable)
((. data "transform") arg1 arg2)

;; Chained access
(. (. data "nested") "field")
```

**Important:** Scheme code doesn't know or care whether `data` came from JS, Python, or Rust. The `.` syntax is generic property access that works on any value supporting it.

### Evaluator Implementation (Internal)

The evaluator handles wrapped values transparently:

```typescript
// When evaluating (. obj key):
if (obj instanceof SchemeJSObject) {
  return obj.get(key);  // Membrane handles conversion
}

// When calling a function:
if (fn instanceof SchemeJSFunction) {
  return fn.apply(thisArg, args);  // Membrane handles boundary crossing
}
```

This is purely internal - Scheme code just sees values and procedures.

---

## Error Propagation

What happens when exceptions cross the boundary?

### JS → Scheme (JS function throws)

```typescript
class SchemeJSFunction {
  apply(thisArg: unknown, args: SchemeValue[]): SchemeValue {
    try {
      const result = this.source.apply(toJS(thisArg), args.map(toJS));
      return fromJS(result);
    } catch (e) {
      // Let JS Error propagate - Scheme's guard/with-exception-handler can catch it
      throw e;
    }
  }
}
```

Errors propagate directly. Scheme code catches them with `guard`:

```scheme
;; 'risky-operation' might be a host-provided procedure
(guard (err (#t (display "caught!")))
  (risky-operation))
```

### Scheme → JS (Scheme raises exception)

When Scheme code raises an exception inside a callback to JS:

```typescript
// JS calls a Scheme procedure
const schemeProc = env.get("my-proc");
try {
  const result = schemeProc(arg1, arg2);
} catch (e) {
  // Scheme exceptions are JS Errors with additional properties
  // e.message contains the Scheme error message
}
```

**Design choice**: Don't wrap exceptions. Let native Error objects flow through both directions. This matches how most polyglot runtimes handle exceptions.

---

## Promise Handling

### JS Promises Pass Through

Raw JS `Promise` objects pass through the membrane without wrapping:

```typescript
if (value instanceof Promise) {
  return value;  // Pass through, don't wrap
}
```

### QuotedPromise for Scheme-side Promise Control

The `'>` syntax creates a `QuotedPromise` that prevents auto-resolution:

```scheme
;; Create a quoted promise from JS Promise
(define qp '>(fetch "https://example.com"))

;; QuotedPromise has .then = false to prevent JS Promise resolution
;; Access the inner promise with valueOf when needed
```

### Crossing Back

When a `QuotedPromise` crosses to JS via `toJS()`:

```typescript
if (value instanceof QuotedPromise) {
  return value.valueOf();  // Returns the inner Promise
}
```

This lets JS code await the result naturally.

---

## Wrapper Classes

### SchemeJSObject (Primary Wrapper)

Thin wrapper for JS objects. Lazy property access.

```typescript
class SchemeJSObject {
  static __class__ = "js-object";

  constructor(readonly source: object) {}

  [TO_JS]() { return this.source; }

  // Lazy access - only converts when actually read
  get(key: string | symbol): SchemeValue {
    return fromJS((this.source as any)[key]);
  }

  set(key: string | symbol, value: SchemeValue): void {
    (this.source as any)[key] = toJS(value);
  }

  has(key: string | symbol): boolean {
    return key in this.source;
  }

  keys(): string[] {
    return Object.keys(this.source);
  }

  toString(): string {
    return `#<js-object>`;
  }
}
```

### SchemeJSFunction (Callable Wrapper)

Wraps JS functions for Scheme invocation.

```typescript
class SchemeJSFunction {
  static __class__ = "js-function";

  constructor(readonly source: Function) {}

  [TO_JS]() { return this.source; }

  // Called when Scheme invokes this function
  apply(thisArg: unknown, args: SchemeValue[]): SchemeValue {
    const jsThis = toJS(thisArg);
    const jsArgs = args.map(toJS);
    const result = this.source.apply(jsThis, jsArgs);
    return fromJS(result);
  }

  toString(): string {
    return `#<js-function ${this.source.name || "anonymous"}>`;
  }
}
```

### No SchemeBytevector Wrapper Needed

We use **polymorphic functions** instead of wrappers for bytevectors:

```typescript
// Already implemented in bridge.ts
function asBytevector(obj: unknown, fnName: string): Uint8Array {
  if (obj instanceof Uint8Array) return obj;
  if (obj instanceof ArrayBuffer) return new Uint8Array(obj);
  if (obj instanceof DataView) return new Uint8Array(obj.buffer, obj.byteOffset, obj.byteLength);
  if (typeof Buffer !== "undefined" && obj instanceof Buffer)
    return new Uint8Array(obj.buffer, obj.byteOffset, obj.byteLength);
  throw new TypeError(`${fnName}: expected bytevector, got ${typeof obj}`);
}

// bytevector-length works on any binary type
env.set("bytevector-length", (bv: unknown) => asBytevector(bv, "bytevector-length").length);
```

**Rationale**: Original Blob/ArrayBuffer/Uint8Array identity preserved. When it crosses back to JS, it's the exact same object.

---

## Implementation

### Core Functions

```typescript
const TO_JS = Symbol.for("scheme.toJS");
const jsToWrapper = new WeakMap<object, SchemeValue>();

function fromJS(value: unknown): SchemeValue {
  // Null/undefined → nil
  if (value === null || value === undefined) return nil;

  // Primitives pass through (including JS Symbol)
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value;
  if (typeof value === "string") return value;
  if (typeof value === "bigint") return value;
  if (typeof value === "symbol") return value;

  // Already a Scheme value? Pass through (prevents double-wrapping)
  if (isSchemeValue(value)) return value;

  // Arrays pass through (shared mutation OK)
  if (Array.isArray(value)) return value;

  // Binary types pass through (polymorphic ops)
  if (isBytevectorLike(value)) return value;

  // Promises pass through (use '> for QuotedPromise)
  if (value instanceof Promise) return value;

  // Check wrapper cache for objects
  const cached = jsToWrapper.get(value as object);
  if (cached) return cached;

  // Create appropriate wrapper
  let wrapper: SchemeValue;
  if (typeof value === "function") {
    wrapper = new SchemeJSFunction(value);
  } else {
    wrapper = new SchemeJSObject(value as object);
  }

  jsToWrapper.set(value as object, wrapper);
  return wrapper;
}

function toJS(value: unknown): unknown {
  // Check for wrapper protocol first
  if (value && typeof value === "object" && TO_JS in value) {
    return (value as any)[TO_JS]();
  }

  // nil → null
  if (value === nil) return null;

  // Native Scheme types with valueOf
  if (value instanceof SchemeString) return value.valueOf();
  if (value instanceof SchemeCharacter) return value.valueOf();
  if (value instanceof SchemeExact) return value.valueOf();
  if (value instanceof SchemeInexact) return value.valueOf();
  if (value instanceof QuotedPromise) return value.valueOf();

  // SchemeSymbol stays as-is (JS can call .toString() if needed)
  // Pair stays as-is (JS can work with car/cdr)

  // Everything else passes through
  return value;
}
```

### Integration Points

```typescript
// env.set - wrap incoming JS values
class Environment {
  set(name: string, value: unknown) {
    this._data[name] = fromJS(value);
  }
}

// JS function calls from Scheme - wrap results
class SchemeJSFunction {
  apply(thisArg: unknown, args: SchemeValue[]): SchemeValue {
    const result = this.source.apply(toJS(thisArg), args.map(toJS));
    return fromJS(result);  // Wrap the result!
  }
}

// Property access - wrap results
class SchemeJSObject {
  get(key: string): SchemeValue {
    return fromJS(this.source[key]);  // Wrap the result!
  }
}
```

---

## Resolved Questions

| Question | Resolution | Rationale |
|----------|------------|-----------|
| Arrays: wrap or pass through? | **Pass through** | Shared mutation is acceptable; zero overhead |
| Strings: wrap in SchemeString? | **Pass through** | JS strings immutable; zero overhead |
| JS Symbols: how to handle? | **Pass through** | Immutable with identity; like primitives |
| Bytevectors: wrapper class? | **No, polymorphic ops** | Preserves original type identity |
| WeakMap caching? | **Yes, for objects/functions** | Required for identity preservation |
| Circular references? | **Handled by lazy wrappers** | No eager traversal = no infinite loops |
| JS Promises? | **Pass through** | Use `'>` syntax for QuotedPromise |
| JS Proxies? | **Pass through** | Wrapper treats them as objects |
| Error propagation? | **Pass through** | JS Errors flow both directions |
| SchemeSymbol → JS? | **Keep as SchemeSymbol** | JS can call `.toString()` if needed |

---

## Implementation Plan

**Completed:**
1. [x] Polymorphic bytevector operations (done in bridge.ts)
2. [x] Define `TO_JS` symbol and export
3. [x] Implement `isSchemeValue()` predicate (recognizes lambdas with `__lambda__`)
4. [x] Implement `isBytevectorLike()` predicate
5. [x] Implement `SchemeJSObject` with lazy access
6. [x] Implement `SchemeJSFunction`
7. [x] Create `fromJS()` with WeakMap cache
8. [x] Create `toJS()` with protocol check
9. [x] Instrument `Environment.set()` (objects wrapped, functions pass through)
10. [x] Instrument evaluator for SchemeJSFunction calls
11. [x] Basic wrapper layer tests (90 tests passing)

**Remaining:**
12. [ ] Update `.` syntax to work with SchemeJSObject
13. [ ] Add identity preservation tests
14. [ ] Add error propagation tests
15. [ ] Method binding (`this` preservation)

---

## Future: Observable Membrane (Salesforce pattern)

For Rosetta reactivity, we could add read/write tracking:

```typescript
class ObservableSchemeJSObject extends SchemeJSObject {
  constructor(
    source: object,
    private onRead?: (key: string) => void,
    private onWrite?: (key: string, value: unknown) => void
  ) {
    super(source);
  }

  get(key: string): SchemeValue {
    this.onRead?.(key);  // Track read
    return fromJS((this.source as any)[key]);
  }

  set(key: string, value: SchemeValue): void {
    this.onWrite?.(key, value);  // Track write
    (this.source as any)[key] = toJS(value);
  }
}
```

This would enable automatic dependency tracking for reactive computations.
