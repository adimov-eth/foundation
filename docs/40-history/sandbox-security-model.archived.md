---
title: Sandbox security model (archived)
layer: history
status: verified
tags: [history, arrival, membrane, security]
canonical-for: []
source-provenance:
  origin: tmp/Archive/arrival/arrival-scheme/docs/sandbox-security-model.md
  branch: origin/tmp-6164624
  retrieved: 2026-06-18
  authority: historical
last-verified: 2026-06-18
verified-against: origin/tmp-6164624
---

> ⚠️ Frozen historical copy — possibly outdated; current truth in [[membrane]] and [[security-by-deletion]].

---

# Sandbox Security Model: Portable Primitives, Isolated Natives

## Philosophy

Arrival Scheme provides **access to data primitives** that exist across all host languages while **blocking access to host-specific native methods** that could break sandbox isolation.

```
┌─────────────────────────────────────────────────────────────────┐
│                    What Scheme Code Can Access                  │
├─────────────────────────────────────────────────────────────────┤
│  ✓ Own properties/fields     (user.name, dict["key"])          │
│  ✓ Array/vector indices      (arr[0], vec.ref(i))              │
│  ✓ Record/struct fields      (point.x, person.age)             │
│  ✓ Map/dict entries          (map.get(k), dict[k])             │
├─────────────────────────────────────────────────────────────────┤
│                  What Scheme Code Cannot Access                 │
├─────────────────────────────────────────────────────────────────┤
│  ✗ Object.prototype methods  (toString, constructor, etc.)     │
│  ✗ Array.prototype methods   (push, pop, map, filter, etc.)    │
│  ✗ Any built-in prototype    (String, Number, Function, etc.)  │
│  ✗ Custom sandbox boundaries (marked classes/objects)          │
└─────────────────────────────────────────────────────────────────┘
```

## The Problem

Every host language has a prototype/class hierarchy that Scheme code shouldn't touch:

**JavaScript:**
```javascript
const user = { name: "Alice" };
user.toString        // → inherited from Object.prototype
user.constructor     // → can create new objects!
user.__proto__       // → direct prototype access
user.hasOwnProperty  // → inherited method
```

**Python:**
```python
user = {"name": "Alice"}
user.__class__       # → can inspect/modify class
user.__dict__        # → raw attribute access
type(user)           # → metaclass access
```

**Rust (via FFI):**
```rust
// Even "safe" Rust can expose internal methods
impl User {
    pub fn internal_debug(&self) { ... }  // shouldn't be callable
}
```

If Scheme code can access these, it can:
1. Escape the sandbox via `constructor`
2. Pollute prototypes affecting other code
3. Inspect internal implementation details
4. Call methods that bypass security checks

## The Solution: Own-Property-Only Access

Arrival Scheme's membrane enforces a simple rule:

> **You can only access what was explicitly put on the object.**

This is the intersection of what's portable across languages:

| Concept | JavaScript | Python | Rust | Scheme |
|---------|------------|--------|------|--------|
| Own field | `obj.x` | `obj["x"]` | `obj.x` | `(ref obj 'x)` |
| Dict entry | `map.get(k)` | `d[k]` | `map.get(&k)` | `(ref m k)` |
| Array index | `arr[i]` | `lst[i]` | `vec[i]` | `(ref v i)` |
| **Inherited method** | `obj.toString()` | `obj.__str__()` | `obj.to_string()` | **BLOCKED** |

## Access Rules

### Rule 1: Own Properties Are Accessible

```scheme
(define user (host-object "name" "Alice" "age" 30))

(ref user 'name)   ; ✓ "Alice" - own property
(ref user 'age)    ; ✓ 30 - own property
(ref-keys user)    ; ✓ ("name" "age") - only own keys
```

### Rule 2: Missing Properties Return NOT_FOUND

```scheme
(ref user 'email)        ; raises "key not found"
(ref user 'email "n/a")  ; returns "n/a" (default)
(ref? user 'email)       ; returns #f
(ref-has? user 'email)   ; returns #f
```

### Rule 3: Inherited Properties Are Blocked

```scheme
;; All of these raise SandboxViolationError:
(ref user 'toString)
(ref user 'constructor)
(ref user 'hasOwnProperty)
(ref user '__proto__)
(ref user 'prototype)

;; Even checking existence is blocked:
(ref-has? user 'toString)  ; raises SandboxViolationError
```

### Rule 4: Mutations Create Own Properties

```scheme
;; Setting always creates/updates an OWN property
(ref! user 'email "alice@example.com")

;; This shadows any inherited property - safe
(ref! user 'toString "my own toString")
(ref user 'toString)  ; ✓ "my own toString" - now it's own
```

### Rule 5: Enumeration Returns Only Own Keys

```scheme
(ref-keys user)
; => ("name" "age" "email" "toString")
; Never includes inherited keys like "constructor", "hasOwnProperty", etc.
```

## Sandbox Boundaries

### Built-in Boundaries

These are always blocked - no configuration needed:

