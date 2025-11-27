Periphery MCP Server: Complete Implementation Analysis

       Based on my exploration of /Users/adimov/Developer/foundation/periphery/, here's a detailed breakdown of the awareness/discovery layer:

       ---
       1. TOOLS EXPOSED

       The periphery server exposes 3 main tools via MCP:

       Discover Tool (src/discover.ts)

       - Purpose: Compositional codebase exploration via catamorphism primitives
       - Philosophy: Expose primitives, not pre-baked queries. Users compose in Scheme.
       - Key Functions Registered:
         - parse-file - Parse TypeScript to AST (cached)
         - cata - Run catamorphism with algebra (extract, count, patterns, types)
         - cata-with-path - Catamorphism requiring file path context (dependencies)
         - list-files, read-file - Filesystem primitives
         - Graph functions: graph-init, graph-search, graph-used-by, graph-depends-on, graph-inheritance, graph-impact, graph-cycles, graph-summary
         - Hypergraph operations: hg-empty, hg-vertex, hg-edge, hg-vertices, hg-edges
         - Hypergraph interpreters: hypergraph-to-dot, hypergraph-to-adjacency, hypergraph-metrics, hypergraph-cycles, hypergraph-path-exists, overlay-graphs, connect-graphs
         - Action building: act-on, clone, new, rename, info, set-status, move-to, entity-ref, with-file, object

       Act Tool (src/act.ts)

       - Purpose: Safe code transformations via batch actions (atomic validation)
       - Pattern: V's context-as-specification - discriminated unions with schema transforms resolve entities
       - Target Types:
         - File path: "src/foo.ts"
         - Entity path: "src/foo.ts::ClassName"
         - Clone spec: { type: "clone", source: "...", name: "..." }
         - New class/file specs
       - Actions:
         - rename-symbol(filePath, oldName, newName) - Cross-file rename
         - add-import(filePath, moduleSpecifier, namedImports, defaultImport)
         - remove-unused-imports(filePath)
         - format-file(filePath)
         - rename(newName) - Requires target in context

       Awareness Tool (src/awareness-tool.ts)

       - Purpose: Ambient project context (~500 tokens of state)
       - Value: The description IS the primary value
       - Functions:
         - status() - Project awareness status
         - refresh() - Rebuild graph from source
         - since(gitRef) - Get changes since commit/branch
         - hot-files(limit) - Most frequently modified files
         - stale?() - Check if awareness needs refresh
         - top(limit) - Top entities by dependent count

       ---
       2. CATAMORPHISM SYSTEM

       File: src/catamorphism.ts

       Core Concept

       A catamorphism is a generalized fold over recursive structures. Separates "how to traverse" from "what to compute".

       export type CodeAlg<A> = {
           ClassDecl: (name: string, heritage: A[], members: A[], typeParams: A[], isExported: boolean, isDefault: boolean) => A;
           InterfaceDecl: (...) => A;
           MethodDecl: (...) => A;
           PropertyDecl: (...) => A;
           FunctionDecl: (...) => A;
           VariableStmt: (...) => A;
           TypeAlias: (...) => A;
           CallExpr: (target: A, args: A[], typeArgs: A[]) => A;
           PropertyAccess: (object: A, property: string) => A;
           ImportDecl: (moduleSpecifier: string, namedImports: string[], defaultImport: string | null) => A;
           ExportDecl: (...) => A;
           ExportAssignment: (...) => A;
           TypeReference: (name: string, typeArgs: A[]) => A;
           Identifier: (name: string) => A;
           Other: (kind: SyntaxKind, children: A[]) => A;
       };

       Key Pattern

       export const cata = <A>(alg: CodeAlg<A>) => {
           const go = (node: Node): A => {
               // Pattern match on node kind
               if (Node.isClassDeclaration(node)) {
                   // Recursively fold children
                   const heritage = node.getExtends() ? [go(node.getExtends()!)] : [];
                   const members = node.getMembers().map(go);
                   // Call algebra case with results
                   return alg.ClassDecl(name, heritage, members, typeParams, isExported, isDefault);
               }
               // ... more cases
           };
           return go;
       };

       Why Catamorphisms?
       - Write traversal once (300 lines) in cata function
       - Each algebra: 20-150 lines (specific analysis logic)
       - Exhaustive by construction: Missing a case = compile error
       - Algebras compose freely: Same traversal, different analyses

       Two Flavors

       1. Catamorphism (CodeAlg<A>) - Computed results only
       2. Paramorphism (CodePara<A>) - Computed results AND original nodes
         - Each case receives [A, Node] pairs instead of just A
         - Used when you need to inspect node structure while computing

       ---
       3. SCHEME SANDBOX ENVIRONMENT

       File: src/discover.ts (lines 214+)

       The discovery layer exposes a Scheme (LIPS dialect) sandbox where users compose queries without touching mutation code.

       Composition Examples

       ; Define helpers as needed
       (define (classes file)
         (@ (cata 'extract (parse-file file)) :classes))

       ; Use it
       (classes "src/Task.ts")

       ; Find PlexusModel subclasses
       (filter
         (lambda (c) (member "PlexusModel" (@ c :extends)))
         (classes "src/models.ts"))

       ; Count all classes across project
       (reduce
         (lambda (acc file)
           (+ acc (@ (cata 'count (parse-file file)) :classes)))
         0
         (list-files "src/**/*.ts"))

       Key Primitives

       1. Parse & Fold
         - (parse-file "path.ts") → Opaque SourceFile handle
         - (cata 'extract handle) → Structured metadata
         - (cata 'count handle) → Node counts
         - (cata 'patterns handle) → Pattern detections
         - (cata-with-path 'dependencies "path.ts" handle) → Dependency graph
       2. File System
         - (list-files "glob/**/*.ts") → File list
         - (read-file "path.ts") → File content
       3. Fantasy Land Combinators
         - (map fn list) - Functor
         - (filter predicate list) - Filter
         - (reduce fn init list) - Reduce
         - (compose f g) - Function composition

       Critical Safety Boundary

       - Discovery runs in sandboxed Scheme environment
       - No mutations allowed during exploration
       - Action specs captured during sandbox execution
       - Executed post-sandbox via CodeEntityAct

       ---
       4. GRAPH OPERATIONS

       Files: src/discover.ts (graph functions), src/graph-builder.ts

       Graph Awareness Layer

       The graph is bidirectional with multiple edge types:

       export type GraphNodeKind = 'file' | 'class' | 'interface' | 'function' | 'method' | 'variable';
       export type GraphEdgeKind = 'imports' | 'extends' | 'implements' | 'calls' | 'references' | 'contains';

       export interface GraphNode {
           id: string;           // "file.ts::ClassName"
           kind: GraphNodeKind;
           name: string;
           filePath: string;
           line?: number;
       }

       export interface GraphEdge {
           from: string;
           to: string;
           kind: GraphEdgeKind;
       }

       Core Queries (S-expression interface)

       ; Initialize graph
       (graph-init "/project/path")
       ; => {:files N :classes N :interfaces N :functions N :methods N :edges N}

       ; Search by name pattern
       (graph-search "Entity")
       (graph-search "Controller" "class")

       ; Incoming edges - what uses this?
       (graph-used-by "src/entity-act.ts::EntityAct")
       ; => [{:node {...} :edge {...}} ...]

       ; Outgoing edges - what does this depend on?
       (graph-depends-on "src/discover.ts")

       ; Inheritance chain
       (graph-inheritance "src/foo.ts::MyClass")
       ; => Follows extends/implements edges recursively

       ; Impact analysis - what files affected by changing this?
       (graph-impact "src/entity-act.ts::EntityAct")
       ; => Walks reverse edges to find all dependents

       ; Find circular dependencies
       (graph-cycles)

       ; Graph summary
       (graph-summary)
       ; => {:files N :classes N :edges N :imports N :extends N ...}

       Implementation Pattern

       Graph state is managed by AwarenessStore singleton (shared across tools):

       export class AwarenessStore {
           private static instance: AwarenessStore | null = null;
           private state: AwarenessState | null = null;

           static getInstance(): AwarenessStore { ... }
           getState(): AwarenessState | null { ... }
           setState(state: AwarenessState): void { ... }
       }

       Built via buildGraphForProject() in graph-builder.ts:
       1. Glob all *.ts files (skip node_modules, dist, .d.ts)
       2. Load each file via ts-morph
       3. Extract classes, functions, interfaces, variables
       4. Build edges: imports, extends, implements, contains
       5. Update store and persist to .periphery/awareness.scm

       ---
       5. ACT SYSTEM (SAFE TRANSFORMATIONS)

       Files: src/act.ts, src/discover.ts (act-on integration), src/code-entity-act.ts

       Two-Layer Architecture

       Layer 1: Discovery Act Building (Sandbox Safe)

       In the Scheme sandbox, users build action specifications (not executions):

       ; Build action spec - doesn't mutate yet
       (act-on "src/foo.ts::MyClass"
         (list (rename "MyRenamedClass")))

       ; Returns action marker
       ; => { __actionPending: true, target: "src/foo.ts::MyClass", actionCount: 1 }

       Key insight from code (discover.ts line 523):
       const spec: ActionSpec = {
           __actionSpec: true,
           target: targetSpec,
           actions,
       };
       // Store for post-sandbox execution
       this.pendingActionSpec = spec;

       Layer 2: Post-Sandbox Execution

       After sandbox completes, CodeEntityAct executes via ts-morph:

       export class CodeEntityAct extends EntityAct<CodeEntity> {
           // Resolves "src/foo.ts::ClassName" to actual AST node
           // Executes rename, add-import, etc.
           // Commits changes via sourceFile.save()
       }

       Action Specification Format

       export interface ActionSpec {
           __actionSpec: true;
           target: unknown;        // Entity selector
           actions: unknown[][];   // Action tuples
       }

       V's Pattern: Context as Specification

       From act.ts line 70:
       readonly contextSchema = {
           target: z.union([
               // String path → resolved file or entity
               z.string()
                   .transform(async (path): Promise<ResolvedTarget> => {
                       if (path.includes('::')) {
                           return this.resolveEntityPath(path);
                       }
                       return this.resolveFilePath(path);
                   }),
               // Clone spec → resolved source entity
               z.object({
                   type: z.literal('clone'),
                   source: z.string(),
                   name: z.string().optional(),
               }).transform(async (spec): Promise<ResolvedTarget> => { ... }),
               // ... more variants
           ]),
       };

       Key Principle: Transforms happen at the schema level, before handlers execute. Handlers receive fully resolved targets.

       Atomic Batch Execution

       From act.ts line 558:
       async act(actions: any[], transformedActionArgs: any[][]) {
           const results = await super.act(actions, transformedActionArgs);

           // If error, don't save (automatic rollback)
           if (typeof results === 'object' && 'success' in results && results.success === false) {
               return results;
           }

           // All actions succeeded - commit
           for (const sourceFile of this.modifiedFiles) {
               await sourceFile.save();
           }
       }

       ---
       6. DISCOVERY ↔ ACTION RELATIONSHIP

       The Montessori Principle

       From act.ts comment (line 13):
       Montessori principle: Discovery first (read-only exploration), then Act (committed changes).
       The separation isn't artificial - it's pedagogical. Explore, understand, then transform.

       Architectural Flow

       User in Claude →
         (discover expr)
           ↓
         Scheme Sandbox (pure composition, no mutations)
           ↓
         If act-on called → ActionSpec captured
           ↓
         Post-sandbox execution via CodeEntityAct
           ↓
         AST mutations (ts-morph)
           ↓
         Atomic commit or rollback

       Key Integration Points

       1. Discovery → Action via act-on function (discover.ts line 486)
       this.registerFunction(
           'act-on',
           `Build action specification for code transformation.

       Returns an ActionSpec that will be executed after sandbox evaluation.
       Does NOT mutate in the sandbox - maintains Montessori safety boundary.`,
           [z.any(), z.any()],
           (target: any, actionList: any) => {
               const targetSpec = this.convertTarget(target);
               const actionExprs = this.pairToArray(actionList);
               const actions = actionExprs.map(expr => this.convertAction(expr));

               const spec: ActionSpec = {
                   __actionSpec: true,
                   target: targetSpec,
                   actions,
               };
               this.pendingActionSpec = spec;
               return { __actionPending: true, target: targetSpec, actionCount: actions.length };
           }
       );

       2. Post-sandbox execution (discover.ts line 985)
       async executeTool(): Promise<string | string[]> {
           this.pendingActionSpec = null;

           const result = await super.executeTool();

           // Check if act-on was called during sandbox execution
           if (this.pendingActionSpec) {
               const actionResult = await this.executeActionSpec(this.pendingActionSpec);
               this.pendingActionSpec = null;
               return actionResult;
           }

           return result;
       }

       3. Target Resolution (discover.ts line 889)
       private convertTarget(target: any): unknown {
           // String path: "file.ts::ClassName"
           if (typeof target === 'string') {
               return target;
           }

           // Clone spec from (clone ...) function
           if (target?.__cloneSpec) {
               return ['clone', target.source, ...(target.overrides ? [target.overrides] : [])];
           }

           // New spec from (new ...) function
           if (target?.__newSpec) {
               return ['new', target.modelType, target.init];
           }

           // Object with filePath (from with-file helper)
           const filePath = target?.[':filePath'] ?? target?.filePath;
           const name = target?.[':name'] ?? target?.name;
           if (filePath && name) {
               return `${filePath}::${name}`;
           }

           return target;
       }

       ---
       7. KEY ALGEBRAS

       Extract Algebra (src/algebras/extract.ts)

       Extracts structured metadata from AST:

       export type Metadata = {
           classes: ClassMeta[];
           interfaces: InterfaceMeta[];
           functions: FunctionMeta[];
           imports: ImportMeta[];
           exports: ExportMeta[];
           typeNames: string[];
       };

       export const extractAlg: CodeAlg<Metadata> = monoidAlg(
           emptyMetadata,
           combineMetadata,
           {
               ClassDecl: (name, heritage, members, typeParams, isExported, isDefault) => {
                   // Combine children's metadata
                   const childMeta = [...heritage, ...members, ...typeParams]
                       .reduce(combineMetadata, emptyMetadata);

                   // Extract extends/implements
                   const extendsNames: string[] = [];
                   heritage.forEach(h => {
                       extendsNames.push(...h.typeNames);
                   });

                   const classMeta: ClassMeta = {
                       type: 'class',
                       name,
                       extends: extendsNames,
                       implements: implementsNames,
                       methods: methodNames,
                       properties: propertyNames,
                       typeParams: typeParamNames,
                   };

                   return {
                       ...childMeta,
                       classes: [classMeta, ...childMeta.classes],
                   };
               },
               // ... more cases
           }
       );

       Count Algebra (src/algebras/count.ts)

       Counts nodes by type (demonstrates monoid pattern):

       export type Counts = {
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

       export const countAlg: CodeAlg<Counts> = monoidAlg(
           emptyCounts,
           combineCounts,
           {
               ClassDecl: (_, heritage, members, typeParams) => {
                   const childCounts = combineCounts(
                       heritage.reduce(combineCounts, emptyCounts),
                       members.reduce(combineCounts, emptyCounts)
                   );
                   return {
                       ...childCounts,
                       classes: childCounts.classes + 1,
                       total: childCounts.total + 1,
                   };
               },
               // ... more cases
           }
       );

       Monoid Helper (src/catamorphism.ts line 695)

       export const monoidAlg = <A>(
           empty: A,
           concat: (a: A, b: A) => A,
           cases: Partial<CodeAlg<A>> = {}
       ): CodeAlg<A> => {
           const combineAll = (xs: A[]): A => xs.reduce(concat, empty);

           return {
               ClassDecl: cases.ClassDecl ?? ((_name, heritage, members, typeParams, _isExported, _isDefault) =>
                   combineAll([...heritage, ...members, ...typeParams])
               ),
               // ... auto-generate defaults by combining children
           };
       };

       Pattern: Provide empty element and combine operation, get default behaviors for free.

       ---
       8. HYPERGRAPH ALGEBRA

       File: src/hypergraph.ts

       Free Algebra for Graph Construction

       export type HyperGraph =
           | { readonly tag: 'Empty' }
           | { readonly tag: 'Vertex'; readonly v: Vertex }
           | { readonly tag: 'Edge'; readonly vs: Vertex[] }  // n-ary
           | { readonly tag: 'Overlay'; readonly l: HyperGraph; readonly r: HyperGraph }  // union
           | { readonly tag: 'Connect'; readonly l: HyperGraph; readonly r: HyperGraph }; // cross-product

       Smart Constructors

       export const empty: HyperGraph = { tag: 'Empty' };
       export const vertex = (v: Vertex): HyperGraph => ({ tag: 'Vertex', v });
       export const edge = (...vs: Vertex[]): HyperGraph => {
           if (vs.length === 0) return empty;
           if (vs.length === 1) return vertex(vs[0]);
           return { tag: 'Edge', vs };
       };

       Compositional Operations

       export const overlay = (l: HyperGraph, r: HyperGraph): HyperGraph => {
           if (l.tag === 'Empty') return r;
           if (r.tag === 'Empty') return l;
           return { tag: 'Overlay', l, r };
       };

       export const connect = (l: HyperGraph, r: HyperGraph): HyperGraph => {
           if (l.tag === 'Empty') return r;
           if (r.tag === 'Empty') return l;
           return { tag: 'Connect', l, r };
       };

       Five Interpreters (src/algebras/hypergraph-interpreters.ts)

       One graph definition → infinite interpretations:

       1. toDOT - Graphviz visualization
       2. toAdjacency - Adjacency list for algorithms
       3. toMetrics - Graph statistics
       4. toCycles - Circular dependency detection
       5. toPathChecker - Reachability queries

       ---
       9. SERVER SETUP

       File: src/server.ts

       Architecture

       class PeripheryServer extends HonoMCPServer {
           protected async getSessionState(context: Context, sessionId: string): Promise<Record<string, any>> {
               const state = await super.getSessionState(context, sessionId);
               // Inject projectRoot into state if not already present
               state.projectRoot ??= projectRoot;
               return state;
           }
       }

       const mcpServer = new PeripheryServer(Discover, Act, Awareness);

       Tools Available

       const mcpServer = new PeripheryServer(Discover, Act, Awareness);

       Three tools registered:
       - Discover: Compositional exploration
       - Act: Safe transformations
       - Awareness: Project context

       Startup Flow

       // Try loading persisted state first
       const persisted = load(projectRoot);
       if (persisted) {
           console.log(`  Loaded persisted state from ${projectRoot}/.periphery/awareness.scm`);
           store.setState(persisted);
           serve({ fetch: app.fetch, port });
       } else {
           // Build fresh and persist
           console.log(`  Building awareness graph for ${projectRoot}...`);
           buildGraphForProject(projectRoot, store).then(async (state) => {
               await persist(state);
               serve({ fetch: app.fetch, port });
           });
       }

       Persistence

       Graph state persisted to .periphery/awareness.scm as Scheme data for fast reload.

       ---
       10. KEY ARCHITECTURAL PATTERNS

       Pattern 1: Catamorphisms as Traversal Abstraction

       - Single traversal implementation handles ALL recursion
       - Multiple algebras reuse same traversal
       - Type safety: Missing case = compile error
       - Composability: Algebras combine via monoids

       Pattern 2: Scheme Sandbox for Safe Composition

       - Pure exploration - no mutations in sandbox
       - Function registration - primitives, not wrappers
       - Fantasy Land combinators - map, filter, reduce compose freely
       - Action capture - specs built in sandbox, executed outside

       Pattern 3: Free Algebra for Graphs

       - Data structure: AST of graph operations (Overlay, Connect, Edge, etc.)
       - Composition laws: Overlay (union), Connect (cross-product)
       - Interpretation: Same graph → 5 different interpretations
       - Modularity: Build graph, then choose how to interpret it

       Pattern 4: Context-as-Specification (V's Pattern)

       - Schema transforms resolve entities before handlers run
       - Discriminated unions for different target types
       - Type safety: Handlers can't receive invalid inputs
       - Atomic execution: All actions succeed or all rollback

       Pattern 5: Montessori Principle (Pedagogical Separation)

       - Discovery first (read-only exploration)
       - Then Action (committed changes)
       - Safety: Sandbox prevents accidental mutations
       - Understanding: Users explore, then deliberately transform

       ---
       11. INTEGRATION EXAMPLE

       From the README - finding PlexusModel subclasses:

       (define (classes file-path)
         (@ (cata 'extract (parse-file file-path)) :classes))

       (filter
         (lambda (c) (member "PlexusModel" (@ c :extends)))
         (classes "src/Task.ts"))

       This demonstrates:
       1. Catamorphism - (cata 'extract ...) traverses AST once
       2. Algebra composition - extract algebra returns classes
       3. S-expression composition - filter, lambda compose the results
       4. No wrappers - direct access to metadata structure

       ---
       12. FILES AND STRUCTURE

       Key source files:
       src/
         catamorphism.ts          # Core cata/para implementations, monoidAlg helper
         discover.ts              # Discovery tool, Scheme sandbox, graph queries
         act.ts                   # Act tool, schema transforms, atomic execution
         code-entity-act.ts       # Bridge between discovery queries and AST mutations
         awareness-tool.ts        # Ambient project context, AwarenessStore singleton
         graph-builder.ts         # Shared graph construction logic
         hypergraph.ts            # Free algebra for graph construction
         server.ts                # MCP server setup, persistence

         algebras/
           extract.ts             # Metadata extraction algebra
           count.ts               # Node counting algebra
           patterns.ts            # Pattern detection
           dependencies.ts        # Dependency graph algebra
           types.ts               # Type relationship algebra
           hypergraph-interpreters.ts  # 5 interpreters (DOT, adjacency, metrics, cycles, paths)

       ---
       This system represents a shift from procedural traversal to declarative composition - you write the traversal once (catamorphism), then compose multiple analyses (algebras) without code duplication or manual recursion.