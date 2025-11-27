/**
 * Awareness Persistence Layer
 *
 * Serializes/deserializes AwarenessState to S-expression format.
 * Stored in .periphery/awareness.scm for git tracking.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import type { GraphNode, GraphEdge, GraphNodeKind, GraphEdgeKind } from './discover.js';

// ============================================================================
// Types
// ============================================================================

export interface AwarenessState {
    projectName: string;
    projectRoot: string;
    generated: string; // ISO timestamp
    version: number;   // Schema version for migrations
    summary: {
        files: number;
        classes: number;
        interfaces: number;
        functions: number;
        methods: number;
        edges: number;
    };
    nodes: Map<string, GraphNode>;
    edges: GraphEdge[];
}

export interface TopEntity {
    kind: GraphNodeKind;
    name: string;
    id: string;
    dependents: number;
}

export interface RecentChange {
    file: string;
    change: 'added' | 'modified' | 'deleted';
    timestamp: string;
}

// ============================================================================
// Paths
// ============================================================================

const AWARENESS_DIR = '.periphery';
const AWARENESS_FILE = 'awareness.scm';

export function getAwarenessPath(projectRoot: string): string {
    return join(projectRoot, AWARENESS_DIR, AWARENESS_FILE);
}

// ============================================================================
// Serialization - S-expression format
// ============================================================================

function escapeString(s: string): string {
    return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function serializeNode(node: GraphNode): string {
    const line = node.line !== undefined ? `:line ${node.line}` : '';
    return `(node :id "${escapeString(node.id)}" :kind ${node.kind} :name "${escapeString(node.name)}" :filePath "${escapeString(node.filePath)}"${line})`;
}

function serializeEdge(edge: GraphEdge): string {
    return `(edge :from "${escapeString(edge.from)}" :to "${escapeString(edge.to)}" :kind ${edge.kind})`;
}

export function serialize(state: AwarenessState): string {
    const lines: string[] = [
        `;; Periphery Awareness State`,
        `;; Generated: ${state.generated}`,
        `;; Project: ${state.projectName}`,
        `;;`,
        `;; This file is auto-generated. Commit to git for persistent awareness.`,
        ``,
        `(awareness`,
        `  :version ${state.version}`,
        `  :project "${escapeString(state.projectName)}"`,
        `  :root "${escapeString(state.projectRoot)}"`,
        `  :generated "${state.generated}"`,
        ``,
        `  :summary (`,
        `    :files ${state.summary.files}`,
        `    :classes ${state.summary.classes}`,
        `    :interfaces ${state.summary.interfaces}`,
        `    :functions ${state.summary.functions}`,
        `    :methods ${state.summary.methods}`,
        `    :edges ${state.summary.edges}`,
        `  )`,
        ``,
        `  :nodes (`,
    ];

    // Group nodes by kind for readability
    const nodesByKind = new Map<GraphNodeKind, GraphNode[]>();
    for (const node of state.nodes.values()) {
        if (!nodesByKind.has(node.kind)) {
            nodesByKind.set(node.kind, []);
        }
        nodesByKind.get(node.kind)!.push(node);
    }

    for (const [kind, nodes] of nodesByKind) {
        lines.push(`    ;; ${kind}s (${nodes.length})`);
        for (const node of nodes) {
            lines.push(`    ${serializeNode(node)}`);
        }
        lines.push('');
    }

    lines.push(`  )`);
    lines.push(``);
    lines.push(`  :edges (`);

    // Group edges by kind
    const edgesByKind = new Map<GraphEdgeKind, GraphEdge[]>();
    for (const edge of state.edges) {
        if (!edgesByKind.has(edge.kind)) {
            edgesByKind.set(edge.kind, []);
        }
        edgesByKind.get(edge.kind)!.push(edge);
    }

    for (const [kind, edges] of edgesByKind) {
        lines.push(`    ;; ${kind} (${edges.length})`);
        for (const edge of edges) {
            lines.push(`    ${serializeEdge(edge)}`);
        }
        lines.push('');
    }

    lines.push(`  )`);
    lines.push(`)`);

    return lines.join('\n');
}

// ============================================================================
// Deserialization - Parse S-expression format
// ============================================================================

interface Token {
    type: 'lparen' | 'rparen' | 'symbol' | 'keyword' | 'string' | 'number';
    value: string | number;
}

function tokenize(input: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;

    while (i < input.length) {
        const char = input[i];

        // Skip whitespace
        if (/\s/.test(char)) {
            i++;
            continue;
        }

        // Skip comments
        if (char === ';') {
            while (i < input.length && input[i] !== '\n') i++;
            continue;
        }

        // Parentheses
        if (char === '(') {
            tokens.push({ type: 'lparen', value: '(' });
            i++;
            continue;
        }
        if (char === ')') {
            tokens.push({ type: 'rparen', value: ')' });
            i++;
            continue;
        }

        // String
        if (char === '"') {
            i++;
            let str = '';
            while (i < input.length && input[i] !== '"') {
                if (input[i] === '\\' && i + 1 < input.length) {
                    i++;
                    if (input[i] === 'n') str += '\n';
                    else if (input[i] === 't') str += '\t';
                    else str += input[i];
                } else {
                    str += input[i];
                }
                i++;
            }
            i++; // skip closing quote
            tokens.push({ type: 'string', value: str });
            continue;
        }

        // Keyword (starts with :)
        if (char === ':') {
            i++;
            let keyword = '';
            while (i < input.length && /[a-zA-Z0-9_-]/.test(input[i])) {
                keyword += input[i];
                i++;
            }
            tokens.push({ type: 'keyword', value: keyword });
            continue;
        }

        // Number or symbol
        if (/[a-zA-Z0-9_\-+.]/.test(char)) {
            let word = '';
            while (i < input.length && /[a-zA-Z0-9_\-+.]/.test(input[i])) {
                word += input[i];
                i++;
            }
            // Check if number
            if (/^-?\d+(\.\d+)?$/.test(word)) {
                tokens.push({ type: 'number', value: parseFloat(word) });
            } else {
                tokens.push({ type: 'symbol', value: word });
            }
            continue;
        }

        i++;
    }

    return tokens;
}

type SExpr = string | number | SExpr[] | { [key: string]: SExpr };

function parse(tokens: Token[]): SExpr {
    let i = 0;

    function parseExpr(): SExpr {
        const token = tokens[i];

        if (token.type === 'lparen') {
            i++;
            const list: SExpr[] = [];
            let propsObj: Record<string, SExpr> | null = null;

            while (tokens[i]?.type !== 'rparen') {
                // Check for keyword-value pairs (property list)
                if (tokens[i]?.type === 'keyword') {
                    const key = tokens[i].value as string;
                    i++;
                    const value = parseExpr();

                    // Accumulate all keywords into a single props object
                    if (!propsObj) {
                        propsObj = {};
                        list.push(propsObj);
                    }
                    propsObj[key] = value;
                } else {
                    list.push(parseExpr());
                }
            }
            i++; // skip rparen

            // If list has single object (pure property list), return it
            if (list.length === 1 && typeof list[0] === 'object' && !Array.isArray(list[0])) {
                return list[0];
            }

            return list;
        }

        if (token.type === 'string' || token.type === 'symbol' || token.type === 'number') {
            i++;
            return token.value;
        }

        throw new Error(`Unexpected token: ${JSON.stringify(token)}`);
    }

    return parseExpr();
}

function extractNodes(nodesExpr: SExpr): Map<string, GraphNode> {
    const nodes = new Map<string, GraphNode>();

    if (!Array.isArray(nodesExpr)) return nodes;

    for (const item of nodesExpr) {
        if (Array.isArray(item) && item[0] === 'node') {
            const props = item[1] as Record<string, SExpr>;
            if (props && typeof props === 'object') {
                const node: GraphNode = {
                    id: props.id as string,
                    kind: props.kind as GraphNodeKind,
                    name: props.name as string,
                    filePath: props.filePath as string,
                    ...(props.line !== undefined ? { line: props.line as number } : {}),
                };
                nodes.set(node.id, node);
            }
        }
    }

    return nodes;
}

function extractEdges(edgesExpr: SExpr): GraphEdge[] {
    const edges: GraphEdge[] = [];

    if (!Array.isArray(edgesExpr)) return edges;

    for (const item of edgesExpr) {
        if (Array.isArray(item) && item[0] === 'edge') {
            const props = item[1] as Record<string, SExpr>;
            if (props && typeof props === 'object') {
                edges.push({
                    from: props.from as string,
                    to: props.to as string,
                    kind: props.kind as GraphEdgeKind,
                });
            }
        }
    }

    return edges;
}

export function deserialize(content: string): AwarenessState | null {
    try {
        const tokens = tokenize(content);
        const expr = parse(tokens);

        if (!Array.isArray(expr) || expr[0] !== 'awareness') {
            return null;
        }

        const props = expr[1] as Record<string, SExpr>;
        if (!props || typeof props !== 'object') return null;

        const summary = props.summary as Record<string, number>;
        const nodesExpr = props.nodes;
        const edgesExpr = props.edges;

        return {
            projectName: props.project as string,
            projectRoot: props.root as string,
            generated: props.generated as string,
            version: (props.version as number) || 1,
            summary: {
                files: summary?.files || 0,
                classes: summary?.classes || 0,
                interfaces: summary?.interfaces || 0,
                functions: summary?.functions || 0,
                methods: summary?.methods || 0,
                edges: summary?.edges || 0,
            },
            nodes: extractNodes(nodesExpr),
            edges: extractEdges(edgesExpr),
        };
    } catch (error) {
        console.error('Failed to parse awareness file:', error);
        return null;
    }
}

// ============================================================================
// Load / Persist
// ============================================================================

export function load(projectRoot: string): AwarenessState | null {
    const path = getAwarenessPath(projectRoot);

    if (!existsSync(path)) {
        return null;
    }

    try {
        const content = readFileSync(path, 'utf-8');
        return deserialize(content);
    } catch (error) {
        console.error(`Failed to load awareness from ${path}:`, error);
        return null;
    }
}

export async function persist(state: AwarenessState): Promise<void> {
    const path = getAwarenessPath(state.projectRoot);
    const dir = dirname(path);

    // Ensure directory exists
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }

    const content = serialize(state);
    writeFileSync(path, content, 'utf-8');
}

// ============================================================================
// State Queries
// ============================================================================

/**
 * Get top entities by dependent count (most used)
 */
export function getTopEntities(state: AwarenessState, limit: number = 5): TopEntity[] {
    const dependentCounts = new Map<string, number>();

    // Count incoming edges for each node
    for (const edge of state.edges) {
        const count = dependentCounts.get(edge.to) || 0;
        dependentCounts.set(edge.to, count + 1);
    }

    // Sort and take top N
    const sorted = Array.from(state.nodes.values())
        .filter(n => n.kind !== 'file') // Exclude file nodes
        .map(node => ({
            kind: node.kind,
            name: node.name,
            id: node.id,
            dependents: dependentCounts.get(node.id) || 0,
        }))
        .sort((a, b) => b.dependents - a.dependents)
        .slice(0, limit);

    return sorted;
}

/**
 * Calculate staleness based on file modification times
 * Returns true if any tracked file is newer than the generated timestamp
 */
export function isStale(state: AwarenessState): boolean {
    // For now, simple time-based check
    const generated = new Date(state.generated).getTime();
    const now = Date.now();
    const ageMs = now - generated;

    // Consider stale if older than 1 hour
    return ageMs > 60 * 60 * 1000;
}
