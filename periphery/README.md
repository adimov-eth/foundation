# @here.build/periphery

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
import { cata } from '@here.build/periphery';
import { countAlg, extractAlg, patternAlg } from '@here.build/periphery/algebras';

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

## Demos

See working examples on real code:

```bash
# Run hypergraph demo on actual codebase
npx tsx demo-hypergraph.ts

# Run PlexusModel hierarchy composition demo
npx tsx demo-plexus.ts
```

Both demos show:
- Catamorphism-based metadata extraction
- AST → HyperGraph conversion
- Graph composition (overlay/connect)
- All 5 interpreters in action
- Compositional queries

## Via S-Expressions (Discovery Tool)

Register the Discovery tool in your MCP server:

```typescript
import { Discover } from '@here.build/periphery';

// In your MCP server setup:
const discovery = new Discover();
```

**Path Handling**: All functions accept both relative and absolute paths. Relative paths are resolved against the project root (configurable via `state.projectRoot`, defaults to `process.cwd()`).

Then query compositionally via Scheme:

```scheme
; Relative paths (most intuitive for you)
(count-nodes "src/PlexusModel.ts")
(list-files "arrival/*/src/*.ts")
(find-classes "plexus/plexus/src/PlexusModel.ts")

; Absolute paths also work
(count-nodes "/Users/you/project/src/index.ts")

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

## Action Tool (Safe Mutations)

Register the Action tool for safe, atomic refactorings:

```typescript
import { Act } from '@here.build/periphery';

// In your MCP server setup:
const actionTool = new Act();
```

**Auto-discovery**: No `projectPath` needed - automatically discovers nearest `tsconfig.json` from file paths. Works across multiple packages in monorepo.

**Available actions via MCP:**

```typescript
// Format file
mcp__periphery__act({
  actions: [
    ["format-file", "src/file.ts"]
  ]
})

// Rename symbol (declaration + all references)
mcp__periphery__act({
  actions: [
    ["rename-symbol", "src/file.ts", "oldName", "newName"]
  ]
})

// Add import with deduplication
mcp__periphery__act({
  actions: [
    ["add-import", "src/file.ts", "path", ["resolve", "join"], ""]
    //              file            module   named imports      default
  ]
})

// Remove unused imports
mcp__periphery__act({
  actions: [
    ["remove-unused-imports", "src/file.ts"]
  ]
})

// Batch multiple actions (atomic - all validate before any execute)
mcp__periphery__act({
  actions: [
    ["format-file", "periphery/src/hypergraph.ts"],
    ["format-file", "plexus/plexus/src/Plexus.ts"],
    ["add-import", "src/file.ts", "path", ["dirname"], ""]
  ]
})
```

**Key features:**
- **Cross-package batches** - Works across multiple packages in monorepo
- **Path resolution** - Relative paths resolved from workspace root (detected via `.git` or `pnpm-workspace.yaml`)
- **Multi-project support** - Maintains separate ts-morph instances per package
- **Atomic validation** - All actions validated upfront, if any fails, none execute

See [src/__tests__/act.test.ts](./src/__tests__/act.test.ts) for examples with observable effects.

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

## Phase 3: Hypergraphs

**Status:** ✅ Complete

Hypergraphs enable **compositional graph construction** where AST analyses are converted to graph structures that can be composed, queried, and interpreted multiple ways.

### What Are Hypergraphs?

A **hypergraph** is a graph where edges can connect multiple vertices (n-ary relationships). We implement them as a **free algebra**:

```typescript
type HyperGraph =
  | { tag: 'Empty' }
  | { tag: 'Vertex'; v: string }
  | { tag: 'Edge'; vs: string[] }        // n-ary edge
  | { tag: 'Overlay'; l: HyperGraph; r: HyperGraph }  // union
  | { tag: 'Connect'; l: HyperGraph; r: HyperGraph }; // cross-product
```

### Smart Constructors

```typescript
import { empty, vertex, edge, overlay, connect } from '@here.build/periphery';

// Basic construction
const v = vertex('Task');
const e = edge('Task', 'PlexusModel');  // Task → PlexusModel

// Composition
const inheritance = edges([
  ['Task', 'PlexusModel'],
  ['Team', 'PlexusModel'],
  ['Project', 'PlexusModel']
]);

