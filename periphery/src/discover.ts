/**
 * Code Discovery Tool - Compositional Primitives
 *
 * Exposes catamorphism substrate - users compose queries in Scheme.
 * No opaque wrappers. Pure composition.
 */

import { DiscoveryToolInteraction } from '@here.build/arrival-mcp';
import { Project, type SourceFile } from 'ts-morph';
import * as z from 'zod';
import { readFileSync, existsSync } from 'fs';
import { glob } from 'glob';
import { resolve, relative, isAbsolute, join, dirname } from 'path';
import { cata } from './catamorphism.js';
import { countAlg, countNodesAlg } from './algebras/count.js';
import { extractAlg } from './algebras/extract.js';
import { findPatterns as findPatternsImpl } from './algebras/patterns.js';
import { dependencyAlg } from './algebras/dependencies.js';
import { typeAlg } from './algebras/types.js';
import {
    hypergraphToDOT,
    hypergraphToAdjacency,
    hypergraphMetrics,
    toCycles,
    toPathChecker,
} from './algebras/hypergraph-interpreters.js';
import { empty, vertex, edge, overlay, connect, vertices, edges as edgeList, type HyperGraph } from './hypergraph.js';
import { CodeEntityAct } from './code-entity-act.js';

// ============================================================================
// Action Specification - S-expression Act returns this
// ============================================================================

/**
 * ActionSpec is returned by act-on in the discovery sandbox.
 * It's a specification, not an execution - actual mutation happens post-sandbox.
 */
export interface ActionSpec {
    __actionSpec: true;
    target: unknown; // EntitySelector in S-expr form
    actions: unknown[][]; // Action tuples
}

/**
 * Check if a value is an ActionSpec
 */
export function isActionSpec(value: unknown): value is ActionSpec {
    return (
        typeof value === 'object' &&
        value !== null &&
        '__actionSpec' in value &&
        (value as any).__actionSpec === true
    );
}

type DiscoveryContext = {
    projectPath?: string;
};

/**
 * Code Discovery Tool - Compositional Substrate
 *
 * Exposes primitives, not pre-baked queries.
 * Composition happens in Scheme.
 */
export class Discover extends DiscoveryToolInteraction<DiscoveryContext> {
    static readonly name = 'discover';
    readonly description = 'Compositional codebase exploration via catamorphism primitives';

    readonly contextSchema = {
        projectPath: z.string().optional().describe('Path to project root (optional - defaults to CWD)'),
    };

    private projects: Map<string, Project> = new Map();
    private sourceFiles: Map<string, SourceFile> = new Map(); // Cache parsed files
    private pendingActionSpec: ActionSpec | null = null; // Captured during sandbox execution

    private get projectRoot(): string {
        return this.executionContext?.projectPath ?? process.cwd();
    }

    /**
     * Execute a query expression and return raw results.
     * Used by CodeEntityResolver to bridge discovery → entity resolution.
     *
     * @param expr S-expression to evaluate
     * @param projectPath Project root for file resolution
     * @returns Array of serialized result strings
     */
    async query(expr: string, projectPath?: string): Promise<string[]> {
        // Temporarily set execution context
        const prevContext = this.executionContext;
        (this as any).executionContext = { expr, projectPath: projectPath ?? process.cwd() };

        try {
            const result = await this.executeTool();
            // executeTool returns string | string[], normalize to array
            return Array.isArray(result) ? result : [result];
        } finally {
            (this as any).executionContext = prevContext;
        }
    }

    private resolvePath(path: string): string {
        return isAbsolute(path) ? path : resolve(this.projectRoot, path);
    }

    private findNearestTsConfig(filePath: string): string | null {
        let currentDir = dirname(filePath);
        const root = this.projectRoot;

        while (currentDir.startsWith(root)) {
            const tsConfigPath = join(currentDir, 'tsconfig.json');
            if (existsSync(tsConfigPath)) {
                return tsConfigPath;
            }
            const parentDir = dirname(currentDir);
            if (parentDir === currentDir) break;
            currentDir = parentDir;
        }
        return null;
    }

    private async loadProject(tsConfigPath?: string): Promise<Project> {
        const key = tsConfigPath ?? '__default__';

        if (this.projects.has(key)) {
            return this.projects.get(key)!;
        }

        const project = new Project({
            skipAddingFilesFromTsConfig: true,
            ...(tsConfigPath ? { tsConfigFilePath: tsConfigPath } : {}),
        });

        this.projects.set(key, project);
        return project;
    }

