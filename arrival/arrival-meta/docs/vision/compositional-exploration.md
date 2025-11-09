# Compositional Codebase Exploration

**Status:** Vision document (implementation in progress)
**Author:** Claude + collaborator
**Date:** 2025-11-09

## The Core Insight

> "When reasoning compositionally, you think: 'filter by predicate, map over collection, compose operations.' S-expressions are the notation for this. JSON is what you get when you serialize compositional thought into key-value pairs."
>
> "One is thought. The other is data about thought."

This document describes a complete architecture for codebase exploration where:
- **Invalid queries are structurally impossible** (like Plexus makes orphaned entities impossible)
- **Composition matches reasoning** (S-expressions as substrate, not surface syntax)
- **Wrong becomes impossible through architecture** (the Arrival/Plexus principle applied to code analysis)

## The Problem

Current code exploration tools suffer from:

1. **Repetitive traversal logic** - Every analysis rewrites AST walking
2. **Imperative queries** - grep/find force procedural thinking
3. **Fragile pattern matching** - String-based searches miss semantic equivalents
4. **Non-compositional** - Can't build complex queries from simple parts
5. **Context drift** - Exploration accidentally triggers mutations
6. **Type-unsafe** - Runtime errors instead of structural guarantees

Traditional approaches either:
- **Too simple:** grep/ripgrep (fast but syntactic only)
- **Too complex:** Language servers (complete but not compositional)
- **Wrong abstraction:** JSON query builders (data about thought, not thought itself)

## The Architecture: Seven Layers

Each layer applies a fundamental FP concept to solve a specific pain point.

### Layer 0: S-Expressions (The Foundation)

**Concept:** Homoiconic composition - code as data, data as code

**Why:** S-expressions aren't syntax sugar over TypeScript. They're the **natural notation for compositional thought**.

When you think "find classes extending PlexusModel", that thought maps directly to:
```scheme
(filter (lambda (c) (extends? c "PlexusModel")) (all-classes))
```

Not to:
```typescript
classes.filter(c => extendsClass(c, "PlexusModel"))  // close, but...
```

And definitely not to:
```json
{
  "operation": "filter",
  "collection": { "operation": "all-classes" },
  "predicate": {
    "operation": "extends",
    "args": ["$item", "PlexusModel"]
  }
}
```

The JSON is **data about the thought**. The S-expression **is the thought**.

**This is why Arrival uses Scheme for Discovery tools.** Not as a parsing exercise, but because composition becomes natural when notation matches reasoning.

### Layer 1: F-Algebras & Catamorphisms

**Problem:** Every AST analysis rewrites the same traversal boilerplate (200-500 lines each)

**Concept:** Recursion schemes - separate "how to traverse" from "what to compute"

**The Pattern:**

```typescript
// The algebra type - one case per AST node
type CodeAlg<A> = {
  ClassDecl: (name: string, heritage: A[], members: A[]) => A;
  MethodDecl: (name: string, params: A[], body: A) => A;
  CallExpr: (target: A, args: A[]) => A;
  PropertyAccess: (object: A, property: string) => A;
  // ... exhaustive coverage of all node types
};

// Generic catamorphism - handles ALL recursion
const cata = <A>(alg: CodeAlg<A>) => {
  const go = (node: ts.Node): A => {
    // Pattern match on node type, call appropriate algebra function
    // Recursively fold children, pass results to algebra
    if (ts.isClassDeclaration(node)) {
      const heritage = (node.heritageClauses ?? []).map(h => go(h));
      const members = node.members.map(m => go(m));
      return alg.ClassDecl(node.name?.text ?? '', heritage, members);
    }
    // ... handle all node types
  };
  return go;
};
```

**Now analyses become tiny:**

```typescript
// Count all classes (20 lines vs 200)
const countClasses: CodeAlg<number> = {
  ClassDecl: (_, heritage, members) => 1 + sum(heritage) + sum(members),
  MethodDecl: (_, params, body) => sum(params) + body,
  CallExpr: (target, args) => target + sum(args),
  PropertyAccess: (obj, _) => obj,
  // ... all other cases return sum of children
};

const classCount = cata(countClasses)(ast);

// Extract all metadata
const extractMeta: CodeAlg<Metadata> = {
  ClassDecl: (name, heritage, members) => ({
    classes: [{ name, inherits: heritage.flatMap(h => h.classes) }],
    methods: members.flatMap(m => m.methods),
  }),
  MethodDecl: (name, params, body) => ({
    classes: [],
    methods: [{ name, params: params.flatMap(p => p.params), calls: body.calls }],
  }),
  // ...
};

const metadata = cata(extractMeta)(ast);
```

