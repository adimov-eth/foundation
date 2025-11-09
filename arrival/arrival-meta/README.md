# @here.build/arrival-meta

**Compositional codebase exploration via catamorphisms and S-expressions**

Phase 1: F-Algebras - Write traversal once, compose analyses infinitely.

## What This Is

A codebase exploration framework where:
- **Wrong is impossible through structure** (catamorphisms enforce exhaustive traversal)
- **Composition matches reasoning** (S-expressions as substrate, not syntax)
- **Analyses compose freely** (monoid algebras combine without coordination)

Built on Arrival's Discovery/Action architecture to prevent agent fragmentation.

## Quick Start

```typescript
import { Project } from 'ts-morph';
import { cata } from '@here.build/arrival-meta';
import { countAlg, extractAlg, patternAlg } from '@here.build/arrival-meta/algebras';

const project = new Project({ tsConfigFilePath: './tsconfig.json' });
const sourceFile = project.getSourceFile('src/MyClass.ts')!;

// Count nodes - demonstrates write traversal once
const counts = cata(countAlg)(sourceFile);
console.log(counts);
// => { classes: 3, methods: 12, functions: 5, ... }

// Extract metadata - same traversal, different algebra
const metadata = cata(extractAlg)(sourceFile);
console.log(metadata.classes);
// => [{ type: 'class', name: 'MyClass', extends: ['BaseClass'], ... }]

// Find patterns - Plexus emancipation, splice operations, etc.
const patterns = cata(patternAlg)(sourceFile);
console.log(patterns.filter(p => p.type === 'plexus-model'));
// => [{ type: 'plexus-model', description: 'Task extends PlexusModel', ... }]
```

## Via S-Expressions (Discovery Tool)

Register the Discovery tool in your MCP server:

```typescript
import { CodeDiscovery } from '@here.build/arrival-meta';

// In your MCP server setup:
const discovery = new CodeDiscovery();
```

Then query compositionally via Scheme:

```scheme
; Count nodes in a file
(count-nodes "src/PlexusModel.ts")
; => 1247

; Count by type
(count-by-type "src/PlexusModel.ts")
; => {:classes 5, :methods 23, :functions 8, ...}

; Extract all classes
(find-classes "src/Task.ts")
; => [{:name "Task", :extends ["PlexusModel"], :methods ["emancipate" ...]}]

; Find patterns
(find-patterns "src/Task.ts")
; => [{:type "plexus-model", :description "Task extends PlexusModel", :confidence 1.0}
;     {:type "emancipate-call", :description "Call to emancipate method", ...}]

; Filter patterns by type
(find-pattern-type "src/Task.ts" "plexus-model")
; => [{:type "plexus-model", ...}]

; High confidence patterns only
(find-high-confidence-patterns "src/Task.ts" 0.8)
; => [patterns with confidence >= 0.8]

; Build dependency graph
(dependency-graph "src/index.ts")
; => {:edges [...], :modules [...]}

; Find circular dependencies
(find-cycles "src/index.ts")
; => [["moduleA" "moduleB" "moduleA"]]

; Build type graph
(type-graph "src/types.ts")
; => {:types [...], :relations [...]}

; Find all subtypes of a type
(find-subtypes "src/PlexusModel.ts" "PlexusModel")
; => ["Task" "Team" "Project" ...]

; Get inheritance hierarchy
(inheritance-hierarchy "src/Task.ts" "Task")
; => ["Task" "PlexusModel" "Model" "Object"]
```

### Compositional Queries

The power is in composition:

```scheme
; Find all PlexusModel subclasses with emancipate patterns
(let ((models (find-classes "src/models.ts"))
      (patterns (find-patterns "src/models.ts")))
  (filter (lambda (m)
            (and (member "PlexusModel" (@ m :extends))
                 (> (length (filter (lambda (p)
                                      (and (= (@ p :type) "emancipate-call")
                                           (= (@ (@ p :location) :className) (@ m :name))))
                                    patterns))
                    0)))
          models))

; Count methods per class
(map (lambda (c) (cons (@ c :name) (length (@ c :methods))))
     (find-classes "src/models.ts"))
; => [("Task" . 5) ("Team" . 3) ("Project" . 7)]

; Find classes with circular dependencies
(let ((classes (find-classes "src/index.ts"))
      (cycles (find-cycles "src/index.ts")))
  (filter (lambda (c)
            (> (length (filter (lambda (cycle) (member (@ c :name) cycle))
                               cycles))
               0))
          classes))
```