const calls = edges([
  ['Task', 'Team'],
  ['Team', 'Task']
]);

// Overlay combines graphs (union)
const combined = overlay(inheritance, calls);

// Connect creates cross-product (all left → all right)
const hierarchical = connect(
  vertices(['Task', 'Team']),
  vertex('PlexusModel')
);
```

### Five Interpreters

One graph definition, five interpretations via `foldHG`:

#### 1. toAdjacency - Execute as Data Structure

```typescript
import { hypergraphToAdjacency } from '@here.build/periphery';

const hg = edges([['a', 'b'], ['b', 'c']]);
const adj = hypergraphToAdjacency(hg);
// => Map { 'a' => Set{'b'}, 'b' => Set{'c'}, 'c' => Set{} }
```

**Scheme:** `(hypergraph-to-adjacency hg)`

#### 2. toMetrics - Graph Statistics

```typescript
import { hypergraphMetrics } from '@here.build/periphery';

const metrics = hypergraphMetrics(hg);
// => { vertices: Set{'a','b','c'}, edges: 2, hyperEdges: 0, density: 0.33 }
```

**Scheme:** `(hypergraph-metrics hg)`

#### 3. toDOT - Graphviz Visualization

```typescript
import { hypergraphToDOT } from '@here.build/periphery';

const dot = hypergraphToDOT(hg, 'MyGraph');
// => "digraph MyGraph {\n  \"a\" -> \"b\";\n  \"b\" -> \"c\";\n}"
```

**Scheme:** `(hypergraph-to-dot hg)`

Then: `dot -Tpng graph.dot -o graph.png`

#### 4. toCycles - Circular Dependency Detection

```typescript
import { toCycles } from '@here.build/periphery';

const cycles = toCycles(hg);
// => [['a', 'b', 'c', 'a']] if circular
```

**Scheme:** `(hypergraph-cycles hg)`

#### 5. toPathChecker - Reachability Queries

```typescript
import { toPathChecker } from '@here.build/periphery';

const hasPath = toPathChecker({ from: 'Task', to: 'PlexusModel' })(hg);
// => true if path exists
```

**Scheme:** `(hypergraph-path-exists hg "Task" "PlexusModel")`

### AST → HyperGraph Converters

Convert analysis results to hypergraphs for composition:

```typescript
import {
  metadataToInheritanceGraph,
  metadataToCallGraph,
  dependencyGraphToHG,
  typeGraphToHG,
  plexusModelGraph,
} from '@here.build/periphery';

// Extract metadata
const metadata = cata(extractAlg)(sourceFile);

// Convert to hypergraphs
const inheritance = metadataToInheritanceGraph(metadata);
const calls = metadataToCallGraph(metadata);

// Compose
const combined = overlay(inheritance, calls);

// Interpret
const dot = hypergraphToDOT(combined);
const cycles = toCycles(combined);
```

### Via S-Expressions

```scheme
; Build inheritance hypergraph
(build-inheritance-hypergraph "src/models.ts")

; Build call graph hypergraph
(build-call-hypergraph "src/models.ts")

; Build dependency hypergraph
(build-dependency-hypergraph "src/index.ts")

; Build type relationship hypergraph
(build-type-hypergraph "src/types.ts")

; Build PlexusModel-only subgraph
(build-plexus-model-graph "src/models.ts")

; Compose graphs
(overlay-graphs
  (build-inheritance-hypergraph "src/models.ts")
  (build-call-hypergraph "src/models.ts"))

; Connect graphs (cross-product)
(connect-graphs
  (build-plexus-model-graph "src/models.ts")
  base-model-graph)

; Convert to DOT for visualization
(hypergraph-to-dot
  (overlay-graphs
    (build-inheritance-hypergraph "src/models.ts")
    (build-call-hypergraph "src/models.ts")))

; Check metrics
(hypergraph-metrics (build-inheritance-hypergraph "src/models.ts"))
; => {:vertices [...] :vertexCount 12 :edges 15 :density 0.42}

; Find cycles
(hypergraph-cycles (build-dependency-hypergraph "src/index.ts"))
; => [["moduleA" "moduleB" "moduleA"]]