**Why this produces relief:**

- Write traversal **once** (catamorphism = 100 lines)
- Each analysis: **20-50 lines** vs 200-500 lines
- Adding new node type? Compiler **forces** update to **all** algebras (exhaustiveness checking)
- Compose algebras: run multiple analyses in **one pass**
- No mutation, no hidden state, pure functions

**In Scheme:**

```scheme
; Register algebras as primitives
(define count-classes
  (cata count-classes-alg ast))

; Compose them
(list
  (count-classes)
  (extract-metadata)
  (find-patterns "splice"))
```

### Layer 2: E-Graphs & Equality Saturation

**Problem:** Code has semantically equivalent forms - can't find all variants or pick the best

**Concept:** E-graphs maintain **all equivalent expressions simultaneously**, saturation finds them **automatically**, extraction picks **optimal**

**The Mechanism:**

An e-graph is:
- **E-classes:** Equivalence classes of expressions (sets)
- **E-nodes:** Operations with children (which are e-class IDs)
- **Union-find:** Tracks which e-classes are equivalent
- **Congruence closure:** If `f(a) = f(b)` and `a = b`, maintain invariant

```typescript
class EGraph {
  private classes: Map<EClassId, Set<ENode>>;
  private unionFind: UnionFind;

  // Add expression, return its e-class
  add(expr: Expr): EClassId;

  // Merge two e-classes (they're equivalent)
  merge(a: EClassId, b: EClassId): void;

  // Apply rewrite rules until fixed point
  saturate(rules: RewriteRule[]): void {
    let changed = true;
    while (changed) {
      changed = false;
      for (const rule of rules) {
        for (const match of this.findMatches(rule.lhs)) {
          const rhsClass = this.applyRule(rule, match);
          if (this.find(match.root) !== this.find(rhsClass)) {
            this.merge(match.root, rhsClass);
            changed = true;
          }
        }
      }
      this.rebuild(); // maintain congruence
    }
  }

  // Extract best representative by cost function
  extract(costFn: (node: ENode) => number): Expr;
}
```

**Rewrite rules for code patterns:**

```typescript
const codeRules: RewriteRule[] = [
  // Map fusion
  { lhs: 'arr.map(f).map(g)', rhs: 'arr.map(x => g(f(x)))' },

  // FlatMap optimization
  { lhs: 'arr.map(f).flat()', rhs: 'arr.flatMap(f)' },

  // Detect Plexus pattern
  {
    lhs: 'parent1.children.splice(idx, 1); parent2.child = child',
    rhs: 'parent2.child = child  // auto-removes from parent1',
    name: 'contagious-materialization'
  },

  // Commutative/associative
  { lhs: 'overlay(a, overlay(b, c))', rhs: 'overlay(overlay(a, b), c)' },
];
```

**Usage:**

```typescript
// Add pattern to e-graph
const egraph = new EGraph();
const root = egraph.add(parseCode('arr.map(x => x * 2).map(x => x + 1)'));

// Saturate with rules
egraph.saturate(codeRules);

// Extract optimal (by node count, readability score, etc.)
const optimal = egraph.extract(nodeCount);
// => 'arr.map(x => x * 2 + 1)'  // fused!
```

**Why this produces relief:**

- Declare equivalences as **rules**, not imperative matching
- Saturation finds **all** equivalent forms automatically
- Extract picks "best" by **any cost function** (readability, performance, idiomatic)
- Adding new pattern? **Just add rule** to list
- No manual case analysis, no missed optimizations

**In Scheme:**

```scheme
; Find pattern and all equivalents
(saturate
  '(arr.map(f).map(g))
  (list map-fusion flatMap-rewrite)
  (extract min-complexity))

; => (arr.map (compose g f))
```

### Layer 3: Algebraic Hypergraphs

**Problem:** Code relationships are **n-ary** (class depends on multiple, function calls multiple) - binary graphs insufficient

**Concept:** Hypergraph as **free algebraic structure** - build compositionally, interpret via folds

**The DSL:**