- `Object.prototype`
- `Array.prototype`
- `Function.prototype`
- `String.prototype`
- `Number.prototype`
- `Boolean.prototype`
- `RegExp.prototype`
- `Date.prototype`
- `Map.prototype`
- `Set.prototype`
- `Promise.prototype`
- `Error.prototype`

### Custom Boundaries

Mark any class or object as a sandbox boundary:

```typescript
// TypeScript/JavaScript
const SANDBOX_BOUNDARY = Symbol.for('scheme:sandbox-boundary');

// Mark a class - instances won't leak methods to inheritors
class SecureAPI {
  static [SANDBOX_BOUNDARY] = true;

  internalMethod() {
    // Scheme code inheriting from SecureAPI can't call this
  }
}

// Mark an object
const config = {
  [SANDBOX_BOUNDARY]: true,
  secretKey: "...",
};
```

```python
# Python
class SecureAPI:
    __sandbox_boundary__ = True

    def internal_method(self):
        # Blocked from Scheme
        pass
```

### Inheritance Across Boundaries

```
┌─────────────────────────────────────────────────┐
│  Object.prototype  [BOUNDARY]                   │
│    toString, constructor, hasOwnProperty, ...   │
├─────────────────────────────────────────────────┤
          ▲ blocked
┌─────────────────────────────────────────────────┐
│  SecureAPI.prototype  [BOUNDARY]                │
│    internalMethod, sensitiveData, ...           │
├─────────────────────────────────────────────────┤
          ▲ blocked
┌─────────────────────────────────────────────────┐
│  UserDefinedClass.prototype                     │
│    customMethod, userField, ...                 │
├─────────────────────────────────────────────────┤
          ▲ allowed (not a boundary)
┌─────────────────────────────────────────────────┐
│  instance                                       │
│    name: "Alice", age: 30                       │
└─────────────────────────────────────────────────┘

(ref instance 'name)         ; ✓ own property
(ref instance 'customMethod) ; ✓ inherited from UserDefinedClass
(ref instance 'internalMethod) ; ✗ blocked at SecureAPI boundary
(ref instance 'toString)     ; ✗ blocked at Object boundary
```

## What This Enables

### 1. Safe Data Manipulation

Migration scripts can work with host data without risk:

```scheme
(define users (fetch-users-from-db))

;; Safe iteration - only sees own properties
(for-each
  (lambda (user)
    (let ([name (ref user 'name)]
          [email (ref user 'email)])
      (migrate-user name email)))
  users)
```

### 2. Portable Code

Same Scheme code works on any host:

```scheme
;; This works identically on JS, Python, Rust
(define (get-full-name person)
  (string-append
    (ref person 'first-name)
    " "
    (ref person 'last-name)))
```

### 3. Defense in Depth

Even if Scheme code is malicious, it can't:

```scheme
;; Try to escape sandbox - all blocked:
(ref global 'eval)           ; ✗ SandboxViolationError
(ref obj 'constructor)       ; ✗ SandboxViolationError
(ref fn 'call)               ; ✗ SandboxViolationError
(ref arr 'push)              ; ✗ SandboxViolationError

;; Try to inspect internals - blocked:
(ref obj '__proto__)         ; ✗ SandboxViolationError
(ref cls 'prototype)         ; ✗ SandboxViolationError
```

### 4. Controlled Exposure

Host can explicitly expose safe operations:

```scheme
;; Host provides these as Scheme procedures, not object methods
(define (array-map fn arr) ...)      ; safe wrapper
(define (string-upcase s) ...)       ; safe wrapper
(define (json-parse str) ...)        ; safe wrapper

;; Scheme code uses procedures, not methods
(array-map transform users)          ; ✓ works
(ref users 'map)                     ; ✗ blocked
```

## Implementation Summary

```typescript
function sandboxedAccess(data: unknown, key: string | symbol): unknown {
  // 1. Own property? Return it.
  if (hasOwnProperty(data, key)) {
    return data[key];
  }

  // 2. Not in object at all? NOT_FOUND.
  if (!(key in data)) {
    return NOT_FOUND;
  }

  // 3. Inherited - trace prototype chain
  let proto = getPrototypeOf(data);
  while (proto !== null) {
    // Hit boundary? Block access.
    if (isSandboxBoundary(proto)) {
      throw new SandboxViolationError(
        `Cannot access '${key}' - blocked at sandbox boundary`
      );
    }

    // Found on non-boundary prototype? Allow.
    if (hasOwnProperty(proto, key)) {
      return data[key];
    }

    proto = getPrototypeOf(proto);
  }

  return NOT_FOUND;
}
```

## Summary

| Principle | Implementation |
|-----------|----------------|
| **Portable primitives** | `ref`, `ref!`, `ref-keys` work on any host's data |
| **No native methods** | Prototype chain access blocked at boundaries |
| **Explicit exposure** | Host wraps safe operations as Scheme procedures |
| **Custom isolation** | Mark sensitive classes with `scheme:sandbox-boundary` |
| **Defense in depth** | Even inherited properties are checked, not just own |

The result: Scheme code that's **powerful enough to manipulate data** but **isolated from host internals**.