## The Catamorphism Pattern

A **catamorphism** is a generalized fold over recursive data structures.

### Why Catamorphisms?

**Traditional approach:** Write recursive traversal for each analysis
```typescript
function countClasses(node: Node): number {
  if (ts.isClassDeclaration(node)) {
    return 1 + node.members.reduce((sum, m) => sum + countClasses(m), 0);
  }
  if (ts.isMethodDeclaration(node)) {
    return node.body ? countClasses(node.body) : 0;
  }
  // ... 50 more node types ...
  return node.getChildren().reduce((sum, c) => sum + countClasses(c), 0);
}
```

**Catamorphism approach:** Write traversal once, define algebras
```typescript
// Generic traversal (write once)
const cata = <A>(alg: CodeAlg<A>) => (node: Node): A => { /* ... */ };

// Count algebra (20 lines)
const countAlg: CodeAlg<number> = {
  ClassDecl: (_, heritage, members, typeParams) => 1 + sum(heritage) + sum(members) + sum(typeParams),
  MethodDecl: (_, params, returnType, body) => 1 + sum(params) + (returnType ?? 0) + (body ?? 0),
  // ... only the interesting cases
  Other: (_, children) => sum(children),
};

const count = cata(countAlg);
```

### The Algebra Type

```typescript
type CodeAlg<A> = {
  // Declarations
  ClassDecl: (name: string, heritage: A[], members: A[], typeParams: A[]) => A;
  InterfaceDecl: (name: string, heritage: A[], members: A[], typeParams: A[]) => A;
  MethodDecl: (name: string, params: A[], returnType: A | null, body: A | null) => A;
  // ... more cases
  Other: (kind: SyntaxKind, children: A[]) => A;  // catch-all
};
```

Each case receives:
- **Relevant data** from the node (names, modifiers, etc.)
- **Already-computed results** from children (type `A`)

Returns:
- **Result of type `A`**

The catamorphism handles ALL recursion. You just describe what to compute at each node.

## Five Algebras

### 1. Count Algebra

**Type:** `CodeAlg<Counts>`

**What it does:** Counts nodes by type

```typescript
type Counts = {
  classes: number;
  interfaces: number;
  methods: number;
  properties: number;
  functions: number;
  imports: number;
  exports: number;
  callExprs: number;
  total: number;
};

const counts = cata(countAlg)(sourceFile);
```

**Scheme:** `(count-by-type "path/to/file.ts")`

### 2. Extract Algebra

**Type:** `CodeAlg<Metadata>`

**What it does:** Extracts structured metadata

```typescript
type Metadata = {
  classes: ClassMeta[];
  interfaces: InterfaceMeta[];
  functions: FunctionMeta[];
  imports: ImportMeta[];
  exports: ExportMeta[];
  typeNames: string[];
};

const metadata = cata(extractAlg)(sourceFile);
```

**Scheme:**
- `(extract-metadata "file.ts")` - full metadata
- `(find-classes "file.ts")` - just classes
- `(find-interfaces "file.ts")` - just interfaces

### 3. Pattern Detection Algebra

**Type:** `CodeAlg<Patterns>`

**What it does:** Finds code patterns (Plexus emancipation, splice operations, etc.)

```typescript
type Pattern = {
  type: string;
  description: string;
  location: { className?: string; methodName?: string };
  confidence: number;  // 0-1
};

const patterns = cata(patternAlg)(sourceFile);
```

**Patterns detected:**
- `plexus-model` - Classes extending PlexusModel
- `emancipate-call` - Calls to emancipate methods
- `array-splice` - Array splice operations (potential emancipation)
- `parent-assignment` - Parent assignments (potential adoption)

**Scheme:**
- `(find-patterns "file.ts")` - all patterns
- `(find-pattern-type "file.ts" "plexus-model")` - specific type
- `(find-high-confidence-patterns "file.ts" 0.8)` - confidence threshold

### 4. Dependency Graph Algebra

**Type:** `CodeAlg<DependencyGraph>`

**What it does:** Builds module dependency graph