; Check if Task inherits from PlexusModel
(hypergraph-path-exists
  (build-inheritance-hypergraph "src/models.ts")
  "Task"
  "PlexusModel")
; => true
```

### Verified End-to-End Examples

These queries work right now via MCP discovery tool:

```scheme
; Build and inspect inheritance graph
(begin
  (define hg (build-inheritance-hypergraph "src/discovery-tool.ts"))
  (hypergraph-metrics hg))
; => {:vertices (Discover DiscoveryToolInteraction Record)
;     :vertexCount 3 :edges 2 :density 0.333}

; Visualize as DOT
(hypergraph-to-dot (build-inheritance-hypergraph "src/discovery-tool.ts"))
; => "digraph CodeGraph {\n  \"Discover\" -> \"DiscoveryToolInteraction\";\n ...}"

; Compose inheritance + calls, check metrics
(begin
  (define inheritance (build-inheritance-hypergraph "src/discovery-tool.ts"))
  (define calls (build-call-hypergraph "src/discovery-tool.ts"))
  (define combined (overlay-graphs inheritance calls))
  (hypergraph-metrics combined))
; => {:vertices (Discover ...) :vertexCount 3 :edges 4 :density 0.667}

; Check if path exists
(hypergraph-path-exists
  (build-inheritance-hypergraph "src/discovery-tool.ts")
  "Discover"
  "DiscoveryToolInteraction")
; => true

; Verify acyclic
(hypergraph-cycles (build-inheritance-hypergraph "src/discovery-tool.ts"))
; => nil

; Cross-product composition
(begin
  (define hg1 (build-inheritance-hypergraph "src/discovery-tool.ts"))
  (define hg2 (build-type-hypergraph "src/discovery-tool.ts"))
  (define connected (connect-graphs hg1 hg2))
  (hypergraph-metrics connected))
; => {:vertexCount 9 :edges 37 :density 0.514}
```

All 12 hypergraph functions tested and verified working.

### Algebraic Laws

Hypergraphs satisfy algebraic properties:

**Overlay (union):**
- Associative: `overlay(overlay(a,b),c) = overlay(a,overlay(b,c))`
- Commutative: `overlay(a,b) = overlay(b,a)`
- Idempotent: `overlay(a,a) = a`
- Identity: `overlay(empty,a) = a`

**Connect (cross-product):**
- Associative: `connect(connect(a,b),c) = connect(a,connect(b,c))`
- Identity: `connect(empty,a) = a`

These properties enable **compositional reasoning** - graphs compose predictably.

### Why Hypergraphs?

1. **Compositional Construction** - Build complex graphs from simple pieces via overlay/connect
2. **Multiple Interpretations** - One graph, many views (DOT, adjacency, metrics, cycles, paths)
3. **Type Safety** - Exhaustive pattern matching via folds, compile-time correctness
4. **Structural Correctness** - Invalid graphs can't be expressed (ADT + smart constructors)

See [src/__tests__/hypergraph.test.ts](./src/__tests__/hypergraph.test.ts) and [src/__tests__/hypergraph-integration.test.ts](./src/__tests__/hypergraph-integration.test.ts) for examples.

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

### Phase 3: Hypergraphs ✅ **COMPLETE**
- ✅ Algebraic DSL for n-ary relationships
- ✅ Compositional graph construction (overlay, connect)
- ✅ Fold-based interpretation (5 interpreters)
- ✅ AST→HyperGraph converters
- ✅ MCP integration (12 discovery functions)
- ✅ Comprehensive test coverage (48 tests)

### Phase 4: Tagless-Final
- Single query definition
- Multiple interpreters (execute, explain, optimize, cost)

### Phase 5: Algebraic Effects
- Extensible operations via generators
- Swappable handlers (real, test, record/replay)

### Phase 6: Action Tool ✅ **COMPLETE**
- ✅ Auto-discovery (no manual projectPath needed)
- ✅ Cross-platform filesystem walking
- ✅ Multi-project support (separate ts-morph instances per package)
- ✅ Batched refactorings with atomic validation
- ✅ 4 working actions: format-file, rename-symbol, add-import, remove-unused-imports
- ✅ Comprehensive test coverage (8 tests)

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