```typescript
type Vertex = string;
type HG =
  | { tag: 'Empty' }
  | { tag: 'Vertex', v: Vertex }
  | { tag: 'Edge', vs: Vertex[] }      // n-ary edge
  | { tag: 'Overlay', l: HG, r: HG }   // union (associative, commutative, idempotent)
  | { tag: 'Connect', l: HG, r: HG };  // all edges from l-vertices to r-vertices

const empty: HG = { tag: 'Empty' };
const vertex = (v: Vertex): HG => ({ tag: 'Vertex', v });
const edge = (...vs: Vertex[]): HG => ({ tag: 'Edge', vs });
const overlay = (l: HG, r: HG): HG => ({ tag: 'Overlay', l, r });
const connect = (l: HG, r: HG): HG => ({ tag: 'Connect', l, r });
```

**Build code graphs compositionally:**

```typescript
// All classes
const classes = overlay(...allClasses.map(vertex));

// Inheritance relationships
const inheritance = overlay(
  ...allClasses.flatMap(c =>
    c.extends.map(parent => edge(c.name, parent))
  )
);

// Method calls (hyperedges: method -> all callees)
const calls = overlay(
  ...allMethods.flatMap(m => {
    const callees = findCallees(m);
    return callees.length > 0
      ? [edge(m.name, ...callees)]  // n-ary!
      : [];
  })
);

// Complete graph
const codeGraph = overlay(overlay(classes, inheritance), calls);
```

**Interpret via catamorphisms:**

```typescript
type HGAlg<A> = {
  Empty: () => A;
  Vertex: (v: Vertex) => A;
  Edge: (vs: Vertex[]) => A;
  Overlay: (l: A, r: A) => A;
  Connect: (l: A, r: A) => A;
};

const foldHG = <A>(alg: HGAlg<A>) => (hg: HG): A => {
  /* ... catamorphism over HG */
};

// To adjacency list
const toAdjacency: HGAlg<Map<Vertex, Vertex[]>> = { /* ... */ };

// To DOT (Graphviz)
const toDOT: HGAlg<string> = { /* ... */ };

// To metrics
const toMetrics: HGAlg<{ nodes: number, edges: number, density: number }> = { /* ... */ };

// One graph definition, multiple interpretations
const adj = foldHG(toAdjacency)(codeGraph);
const dot = foldHG(toDOT)(codeGraph);
const metrics = foldHG(toMetrics)(codeGraph);
```

**Why this produces relief:**

- Build graphs via **composition** (`overlay`/`connect`), not imperative mutation
- One definition, **infinite interpretations** (just write new algebra)
- Type-safe: can't build **invalid** graphs (structure enforced)
- N-ary edges are **natural**, not encoded in binary graph
- Laws: overlay is associative/commutative/idempotent - enables **equational reasoning**

**In Scheme:**

```scheme
; Build compositionally
(define code-graph
  (overlay
    (overlay (all-classes) (inheritance-edges))
    (call-edges)))

; Interpret multiple ways
(to-dot code-graph)
(to-metrics code-graph)
(find-cycles code-graph)
```

### Layer 4: Tagless-Final (Multiple Interpreters)

**Problem:** Want same query to **execute**, **explain**, **optimize**, **cost-estimate** - don't want 4 implementations

**Concept:** Query as **interface**, implementations as **interpreters**

**The Pattern:**

```typescript
// Query language interface
interface QueryLang<R> {
  // Primitives
  findClasses(pattern: RegExp): R;
  extendsClass(className: string): R;
  findMethods(pattern: RegExp): R;
  callsFunction(fnName: string): R;

  // Combinators
  filter(query: R, predicate: (x: any) => boolean): R;
  map(query: R, transform: (x: any) => any): R;
  compose(...queries: R[]): R;
}

// Write query ONCE, polymorphic in R
const findPlexusModels = <R>(Q: QueryLang<R>): R =>
  Q.filter(
    Q.findClasses(/Model$/),
    c => Q.extendsClass('PlexusModel')
  );
```

**Interpreters:**