```typescript
type DependencyGraph = {
  edges: Dependency[];
  modules: Set<string>;
};

const graph = cata(dependencyAlg(currentModule))(sourceFile);
const cycles = findCycles(graph);
const sorted = topologicalSort(graph);
```

**Scheme:**
- `(dependency-graph "file.ts")` - build graph
- `(find-cycles "file.ts")` - find circular deps
- `(topological-sort "file.ts")` - dependency order
- `(deps-to-dot "file.ts")` - Graphviz visualization

### 5. Type Relationships Algebra

**Type:** `CodeAlg<TypeGraph>`

**What it does:** Tracks type inheritance and usage

```typescript
type TypeGraph = {
  types: Map<string, TypeInfo>;
  relations: TypeRelation[];
};

const graph = cata(typeAlg)(sourceFile);
const subtypes = findSubtypes(graph, 'PlexusModel');
const hierarchy = getInheritanceHierarchy(graph, 'Task');
```

**Scheme:**
- `(type-graph "file.ts")` - build graph
- `(find-subtypes "file.ts" "PlexusModel")` - all subtypes
- `(inheritance-hierarchy "file.ts" "Task")` - full hierarchy
- `(type-graph-to-dot "file.ts")` - Graphviz visualization

## Composing Algebras

All algebras are **monoids**, so they compose naturally:

```typescript
// Run multiple analyses in parallel (future optimization)
const combined = combineAlgebras(countAlg, extractAlg, patternAlg);
const results = cata(combined)(sourceFile);
// => { counts: {...}, metadata: {...}, patterns: [...] }
```

In Scheme, just call them sequentially - the Discovery sandbox is sandboxed, no side effects:

```scheme
(list
  (count-by-type "file.ts")
  (extract-metadata "file.ts")
  (find-patterns "file.ts"))
```

## Architectural Guarantees

### Wrong is Impossible Through Structure

**Exhaustive coverage:** The `CodeAlg<A>` type requires handling all node types. Missing a case? **Compile error.**

**No accidental execution:** Discovery tool runs in sandboxed Scheme. Exploration can't trigger mutations.

**Context immutability:** (Future Action tool) All actions validated upfront, context frozen during batch.

**Type safety:** Catamorphisms maintain types throughout. No `any`, no casts, no runtime type errors.

### Composition Matches Reasoning

When you think "find classes extending PlexusModel", that thought maps to:

```scheme
(filter (lambda (c) (member "PlexusModel" (@ c :extends)))
        (find-classes "file.ts"))
```

Not to imperative loops, not to JSON query builders, not to method chaining that loses type information.

**S-expressions are the compositional substrate** - they ARE thought, not data about thought.

## Future Phases

See [docs/vision/compositional-exploration.md](./docs/vision/compositional-exploration.md) for the complete architecture.

### Phase 2: E-Graphs
- Equality saturation for pattern finding
- Declarative rewrite rules
- Cost-based extraction

### Phase 3: Hypergraphs
- Algebraic DSL for n-ary relationships
- Compositional graph construction
- Fold-based interpretation

### Phase 4: Tagless-Final
- Single query definition
- Multiple interpreters (execute, explain, optimize, cost)

### Phase 5: Algebraic Effects
- Extensible operations via generators
- Swappable handlers (real, test, record/replay)

### Phase 6: Action Tool
- Batched refactorings
- Context immutability
- Structural guarantees for mutations

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

See [src/__tests__/demo.test.ts](./src/__tests__/demo.test.ts) for working examples of:
- Counting nodes
- Extracting metadata
- Finding patterns
- Building dependency graphs
- Analyzing type relationships
- Composing multiple analyses

## License

See [LICENSE.md](../../LICENSE.md) - Future MIT (effective 2027-01-01)

## References

- **Catamorphisms:** Meijer, Fokkinga, Paterson (1991) - "Functional Programming with Bananas, Lenses, Envelopes and Barbed Wire"
- **Arrival Architecture:** [arrival/arrival/README.md](../arrival/README.md)
- **Fragmentation Hypothesis:** [docs/research/fragmentation-hypothesis.md](../../docs/research/fragmentation-hypothesis.md)
- **Vision Document:** [docs/vision/compositional-exploration.md](./docs/vision/compositional-exploration.md)
