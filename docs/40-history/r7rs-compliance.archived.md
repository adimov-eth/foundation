---
title: R7RS compliance report (archived)
layer: history
status: verified
tags: [history, arrival, scheme]
canonical-for: []
source-provenance:
  origin: tmp/Archive/arrival/arrival-scheme/docs/R7RS-COMPLIANCE.md
  branch: origin/tmp-6164624
  retrieved: 2026-06-18
  authority: historical
last-verified: 2026-06-18
verified-against: origin/tmp-6164624
---

> ⚠️ Frozen historical copy — possibly outdated; current truth in [[arrival]].

---

# R7RS Compliance Report for arrival-scheme (LIPS)

**Generated**: December 2024
**Test Framework**: Chibi-compatible test runner
**Reference**: R7RS-small specification

## Executive Summary

Current R7RS compliance: **35.4%** (110/311 tests passing)

The arrival-scheme package is a forked and sandboxed version of LIPS Scheme. This report documents compliance with the R7RS-small specification for sandbox-safe operations (excluding I/O, filesystem, and process access).

## Compliance by Section

| Section | Passed | Total | Compliance |
|---------|--------|-------|------------|
| 4.1 Primitive expressions | 2 | 3 | 66.7% |
| 4.2 Derived expressions | 9 | 29 | 31.0% |
| 4.3 Macros | 10 | 12 | 83.3% |
| 5 Program structure | 4 | 5 | 80.0% |
| 6.1 Equivalence predicates | 5 | 10 | 50.0% |
| 6.2 Numbers | 0 | 3 | 0.0% |
| 6.3 Booleans | 10 | 15 | 66.7% |
| 6.4 Pairs and lists | 42 | 65 | 64.6% |
| 6.5 Symbols | 18 | 22 | 81.8% |
| 6.6 Characters | 0 | 57 | 0.0% |
| 6.7 Strings | 7 | 50 | 14.0% |
| 6.8 Vectors | 0 | 6 | 0.0% |
| 6.9 Bytevectors | 0 | 6 | 0.0% |
| 6.10 Control features | 3 | 9 | 33.3% |
| 6.11 Exceptions | 0 | 12 | 0.0% |
| 6.12 Environments/eval | 0 | 7 | 0.0% |

## Critical Missing Features

### Equivalence Predicates (Section 6.1)

LIPS only provides `eq?`. Missing:
- `equal?` - Recursive structural equality
- `eqv?` - Equivalence for atoms

**Impact**: High - Many Scheme programs rely on these for comparisons.

### Numbers (Section 6.2)

Missing predicates:
- `complex?`
- `real?` (partial)
- `rational?`
- `integer?`
- `exact?`, `inexact?`
- `exact-integer?`
- `finite?`, `infinite?`, `nan?`

Missing comparison functions:
- `zero?`, `positive?`, `negative?`
- `odd?`, `even?`
- `max`, `min`

Missing arithmetic:
- `abs`, `floor-quotient`, `floor-remainder`, `floor/`
- `truncate-quotient`, `truncate-remainder`, `truncate/`
- `quotient`, `remainder`, `modulo`
- `gcd`, `lcm`
- `numerator`, `denominator`
- `floor`, `ceiling`, `truncate`, `round`

Missing transcendental functions:
- `exp`, `log`, `sin`, `cos`, `tan`
- `asin`, `acos`, `atan`
- `sqrt`, `expt`

Missing complex operations:
- `make-rectangular`, `make-polar`
- `real-part`, `imag-part`
- `magnitude`, `angle`

**Impact**: Critical - Numerical computing is severely limited.

### Characters (Section 6.6)

Nearly all character functions missing:
- `char?`, `char=?`, `char<?`, `char>?`, `char<=?`, `char>=?`
- `char-ci=?`, `char-ci<?`, `char-ci>?`, `char-ci<=?`, `char-ci>=?`
- `char-alphabetic?`, `char-numeric?`, `char-whitespace?`
- `char-upper-case?`, `char-lower-case?`
- `digit-value`
- `char-upcase`, `char-downcase`, `char-foldcase`
- `char->integer`, `integer->char`

