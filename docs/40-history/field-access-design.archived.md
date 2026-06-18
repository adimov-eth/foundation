---
title: Field access design (archived)
layer: history
status: verified
tags: [history, arrival, membrane]
canonical-for: []
source-provenance:
  origin: tmp/Archive/arrival/arrival-scheme/docs/field-access-design.md
  branch: origin/tmp-6164624
  retrieved: 2026-06-18
  authority: historical
last-verified: 2026-06-18
verified-against: origin/tmp-6164624
---

> ⚠️ Frozen historical copy — possibly outdated; current truth in [[membrane]].

---

# Field Access Design: Records, Dicts, and Structured Data

## Problem Statement

Scheme code needs to access fields on structured data. This data might be:
- Host-provided objects (JS objects, Python dicts, Rust structs)
- Scheme-native records/structs
- Association lists
- Hash tables

We need a **unified, portable syntax** that:
1. Works identically across all host environments
2. Doesn't leak host implementation details
3. Is readable and ergonomic for migration scripts
4. Supports both read and write access

---

## Current Approaches in Scheme Ecosystem

### 1. Dot Syntax (Current LIPS)

```scheme
(. obj "key")           ; read
(. obj "nested" "deep") ; chained (?)
```

**Pros:**
- Already implemented
- Familiar to JS developers

**Cons:**
- String keys feel verbose
- JS-flavored (not portable feeling)
- Unclear semantics for nested access

### 2. SRFI-9 Records (R7RS)

```scheme
(define-record-type <point>
  (make-point x y)
  point?
  (x point-x)
  (y point-y))

(point-x my-point)  ; access
```

**Pros:**
- Standard Scheme
- Type-safe with predicates
- Named accessors

**Cons:**
- Requires type definition upfront
- Doesn't work with arbitrary data from host
- Verbose for ad-hoc data

### 3. Association Lists (Classic Scheme)

```scheme
(define data '((name . "Alice") (age . 30)))
(assoc 'name data)  ; => (name . "Alice")
(cdr (assoc 'name data))  ; => "Alice"
```

**Pros:**
- Pure Scheme, completely portable
- No special syntax needed

**Cons:**
- O(n) lookup
- Verbose to extract value
- Awkward for nested access

### 4. Hash Tables (SRFI-125 / R7RS-large)

```scheme
(hash-ref ht 'key)
(hash-set! ht 'key value)
```

**Pros:**
- O(1) lookup
- Standard API

**Cons:**
- Mutable by default
- Different type than records
- Still verbose for nested access

### 5. Keyword/Symbol Access (Clojure-style)

```scheme
(:name person)        ; keyword as function
(person :name)        ; object as function (?)
(get-in person [:address :city])  ; nested
```

**Pros:**
- Very concise
- Keywords are self-documenting
- `get-in` handles nesting elegantly

**Cons:**
- Not standard Scheme
- Requires keywords as callable

### 6. Lens/Accessor Pattern (Functional)

```scheme
(define name-lens (make-lens 'name))
(view name-lens person)
(set name-lens person "Bob")
(over name-lens person string-upcase)
```

**Pros:**
- Composable
- First-class accessors
- Works with immutable updates

**Cons:**
- Learning curve
- Overkill for simple access

### 7. Path-based Access

```scheme
(ref data 'name)
(ref data 'address 'city)      ; nested
(ref data 'items 0 'name)      ; with index
```

**Pros:**
- Unified syntax for any depth
- Works with both keys and indices
- Simple to understand

**Cons:**
- New procedure to learn
- Needs good error messages for missing paths

---

## What Modern Lisp Dialects Actually Use

### Clojure: Keywords as Functions + `get-in`

Clojure is the most influential modern Lisp for data manipulation. Three approaches coexist:

```clojure
;; 1. Keyword as function (idiomatic, recommended)
(:name person)              ; => "Alice"

;; 2. Map as function
(person :name)              ; => "Alice"

;; 3. Explicit get
(get person :name)          ; => "Alice"
(get person :missing nil)   ; => nil (with default)

;; Nested access
(get-in person [:address :city])     ; => "Boston"
(get-in person [:missing :deep] "?") ; => "?" (with default)
```

**Key insight**: Clojure's style guides (Batsov, clojure.org) recommend `(:key map)` over `(map :key)` or `(get map :key)` for simple access. The `get` function is preferred for non-keyword keys or when a default is needed.

