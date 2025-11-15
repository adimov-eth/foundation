# @here.build/periphery

**Compositional codebase exploration via catamorphisms**

Exposes the compositional substrate - users compose queries, not pre-baked wrappers.

## Philosophy

- **Primitives, not wrappers**: Expose `cata` + algebras, let users compose
- **Write traversal once**: Catamorphisms handle ALL recursion
- **Composition in Scheme**: Define helpers as needed, don't hide the structure
- **Wrong is impossible**: Exhaustive traversal, type safety, structural guarantees

From 44 opaque functions → 18 compositional primitives. Users write their own queries.

## Quick Start

```typescript
import { Project } from 'ts-morph';
import { cata } from '@here.build/periphery';
import { countAlg, extractAlg } from '@here.build/periphery/algebras';

const project = new Project({ tsConfigFilePath: './tsconfig.json' });
const sourceFile = project.getSourceFile('src/MyClass.ts')!;

// Run catamorphisms
const counts = cata(countAlg)(sourceFile);
const metadata = cata(extractAlg)(sourceFile);

console.log(counts);
// => { classes: 3, methods: 12, functions: 5, total: 234 }

console.log(metadata.classes);
// => [{ type: 'class', name: 'MyClass', extends: ['BaseClass'], methods: [...] }]
```

## Via S-Expressions (MCP Discovery Tool)

The real power: compositional queries in Scheme.

### Core Primitives

```scheme
; Parse file to AST (cached)
(parse-file "src/Task.ts")

; Run catamorphism with algebra
(cata 'extract (parse-file "file.ts"))
(cata 'count (parse-file "file.ts"))
(cata 'patterns (parse-file "file.ts"))
(cata 'types (parse-file "file.ts"))

; Dependencies needs file path
(cata-with-path 'dependencies "file.ts" (parse-file "file.ts"))
```

### Available Algebras

**'extract** - Structured metadata
```scheme
(cata 'extract (parse-file "file.ts"))
; => {:classes [...] :interfaces [...] :functions [...] :imports [...] :exports [...]}
```

**'count** - Node counts
```scheme
(cata 'count (parse-file "file.ts"))
; => {:classes 3 :interfaces 2 :methods 12 :functions 8 :total 234}
```

**'patterns** - Code patterns (Plexus emancipation, etc.)
```scheme
(cata 'patterns (parse-file "file.ts"))
; => [{:type "plexus-model" :description "..." :confidence 1.0} ...]
```

**'types** - Type relationships
```scheme
(cata 'types (parse-file "file.ts"))
; => {:types [...] :relations [...]}
```

**'dependencies** - Module dependency graph
```scheme
(cata-with-path 'dependencies "file.ts" (parse-file "file.ts"))
; => {:edges [...] :modules [...]}
```

### Compositional Queries

Define your own helpers. Compose primitives. No wrappers needed.

```scheme
; Define helper - get classes from file
(define (classes file-path)
  (@ (cata 'extract (parse-file file-path)) :classes))

; Use it
(classes "src/Task.ts")

; Count classes in file
(length (classes "src/models.ts"))

; Find PlexusModel subclasses
(filter
  (lambda (c) (member "PlexusModel" (@ c :extends)))
  (classes "src/models.ts"))

; Get class names only
(map
  (lambda (c) (@ c :name))
  (classes "src/models.ts"))

; Classes with specific method
(filter
  (lambda (c) (member "emancipate" (@ c :methods)))
  (classes "src/models.ts"))
```

### Multi-file Analysis

```scheme
; Analyze all files in directory
(define files (list-files "src/**/*.ts"))

; Count total classes across all files
(reduce
  (lambda (acc file)
    (+ acc (@ (cata 'count (parse-file file)) :classes)))
  0
  files)

; Find all files with classes extending PlexusModel
(filter
  (lambda (file)
    (let ((classes (@ (cata 'extract (parse-file file)) :classes)))
      (> (length (filter
                   (lambda (c) (member "PlexusModel" (@ c :extends)))
                   classes))
         0)))
  files)
```

### Hypergraph Composition

```scheme
; Build graphs from metadata
(define file (parse-file "src/models.ts"))
(define meta (cata 'extract file))

; Create inheritance graph
(define inheritance (build-inheritance-graph meta))

; Create call graph
(define calls (build-call-graph meta))

; Compose graphs
(define combined (overlay-graphs inheritance calls))

; Analyze
(hypergraph-metrics combined)
; => {:vertices [...] :edges 15 :density 0.42}

; Visualize
(hypergraph-to-dot combined)
; => DOT format for Graphviz

; Find cycles
(hypergraph-cycles combined)

; Check paths
(hypergraph-path-exists combined "Task" "PlexusModel")
; => true
```

### Real-World Examples

**Find complex files:**
```scheme
(define files (list-files "src/**/*.ts"))

(filter
  (lambda (file)
    (> (@ (cata 'count (parse-file file)) :total) 200))
  files)
```

**Analyze dependency structure:**
```scheme
(define deps (cata-with-path 'dependencies "src/index.ts"
                             (parse-file "src/index.ts")))

; Find circular dependencies
(define cycles (@ deps :modules))
(if (> (length cycles) 0)
    (print "Warning: circular dependencies found")
    (print "Clean dependency graph"))
```

