/**
 * ProjectGraph: Composed hypergraph for codebase awareness
 *
 * Overlays multiple relationship graphs into single queryable structure.
 * Rebuilt incrementally as files change.
 */

import { Project, SourceFile } from 'ts-morph';
import {
    empty,
    overlay,
    vertices,
    edges as edgeList,
    hypergraphToAdjacency,
    hypergraphMetrics,
    toCycles,
    toPathChecker,
    type HyperGraph,
    type AdjacencyList,
    type Metrics,
} from '@here.build/periphery';

// ============================================================================
// Types
// ============================================================================

export type NodeKind = 'file' | 'class' | 'interface' | 'function' | 'method' | 'variable';
export type EdgeKind = 'imports' | 'extends' | 'implements' | 'calls' | 'references' | 'contains';

export interface GraphNode {
    id: string;           // Unique: "file.ts::ClassName" or "file.ts"
    kind: NodeKind;
    name: string;
    filePath: string;
    line?: number;
    metadata?: Record<string, unknown>;
}

export interface GraphEdge {
    from: string;         // Node ID
    to: string;           // Node ID
    kind: EdgeKind;
    metadata?: Record<string, unknown>;
}

export interface ProjectGraphState {
    nodes: Map<string, GraphNode>;
    edges: GraphEdge[];
    hypergraph: HyperGraph;
    fileContributions: Map<string, { nodes: string[]; edges: GraphEdge[] }>;
    lastUpdate: Map<string, number>; // file -> mtime
}

// ============================================================================
// Extraction from ts-morph
// ============================================================================

function extractFromFile(sourceFile: SourceFile, filePath: string): { nodes: GraphNode[]; edges: GraphEdge[] } {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    const fileId = filePath;

    // File node
    nodes.push({
        id: fileId,
        kind: 'file',
        name: filePath,
        filePath,
    });

    // Classes
    for (const cls of sourceFile.getClasses()) {
        const name = cls.getName();
        if (!name) continue;

        const classId = `${filePath}::${name}`;
        nodes.push({
            id: classId,
            kind: 'class',
            name,
            filePath,
            line: cls.getStartLineNumber(),
        });

        // File contains class
        edges.push({ from: fileId, to: classId, kind: 'contains' });

        // Extends
        const baseClass = cls.getBaseClass();
        if (baseClass) {
            const baseFile = baseClass.getSourceFile().getFilePath();
            const baseName = baseClass.getName();
            if (baseName) {
                const baseId = `${baseFile}::${baseName}`;
                edges.push({ from: classId, to: baseId, kind: 'extends' });
            }
        }

        // Implements
        for (const impl of cls.getImplements()) {
            const implText = impl.getText();
            // Try to resolve the interface
            const symbol = impl.getType().getSymbol();
            if (symbol) {
                const decls = symbol.getDeclarations();
                if (decls.length > 0) {
                    const decl = decls[0];
                    const implFile = decl.getSourceFile().getFilePath();
                    const implId = `${implFile}::${implText}`;
                    edges.push({ from: classId, to: implId, kind: 'implements' });
                }
            }
        }

        // Methods
        for (const method of cls.getMethods()) {
            const methodName = method.getName();
            const methodId = `${classId}::${methodName}`;
            nodes.push({
                id: methodId,
                kind: 'method',
                name: methodName,
                filePath,
                line: method.getStartLineNumber(),
            });
            edges.push({ from: classId, to: methodId, kind: 'contains' });
        }
    }

    // Interfaces
    for (const iface of sourceFile.getInterfaces()) {
        const name = iface.getName();
        const ifaceId = `${filePath}::${name}`;
        nodes.push({
            id: ifaceId,
            kind: 'interface',
            name,
            filePath,
            line: iface.getStartLineNumber(),
        });
        edges.push({ from: fileId, to: ifaceId, kind: 'contains' });

        // Extends interfaces
        for (const ext of iface.getExtends()) {
            const extText = ext.getText();
            const symbol = ext.getType().getSymbol();
            if (symbol) {
                const decls = symbol.getDeclarations();
                if (decls.length > 0) {
                    const decl = decls[0];
                    const extFile = decl.getSourceFile().getFilePath();
                    const extId = `${extFile}::${extText}`;
                    edges.push({ from: ifaceId, to: extId, kind: 'extends' });
                }
            }
        }
    }

    // Functions
    for (const fn of sourceFile.getFunctions()) {
        const name = fn.getName();
        if (!name) continue;

        const fnId = `${filePath}::${name}`;
        nodes.push({
            id: fnId,
            kind: 'function',
            name,
            filePath,
            line: fn.getStartLineNumber(),
        });
        edges.push({ from: fileId, to: fnId, kind: 'contains' });
    }

    // Imports
    for (const imp of sourceFile.getImportDeclarations()) {
        const moduleSpecifier = imp.getModuleSpecifierValue();

        // Resolve to actual file if relative import
        if (moduleSpecifier.startsWith('.')) {
            const resolved = imp.getModuleSpecifierSourceFile();
            if (resolved) {
                const targetPath = resolved.getFilePath();
                edges.push({
                    from: fileId,
                    to: targetPath,
                    kind: 'imports',
                    metadata: { specifier: moduleSpecifier }
                });
            }
        }
    }

    return { nodes, edges };
}