**Impact**: Critical - Character processing impossible.

### Strings (Section 6.7)

Missing:
- `make-string`, `string` (constructor from chars)
- `string-length`, `string-ref`, `string-set!`
- `string=?`, `string<?`, `string>?`, `string<=?`, `string>=?`
- `string-ci=?`, `string-ci<?`, etc.
- `substring`
- `string-append` (native)
- `string->list`, `list->string`
- `string-copy`, `string-copy!`, `string-fill!`
- `string-upcase`, `string-downcase`, `string-foldcase`

**Impact**: Critical - String manipulation limited.

### Vectors (Section 6.8)

Missing:
- `vector?`, `make-vector`, `vector`
- `vector-length`, `vector-ref`, `vector-set!`
- `vector->list`, `list->vector`
- `vector->string`, `string->vector`
- `vector-copy`, `vector-copy!`, `vector-append`, `vector-fill!`

**Impact**: High - No vector support.

### Bytevectors (Section 6.9)

All bytevector operations missing.

**Impact**: Medium - Binary data handling impossible.

### Control Features (Section 6.10)

Missing:
- `string-map`, `string-for-each`
- `vector-map`, `vector-for-each`
- Full `call-with-current-continuation` support
- `values`, `call-with-values`
- `dynamic-wind`

**Impact**: High - Advanced control flow limited.

### Exceptions (Section 6.11)

Missing:
- `with-exception-handler`
- `raise`, `raise-continuable`
- `error`
- `error-object?`, `error-object-message`, `error-object-irritants`
- `read-error?`, `file-error?`
- `guard` (only partial support)

**Impact**: High - Error handling limited.

### Derived Expressions (Section 4.2)

Missing/incomplete:
- `case` with `=>` clause
- `when`, `unless`
- `let-values`, `let*-values`
- `letrec*`
- `delay`, `force`, `delay-force`, `promise?`, `make-promise`
- `parameterize`, `make-parameter`
- `guard`
- `case-lambda`

**Impact**: High - Many common patterns unavailable.

### Program Structure (Section 5)

Missing:
- `define-values`
- `define-record-type`

**Impact**: Medium - Record types unavailable.

## Well-Supported Features

### Symbols (81.8% compliance)
Core symbol operations work correctly.

### Macros (83.3% compliance)
`syntax-rules` hygiene and basic macro expansion work well.

### Program Structure (80.0% compliance)
Basic definitions and internal definitions work.

### Pairs and Lists (64.6% compliance)
Core list operations work, though some functions missing.

## Recommendations

### Priority 1 (Critical Path)
1. Implement `equal?` and `eqv?` in LIPS core
2. Add character operations (`char?`, `char=?`, etc.)
3. Add string operations (`string-length`, `string-ref`, etc.)
4. Implement numeric predicates and basic math functions

### Priority 2 (High Value)
1. Vector support
2. `case` with full syntax
3. `when`/`unless`
4. `let-values`/`let*-values`
5. Exception handling (`guard`, `raise`)

### Priority 3 (Nice to Have)
1. Bytevector support
2. Full numeric tower (complex, rational)
3. `define-record-type`
4. Parameters (`make-parameter`, `parameterize`)

## Running the Tests

```bash
pnpm test src/__tests__/r7rs.spec.ts
```

Tests are located in `src/__tests__/r7rs/` with files organized by R7RS section.

## Test Framework

The test framework (`lib/chibi-test.scm`) implements a Chibi Scheme compatible testing library:

- `(test expected expr)` - Basic test
- `(test name expected expr)` - Named test
- `(test-begin name)` / `(test-end)` - Test groups
- `(test-assert expr)` - Boolean assertion
- `(test-error expr)` - Exception testing

This allows running standard R7RS test suites designed for Chibi Scheme.