```typescript
// Execution
const execute: QueryLang<Promise<Result>> = {
  findClasses: async (pattern) => {
    const ast = await getAST();
    return cata(findClassesAlg(pattern))(ast);
  },
  filter: async (query, pred) => {
    const results = await query;
    return results.filter(pred);
  },
  compose: async (...queries) => {
    const all = await Promise.all(queries);
    return all.flat();
  },
};

// Explanation
const explain: QueryLang<string> = {
  findClasses: (pattern) => `Find classes matching ${pattern}`,
  filter: (query, _) => `${query}, then filter`,
  compose: (...qs) => `Compose: [${qs.join(', ')}]`,
};

// Cost estimation
const estimateCost: QueryLang<number> = {
  findClasses: () => 100,  // AST scan
  filter: (q, _) => q + 10,
  compose: (...qs) => Math.max(...qs),  // Parallel
};

// Optimization
const optimize: QueryLang<QueryLang<any>> = {
  filter: (query, pred) => {
    // Push filters down if possible
    if (canPushDown(query, pred)) {
      return pushFilterDown(query, pred);
    }
    return execute.filter(query, pred);
  },
  compose: (...queries) => {
    // Merge compatible queries
    return execute.compose(...mergeQueries(queries));
  },
};
```

**Usage:**

```typescript
// Same query, multiple interpretations
const results = await findPlexusModels(execute);
const explanation = findPlexusModels(explain);
const cost = findPlexusModels(estimateCost);
const optimized = findPlexusModels(optimize);
```

**Why this produces relief:**