// ============================================================================
// ProjectGraph class
// ============================================================================

export class ProjectGraph {
    private state: ProjectGraphState;
    private project: Project;

    constructor(projectRoot: string, tsConfigPath?: string) {
        this.project = new Project({
            tsConfigFilePath: tsConfigPath,
            skipAddingFilesFromTsConfig: !tsConfigPath,
        });

        if (!tsConfigPath) {
            // Add all TS files in project
            this.project.addSourceFilesAtPaths(`${projectRoot}/**/*.ts`);
        }

        this.state = {
            nodes: new Map(),
            edges: [],
            hypergraph: empty,
            fileContributions: new Map(),
            lastUpdate: new Map(),
        };
    }

    /** Build full graph from all source files */
    build(): void {
        const startTime = Date.now();

        for (const sourceFile of this.project.getSourceFiles()) {
            const filePath = sourceFile.getFilePath();

            // Skip node_modules and dist
            if (filePath.includes('node_modules') || filePath.includes('/dist/')) {
                continue;
            }

            this.addFile(sourceFile);
        }

        this.rebuildHypergraph();

        console.log(`[awareness] Built graph: ${this.state.nodes.size} nodes, ${this.state.edges.length} edges in ${Date.now() - startTime}ms`);
    }

    /** Add/update a single file's contribution */
    addFile(sourceFile: SourceFile): void {
        const filePath = sourceFile.getFilePath();

        // Remove old contribution if exists
        this.removeFile(filePath);

        // Extract new data
        const { nodes, edges } = extractFromFile(sourceFile, filePath);

        // Add to state
        for (const node of nodes) {
            this.state.nodes.set(node.id, node);
        }
        this.state.edges.push(...edges);

        // Track contribution
        this.state.fileContributions.set(filePath, {
            nodes: nodes.map(n => n.id),
            edges,
        });
        this.state.lastUpdate.set(filePath, Date.now());
    }

    /** Remove a file's contribution */
    removeFile(filePath: string): void {
        const contribution = this.state.fileContributions.get(filePath);
        if (!contribution) return;

        // Remove nodes
        for (const nodeId of contribution.nodes) {
            this.state.nodes.delete(nodeId);
        }

        // Remove edges (by reference equality)
        const edgeSet = new Set(contribution.edges);
        this.state.edges = this.state.edges.filter(e => !edgeSet.has(e));

        this.state.fileContributions.delete(filePath);
        this.state.lastUpdate.delete(filePath);
    }

    /** Rebuild hypergraph from current nodes/edges */
    private rebuildHypergraph(): void {
        // Create vertices for all nodes
        const nodeIds = Array.from(this.state.nodes.keys());
        const vertexGraph = vertices(nodeIds);

        // Create edges
        const edgePairs = this.state.edges.map(e => [e.from, e.to] as [string, string]);
        const edgeGraph = edgeList(edgePairs);

        // Overlay
        this.state.hypergraph = overlay(vertexGraph, edgeGraph);
    }

    /** Update file if changed */
    updateFile(filePath: string): boolean {
        const sourceFile = this.project.getSourceFile(filePath);
        if (!sourceFile) {
            // File was deleted
            this.removeFile(filePath);
            this.rebuildHypergraph();
            return true;
        }

        // Refresh from disk
        sourceFile.refreshFromFileSystemSync();
        this.addFile(sourceFile);
        this.rebuildHypergraph();
        return true;
    }

    /** Add new file to project */
    addNewFile(filePath: string): void {
        const sourceFile = this.project.addSourceFileAtPath(filePath);
        this.addFile(sourceFile);
        this.rebuildHypergraph();
    }

