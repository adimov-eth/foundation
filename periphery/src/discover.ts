/**
 * Code Discovery Tool - Arrival MCP integration
 *
 * Exposes catamorphism-based analyses as Discovery tool primitives.
 * Composable via S-expressions in Scheme.
 */

import { DiscoveryToolInteraction } from '@here.build/arrival-mcp';
import { Project } from 'ts-morph';
import * as z from 'zod';
import { readFileSync, statSync } from 'fs';
import { glob } from 'glob';
import { resolve, relative, isAbsolute, join, dirname } from 'path';
import { cata } from './catamorphism.js';
import {
    countAlg,
    countNodesAlg,
    type Counts,
} from './algebras/count.js';
import {
    extractAlg,
    type Metadata,
} from './algebras/extract.js';
import {
    findPatterns,
    filterPatterns,
    filterByConfidence,
    groupPatternsByType,
    type Patterns,
} from './algebras/patterns.js';
import {
    dependencyAlg,
    findCycles,
    topologicalSort,
    getDependencies,
    getDependents,
    toDOT as depsToDOT,
    type DependencyGraph,
} from './algebras/dependencies.js';
import {
    typeAlg,
    findSubtypes,
    findSupertypes,
    getInheritanceHierarchy,
    typeGraphToDOT,
    type TypeGraph,
} from './algebras/types.js';
import {
    metadataToInheritanceGraph,
    metadataToCallGraph,
    dependencyGraphToHG,
    typeGraphToHG,
    combinedCodeGraph,
    plexusModelGraph,
} from './algebras/ast-to-hypergraph.js';
import {
    hypergraphToDOT,
    hypergraphToAdjacency,
    hypergraphMetrics,
    toCycles,
    toPathChecker,
    type AdjacencyList,
} from './algebras/hypergraph-interpreters.js';
import { overlay, connect, type HyperGraph } from './hypergraph.js';

/**
 * Code Discovery Tool
 *
 * Registers catamorphism-based analyses as composable primitives.
 * Accepts both absolute and relative paths - relative paths resolved against project root.
 */
export class Discover extends DiscoveryToolInteraction<Record<string, never>> {
    static readonly name = 'discover';
    readonly description = 'Codebase exploration: filesystem primitives + compositional AST analysis';

    private project: Project | null = null;

    /**
     * Get project root from state or default to process.cwd()
     */
    private get projectRoot(): string {
        return this.state.projectRoot ?? process.cwd();
    }

    /**
     * Resolve path against project root if relative, or use as-is if absolute
     */
    private resolvePath(path: string): string {
        return isAbsolute(path) ? path : resolve(this.projectRoot, path);
    }

    /**
     * Initialize ts-morph project
     */
    private async loadProject(tsConfigPath?: string): Promise<Project> {
        if (this.project) return this.project;

        this.project = new Project({
            tsConfigFilePath: tsConfigPath ?? './tsconfig.json',
        });

        return this.project;
    }

    /**
     * Helper: get source file from path (accepts relative or absolute)
     */
    private async loadSourceFile(filePath: string, tsConfigPath?: string) {
        const resolvedPath = this.resolvePath(filePath);
        const project = await this.loadProject(tsConfigPath);

        // Try to get existing source file first
        let sourceFile = project.getSourceFile(resolvedPath);

        // If not found, add it to the project
        if (!sourceFile) {
            sourceFile = project.addSourceFileAtPath(resolvedPath);
        }

        if (!sourceFile) {
            throw new Error(`File not found: ${resolvedPath} (from: ${filePath})`);
        }
        return sourceFile;
    }