    private async loadSourceFile(filePath: string, tsConfigPath?: string): Promise<SourceFile> {
        const resolvedPath = this.resolvePath(filePath);

        // Check cache first
        if (this.sourceFiles.has(resolvedPath)) {
            return this.sourceFiles.get(resolvedPath)!;
        }

        if (!tsConfigPath) {
            tsConfigPath = this.findNearestTsConfig(resolvedPath) ?? undefined;
        }

        const project = await this.loadProject(tsConfigPath);

        let sourceFile = project.getSourceFile(resolvedPath);

        if (!sourceFile) {
            sourceFile = project.addSourceFileAtPath(resolvedPath);
        }

        if (!sourceFile) {
            throw new Error(`File not found: ${resolvedPath} (from: ${filePath})`);
        }

        // Cache it
        this.sourceFiles.set(resolvedPath, sourceFile);
        return sourceFile;
    }

    async registerFunctions() {
        // ========================================
        // Core Primitives
        // ========================================

        this.registerFunction(
            'parse-file',
            `Parse TypeScript file to AST (cached).

Returns: Opaque SourceFile handle for use with cata.

Example: (parse-file "src/Task.ts")
Compose with: (cata 'extract (parse-file "file.ts"))`,
            [z.string(), z.string().optional()],
            async (filePath: string, tsConfigPath?: string) => {
                const sourceFile = await this.loadSourceFile(filePath, tsConfigPath);
                // Return identifier for the source file
                return { __sourceFile: this.resolvePath(filePath) };
            }
        );

        this.registerFunction(
            'cata',
            `Run catamorphism with named algebra on parsed file.

Available algebras:
- 'extract  → {:classes [...] :interfaces [...] :functions [...] :imports [...] :exports [...]}
- 'count    → {:classes N :interfaces N :methods N :total N ...}
- 'patterns → [{:type :description :location :confidence} ...]
- 'types    → {:types [...] :relations [...]}

Dependency algebra requires file path:
- (cata-with-path 'dependencies "file.ts" source) → {:edges [...] :modules [...]}

Example: (cata 'extract (parse-file "file.ts"))
         (cata 'count (parse-file "file.ts"))
         (@ (cata 'extract (parse-file "file.ts")) :classes)

Compose: Define helpers in Scheme:
         (define (classes file) (@ (cata 'extract (parse-file file)) :classes))`,
            [z.any(), z.any()],
            async (algNameRaw: any, sourceFileHandle: any) => {
                // Convert LIPS symbol to string
                const algName = String(algNameRaw?.valueOf?.() ?? algNameRaw);

                // Validate algebra name
                const validAlgebras = ['extract', 'count', 'patterns', 'types'];
                if (!validAlgebras.includes(algName)) {
                    throw new Error(`Invalid algebra: ${algName}. Expected one of: ${validAlgebras.join(', ')}`);
                }

                // Resolve sourceFile from handle
                const filePath = sourceFileHandle.__sourceFile;
                if (!filePath) {
                    throw new Error('Invalid source file handle - use parse-file');
                }

                const sourceFile = this.sourceFiles.get(filePath);
                if (!sourceFile) {
                    throw new Error(`Source file not loaded: ${filePath}`);
                }

                switch (algName) {
                    case 'extract':
                        return cata(extractAlg)(sourceFile);
                    case 'count':
                        return cata(countAlg)(sourceFile);
                    case 'patterns':
                        return findPatternsImpl(sourceFile);
                    case 'types': {
                        const graph = cata(typeAlg)(sourceFile);
                        return {
                            types: Array.from(graph.types.entries()).map(([, info]) => info),
                            relations: graph.relations,
                        };
                    }
                }
            }
        );

        this.registerFunction(
            'cata-with-path',
            `Run catamorphism that needs file path context.

Currently only 'dependencies algebra needs path.

Example: (cata-with-path 'dependencies "src/index.ts" (parse-file "src/index.ts"))
         (@ result :edges)`,
            [z.any(), z.string(), z.any()],
            async (algNameRaw: any, filePath: string, sourceFileHandle: any) => {
                const algName = String(algNameRaw?.valueOf?.() ?? algNameRaw);

                if (algName !== 'dependencies') {
                    throw new Error(`Invalid algebra: ${algName}. Currently only 'dependencies' is supported.`);
                }
                const resolvedPath = sourceFileHandle.__sourceFile;
                if (!resolvedPath) {
                    throw new Error('Invalid source file handle - use parse-file');
                }

                const sourceFile = this.sourceFiles.get(resolvedPath);
                if (!sourceFile) {
                    throw new Error(`Source file not loaded: ${resolvedPath}`);
                }

                const graph = cata(dependencyAlg(filePath))(sourceFile);
                return {
                    edges: graph.edges,
                    modules: Array.from(graph.modules),
                };
            }
        );

        // ========================================
        // Filesystem Primitives
        // ========================================

        this.registerFunction(
            'list-files',
            'List files matching glob pattern',
            [z.string()],
            async (pattern: string) => {
                const resolvedPattern = isAbsolute(pattern) ? pattern : resolve(this.projectRoot, pattern);
                return await glob(resolvedPattern, { nodir: true });
            }
        );

        this.registerFunction(
            'read-file',
            'Read file content as string',
            [z.string()],
            (filePath: string) => {
                return readFileSync(this.resolvePath(filePath), 'utf-8');
            }
        );

        // ========================================
        // Hypergraph Construction Primitives
        // ========================================

        this.registerFunction(
            'hg-empty',
            'Empty hypergraph',
            [],
            () => this.serializeHyperGraph(empty)
        );

        this.registerFunction(
            'hg-vertex',
            'Create vertex in hypergraph',
            [z.string()],
            (v: string) => this.serializeHyperGraph(vertex(v))
        );

        this.registerFunction(
            'hg-edge',
            `Create hyperedge connecting vertices.

Example: (hg-edge "Task" "PlexusModel") ; Task → PlexusModel`,
            [z.array(z.string())],
            (vs: string[]) => this.serializeHyperGraph(edge(...vs))
        );

        this.registerFunction(
            'hg-vertices',
            'Create graph with multiple vertices',
            [z.array(z.string())],
            (vs: string[]) => this.serializeHyperGraph(vertices(vs))
        );

        this.registerFunction(
            'hg-edges',
            'Create graph from edge list',
            [z.array(z.array(z.string()))],
            (edgesList: string[][]) => this.serializeHyperGraph(edgeList(edgesList))
        );

        // ========================================
        // Hypergraph Interpreters
        // ========================================

        this.registerFunction(
            'hypergraph-to-dot',
            'Convert hypergraph to DOT format',
            [z.any()],
            (hg: any) => {
                const hypergraph = this.deserializeHyperGraph(hg);
                return hypergraphToDOT(hypergraph, 'CodeGraph');
            }
        );

        this.registerFunction(
            'hypergraph-to-adjacency',
            'Convert hypergraph to adjacency list',
            [z.any()],
            (hg: any) => {
                const hypergraph = this.deserializeHyperGraph(hg);
                const adj = hypergraphToAdjacency(hypergraph);

                const result: Record<string, string[]> = {};
                for (const [v, neighbors] of adj.entries()) {
                    result[v] = Array.from(neighbors);
                }
                return result;
            }
        );

        this.registerFunction(
            'hypergraph-metrics',
            'Get hypergraph metrics',
            [z.any()],
            (hg: any) => {
                const hypergraph = this.deserializeHyperGraph(hg);
                const metrics = hypergraphMetrics(hypergraph);
                return {
                    vertices: Array.from(metrics.vertices),
                    vertexCount: metrics.vertices.size,
                    edges: metrics.edges,
                    hyperEdges: metrics.hyperEdges,
                    density: metrics.density,
                };
            }
        );

        this.registerFunction(
            'hypergraph-cycles',
            'Find cycles in hypergraph',
            [z.any()],
            (hg: any) => {
                const hypergraph = this.deserializeHyperGraph(hg);
                return toCycles(hypergraph);
            }
        );

        this.registerFunction(
            'hypergraph-path-exists',
            'Check if path exists between vertices',
            [z.any(), z.string(), z.string()],
            (hg: any, from: string, to: string) => {
                const hypergraph = this.deserializeHyperGraph(hg);
                return toPathChecker({ from, to })(hypergraph);
            }
        );

        this.registerFunction(
            'overlay-graphs',
            'Overlay (union) two hypergraphs',
            [z.any(), z.any()],
            (hg1: any, hg2: any) => {
                const g1 = this.deserializeHyperGraph(hg1);
                const g2 = this.deserializeHyperGraph(hg2);
                const combined = overlay(g1, g2);
                return this.serializeHyperGraph(combined);
            }
        );

        this.registerFunction(
            'connect-graphs',
            'Connect two hypergraphs (cross-product)',
            [z.any(), z.any()],
            (hg1: any, hg2: any) => {
                const g1 = this.deserializeHyperGraph(hg1);
                const g2 = this.deserializeHyperGraph(hg2);
                const connected = connect(g1, g2);
                return this.serializeHyperGraph(connected);
            }
        );

        // ========================================
        // Act Integration - S-expression Actions
        // ========================================

        this.registerFunction(
            'act-on',
            `Build action specification for code transformation.

Returns an ActionSpec that will be executed after sandbox evaluation.
Does NOT mutate in the sandbox - maintains Montessori safety boundary.

Target can be:
- Entity metadata from cata 'extract (e.g., a class object)
- Entity path string: "file.ts::ClassName"
- Clone spec: (clone target) or (clone target overrides)
- New spec: (new "class" init)

Actions is a list of action specs (use list or quote):
- (list (rename "NewName")) or '((rename "NewName"))
- (list (info)) or '((info))

Example:
  (act-on (car (@ (cata 'extract (parse-file "src/foo.ts")) :classes))
    (list (rename "FooV2")))

  (act-on "src/foo.ts::MyClass" (list (info)))

  (act-on (clone "src/foo.ts::MyClass")
    (list (rename "MyClassClone") (info)))`,
            [z.any(), z.any()],
            (target: any, actionList: any) => {
                // Convert target to entity selector format
                const targetSpec = this.convertTarget(target);

                // Convert action list to array
                const actionExprs = this.pairToArray(actionList);

                // Convert action S-expressions to tuples
                const actions = actionExprs.map(expr => this.convertAction(expr));

                // Build ActionSpec - will be executed post-sandbox
                const spec: ActionSpec = {
                    __actionSpec: true,
                    target: targetSpec,
                    actions,
                };

                // Store for post-sandbox execution
                this.pendingActionSpec = spec;

                // Return a marker that indicates action pending
                return { __actionPending: true, target: targetSpec, actionCount: actions.length };
            }
        );

        // Helper: clone specification
        this.registerFunction(
            'clone',
            `Create clone specification for act-on target.

Example: (act-on (clone "src/foo.ts::MyClass") (rename "ClonedClass"))
         (act-on (clone my-class &(:name "ClonedClass")) (info))`,
            [z.any(), z.any().optional()],
            (source: any, overrides?: any) => {
                const sourceSpec = this.convertTarget(source);
                return {
                    __cloneSpec: true,
                    source: sourceSpec,
                    overrides: overrides ? this.convertOverrides(overrides) : undefined,
                };
            }
        );

        // Helper: new entity specification
        this.registerFunction(
            'new',
            `Create new entity specification for act-on target.

Example: (act-on (new "class" &(:name "NewClass" :filePath "src/new.ts")) (info))`,
            [z.string(), z.any().optional()],
            (modelType: string, init?: any) => {
                return {
                    __newSpec: true,
                    modelType,
                    init: init ? this.convertOverrides(init) : {},
                };
            }
        );

        // Action helpers - these return action tuples for act-on
        this.registerFunction('rename', 'Rename action', [z.string()],
            (newName: string) => ({ __action: 'rename', args: [newName] }));

        this.registerFunction('info', 'Get entity info', [],
            () => ({ __action: 'info', args: [] }));

        this.registerFunction('set-status', 'Set entity status', [z.string()],
            (status: string) => ({ __action: 'set-status', args: [status] }));

        this.registerFunction('move-to', 'Move entity to new parent', [z.any().optional()],
            (parentId?: any) => ({ __action: 'move-to', args: [parentId ?? null] }));

        // ========================================
        // Entity Reference Helpers
        // ========================================

        this.registerFunction(
            'entity-ref',
            `Create entity reference from file path and entity name.

Use this to reference an entity for act-on when you have file + name.

Example:
  (define classes (@ (cata 'extract (parse-file "src/foo.ts")) :classes))
  (act-on (entity-ref "src/foo.ts" (@ (car classes) :name)) (list (info)))`,
            [z.string(), z.string()],
            (filePath: string, entityName: string) => {
                return `${filePath}::${entityName}`;
            }
        );

        this.registerFunction(
            'with-file',
            `Associate file path with entity metadata.

Returns entity with :filePath added for use with act-on.

Example:
  (define classes (@ (cata 'extract (parse-file "src/foo.ts")) :classes))
  (act-on (with-file "src/foo.ts" (car classes)) (list (info)))`,
            [z.string(), z.any()],
            (filePath: string, entity: any) => {
                if (entity && typeof entity === 'object') {
                    return { ...entity, filePath };
                }
                return entity;
            }
        );

        // Object literal helper - mirrors output format &(:key value ...)
        this.registerFunction(
            'object',
            `Create a JavaScript object from a list of keyword-value pairs.

Mirrors the &(:key value ...) output format used in cata results.

Example:
  (object (list :name "foo" :count 42))
  ; => { name: "foo", count: 42 }

  (clone entity (object (list :name "NewName")))`,
            [z.any()],  // Single arg: LIPS list of key-value pairs
            (pairList: any) => {
                const args = this.pairToArray(pairList);
                const result: Record<string, any> = {};
                // Process pairs of keyword + value
                for (let i = 0; i < args.length; i += 2) {
                    const key = args[i];
                    const value = args[i + 1];
                    // Strip : prefix from keyword
                    const keyStr = String(key?.valueOf?.() ?? key);
                    const cleanKey = keyStr.startsWith(':') ? keyStr.slice(1) : keyStr;
                    result[cleanKey] = value;
                }
                return result;
            }
        );
    }