Sources: [Clojure Hashed Collections](https://clojure.org/guides/learn/hashed_colls), [Keywords and Map Lookup](https://egghead.io/lessons/clojure-keywords-and-map-lookup-in-clojure-and-clojurescript), [ClojureDocs: get](https://clojuredocs.org/clojure.core/get)

### Janet: `get`, `in`, `get-in`, `put-in`

Janet (Clojure-inspired, compiles to C) uses explicit functions:

```janet
;; Basic access
(get @{:name "Alice"} :name)      ; => "Alice"
(in @[:a :b :c] 1)                ; => :b (strict on arrays)

;; Nested access
(get-in data [:address :city])    ; => value
(get-in data [:missing] "default") ; => "default"

;; Mutation
(put @{} :key "value")
(put-in data [:a :b] "deep")      ; creates tables as needed
```

**Key insight**: `in` is stricter than `get` for arrays/tuples (throws on bad keys). Both exist because different use cases need different safety levels.

Sources: [Janet Data Structures](https://janet-lang.org/docs/data_structures/index.html), [Janet Structs](https://janet-lang.org/docs/data_structures/structs.html)

### Fennel: Dot Syntax (Lua Host)

Fennel compiles to Lua and uses dot syntax directly in symbols:

```fennel
;; Dot access on tables
(let [tbl {:x 52 :y 91}]
  (+ tbl.x tbl.y))    ; => 143

;; Multi-level
user.address.city     ; chained access

;; Works with set too
(set tbl.one 1)
```

**Key insight**: The dot is part of the symbol syntax, not a special form. This is possible because Fennel targets Lua's table semantics directly. Not portable to non-Lua hosts.

Sources: [Fennel Tutorial](https://fennel-lang.org/tutorial), [Fennel Reference](https://fennel-lang.org/reference)

### Racket: Generated Accessors (SRFI-9 style)

Racket uses the R7RS approach - `define-record-type` generates named accessor functions:

```racket
(struct point (x y))
;; Automatically creates: point-x, point-y, point?

(point-x my-point)    ; access x field
```

For ad-hoc data, hash tables use explicit functions:
```racket
(hash-ref ht 'key)
(hash-ref ht 'key default)
```

**Key insight**: Racket emphasizes type safety through generated accessors. No generic "get field" exists by default - each record type defines its own interface.

Sources: [Racket Struct Reference](https://docs.racket-lang.org/reference/define-struct.html), [Racket Guide: Structures](https://docs.racket-lang.org/guide/define-struct.html)

### Common Lisp (CLOS): `slot-value` + Accessors

CLOS provides both low-level access and generated methods:

```lisp
;; Direct slot access (always works)
(slot-value person 'name)
(setf (slot-value person 'name) "Bob")

;; Generated accessor (if defined with :accessor)
(person-name person)
(setf (person-name person) "Bob")
```

**Key insight**: `slot-value` is the universal escape hatch, but generated accessors are preferred because they're generic functions that can be specialized with methods.

Sources: [Common Lisp Cookbook: CLOS](https://lispcookbook.github.io/cl-cookbook/clos.html), [CLHS: slot-value](http://clhs.lisp.se/Body/f_slt_va.htm)

### Guile Scheme: SRFI-9 + Functional Setters

Guile follows R7RS with extensions for immutable updates:

```scheme
;; Standard SRFI-9
(define-record-type <employee>
  (make-employee name salary)
  employee?
  (name employee-name)
  (salary employee-salary set-employee-salary!))

(employee-name emp)  ; access

;; Guile extension: functional update
(set-field emp (employee-salary) 50000)  ; returns new record
(set-fields emp
  ((employee-name) "New Name")
  ((employee-salary) 60000))
```

Sources: [Guile SRFI-9](https://www.gnu.org/software/guile/manual/html_node/SRFI_002d9-Records.html)

### SRFI-123: Generic `ref` (The Standard Answer)

SRFI-123 explicitly addresses this problem for Scheme:

```scheme
;; Generic accessor
(ref #(a b c) 1)              ; => b (vector)
(ref '((a . 1) (b . 2)) 'a)   ; => 1 (alist)
(ref ht 'key)                 ; => value (hash table)
(ref ht 'missing 'default)    ; => default

;; Chained access with ref*
(ref* data 'users 0 'name)    ; => nested value

;; ~ is synonym for ref*
(~ data 'users 0 'name)

;; With SRFI-17 generalized set!
(set! (~ data 'key) value)
```

**Key insight**: SRFI-123 is exactly what we're designing. It provides:
- `ref` for single access with optional default
- `ref*` (and `~`) for chained access
- SRFI-17 setter support
- Extensible to custom types via `register-getter-with-setter!`

Sources: [SRFI-123](https://srfi.schemers.org/srfi-123/srfi-123.html), [SRFI-17](https://srfi.schemers.org/srfi-17/srfi-17.html)

### Summary Table

| Dialect | Single Access | Nested Access | Default Value | Style |
|---------|--------------|---------------|---------------|-------|
| **Clojure** | `(:key m)` | `(get-in m ks)` | `(get m k d)` | Keywords as functions |
| **Janet** | `(get t k)` | `(get-in t ks)` | `(get-in t ks d)` | Explicit functions |
| **Fennel** | `t.key` | `t.a.b.c` | N/A | Dot in symbol |
| **Racket** | `(rec-field r)` | Chained calls | N/A | Generated accessors |
| **CL/CLOS** | `(slot-value o 's)` | Chained calls | N/A | Universal escape hatch |
| **Guile** | `(rec-field r)` | Chained calls | N/A | SRFI-9 + extensions |
| **SRFI-123** | `(ref d k)` | `(ref* d k1 k2)` | `(ref d k dflt)` | Generic functions |

---

## Design Considerations for Arrival Scheme

### Constraint 1: Host Agnosticism

The syntax must work whether the underlying data is:
- JavaScript object
- Python dictionary
- Rust HashMap/struct
- Native Scheme record

```scheme
;; This code must work identically everywhere
(ref user 'name)
```

### Constraint 2: Migration Script Ergonomics

Migration scripts manipulate data heavily. Syntax should be:
- Concise (will be written thousands of times)
- Readable (will be reviewed by humans)
- Predictable (no surprises)

### Constraint 3: Nested Access

Real data is nested. Must handle:

```scheme
;; Access deeply nested field
(ref response 'data 'users 0 'profile 'email)
```

### Constraint 4: Safe by Default

Missing keys should have clear, predictable behavior:
- Return `#f` or special "not found" value?
- Raise exception?
- Support default values?

---

## Proposal: `ref` and `set!` with Paths

### Core API

```scheme
;; Read access
(ref data key)                    ; single key
(ref data key1 key2 key3)         ; path (nested)
(ref data key default)            ; with default (how to distinguish?)

;; Alternative: explicit path
(ref data '(address city))        ; path as list
(ref-or data '(address city) "Unknown")  ; with default

;; Write access (if mutable)
(set! (ref data 'name) "New Name")  ; generalized set!
;; or
(ref-set! data 'name "New Name")
(ref-set! data '(address city) "Boston")
```

### Path Semantics

A path is a sequence of keys/indices:
- Symbols: `'name` - lookup by symbol/string key
- Numbers: `0`, `1` - index into sequence
- Strings: `"key"` - explicit string key (rarely needed)

```scheme
(ref users 0 'name)           ; first user's name
(ref config 'database 'host)  ; nested config
```

### Missing Key Behavior

**Option A: Return #f**
```scheme
(ref data 'missing)  ; => #f
(ref data 'name)     ; => "Alice" or #f if missing
```
Problem: Can't distinguish "key exists with value #f" from "key missing"

**Option B: Raise exception**
```scheme
(ref data 'missing)  ; => ERROR: key 'missing not found
```
Problem: Need try/catch for optional fields

**Option C: Explicit variants**
```scheme
(ref data 'name)              ; raises if missing
(ref? data 'name)             ; returns #f if missing (or the value)
(ref-or data 'name "default") ; returns default if missing
```

**Option D: Maybe/Option monad**
```scheme
(ref data 'name)  ; => (just "Alice") or (nothing)
```
Problem: Adds complexity, need to unwrap

### Recommended: Option C (Explicit Variants)

```scheme
;; Strict - raises on missing
(ref data 'name)

;; Lenient - returns #f on missing
(ref? data 'name)

;; Default - returns default on missing
(ref-or data 'name "Anonymous")

;; Path versions
(ref data 'address 'city)
(ref? data 'address 'city)
(ref-or data 'address 'city "Unknown")
```

---

## Alternative Proposal: Keyword Functions

If we add keywords (`:name` syntax), they can act as accessors:

```scheme
(:name person)              ; => "Alice"
(:city (:address person))   ; => nested

;; With threading macro
(-> person :address :city)  ; => "Boston"
```

### Pros:
- Very concise
- Self-documenting (keywords stand out)
- Familiar to Clojure users

### Cons:
- Requires keywords as first-class callable
- Unfamiliar to traditional Schemers
- Nested access still needs threading or explicit nesting

---

## Alternative Proposal: Unified `.` with Symbols

Extend current `.` to work with symbols:

```scheme
(. data 'name)           ; symbol key
(. data "name")          ; string key (same result)
(. data 'address 'city)  ; chained

;; Shorthand if we add reader macro
data.name                ; => (. data 'name)
data.address.city        ; => (. data 'address 'city)
```

### Pros:
- Extends existing syntax
- Very familiar notation
- Concise with reader macro

### Cons:
- Reader macro adds complexity
- `.` traditionally means something specific in Scheme
- Conflicts with decimal numbers (`1.5` vs `obj.5`)

---

## Questions to Resolve

1. **Naming**: `ref` vs `get` vs `at` vs `.` vs keyword-functions?

2. **Nesting**: Variadic `(ref data 'a 'b 'c)` vs path list `(ref data '(a b c))`?

3. **Missing keys**: Strict (exception) vs lenient (#f) vs explicit variants?

4. **Mutability**: Support `set!` or keep data immutable in Scheme?

5. **Keywords**: Add `:keyword` syntax or stick with symbols?

6. **Index access**: Same syntax for numeric indices? `(ref items 0)`?

---

## Recommendation

Based on research into modern Lisp dialects, **SRFI-123 is the standard answer** for generic field access in Scheme. We should follow it closely with minor adaptations for portability.

### Primary: SRFI-123 Compatible `ref` Family

```scheme
;; Single access with optional default
(ref data 'key)                    ; raises on missing
(ref data 'key 'not-found)         ; returns 'not-found if missing

;; Chained access (ref*)
(ref* data 'users 0 'name)         ; nested path

;; ~ synonym (familiar to Gauche users)
(~ data 'users 0 'name)            ; same as ref*
```

### Deviation from SRFI-123

SRFI-123 uses optional second argument for defaults in `ref`, but this creates ambiguity:
```scheme
(ref data 'key 'value)  ; Is 'value a path segment or default?
```

**Our solution**: Separate functions for clarity (similar to Janet's `get` vs `get-in`):

```scheme
;; SRFI-123 compatible
(ref data 'key)                    ; single, strict
(ref data 'key default)            ; single, with default
(ref* data 'a 'b 'c)               ; chained, strict

;; Arrival extensions for ergonomics
(ref? data 'key)                   ; single, returns #f if missing
(ref*? data 'a 'b 'c)              ; chained, returns #f if missing
(ref*-or data '(a b c) default)    ; chained, with default (path as list)
```

### Why Not Clojure-style Keywords?

Clojure's `(:key map)` is elegant but:
1. Requires keywords to be callable (not standard Scheme)
2. Nested access still needs `get-in` or threading
3. Less portable to Python/Rust hosts

We may add keyword syntax later if migration scripts heavily favor it.

### Why Not Fennel-style Dots?

Fennel's `obj.field` is concise but:
1. Requires reader macro changes
2. Conflicts with Scheme's dot-pair syntax
3. Only works because Lua has unified table semantics

### Do NOT implement:
- Reader macros (`data.field`)
- JS-specific object introspection
- Mutable `set!` on refs without explicit opt-in

### Consider for v2:
- SRFI-17 generalized `set!` for `ref` and `~`
- Threading macros (`->`, `->>`) for deep access chains
- Keywords as callable accessors if ergonomics demand it

---

## Implementation Notes

### Core Functions (TypeScript)

```typescript
// Symbol for "not found" sentinel (avoids #f ambiguity)
const REF_NOT_FOUND = Symbol.for('scheme.ref.not-found');

// ref: single-key access with optional default
function schemeRef(data: SchemeValue, key: SchemeValue, dflt?: SchemeValue): SchemeValue {
  const result = accessField(data, key);
  if (result === REF_NOT_FOUND) {
    if (dflt !== undefined) return dflt;
    throw new Error(`Key ${String(key)} not found`);
  }
  return result;
}

// ref*: chained access (variadic)
function schemeRefStar(data: SchemeValue, ...path: SchemeValue[]): SchemeValue {
  let current = data;
  for (const key of path) {
    const result = accessField(current, key);
    if (result === REF_NOT_FOUND) {
      throw new Error(`Key ${String(key)} not found in path`);
    }
    current = result;
  }
  return current;
}

// ref?: lenient single access
function schemeRefQ(data: SchemeValue, key: SchemeValue): SchemeValue {
  const result = accessField(data, key);
  return result === REF_NOT_FOUND ? false : result;
}

// Core dispatcher (host-agnostic interface)
function accessField(data: SchemeValue, key: SchemeValue): SchemeValue | typeof REF_NOT_FOUND {
  // Host object (wrapped)
  if (data instanceof SchemeJSObject) {
    const k = keyToString(key);
    return data.has(k) ? data.get(k) : REF_NOT_FOUND;
  }

  // Association list
  if (isPair(data)) {
    const found = assocRef(data, key);
    return found ? cdr(found) : REF_NOT_FOUND;
  }

  // Vector/Array
  if (Array.isArray(data)) {
    const idx = toIndex(key);
    return idx >= 0 && idx < data.length ? fromJS(data[idx]) : REF_NOT_FOUND;
  }

  // Hash table (SRFI-125)
  if (isHashTable(data)) {
    return hashTableRef(data, key, REF_NOT_FOUND);
  }

  // SRFI-9 record (via accessor registry)
  if (isRecord(data)) {
    return recordRef(data, key);
  }

  throw new TypeError(`Cannot access field on ${typeOf(data)}`);
}
```

### Portable to Other Hosts

Each host implements `accessField` for its native types:

**JavaScript:**
- Objects → property access
- Arrays → index access
- Maps → `.get()`

**Python:**
```python
def access_field(data, key):
    if isinstance(data, dict):
        return data.get(key, REF_NOT_FOUND)
    if isinstance(data, (list, tuple)):
        return data[key] if 0 <= key < len(data) else REF_NOT_FOUND
    if hasattr(data, key):
        return getattr(data, key)
    return REF_NOT_FOUND
```

**Rust:**
```rust
fn access_field(data: &Value, key: &Value) -> Option<Value> {
    match data {
        Value::HashMap(m) => m.get(key).cloned(),
        Value::Vec(v) => key.as_index().and_then(|i| v.get(i).cloned()),
        Value::Struct(s) => s.get_field(key),
        _ => None,
    }
}
```

### SRFI-123 Compatibility

To maintain compatibility, we also export `~` as an alias:
```scheme
(define ~ ref*)  ; or special form that shares implementation
```

For SRFI-17 generalized `set!` (future):
```scheme
(set! (ref data 'key) value)   ; desugars to ref-set!
(set! (~ data 'a 'b) value)    ; desugars to ref*-set!
```

---

## Envpack Architecture: Multiple Styles

All field access styles reduce to one primitive. Envpacks provide familiar syntax as pure Scheme sugar.

### Layer Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Code                               │
│   (import (arrival clojure))         ; read-only (default)      │
│   (import (arrival clojure mutable)) ; read + write             │
├─────────────────────────────────────────────────────────────────┤
│                    Style Envpacks (read-only)                   │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌─────────────────┐ │
│  │  clojure  │ │   clos    │ │  srfi-123 │ │     records     │ │
│  │  :key     │ │ slot-value│ │  ref* ~   │ │ rec-field       │ │
│  │  get-in   │ │           │ │  ref?     │ │                 │ │
│  └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └────────┬────────┘ │
│        │             │             │                │          │
│        └─────────────┴──────┬──────┴────────────────┘          │
│                             ▼                                   │
├─────────────────────────────────────────────────────────────────┤
│                     (arrival base)  [read-only]                 │
│                                                                 │
│   ref      - single key access with optional default            │
│   ref-has? - key existence check                                │
│   ref-keys - enumerate keys                                     │
│                                                                 │
├ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┤
│                 Style Envpacks (mutable) - extends read-only    │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐         │
│  │clojure mutable│ │ clos mutable  │ │srfi-123 mutabl│         │
│  │  assoc!       │ │ setf          │ │  ref! ~!      │         │
│  │  update!      │ │ slot-set!     │ │  set! (~ ..)  │         │
│  └───────┬───────┘ └───────┬───────┘ └───────┬───────┘         │
│          │                 │                 │                  │
│          └─────────────────┴────────┬────────┘                  │
│                                     ▼                           │
├─────────────────────────────────────────────────────────────────┤
│                  (arrival base mutable)  [extends base]         │
│                                                                 │
│   (import (arrival base))  ; re-exports all read-only           │
│   ref!       - single key mutation                              │
│   ref-delete! - key deletion                                    │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                     Membrane Layer                              │
│                                                                 │
│   accessField(data, key) → value | NOT_FOUND    [read]          │
│   hasField(data, key) → boolean                 [read]          │
│   getKeys(data) → list                          [read]          │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─          │
│   setField(data, key, value) → void             [write]         │
│   deleteField(data, key) → void                 [write]         │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                    Host Runtime                                 │
│         JavaScript  │  Python  │  Rust  │  WASM                 │
└─────────────────────────────────────────────────────────────────┘
```

### Read-Only vs Mutable Split

**Design principle**: Read-only is the safe default. Mutation requires explicit opt-in.

```scheme
;; Safe default - can't accidentally mutate
(import (arrival clojure))
(:name user)              ; ✓ read
(assoc user :name "Bob")  ; ✓ functional update (returns new)
(assoc! user :name "Bob") ; ✗ error: assoc! not exported

;; Explicit opt-in for mutation
(import (arrival clojure mutable))
(:name user)              ; ✓ read (re-exported)
(assoc user :name "Bob")  ; ✓ functional update (re-exported)
(assoc! user :name "Bob") ; ✓ in-place mutation
```

**Benefits:**
1. **Safety** - migration scripts default to not mutating source data
2. **Portability** - read-only works on immutable hosts (Rust, frozen Python)
3. **Clarity** - `(import (... mutable))` signals "this code mutates"
4. **Auditability** - grep for "mutable" to find all mutating code

### Core Primitives: `(arrival base)` + `(arrival base mutable)`

The minimal set everything builds on, split into read-only and mutable:

```scheme
;; ============================================================
;; (arrival base) - READ-ONLY (safe default)
;; ============================================================
(library (arrival base)
  (export ref ref-has? ref-keys)

  ;; Core accessor - the ONE primitive
  ;; Returns value or raises if missing (unless default provided)
  (define (ref data key . maybe-default)
    (%membrane-ref data key maybe-default))

  ;; Predicate
  (define (ref-has? data key)
    (%membrane-has data key))

  ;; Introspection
  (define (ref-keys data)
    (%membrane-keys data)))

;; ============================================================
;; (arrival base mutable) - EXTENDS with write operations
;; ============================================================
(library (arrival base mutable)
  (export ref ref-has? ref-keys      ; re-export read-only
          ref! ref-delete!)          ; add mutations
  (import (arrival base))

  ;; Mutation
  (define (ref! data key value)
    (%membrane-set data key value))

  ;; Deletion
  (define (ref-delete! data key)
    (%membrane-delete data key)))
```

### Envpack 1: `(arrival srfi-123)` + `(arrival srfi-123 mutable)`

SRFI-123 compatible generic accessors:

```scheme
;; ============================================================
;; (arrival srfi-123) - READ-ONLY
;; ============================================================
(library (arrival srfi-123)
  (export ref ref* ~ ref? ref*? ref-has? ref-keys)
  (import (arrival base))

  ;; Re-export base ref (already variadic with default support)

  ;; Chained access
  (define (ref* data . path)
    (fold-left (lambda (d k) (ref d k)) data path))

  ;; Gauche-style alias
  (define ~ ref*)

  ;; Lenient variants (return #f on missing)
  (define (ref? data key)
    (if (ref-has? data key)
        (ref data key)
        #f))

  (define (ref*? data . path)
    (let loop ([d data] [p path])
      (cond
        [(null? p) d]
        [(not (ref-has? d (car p))) #f]
        [else (loop (ref d (car p)) (cdr p))]))))

;; ============================================================
;; (arrival srfi-123 mutable) - EXTENDS with write operations
;; ============================================================
(library (arrival srfi-123 mutable)
  (export ref ref* ~ ref? ref*? ref-has? ref-keys  ; re-export read
          ref! ref*! ~!                            ; add mutations
          register-getter-with-setter!)
  (import (arrival srfi-123)
          (arrival base mutable))

  ;; Chained mutation
  (define (ref*! data value . path)
    (if (null? (cdr path))
        (ref! data (car path) value)
        (ref*! (ref data (car path)) value (cdr path))))

  (define ~! ref*!)

  ;; SRFI-17 setter registration (for generalized set!)
  (define *setters* (make-eq-hashtable))

  (define (register-getter-with-setter! getter setter)
    (hashtable-set! *setters* getter setter))

  ;; Register our own
  (register-getter-with-setter! ref ref!)
  (register-getter-with-setter! ref* ref*!)
  (register-getter-with-setter! ~ ~!))
```

### Envpack 2: `(arrival clojure)` + `(arrival clojure mutable)`

Clojure-style keywords-as-functions and immutable semantics:

```scheme
;; ============================================================
;; (arrival clojure) - READ-ONLY + FUNCTIONAL UPDATES
;; ============================================================
(library (arrival clojure)
  (export get get-in
          assoc assoc-in update update-in  ; functional (return new)
          -> ->> some-> some->>
          select-keys keys vals)
  (import (arrival base)
          (arrival keywords))  ; for keyword? and keyword->symbol

  ;; Basic get with default
  (define (get m k . maybe-default)
    (if (ref-has? m k)
        (ref m k)
        (if (null? maybe-default) #f (car maybe-default))))

  ;; Nested get with path (vector or list)
  (define (get-in m ks . maybe-default)
    (let ([default (if (null? maybe-default) #f (car maybe-default))])
      (let loop ([data m] [path (if (vector? ks) (vector->list ks) ks)])
        (cond
          [(null? path) data]
          [(not (ref-has? data (car path))) default]
          [else (loop (ref data (car path)) (cdr path))]))))

  ;; Functional update (returns NEW structure, doesn't mutate)
  (define (assoc m k v)
    (%membrane-assoc m k v))  ; host creates new object

  (define (assoc-in m ks v)
    (let ([path (if (vector? ks) (vector->list ks) ks)])
      (if (= 1 (length path))
          (assoc m (car path) v)
          (assoc m (car path)
                 (assoc-in (get m (car path) '()) (cdr path) v)))))

  ;; Update with function (functional)
  (define (update m k f . args)
    (assoc m k (apply f (get m k) args)))

  (define (update-in m ks f . args)
    (let ([path (if (vector? ks) (vector->list ks) ks)])
      (if (= 1 (length path))
          (apply update m (car path) f args)
          (assoc m (car path)
                 (apply update-in (get m (car path) '()) (cdr path) f args)))))

  ;; Threading macros
  (define-syntax ->
    (syntax-rules ()
      [(_ x) x]
      [(_ x (f args ...) rest ...)
       (-> (f x args ...) rest ...)]
      [(_ x f rest ...)
       (-> (f x) rest ...)]))

  (define-syntax ->>
    (syntax-rules ()
      [(_ x) x]
      [(_ x (f args ...) rest ...)
       (->> (f args ... x) rest ...)]
      [(_ x f rest ...)
       (->> (f x) rest ...)]))

  ;; Short-circuit threading (stops on #f/nil)
  (define-syntax some->
    (syntax-rules ()
      [(_ x) x]
      [(_ x form rest ...)
       (let ([v x])
         (if v (some-> (-> v form) rest ...) #f))]))

  (define-syntax some->>
    (syntax-rules ()
      [(_ x) x]
      [(_ x form rest ...)
       (let ([v x])
         (if v (some->> (->> v form) rest ...) #f))]))

  ;; Utilities (read-only)
  (define (select-keys m ks)
    (fold-left (lambda (acc k)
                 (if (ref-has? m k)
                     (assoc acc k (ref m k))
                     acc))
               '() ks))

  (define (keys m) (ref-keys m))
  (define (vals m) (map (lambda (k) (ref m k)) (ref-keys m))))

;; ============================================================
;; (arrival clojure mutable) - EXTENDS with in-place mutations
;; ============================================================
(library (arrival clojure mutable)
  (export get get-in                              ; re-export read
          assoc assoc-in update update-in         ; re-export functional
          -> ->> some-> some->>                   ; re-export threading
          select-keys keys vals                   ; re-export utils
          assoc! dissoc! update! update-in!       ; add mutations
          swap! reset!)
  (import (arrival clojure)
          (arrival base mutable))

  ;; In-place mutations (modify original, return it)
  (define (assoc! m k v)
    (ref! m k v)
    m)

  (define (dissoc! m k)
    (ref-delete! m k)
    m)

  (define (update! m k f . args)
    (ref! m k (apply f (get m k) args))
    m)

  (define (update-in! m ks f . args)
    (let ([path (if (vector? ks) (vector->list ks) ks)])
      (if (= 1 (length path))
          (apply update! m (car path) f args)
          (apply update-in! (ref m (car path)) (cdr path) f args)))
    m)

  ;; Atom-like operations (for mutable containers)
  (define (swap! atom f . args)
    (let ([new-val (apply f (ref atom 'value) args)])
      (ref! atom 'value new-val)
      new-val))

  (define (reset! atom v)
    (ref! atom 'value v)
    v))
```

### Envpack 2b: `(arrival keywords)`

Callable keywords for true Clojure feel:

```scheme
(library (arrival keywords)
  (export keyword keyword? keyword->symbol keyword->string
          define-keyword-accessor)
  (import (arrival base))

  ;; Keywords are a distinct type
  (define-record-type <keyword>
    (make-keyword sym)
    keyword?
    (sym keyword->symbol))

  (define (keyword->string kw)
    (symbol->string (keyword->symbol kw)))

  ;; Reader hook: :foo -> (make-keyword 'foo)
  ;; (configured in parser)

  ;; Make keywords callable as accessors
  ;; This requires evaluator support for applying keywords
  (define (keyword-apply kw args)
    (cond
      [(= 1 (length args))
       (ref (car args) (keyword->symbol kw))]
      [(= 2 (length args))
       (ref (car args) (keyword->symbol kw) (cadr args))]
      [else
       (error "keyword: expected 1-2 arguments")]))

  ;; Register keyword type as callable
  (%register-callable-type <keyword> keyword-apply))
```

### Envpack 3: `(arrival clos)` + `(arrival clos mutable)`

Common Lisp / CLOS style:

```scheme
;; ============================================================
;; (arrival clos) - READ-ONLY
;; ============================================================
(library (arrival clos)
  (export slot-value slot-boundp with-slots)
  (import (arrival base))

  ;; Universal slot accessor (read-only)
  (define (slot-value obj slot-name)
    (unless (ref-has? obj slot-name)
      (error "slot-unbound" obj slot-name))
    (ref obj slot-name))

  ;; Predicate
  (define (slot-boundp obj slot-name)
    (ref-has? obj slot-name))

  ;; with-slots binding macro (read-only access)
  (define-syntax with-slots
    (syntax-rules ()
      [(_ (slot ...) obj body ...)
       (let ([o obj])
         (let-syntax ([slot (identifier-syntax (slot-value o 'slot))] ...)
           body ...))])))

;; ============================================================
;; (arrival clos mutable) - EXTENDS with setf and mutations
;; ============================================================
(library (arrival clos mutable)
  (export slot-value slot-boundp with-slots  ; re-export read
          setf slot-makunbound               ; add mutations
          with-slots*)                       ; mutable with-slots
  (import (arrival clos)
          (arrival base mutable))

  ;; Remove slot
  (define (slot-makunbound obj slot-name)
    (ref-delete! obj slot-name))

  ;; Generalized setf
  (define-syntax setf
    (syntax-rules (slot-value ref car cdr)
      [(_ (slot-value obj slot) value)
       (ref! obj 'slot value)]
      [(_ (ref obj key) value)
       (ref! obj key value)]
      [(_ (car pair) value)
       (set-car! pair value)]
      [(_ (cdr pair) value)
       (set-cdr! pair value)]))

  ;; with-slots that allows setf
  (define-syntax with-slots*
    (syntax-rules ()
      [(_ (slot ...) obj body ...)
       (let ([o obj])
         (let-syntax ([slot (make-variable-transformer
                              (lambda (stx)
                                (syntax-case stx (set!)
                                  [(set! _ v) #'(ref! o 'slot v)]
                                  [_ #'(slot-value o 'slot)])))] ...)
           body ...))])))
```

### Envpack 4: `(arrival records)` + `(arrival records mutable)`

Racket/R7RS style with generated accessors:

```scheme
;; ============================================================
;; (arrival records) - READ-ONLY (immutable records)
;; ============================================================
(library (arrival records)
  (export define-record-type
          record? record-type-descriptor record-ref
          record-copy)  ; functional update
  (import (arrival base))

  ;; Enhanced define-record-type - generates read-only accessors
  (define-syntax define-record-type
    (syntax-rules ()
      [(_ <name>
          (constructor field-name ...)
          predicate?
          (field accessor) ...)
       (begin
         ;; Create record type descriptor
         (define <name> (make-rtd '<name> '(field ...)))

         ;; Constructor
         (define (constructor field-name ...)
           (make-record <name> `((field . ,field-name) ...)))

         ;; Predicate
         (define (predicate? obj)
           (and (record? obj)
                (eq? (record-type-descriptor obj) <name>)))

         ;; Accessors (read-only)
         (define (accessor obj)
           (unless (predicate? obj)
             (error "type error: expected" '<name>))
           (ref obj 'field))
         ...)]))

  ;; Functional copy with changes
  (define (record-copy rec . field-values)
    (%membrane-record-copy rec field-values)))

;; ============================================================
;; (arrival records mutable) - EXTENDS with setters
;; ============================================================
(library (arrival records mutable)
  (export define-record-type                ; re-export (for convenience)
          define-record-type/mutable        ; with setters
          record? record-type-descriptor record-ref
          record-copy record-set!)
  (import (arrival records)
          (arrival base mutable))

  ;; Mutable record type - generates both accessors and setters
  (define-syntax define-record-type/mutable
    (syntax-rules ()
      [(_ <name>
          (constructor field-name ...)
          predicate?
          (field accessor setter) ...)
       (begin
         ;; Create record type descriptor
         (define <name> (make-rtd '<name> '(field ...)))

         ;; Constructor
         (define (constructor field-name ...)
           (make-record <name> `((field . ,field-name) ...)))

         ;; Predicate
         (define (predicate? obj)
           (and (record? obj)
                (eq? (record-type-descriptor obj) <name>)))

         ;; Accessors
         (define (accessor obj)
           (unless (predicate? obj)
             (error "type error: expected" '<name>))
           (ref obj 'field))

         ;; Setters
         (define (setter obj value)
           (unless (predicate? obj)
             (error "type error: expected" '<name>))
           (ref! obj 'field value))
         ...)]))

  ;; Direct mutation
  (define (record-set! rec field value)
    (ref! rec field value)))
```

### Envpack 5: `(arrival lens)` + `(arrival lens mutable)`

Functional lens/optics:

```scheme
;; ============================================================
;; (arrival lens) - READ + FUNCTIONAL UPDATES (no mutation)
;; ============================================================
(library (arrival lens)
  (export lens lens? lens-view lens-set lens-over
          lens-compose
          key-lens index-lens
          ->lens)
  (import (arrival base)
          (arrival clojure))  ; for assoc (functional)

  ;; Lens = pair of (getter . functional-setter)
  (define-record-type <lens>
    (make-lens* getter setter)
    lens?
    (getter lens-getter)
    (setter lens-setter))

  (define (lens getter setter)
    (make-lens* getter setter))

  ;; Read operation
  (define (lens-view l data)
    ((lens-getter l) data))

  ;; Functional update (returns NEW structure)
  (define (lens-set l data value)
    ((lens-setter l) data value))

  (define (lens-over l data f)
    (lens-set l data (f (lens-view l data))))

  ;; Composition (left to right)
  (define (lens-compose . lenses)
    (fold-left
     (lambda (outer inner)
       (lens
        (lambda (d) (lens-view inner (lens-view outer d)))
        (lambda (d v) (lens-set outer d (lens-set inner (lens-view outer d) v)))))
     (lens identity (lambda (d v) v))
     lenses))

  ;; Common lens constructors (functional setters)
  (define (key-lens k)
    (lens
     (lambda (d) (ref d k))
     (lambda (d v) (assoc d k v))))  ; assoc returns new structure

  (define (index-lens i)
    (lens
     (lambda (d) (ref d i))
     (lambda (d v)
       (let ([copy (vector-copy d)])
         (vector-set! copy i v)
         copy))))

  ;; Syntax for lens paths
  (define-syntax ->lens
    (syntax-rules ()
      [(_ key)
       (key-lens 'key)]
      [(_ key rest ...)
       (lens-compose (key-lens 'key) (->lens rest ...))])))

;; ============================================================
;; (arrival lens mutable) - EXTENDS with in-place mutations
;; ============================================================
(library (arrival lens mutable)
  (export lens lens? lens-view lens-set lens-over  ; re-export functional
          lens-compose key-lens index-lens ->lens
          lens-set! lens-over!                     ; add mutations
          key-lens! index-lens!)
  (import (arrival lens)
          (arrival base mutable))

  ;; In-place mutations (modify original, return value set)
  (define (lens-set! l data value)
    (let ([setter! (lens-setter! l)])
      (setter! data value)
      value))

  (define (lens-over! l data f)
    (lens-set! l data (f (lens-view l data))))

  ;; Mutable lens constructors
  (define (key-lens! k)
    (lens
     (lambda (d) (ref d k))
     (lambda (d v) (ref! d k v) d)))  ; mutates in place

  (define (index-lens! i)
    (lens
     (lambda (d) (ref d i))
     (lambda (d v) (ref! d i v) d))))
```

### Usage Examples

```scheme
;; Pick your style based on team familiarity

;; === Clojure team ===
(import (arrival clojure)
        (arrival keywords))

(define user {:name "Alice" :address {:city "Boston" :zip "02101"}})

(:name user)                          ; => "Alice"
(get-in user [:address :city])        ; => "Boston"
(-> user :address :city)              ; => "Boston"
(assoc-in user [:address :zip] "02102")  ; => new user

;; === Common Lisp team ===
(import (arrival clos))

(define person (make-person))
(slot-value person 'name)             ; => "Alice"
(setf (slot-value person 'name) "Bob")
(with-slots (name age) person
  (format #t "~a is ~a years old" name age))

;; === Haskell/FP team ===
(import (arrival lens))

(define address-city (->lens address city))
(lens-view address-city user)         ; => "Boston"
(lens-set address-city user "NYC")    ; => new user
(lens-over address-city user string-upcase)  ; => user with "BOSTON"

;; === Standard Scheme team ===
(import (arrival srfi-123))

(ref user 'name)                      ; => "Alice"
(ref* user 'address 'city)            ; => "Boston"
(~ user 'address 'city)               ; => "Boston"

;; === Mix freely ===
(import (arrival clojure)
        (arrival srfi-123)
        (arrival lens))

;; Use whatever fits the moment
(-> response
    (get-in [:data :users])
    (filter active-user?)
    (map (lens-view (->lens profile email))))
```

### Envpack Comparison Table

| Pack | Read-Only | Mutable Extension |
|------|-----------|-------------------|
| `(arrival base)` | `ref`, `ref-has?`, `ref-keys` | + `ref!`, `ref-delete!` |
| `(arrival srfi-123)` | `ref*`, `~`, `ref?`, `ref*?` | + `ref*!`, `~!`, SRFI-17 setters |
| `(arrival clojure)` | `get`, `get-in`, `assoc`*, `->` | + `assoc!`, `dissoc!`, `update!` |
| `(arrival clos)` | `slot-value`, `slot-boundp`, `with-slots` | + `setf`, `slot-makunbound` |
| `(arrival records)` | `define-record-type`, `record-copy` | + `define-record-type/mutable`, `record-set!` |
| `(arrival lens)` | `lens-view`, `lens-set`*, `lens-over`* | + `lens-set!`, `lens-over!` |

\* = functional update (returns new structure, doesn't mutate)

### API Summary by Style

| Style | Single Read | Nested Read | Functional Update | Mutation |
|-------|-------------|-------------|-------------------|----------|
| **base** | `(ref d k)` | chain manually | — | `(ref! d k v)` |
| **srfi-123** | `(ref d k)` | `(~ d k1 k2)` | — | `(~! d v k1 k2)` |
| **clojure** | `(:k d)` | `(get-in d [k1 k2])` | `(assoc d k v)` | `(assoc! d k v)` |
| **clos** | `(slot-value d 'k)` | chain manually | — | `(setf (slot-value d 'k) v)` |
| **records** | `(rec-field r)` | chain manually | `(record-copy r 'f v)` | `(set-rec-field! r v)` |
| **lens** | `(lens-view l d)` | `(->lens k1 k2)` | `(lens-set l d v)` | `(lens-set! l d v)` |

### When to Use Each

| If your team knows... | Read-Only | With Mutation |
|----------------------|-----------|---------------|
| Clojure, ClojureScript | `(arrival clojure)` | `(arrival clojure mutable)` |
| Common Lisp, CLOS | `(arrival clos)` | `(arrival clos mutable)` |
| Haskell, functional optics | `(arrival lens)` | `(arrival lens mutable)` |
| Standard Scheme, SRFI | `(arrival srfi-123)` | `(arrival srfi-123 mutable)` |
| Racket, typed records | `(arrival records)` | `(arrival records mutable)` |
| Just want minimal | `(arrival base)` | `(arrival base mutable)` |

### File Structure

```
src/
├── envpacks/
│   ├── base.scm                 # Core ref primitives (read-only)
│   ├── base-mutable.scm         # Extends base with mutations
│   ├── srfi-123.scm             # SRFI-123 ref*, ~ (read-only)
│   ├── srfi-123-mutable.scm     # Extends with ref*!, ~!
│   ├── clojure.scm              # get, get-in, assoc (functional)
│   ├── clojure-mutable.scm      # Extends with assoc!, update!
│   ├── keywords.scm             # Callable keywords
│   ├── clos.scm                 # slot-value (read-only)
│   ├── clos-mutable.scm         # Extends with setf
│   ├── records.scm              # define-record-type (immutable)
│   ├── records-mutable.scm      # Extends with setters
│   ├── lens.scm                 # Functional lenses
│   └── lens-mutable.scm         # Extends with lens-set!
│
├── membrane/
│   ├── primitives.ts            # %membrane-ref, %membrane-set, etc.
│   ├── sandbox.ts               # Sandbox boundary checking
│   └── hosts/
│       ├── javascript.ts        # JS object/array/Map handling
│       ├── python.ts            # dict/list/object handling (future)
│       └── rust.ts              # HashMap/Vec/struct handling (future)
```

### Membrane Primitives (TypeScript)

```typescript
// The actual host-touching code - everything else is pure Scheme

export const membranePrimitives = {
  '%membrane-ref': (data: SchemeValue, key: SchemeValue, maybeDefault: SchemeValue[]) => {
    const result = sandboxedAccess(data, key);
    if (result === NOT_FOUND) {
      if (maybeDefault.length > 0) return maybeDefault[0];
      throw new SchemeError(`Key not found: ${formatKey(key)}`);
    }
    return result;
  },

  '%membrane-set': (data: SchemeValue, key: SchemeValue, value: SchemeValue) => {
    sandboxedSet(data, key, value);
    return undefined;
  },

  '%membrane-has': (data: SchemeValue, key: SchemeValue): boolean => {
    return sandboxedHas(data, key);
  },

  '%membrane-keys': (data: SchemeValue): SchemeValue[] => {
    return sandboxedKeys(data);
  },

  '%membrane-delete': (data: SchemeValue, key: SchemeValue) => {
    sandboxedDelete(data, key);
    return undefined;
  },

  '%membrane-assoc': (data: SchemeValue, key: SchemeValue, value: SchemeValue) => {
    // Functional update - returns new object
    return sandboxedAssoc(data, key, value);
  },

  '%register-callable-type': (rtd: any, applier: Function) => {
    callableTypes.set(rtd, applier);
  },
};
```

---

## Sandbox Security Model

All field access goes through a security layer that enforces **own-property-only access** by default, blocking prototype chain escapes.

**See [sandbox-security-model.md](./sandbox-security-model.md) for full details.**

Summary:
- **Own properties**: Always accessible
- **Missing properties**: Return NOT_FOUND (or default)
- **Inherited from built-in prototypes**: Blocked (SandboxViolationError)
- **Custom boundaries**: Mark with `Symbol.for('scheme:sandbox-boundary')`

```scheme
(ref user 'name)        ; ✓ own property
(ref user 'email)       ; ✗ not found (or default)
(ref user 'toString)    ; ✗ SandboxViolationError - Object.prototype
(ref user 'constructor) ; ✗ SandboxViolationError - Object.prototype
```

This enables **portable data access** while preventing **sandbox escapes**.