    async registerFunctions() {
        // ========================================
        // Filesystem Primitives
        // ========================================

        this.registerFunction(
            'list-files',
            'List files matching glob pattern (relative to project root or absolute)',
            [z.string()],
            async (pattern: string) => {
                // Resolve glob pattern relative to project root
                const resolvedPattern = isAbsolute(pattern) ? pattern : resolve(this.projectRoot, pattern);
                return await glob(resolvedPattern, { nodir: true });
            }
        );

        this.registerFunction(
            'read-file',
            'Read file content as string (relative to project root or absolute)',
            [z.string()],
            (filePath: string) => {
                return readFileSync(this.resolvePath(filePath), 'utf-8');
            }
        );

        this.registerFunction(
            'file-stats',
            'Get file statistics (size, modified time, etc.) (relative to project root or absolute)',
            [z.string()],
            (filePath: string) => {
                const stats = statSync(this.resolvePath(filePath));
                return {
                    size: stats.size,
                    modified: stats.mtime.toISOString(),
                    created: stats.birthtime.toISOString(),
                    isFile: stats.isFile(),
                    isDirectory: stats.isDirectory(),
                };
            }
        );

        this.registerFunction(
            'grep-content',
            'Search for pattern in file content (relative to project root or absolute)',
            [z.string(), z.string()],
            (pattern: string, filePath: string) => {
                const content = readFileSync(this.resolvePath(filePath), 'utf-8');
                const regex = new RegExp(pattern, 'gm');
                const matches: Array<{ line: number; text: string; match: string }> = [];

                const lines = content.split('\n');
                lines.forEach((lineText, idx) => {
                    const lineMatches = lineText.match(regex);
                    if (lineMatches) {
                        matches.push({
                            line: idx + 1,
                            text: lineText.trim(),
                            match: lineMatches[0],
                        });
                    }
                });

                return matches;
            }
        );

        // ========================================
        // Composition Helpers
        // ========================================

        this.registerFunction(
            'member',
            'Check if item is in list',
            [z.any(), z.any()],
            (item: any, list: any) => {
                if (!list) return false;
                if (Array.isArray(list)) {
                    return list.some(x => {
                        // Handle string comparison
                        if (typeof x === 'string' && typeof item === 'string') {
                            return x === item;
                        }
                        // Handle deep equality for objects
                        return JSON.stringify(x) === JSON.stringify(item);
                    });
                }
                return false;
            }
        );

        this.registerFunction(
            'string-contains?',
            'Check if string contains substring',
            [z.string(), z.string()],
            (str: string, substr: string) => {
                return str.includes(substr);
            }
        );

        this.registerFunction(
            'string-starts-with?',
            'Check if string starts with prefix',
            [z.string(), z.string()],
            (str: string, prefix: string) => {
                return str.startsWith(prefix);
            }
        );

        this.registerFunction(
            'string-ends-with?',
            'Check if string ends with suffix',
            [z.string(), z.string()],
            (str: string, suffix: string) => {
                return str.endsWith(suffix);
            }
        );

        this.registerFunction(
            'string-match',
            'Test if string matches regex pattern',
            [z.string(), z.string()],
            (pattern: string, str: string) => {
                try {
                    const regex = new RegExp(pattern);
                    return regex.test(str);
                } catch {
                    return false;
                }
            }
        );

        // ========================================
        // Count Algebra
        // ========================================

        this.registerFunction(
            'count-nodes',
            'Count total AST nodes in a file',
            [z.string(), z.string().optional()],
            async (filePath: string, tsConfigPath?: string) => {
                const sourceFile = await this.loadSourceFile(filePath, tsConfigPath);
                return cata(countNodesAlg)(sourceFile);
            }
        );

        this.registerFunction(
            'count-by-type',
            `Count AST nodes by type using catamorphism.

Returns: {:classes N :interfaces N :methods N :properties N :functions N :imports N :exports N :callExprs N :total N}

Example: (count-by-type "src/Task.ts")
Useful for: Quick codebase metrics, finding large files, complexity estimation`,
            [z.string(), z.string().optional()],
            async (filePath: string, tsConfigPath?: string) => {
                const sourceFile = await this.loadSourceFile(filePath, tsConfigPath);
                return cata(countAlg)(sourceFile);
            }
        );

        // ========================================
        // Extract Algebra
        // ========================================

        this.registerFunction(
            'extract-metadata',
            `Extract structured metadata using catamorphism.

Returns: {:classes [{:name :extends :implements :methods :properties}...] :interfaces [...] :functions [...] :imports [...] :exports [...] :typeNames [...]}

Example: (extract-metadata "src/Task.ts")
Then: (@ (car (@ result :classes)) :name) => class name
Compose with: find-classes, find-interfaces, filter`,
            [z.string(), z.string().optional()],
            async (filePath: string, tsConfigPath?: string) => {
                const sourceFile = await this.loadSourceFile(filePath, tsConfigPath);
                return cata(extractAlg)(sourceFile);
            }
        );

        this.registerFunction(
            'find-classes',
            `Find all classes in a file (shortcut for extract-metadata classes).

Returns: List of class metadata {:name :extends :implements :methods :properties}

Example: (find-classes "src/Task.ts")
Then: (filter (lambda (c) (member "PlexusModel" (@ c :extends))) (find-classes "src/Task.ts"))`,
            [z.string(), z.string().optional()],
            async (filePath: string, tsConfigPath?: string) => {
                const sourceFile = await this.loadSourceFile(filePath, tsConfigPath);
                const metadata = cata(extractAlg)(sourceFile);
                return metadata.classes;
            }
        );

        this.registerFunction(
            'find-interfaces',
            'Find all interfaces in a file',
            [z.string(), z.string().optional()],
            async (filePath: string, tsConfigPath?: string) => {
                const sourceFile = await this.loadSourceFile(filePath, tsConfigPath);
                const metadata = cata(extractAlg)(sourceFile);
                return metadata.interfaces;
            }
        );

        // ========================================
        // Pattern Detection Algebra
        // ========================================

        this.registerFunction(
            'find-patterns',
            `Find code patterns in a file using paramorphism-based detection.

Returns list of patterns with :type, :description, :location {:className, :methodName}, :confidence.

Pattern types detected:
- plexus-model: Classes extending PlexusModel
- emancipate-call: Calls to emancipate() method (Plexus parent removal)
- array-splice: Array.splice operations (potential emancipation)
- parent-assignment: Parent property assignments (adoption)

Example: (find-patterns "src/Task.ts")
Returns: [{:type "plexus-model" :description "Class Task extends PlexusModel" :location {:className "Task"} :confidence 1.0} ...]

Compose with: filter, find-pattern-type, find-high-confidence-patterns`,
            [z.string(), z.string().optional()],
            async (filePath: string, tsConfigPath?: string) => {
                const sourceFile = await this.loadSourceFile(filePath, tsConfigPath);
                return findPatterns(sourceFile);
            }
        );

        this.registerFunction(
            'find-pattern-type',
            `Find patterns of a specific type.

Types: plexus-model, emancipate-call, array-splice, parent-assignment

Example: (find-pattern-type "src/Task.ts" "emancipate-call")
Returns: Filtered list of patterns matching the type`,
            [z.string(), z.string(), z.string().optional()],
            async (
                filePath: string,
                patternType: string,
                tsConfigPath?: string
            ) => {
                const sourceFile = await this.loadSourceFile(filePath, tsConfigPath);
                const patterns = findPatterns(sourceFile);
                return filterPatterns(patterns, patternType);
            }
        );

        this.registerFunction(
            'find-high-confidence-patterns',
            'Find patterns above confidence threshold',
            [z.string(), z.number(), z.string().optional()],
            async (
                filePath: string,
                minConfidence: number,
                tsConfigPath?: string
            ) => {
                const sourceFile = await this.loadSourceFile(filePath, tsConfigPath);
                const patterns = findPatterns(sourceFile);
                return filterByConfidence(patterns, minConfidence);
            }
        );

        this.registerFunction(
            'group-patterns',
            'Group patterns by type',
            [z.string(), z.string().optional()],
            async (filePath: string, tsConfigPath?: string) => {
                const sourceFile = await this.loadSourceFile(filePath, tsConfigPath);
                const patterns = findPatterns(sourceFile);
                return groupPatternsByType(patterns);
            }
        );

        // ========================================
        // Dependency Graph Algebra
        // ========================================

        this.registerFunction(
            'dependency-graph',
            `Build module dependency graph from imports.

Returns: {:edges [{:from :to :symbols}...] :modules [...]}

Example: (dependency-graph "src/index.ts")
Compose with: find-cycles, topological-sort, deps-to-dot
Use for: Detecting circular deps, understanding module structure`,
            [z.string(), z.string().optional()],
            async (filePath: string, tsConfigPath?: string) => {
                const sourceFile = await this.loadSourceFile(filePath, tsConfigPath);
                const graph = cata(dependencyAlg(filePath))(sourceFile);
                return {
                    edges: graph.edges,
                    modules: Array.from(graph.modules),
                };
            }
        );

        this.registerFunction(
            'find-cycles',
            `Find circular dependencies in module graph.

Returns: List of cycles [[module1 module2 module1] ...]

Example: (find-cycles "src/index.ts")
Returns: Empty list if no cycles, or list of circular paths
Use for: Architecture validation, refactoring planning`,
            [z.string(), z.string().optional()],
            async (filePath: string, tsConfigPath?: string) => {
                const sourceFile = await this.loadSourceFile(filePath, tsConfigPath);
                const graph = cata(dependencyAlg(filePath))(sourceFile);
                return findCycles(graph);
            }
        );

        this.registerFunction(
            'topological-sort',
            'Sort modules in dependency order',
            [z.string(), z.string().optional()],
            async (filePath: string, tsConfigPath?: string) => {
                const sourceFile = await this.loadSourceFile(filePath, tsConfigPath);
                const graph = cata(dependencyAlg(filePath))(sourceFile);
                return topologicalSort(graph);
            }
        );

        this.registerFunction(
            'deps-to-dot',
            'Convert dependency graph to DOT format',
            [z.string(), z.string().optional()],
            async (filePath: string, tsConfigPath?: string) => {
                const sourceFile = await this.loadSourceFile(filePath, tsConfigPath);
                const graph = cata(dependencyAlg(filePath))(sourceFile);
                return depsToDOT(graph);
            }
        );

        // ========================================
        // Type Graph Algebra
        // ========================================

        this.registerFunction(
            'type-graph',
            'Build type relationship graph',
            [z.string(), z.string().optional()],
            async (filePath: string, tsConfigPath?: string) => {
                const sourceFile = await this.loadSourceFile(filePath, tsConfigPath);
                const graph = cata(typeAlg)(sourceFile);
                return {
                    types: Array.from(graph.types.entries()).map(([, info]) => info),
                    relations: graph.relations,
                };
            }
        );

        this.registerFunction(
            'find-subtypes',
            `Find all types that extend a given type.

Returns: List of type names that inherit from the base type

Example: (find-subtypes "src/models.ts" "PlexusModel")
Returns: ["Task" "Team" "Project" ...]
Use for: Finding all implementations, understanding class hierarchies`,
            [z.string(), z.string(), z.string().optional()],
            async (
                filePath: string,
                typeName: string,
                tsConfigPath?: string
            ) => {
                const sourceFile = await this.loadSourceFile(filePath, tsConfigPath);
                const graph = cata(typeAlg)(sourceFile);
                return findSubtypes(graph, typeName);
            }
        );

        this.registerFunction(
            'inheritance-hierarchy',
            'Get complete inheritance hierarchy for a type',
            [z.string(), z.string(), z.string().optional()],
            async (
                filePath: string,
                typeName: string,
                tsConfigPath?: string
            ) => {
                const sourceFile = await this.loadSourceFile(filePath, tsConfigPath);
                const graph = cata(typeAlg)(sourceFile);
                return getInheritanceHierarchy(graph, typeName);
            }
        );

        this.registerFunction(
            'type-graph-to-dot',
            'Convert type graph to DOT format',
            [z.string(), z.string().optional()],
            async (filePath: string, tsConfigPath?: string) => {
                const sourceFile = await this.loadSourceFile(filePath, tsConfigPath);
                const graph = cata(typeAlg)(sourceFile);
                return typeGraphToDOT(graph);
            }
        );

        // ========================================
        // Hypergraph Functions
        // ========================================

        this.registerFunction(
            'build-inheritance-hypergraph',
            `Build inheritance hypergraph from file metadata.

Creates directed edges from subclass → superclass for all extends/implements relationships.

Returns: HyperGraph structure (use with hypergraph-to-dot or hypergraph-to-adjacency)

Example: (build-inheritance-hypergraph "src/models.ts")
Compose with: overlay-graphs, hypergraph-to-dot
Use for: Visualizing class hierarchies, finding inheritance chains`,
            [z.string(), z.string().optional()],
            async (filePath: string, tsConfigPath?: string) => {
                const sourceFile = await this.loadSourceFile(filePath, tsConfigPath);
                const metadata = cata(extractAlg)(sourceFile);
                const hg = metadataToInheritanceGraph(metadata);
                return this.serializeHyperGraph(hg);
            }
        );

        this.registerFunction(
            'build-call-hypergraph',
            `Build call graph hypergraph from file metadata.

Creates edges between classes based on property types and method signatures.

Returns: HyperGraph structure

Example: (build-call-hypergraph "src/models.ts")
Use for: Understanding class dependencies, finding coupling`,
            [z.string(), z.string().optional()],
            async (filePath: string, tsConfigPath?: string) => {
                const sourceFile = await this.loadSourceFile(filePath, tsConfigPath);
                const metadata = cata(extractAlg)(sourceFile);
                const hg = metadataToCallGraph(metadata);
                return this.serializeHyperGraph(hg);
            }
        );

        this.registerFunction(
            'build-dependency-hypergraph',
            `Build module dependency hypergraph.

Creates edges for import/export relationships between modules.

Returns: HyperGraph structure

Example: (build-dependency-hypergraph "src/index.ts")
Compose with: hypergraph-cycles, overlay-graphs`,
            [z.string(), z.string().optional()],
            async (filePath: string, tsConfigPath?: string) => {
                const sourceFile = await this.loadSourceFile(filePath, tsConfigPath);
                const graph = cata(dependencyAlg(filePath))(sourceFile);
                const hg = dependencyGraphToHG(graph);
                return this.serializeHyperGraph(hg);
            }
        );

        this.registerFunction(
            'build-type-hypergraph',
            `Build type relationship hypergraph.

Creates edges for type extends/implements relationships.

Returns: HyperGraph structure

Example: (build-type-hypergraph "src/types.ts")`,
            [z.string(), z.string().optional()],
            async (filePath: string, tsConfigPath?: string) => {
                const sourceFile = await this.loadSourceFile(filePath, tsConfigPath);
                const graph = cata(typeAlg)(sourceFile);
                const hg = typeGraphToHG(graph);
                return this.serializeHyperGraph(hg);
            }
        );

        this.registerFunction(
            'build-plexus-model-graph',
            `Build graph of PlexusModel subclasses and their relationships.

Returns: HyperGraph of just PlexusModel classes

Example: (build-plexus-model-graph "src/models.ts")
Use for: Visualizing Plexus entity relationships`,
            [z.string(), z.string().optional()],
            async (filePath: string, tsConfigPath?: string) => {
                const sourceFile = await this.loadSourceFile(filePath, tsConfigPath);
                const metadata = cata(extractAlg)(sourceFile);
                const hg = plexusModelGraph(metadata);
                return this.serializeHyperGraph(hg);
            }
        );

        this.registerFunction(
            'hypergraph-to-dot',
            `Convert hypergraph to DOT format for Graphviz visualization.

Returns: String in DOT format

Example: (hypergraph-to-dot (build-inheritance-hypergraph "src/models.ts"))
Then: Save to file and run: dot -Tpng graph.dot -o graph.png`,
            [z.any()],
            (hg: any) => {
                const hypergraph = this.deserializeHyperGraph(hg);
                return hypergraphToDOT(hypergraph, 'CodeGraph');
            }
        );

        this.registerFunction(
            'hypergraph-to-adjacency',
            `Convert hypergraph to adjacency list representation.

Returns: Map of vertex → neighbors

Example: (hypergraph-to-adjacency (build-inheritance-hypergraph "src/models.ts"))
Use for: Graph algorithms, path finding`,
            [z.any()],
            (hg: any) => {
                const hypergraph = this.deserializeHyperGraph(hg);
                const adj = hypergraphToAdjacency(hypergraph);

                // Convert Map<string, Set<string>> to object for Scheme
                const result: Record<string, string[]> = {};
                for (const [v, neighbors] of adj.entries()) {
                    result[v] = Array.from(neighbors);
                }
                return result;
            }
        );

        this.registerFunction(
            'hypergraph-metrics',
            `Get metrics about hypergraph structure.

Returns: {:vertices N :edges N :hyperEdges N :density 0.0-1.0}

Example: (hypergraph-metrics (build-inheritance-hypergraph "src/models.ts"))`,
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
            `Find cycles in hypergraph.

Returns: List of cycles [[v1 v2 v3 v1] ...]

Example: (hypergraph-cycles (build-dependency-hypergraph "src/index.ts"))
Use for: Detecting circular dependencies`,
            [z.any()],
            (hg: any) => {
                const hypergraph = this.deserializeHyperGraph(hg);
                return toCycles(hypergraph);
            }
        );

        this.registerFunction(
            'hypergraph-path-exists',
            `Check if path exists between two vertices.

Returns: true/false

Example: (hypergraph-path-exists (build-inheritance-hypergraph "src/models.ts") "Task" "PlexusModel")
Use for: Reachability queries, inheritance checking`,
            [z.any(), z.string(), z.string()],
            (hg: any, from: string, to: string) => {
                const hypergraph = this.deserializeHyperGraph(hg);
                return toPathChecker({ from, to })(hypergraph);
            }
        );

        this.registerFunction(
            'overlay-graphs',
            `Overlay (union) two hypergraphs.

Returns: Combined HyperGraph

Example: (overlay-graphs (build-inheritance-hypergraph "f.ts") (build-call-hypergraph "f.ts"))
Use for: Combining multiple views of code structure`,
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
            `Connect two hypergraphs (all vertices from left → all vertices from right).

Returns: Connected HyperGraph

Example: (connect-graphs (build-plexus-model-graph "f.ts") base-model-graph)
Use for: Adding cross-graph relationships`,
            [z.any(), z.any()],
            (hg1: any, hg2: any) => {
                const g1 = this.deserializeHyperGraph(hg1);
                const g2 = this.deserializeHyperGraph(hg2);
                const connected = connect(g1, g2);
                return this.serializeHyperGraph(connected);
            }
        );
    }

    /**
     * Serialize HyperGraph for transport
     */
    private serializeHyperGraph(hg: HyperGraph): any {
        return hg;  // Already JSON-serializable
    }

    /**
     * Deserialize HyperGraph from transport
     */
    private deserializeHyperGraph(hg: any): HyperGraph {
        return hg as HyperGraph;  // Trust the structure
    }
}