    // ========================================================================
    // Queries
    // ========================================================================

    /** Get node by ID */
    getNode(id: string): GraphNode | undefined {
        return this.state.nodes.get(id);
    }

    /** Get all nodes of a kind */
    getNodesByKind(kind: NodeKind): GraphNode[] {
        return Array.from(this.state.nodes.values()).filter(n => n.kind === kind);
    }

    /** Get all nodes in a file */
    getNodesInFile(filePath: string): GraphNode[] {
        return Array.from(this.state.nodes.values()).filter(n => n.filePath === filePath);
    }

    /** What does this node depend on? (outgoing edges) */
    dependsOn(nodeId: string): { node: GraphNode; edge: GraphEdge }[] {
        const results: { node: GraphNode; edge: GraphEdge }[] = [];

        for (const edge of this.state.edges) {
            if (edge.from === nodeId) {
                const node = this.state.nodes.get(edge.to);
                if (node) {
                    results.push({ node, edge });
                }
            }
        }

        return results;
    }

    /** What uses this node? (incoming edges) */
    usedBy(nodeId: string): { node: GraphNode; edge: GraphEdge }[] {
        const results: { node: GraphNode; edge: GraphEdge }[] = [];

        for (const edge of this.state.edges) {
            if (edge.to === nodeId) {
                const node = this.state.nodes.get(edge.from);
                if (node) {
                    results.push({ node, edge });
                }
            }
        }

        return results;
    }

    /** Get inheritance chain (extends/implements) */
    inheritanceChain(nodeId: string): GraphNode[] {
        const chain: GraphNode[] = [];
        const visited = new Set<string>();

        const walk = (id: string) => {
            if (visited.has(id)) return;
            visited.add(id);

            const node = this.state.nodes.get(id);
            if (node) chain.push(node);

            for (const edge of this.state.edges) {
                if (edge.from === id && (edge.kind === 'extends' || edge.kind === 'implements')) {
                    walk(edge.to);
                }
            }
        };

        walk(nodeId);
        return chain;
    }

    /** What files would be affected by changing this node? */
    impactOf(nodeId: string): string[] {
        const affected = new Set<string>();
        const visited = new Set<string>();

        const walk = (id: string) => {
            if (visited.has(id)) return;
            visited.add(id);

            const node = this.state.nodes.get(id);
            if (node) affected.add(node.filePath);

            // Walk reverse edges (what uses this)
            for (const edge of this.state.edges) {
                if (edge.to === id) {
                    walk(edge.from);
                }
            }
        };

        walk(nodeId);
        return Array.from(affected);
    }

    /** Find path between two nodes */
    pathBetween(fromId: string, toId: string): boolean {
        return toPathChecker({ from: fromId, to: toId })(this.state.hypergraph);
    }

    /** Get cycles in the graph */
    getCycles(): string[][] {
        return toCycles(this.state.hypergraph);
    }

    /** Get graph metrics */
    getMetrics(): Metrics {
        return hypergraphMetrics(this.state.hypergraph);
    }

    /** Get adjacency list */
    getAdjacencyList(): AdjacencyList {
        return hypergraphToAdjacency(this.state.hypergraph);
    }

    /** Search nodes by name pattern */
    searchNodes(pattern: string): GraphNode[] {
        const regex = new RegExp(pattern, 'i');
        return Array.from(this.state.nodes.values()).filter(n => regex.test(n.name));
    }

    /** Get edges by kind */
    getEdgesByKind(kind: EdgeKind): GraphEdge[] {
        return this.state.edges.filter(e => e.kind === kind);
    }

    /** Summary stats */
    getSummary(): {
        files: number;
        classes: number;
        interfaces: number;
        functions: number;
        methods: number;
        edges: Record<EdgeKind, number>;
    } {
        const nodes = Array.from(this.state.nodes.values());
        const edgeCounts: Record<EdgeKind, number> = {
            imports: 0, extends: 0, implements: 0, calls: 0, references: 0, contains: 0
        };

        for (const edge of this.state.edges) {
            edgeCounts[edge.kind]++;
        }

        return {
            files: nodes.filter(n => n.kind === 'file').length,
            classes: nodes.filter(n => n.kind === 'class').length,
            interfaces: nodes.filter(n => n.kind === 'interface').length,
            functions: nodes.filter(n => n.kind === 'function').length,
            methods: nodes.filter(n => n.kind === 'method').length,
            edges: edgeCounts,
        };
    }
}