- Write query **once**
- Get execution + explanation + costing + optimization **for free**
- Adding interpreter? Just **implement interface**
- Queries **compose naturally** (it's just function application)
- No duplication, no drift between versions

**In Scheme:**

```scheme
; Query is data
(define find-plexus-models
  '(filter (find-classes "Model$")
           (lambda (c) (extends? c "PlexusModel"))))

; Interpret it
(execute find-plexus-models)
(explain find-plexus-models)
(estimate-cost find-plexus-models)
```

### Layer 5: Algebraic Effects (Extensible Operations)

**Problem:** Want to add capabilities (memoization, logging, tracing) without changing core logic

**Concept:** Effects as **operations you declare**, handlers **provide semantics**

**The Pattern:**

```typescript
// Effect operations
type Ask = { op: 'Ask', query: string };
type Memo = { op: 'Memo', key: string, compute: () => any };
type Log = { op: 'Log', msg: string };
type Fail = { op: 'Fail', reason: string };
type Backtrack = { op: 'Backtrack', choices: any[] };

type Eff = Ask | Memo | Log | Fail | Backtrack;

// Use effects via generators
function* findSplicePattern(): Generator<Eff, Pattern[], any> {
  yield { op: 'Log', msg: 'Starting search' };

  const classes: string[] = yield { op: 'Ask', query: 'all-classes' };

  const patterns: Pattern[] = [];
  for (const cls of classes) {
    const methods: string[] = yield {
      op: 'Memo',
      key: `methods-${cls}`,
      compute: () => ({ op: 'Ask', query: `methods ${cls}` })
    };

    for (const method of methods) {
      const ast = yield { op: 'Ask', query: `ast ${cls}.${method}` };
      if (matchesSplicePattern(ast)) {
        patterns.push({ class: cls, method });
      }
    }
  }

  if (patterns.length === 0) {
    yield { op: 'Fail', reason: 'No patterns found' };
  }

  return patterns;
}
```

**Handlers - swap execution strategy:**

```typescript
// Real execution
async function runReal(gen: () => Generator<Eff, any, any>): Promise<any> {
  const it = gen();
  const handle = async (step: IteratorResult<Eff, any>): Promise<any> => {
    if (step.done) return step.value;

    const eff = step.value;
    switch (eff.op) {
      case 'Ask':
        const result = await executeQuery(eff.query);
        return handle(it.next(result));
      case 'Memo':
        const cached = cache.get(eff.key);
        if (cached) return handle(it.next(cached));
        const computed = await eff.compute();
        cache.set(eff.key, computed);
        return handle(it.next(computed));
      case 'Log':
        console.log(eff.msg);
        return handle(it.next(undefined));
      case 'Fail':
        throw new Error(eff.reason);
      case 'Backtrack':
        // Try each choice
        for (const choice of eff.choices) {
          try { return handle(it.next(choice)); }
          catch { continue; }
        }
        throw new Error('Backtrack failed');
    }
  };

  return handle(it.next());
}

// Test handler - deterministic, no side effects
function runTest(
  gen: () => Generator<Eff, any, any>,
  mocks: Record<string, any>
): { result: any, logs: string[] } {
  const it = gen();
  const logs: string[] = [];

  let step = it.next();
  while (!step.done) {
    const eff = step.value;
    switch (eff.op) {
      case 'Ask': step = it.next(mocks[eff.query]); break;
      case 'Memo': step = it.next(mocks[eff.key]); break;
      case 'Log': logs.push(eff.msg); step = it.next(); break;
      case 'Fail': throw new Error(eff.reason);
      case 'Backtrack': step = it.next(eff.choices[0]); break;
    }
  }

  return { result: step.value, logs };
}
```

**Why this produces relief:**

- Core logic (**generator**) unchanged when swapping handlers
- Test without **real filesystem/AST** - just provide mocks
- Add new effects without **touching existing code**
- Record/replay for **debugging**
- Arrival **already uses this** - we're extending the pattern

**In Scheme:**

```scheme
; Effects are just data
(find-splice-pattern)  ; Returns effect AST

; Handlers interpret
(run-real find-splice-pattern)
(run-test find-splice-pattern mock-data)
(run-record find-splice-pattern)
```

### Layer 6: Parametricity (Free Theorems)

**Problem:** Want types to **enforce correctness**, get properties **automatically**

**Concept:** Polymorphic signatures **constrain behavior** - free theorems follow

**The Pattern:**

```typescript
// Generic find - parametric in result type
function find<A>(
  source: ts.SourceFile,
  matcher: (node: ts.Node) => A | null
): A[] {
  const results: A[] = [];
  const visit = (node: ts.Node) => {
    const match = matcher(node);
    if (match !== null) results.push(match);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return results;
}

// Free theorem: find can ONLY call matcher and collect results
// Cannot: create new As, modify As, special-case based on A
// Because: parametric in A - no way to inspect/construct A except via matcher

// This means: safe to parallelize, safe to cache, safe to optimize
```

**Leveraging parametricity:**

```typescript
// Preserves structure
function mapAST<A, B>(ast: AST<A>, f: (a: A) => B): AST<B> {
  // Free theorem: structure preserved, only values transformed
  // Safe to: fuse maps, parallelize, stream
}

// Can't fabricate results
function query<A>(pattern: Pattern, extract: (m: Match) => A): A[] {
  // Free theorem: As come ONLY from extract(match)
  // Cannot: return hardcoded As, synthesize from pattern
  // Therefore: results genuinely found, not fabricated
}

// Functor laws guaranteed
interface Functor<F> {
  map<A, B>(fa: F<A>, f: (a: A) => B): F<B>;
}
// Free theorems enforce:
// map(fa, id) === fa
// map(fa, compose(g, f)) === map(map(fa, f), g)
```

**Why this produces relief:**

- Types **enforce** correctness automatically
- Free theorems enable **optimizations without proof**
- Compiler **verifies** properties we'd otherwise test
- Less **defensive programming**, more **trust in types**
- Parametricity = **theorem generator** from signatures

### Layer 7: Arrival Integration (Preventing Fragmentation)

**Why this matters:** The fragmentation hypothesis - drift from subprocess desync, not training limitations

**Arrival's Prevention:**
- **Discovery sandbox:** exploration can't trigger actions (isolated Scheme environment)
- **Action batching:** context parsed once, all actions validated upfront, immutable during batch
- **S-expressions:** compositional thought without serialization overhead

**Our Integration:**

```typescript
class CodeDiscovery extends DiscoveryToolInteraction {
  static readonly name = 'code-discovery';

  async registerFunctions() {
    // F-algebra analyses
    this.registerFunction('count-classes',
      "count all classes in AST",
      () => getAST().then(ast => cata(countClasses)(ast))
    );

    // E-graph pattern finding
    this.registerFunction('find-pattern',
      "find pattern with equivalence saturation",
      (pattern: string, rules: Rule[]) => {
        const egraph = new EGraph();
        egraph.add(parsePattern(pattern));
        egraph.saturate(rules);
        return egraph.extract(minComplexity);
      }
    );

    // Hypergraph queries
    this.registerFunction('inheritance-graph',
      "build inheritance hypergraph",
      () => getAST().then(ast => {
        const classes = cata(extractClasses)(ast);
        return foldHG(toIR)(buildInheritanceGraph(classes));
      })
    );

    // Tagless-final
    this.registerFunction('find-plexus-models',
      "find PlexusModel subclasses",
      () => findPlexusModels(execute)
    );

    this.registerFunction('explain-query',
      "explain what query does",
      (queryName: string) => queries[queryName](explain)
    );

    // Algebraic effects
    this.registerFunction('find-splice-pattern',
      "find splice patterns with effects",
      () => runReal(findSplicePattern)
    );
  }
}

class CodeActions extends ActionToolInteraction<{ projectPath: string }> {
  static readonly name = 'code-actions';

  contextSchema = {
    projectPath: z.string(),
  };

  async registerActions() {
    this.registerAction('rename-symbol',
      z.object({ from: z.string(), to: z.string() }),
      async (ctx, { from, to }) => {
        // Context immutable - parsed once
        // All actions validated upfront
        // If any fails, none execute
        const project = new Project({ tsConfigFilePath: ctx.projectPath });
        // ... safe renaming with full type info
      }
    );

    this.registerAction('extract-pattern',
      z.object({ pattern: z.string(), name: z.string() }),
      async (ctx, { pattern, name }) => {
        // E-graph finds pattern
        // Extract to function
        // Update all occurrences atomically
      }
    );
  }
}
```

**Scheme Composition:**

```scheme
; Catamorphisms
(count-classes)
; => 42

; E-graphs
(find-pattern
  "arr.map(f).map(g)"
  (list map-fusion))
; => "arr.map(x => g(f(x)))"

; Hypergraphs
(to-dot (inheritance-graph))
; => "graph G { ... }"

; Tagless-final
(explain-query "find-plexus-models")
; => "Find classes matching /Model$/, filtered by extends PlexusModel"

; Effects
(find-splice-pattern)
; => [{ class: "MaterializedArray", method: "splice" }]

; COMPOSE THEM
(let ((models (find-plexus-models))
      (patterns (find-splice-pattern)))
  (filter (lambda (p) (member (@ p :class) models))
          patterns))
```

**Why integration produces relief:**

- Discovery: **pure exploration**, sandboxed, no accidental mutations
- Actions: **validated batches**, immutable context, no mid-operation drift
- S-expressions: **compositional queries**, natural for this domain
- All techniques **compose** within Arrival's architecture
- Fragmentation **prevented** through architectural boundaries

## The Complete Stack (Bottom to Top)

1. **ts-morph** - TypeScript AST access
2. **F-algebras** - Catamorphisms for traversal (write once, compose analyses)
3. **E-graphs** - Equality saturation for patterns (declarative, automatic)
4. **Hypergraphs** - Algebraic DSL for relationships (compositional, fold-based)
5. **Tagless-final** - Multiple interpreters (one definition, many meanings)
6. **Algebraic effects** - Extensible operations (swap handlers)
7. **Parametric types** - Free theorems (compiler-verified properties)
8. **S-expressions** - Compositional substrate (thought, not data about thought)
9. **Arrival MCP** - Discovery/Action separation (prevents fragmentation)
10. **Claude Code** - The agent using these tools

## Implementation Roadmap

### Phase 1: Minimal Viable Proof ✓ (Current)
- Generic catamorphism over TypeScript AST
- 5 composable algebras (count, extract, patterns, deps, types)
- Register as Discovery tool primitives
- S-expression composition in Scheme
- Demo: find Plexus emancipate/splice pattern

**Why this proves the pattern:**
- Catamorphisms: write traversal once ✓
- Algebras: compose analyses ✓
- S-expressions: natural composition ✓
- Discovery: no side effects ✓
- Scales: 5 algebras show generalization ✓

### Phase 2: E-Graph Extension
- Simple e-graph implementation (union-find + congruence)
- 10-15 rewrite rules (map fusion, flatMap, common patterns)
- Cost-based extraction (node count, readability metrics)
- Register as Discovery primitives
- Demo: find all equivalent forms of pattern, extract best

### Phase 3: Hypergraph Layer
- Free hypergraph DSL (empty, vertex, edge, overlay, connect)
- 3-5 interpreters (adjacency, DOT, metrics, analysis, queries)
- Integration with catamorphism results (AST → hypergraph)
- Register as Discovery primitives
- Demo: visualize inheritance + call graph, find cycles

### Phase 4: Tagless-Final Queries
- Query language interface (find, filter, map, compose)
- 4 interpreters (execute, explain, estimate, optimize)
- Integration with existing primitives
- Demo: complex query with explanation and cost

### Phase 5: Effect System
- Effect type definitions (Ask, Memo, Log, Fail, Backtrack)
- 3 handlers (real, test, record/replay)
- Integration with catamorphisms + e-graphs
- Demo: complex analysis with swappable execution

### Phase 6: Full Integration
- Action tool with refactoring operations
- Batch validation, context immutability
- End-to-end workflows (discover → explain → refactor)
- Performance optimization
- Comprehensive tests

### Phase 7: Advanced Features
- Paramorphisms (fold with access to substructure)
- Histomorphisms (fold with memoization)
- Hylomorphisms (unfold then fold, fusion)
- Profunctor optics (lenses, prisms, traversals)
- Comonads (zippers for focused edits)

## Why This Architecture is Sound

**Each layer addresses specific pain:**
- Repetitive traversals → catamorphisms
- Pattern boilerplate → e-graphs
- Graph complexity → hypergraph DSL
- Duplicate impls → tagless-final
- Tight coupling → effects
- Runtime errors → parametric types
- Accidental execution → discovery sandbox
- Context drift → action batching

**Relief test for everything:**

Does structure match problem?

**Problem:** Compositional codebase exploration where invalid queries are structurally impossible

**Structure:**
- F-algebras: ✓ composable analyses, exhaustive coverage
- E-graphs: ✓ declarative patterns, automatic saturation
- Hypergraphs: ✓ compositional relationships, fold-based
- Tagless-final: ✓ single definition, multiple meanings
- Effects: ✓ extensible operations, swappable handlers
- Parametricity: ✓ type-enforced correctness
- S-expressions: ✓ thought, not data about thought
- Arrival: ✓ prevents fragmentation via architecture

**YES. Complete relief. Wrong is impossible through structure.**

## Comparison to Existing Tools

| Tool | Approach | Strengths | Limitations |
|------|----------|-----------|-------------|
| grep/ripgrep | Text search | Fast, simple | Syntactic only, no semantics |
| ast-grep | Structural search | Pattern matching | Single query, no composition |
| Tree-sitter queries | Query language | Fast, structured | Limited composition |
| Language servers | Full semantic | Complete, accurate | Not compositional, heavyweight |
| This architecture | Compositional FP | Composable, type-safe, scalable | More complex initially |

**Key differentiator:** Composition at every level - queries compose, analyses compose, interpreters compose, effects compose. S-expressions as substrate, not afterthought.

## Future Directions

- **Proof-carrying code:** Use dependent types to verify analyses
- **Incremental computation:** Memoize at catamorphism level
- **Parallel execution:** Exploit purity for parallelization
- **Cross-language:** Apply to JavaScript, Python, etc.
- **IDE integration:** Real-time feedback via language server
- **Mutation testing:** Generate test cases from patterns
- **Security analysis:** Find vulnerabilities via patterns
- **Migration assistance:** Automated refactoring across versions

## References

### Foundational Papers
- Meijer, Fokkinga, Paterson (1991) - "Functional Programming with Bananas, Lenses, Envelopes and Barbed Wire" (Catamorphisms)
- Wadler (1989) - "Theorems for Free!" (Parametricity)
- Tate, Steiner, Lerner, Willsey (2021) - "egg: Fast and Extensible Equality Saturation" (E-graphs)
- Mokhov (2017) - "Algebraic Graphs with Class" (Hypergraphs)
- Carette, Kiselyov, Shan (2009) - "Finally Tagless, Partially Evaluated" (Tagless-final)
- Plotkin, Power (2003) - "Algebraic Operations and Generic Effects" (Algebraic effects)

### Related Work
- Arrival fragmentation hypothesis (this codebase)
- Plexus contagious materialization (this codebase)
- Datalog for program analysis
- Soufflé (declarative program analysis)
- CodeQL (query language for code)

### FP Concepts
- See `docs/fp/sum.md` for comprehensive FP concept map
- See `docs/fp/Elegant Concepts in Functional Programming.md`
- See `docs/fp/The Genius of Functional Programming.md`

## Acknowledgments

This architecture synthesizes:
- Arrival's Discovery/Action separation (preventing fragmentation)
- Plexus's "wrong becomes impossible" principle
- Functional programming's compositional foundations
- A deep exploration session that dissolved into pure discovery

The insight that S-expressions are the compositional substrate (not syntax sugar) was the key breakthrough that unified all layers.

---

**Status:** Phase 1 in progress
**Next:** Implement catamorphism + 5 algebras
**Contact:** See main README