**Build class hierarchy:**
```scheme
(define (class-hierarchy file-path)
  (let* ((meta (cata 'extract (parse-file file-path)))
         (hg (build-inheritance-graph meta))
         (dot (hypergraph-to-dot hg)))
    dot))

; Save to file, then: dot -Tpng graph.dot -o hierarchy.png
(class-hierarchy "src/models.ts")
```

## Filesystem Primitives

```scheme
; List files
(list-files "src/**/*.ts")

; Read file content
(read-file "src/config.ts")

; Get file stats
(file-stats "src/index.ts")
; => {:size 1234 :modified "2025-01-15T..." :isFile true}
```

## The Catamorphism Pattern

A **catamorphism** is a generalized fold over recursive structures.

### Why?

**Without catamorphisms:**
- Write recursive traversal for each analysis
- 200+ lines per analysis
- Easy to miss edge cases
- No composition

**With catamorphisms:**
- Write traversal ONCE (300 lines)
- Each algebra: 20-150 lines
- Exhaustive by construction
- Algebras compose freely

### The Algebra Type

```typescript
type CodeAlg<A> = {
  ClassDecl: (name: string, heritage: A[], members: A[], typeParams: A[]) => A;
  MethodDecl: (name: string, params: A[], returnType: A | null, body: A | null) => A;
  // ... more cases
  Other: (kind: SyntaxKind, children: A[]) => A;
};
```

Each case receives:
- Relevant data from the node
- Already-computed results from children (type `A`)

Returns: Result of type `A`

The catamorphism handles ALL recursion. You describe what to compute at each node.

### Example: Count Algebra

```typescript
const countAlg: CodeAlg<Counts> = monoidAlg(
  emptyCounts,
  combineCounts,
  {
    ClassDecl: (_, heritage, members, typeParams) => ({
      ...combineCounts(heritage, members, typeParams),
      classes: 1,
    }),
    MethodDecl: (_, params, returnType, body) => ({
      ...combineCounts([params, returnType, body]),
      methods: 1,
    }),
    // Other cases...
  }
);
```

## Available Algebras

1. **Count** - `countAlg` - Counts nodes by type
2. **Extract** - `extractAlg` - Extracts structured metadata
3. **Patterns** - Pattern detection (Plexus emancipation, etc.)
4. **Dependencies** - Module dependency graph
5. **Types** - Type inheritance graph

Each algebra is 20-150 lines. Infinitely composable.

## Hypergraphs

Compositional graph construction with multiple interpretations.

```typescript
import { overlay, connect, hypergraphToDOT, toCycles } from '@here.build/periphery';

// Build graphs
const inheritance = metadataToInheritanceGraph(metadata);
const calls = metadataToCallGraph(metadata);

// Compose
const combined = overlay(inheritance, calls);

// Interpret
const dot = hypergraphToDOT(combined);
const cycles = toCycles(combined);
const metrics = hypergraphMetrics(combined);
```

Five interpreters:
1. **toDOT** - Graphviz visualization
2. **toAdjacency** - Adjacency list
3. **toMetrics** - Graph statistics
4. **toCycles** - Circular dependency detection
5. **toPathChecker** - Reachability queries

One graph definition, multiple interpretations.

## Architectural Guarantees

### Wrong is Impossible Through Structure

**Exhaustive coverage**: `CodeAlg<A>` requires handling all node types. Missing a case? Compile error.

**No accidental execution**: Discovery runs in sandboxed Scheme. Exploration can't trigger mutations.

**Type safety**: Catamorphisms maintain types throughout. No `any`, no casts.

### Composition Matches Reasoning

When you think "find classes extending PlexusModel", write:

```scheme
(filter (lambda (c) (member "PlexusModel" (@ c :extends)))
        (@ (cata 'extract (parse-file "file.ts")) :classes))
```

Not imperative loops. Not JSON query builders. Direct mapping from thought to code.

**S-expressions are the compositional substrate** - they ARE thought, not syntax.

## Development

```bash
# Install
pnpm install

# Build
pnpm run build

# Test
pnpm test

# Type check
pnpm run typecheck
```

## Examples

See working demos:
```bash
npx tsx demo-hypergraph.ts
npx tsx demo-plexus.ts
```

## Migration from Old API

Old (opaque wrappers):
```scheme
(find-classes "file.ts")
(extract-metadata "file.ts")
(count-by-type "file.ts")
```

New (compositional primitives):
```scheme
(@ (cata 'extract (parse-file "file.ts")) :classes)
(cata 'extract (parse-file "file.ts"))
(cata 'count (parse-file "file.ts"))
```

Define helpers as needed:
```scheme
(define (find-classes file)
  (@ (cata 'extract (parse-file file)) :classes))

(define (count-by-type file)
  (cata 'count (parse-file file)))
```

Now you see HOW it works. Composition is explicit. No magic.

## License

See [LICENSE.md](../../LICENSE.md) - Future MIT (effective 2027-01-01)

## References

- **Catamorphisms:** Meijer, Fokkinga, Paterson (1991) - "Functional Programming with Bananas, Lenses, Envelopes and Barbed Wire"
- **Arrival Architecture:** [arrival/arrival/README.md](../arrival/README.md)
- **Vision Document:** [docs/vision/compositional-exploration.md](./docs/vision/compositional-exploration.md)