    // ========================================================================
    // Act Helpers
    // ========================================================================

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

        // Object with filePath (from with-file helper) - extract entity ID
        // Check both :filePath (LIPS keyword) and filePath (JS property)
        const filePath = target?.[':filePath'] ?? target?.filePath;
        const name = target?.[':name'] ?? target?.name;
        const type = target?.[':type'] ?? target?.type;

        if (filePath && name) {
            return `${filePath}::${name}`;
        }

        // Entity metadata from cata 'extract without file path
        if (name && type) {
            // No file path available - fall back to query (will fail but gives clear error)
            return ['query', `(find-by-name "${name}")`];
        }

        return target;
    }

    private convertAction(expr: any): unknown[] {
        // Action helper result
        if (expr?.__action) {
            return [expr.__action, ...expr.args];
        }

        // Raw array (already converted)
        if (Array.isArray(expr)) {
            return expr;
        }

        // Symbol (action name with no args)
        if (typeof expr === 'string') {
            return [expr];
        }

        // LIPS Pair - convert to array
        if (expr?.car !== undefined) {
            const arr = this.pairToArray(expr);
            const [actionName, ...args] = arr;
            return [String(actionName?.valueOf?.() ?? actionName), ...args];
        }

        throw new Error(`Invalid action expression: ${JSON.stringify(expr)}`);
    }

    private convertOverrides(obj: any): Record<string, unknown> {
        // Handle &(:key value ...) keyword object from Scheme
        if (obj && typeof obj === 'object') {
            const result: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(obj)) {
                // Strip leading : from keys if present
                const cleanKey = key.startsWith(':') ? key.slice(1) : key;
                result[cleanKey] = value;
            }
            return result;
        }
        return obj;
    }

    private pairToArray(pair: any): any[] {
        if (pair === null || pair === undefined) return [];
        if (!pair?.car) return Array.isArray(pair) ? pair : [pair];

        const result: any[] = [];
        let current = pair;
        while (current?.car !== undefined) {
            result.push(current.car);
            current = current.cdr;
        }
        return result;
    }

    // ========================================================================
    // Post-Sandbox Action Execution
    // ========================================================================

    /**
     * Override executeTool to handle ActionSpec results.
     * If act-on was called, execute the pending action via CodeEntityAct.
     */
    async executeTool(): Promise<string | string[]> {
        // Clear any pending action from previous execution
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

    private async executeActionSpec(spec: ActionSpec): Promise<string | string[]> {
        // Create CodeEntityAct instance with discover reference for query resolution
        const act = new CodeEntityAct(
            {},
            { projectRoot: this.projectRoot, discover: this },
        );

        // Set execution context
        (act as any).executionContext = {
            target: spec.target,
            actions: spec.actions,
        };

        try {
            const result = await act.executeTool();
            // Format result for display
            if (Array.isArray(result)) {
                return result.map(r => JSON.stringify(r));
            }
            return JSON.stringify(result);
        } catch (error) {
            throw new Error(`Action execution failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private serializeHyperGraph(hg: HyperGraph): any {
        return hg;
    }

    private deserializeHyperGraph(hg: any): HyperGraph {
        return hg as HyperGraph;
    }
}
