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

    private get projectRoot(): string {
        return this.executionContext?.projectPath ?? process.cwd();
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
    }

    private serializeHyperGraph(hg: HyperGraph): any {
        return hg;
    }

    private deserializeHyperGraph(hg: any): HyperGraph {
        return hg as HyperGraph;
    }
}
