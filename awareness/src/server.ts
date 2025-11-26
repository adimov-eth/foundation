/**
 * Awareness MCP Server
 *
 * Maintains live semantic graph of TypeScript codebase.
 * Exposes queries via HTTP MCP protocol.
 */

import express from 'express';
import { ProjectGraph, type GraphNode, type GraphEdge, type NodeKind, type EdgeKind } from './project-graph.js';
import { ProjectWatcher } from './watcher.js';

const app = express();
app.use(express.json());

// ============================================================================
// State
// ============================================================================

let graph: ProjectGraph | null = null;
let watcher: ProjectWatcher | null = null;
let projectRoot: string = process.cwd();

// ============================================================================
// MCP Protocol
// ============================================================================

interface MCPRequest {
    jsonrpc: '2.0';
    id: string | number;
    method: string;
    params?: Record<string, unknown>;
}

interface MCPResponse {
    jsonrpc: '2.0';
    id: string | number;
    result?: unknown;
    error?: { code: number; message: string };
}

// Tool definitions
const tools = [
    {
        name: 'awareness_init',
        description: 'Initialize awareness for a project directory. Must be called before other queries.',
        inputSchema: {
            type: 'object',
            properties: {
                projectPath: { type: 'string', description: 'Path to project root' },
                tsConfigPath: { type: 'string', description: 'Optional path to tsconfig.json' },
                watch: { type: 'boolean', description: 'Enable file watching for incremental updates' },
            },
            required: ['projectPath'],
        },
    },
    {
        name: 'awareness_summary',
        description: 'Get summary statistics of the project graph',
        inputSchema: { type: 'object', properties: {} },
    },
    {
        name: 'awareness_node',
        description: 'Get details about a specific node by ID',
        inputSchema: {
            type: 'object',
            properties: {
                id: { type: 'string', description: 'Node ID (e.g., "src/foo.ts::MyClass")' },
            },
            required: ['id'],
        },
    },
    {
        name: 'awareness_search',
        description: 'Search nodes by name pattern (regex)',
        inputSchema: {
            type: 'object',
            properties: {
                pattern: { type: 'string', description: 'Regex pattern to match node names' },
                kind: { type: 'string', description: 'Optional: filter by node kind' },
            },
            required: ['pattern'],
        },
    },
    {
        name: 'awareness_depends_on',
        description: 'What does this node depend on? (outgoing relationships)',
        inputSchema: {
            type: 'object',
            properties: {
                id: { type: 'string', description: 'Node ID' },
                kind: { type: 'string', description: 'Optional: filter by edge kind' },
            },
            required: ['id'],
        },
    },
    {
        name: 'awareness_used_by',
        description: 'What uses this node? (incoming relationships)',
        inputSchema: {
            type: 'object',
            properties: {
                id: { type: 'string', description: 'Node ID' },
                kind: { type: 'string', description: 'Optional: filter by edge kind' },
            },
            required: ['id'],
        },
    },
    {
        name: 'awareness_inheritance',
        description: 'Get inheritance chain for a class or interface',
        inputSchema: {
            type: 'object',
            properties: {
                id: { type: 'string', description: 'Node ID of class or interface' },
            },
            required: ['id'],
        },
    },
    {
        name: 'awareness_impact',
        description: 'What files would be affected by changing this node?',
        inputSchema: {
            type: 'object',
            properties: {
                id: { type: 'string', description: 'Node ID' },
            },
            required: ['id'],
        },
    },
    {
        name: 'awareness_path',
        description: 'Check if a path exists between two nodes',
        inputSchema: {
            type: 'object',
            properties: {
                from: { type: 'string', description: 'Source node ID' },
                to: { type: 'string', description: 'Target node ID' },
            },
            required: ['from', 'to'],
        },
    },
    {
        name: 'awareness_cycles',
        description: 'Find cycles in the dependency graph',
        inputSchema: { type: 'object', properties: {} },
    },
    {
        name: 'awareness_files',
        description: 'List all files in the project',
        inputSchema: { type: 'object', properties: {} },
    },
    {
        name: 'awareness_file_contents',
        description: 'Get all nodes defined in a specific file',
        inputSchema: {
            type: 'object',
            properties: {
                filePath: { type: 'string', description: 'File path' },
            },
            required: ['filePath'],
        },
    },
];

// ============================================================================
// Tool Handlers
// ============================================================================

async function handleTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    switch (name) {
        case 'awareness_init': {
            const { projectPath, tsConfigPath, watch: enableWatch } = args as {
                projectPath: string;
                tsConfigPath?: string;
                watch?: boolean;
            };

            // Stop existing watcher
            if (watcher) {
                watcher.stop();
                watcher = null;
            }

            projectRoot = projectPath;
            graph = new ProjectGraph(projectPath, tsConfigPath);
            graph.build();

            if (enableWatch) {
                watcher = new ProjectWatcher(graph, projectPath);
                watcher.start();
            }

            return {
                success: true,
                summary: graph.getSummary(),
                watching: enableWatch ?? false,
            };
        }

        case 'awareness_summary': {
            if (!graph) return { error: 'Not initialized. Call awareness_init first.' };
            return graph.getSummary();
        }

        case 'awareness_node': {
            if (!graph) return { error: 'Not initialized' };
            const { id } = args as { id: string };
            const node = graph.getNode(id);
            if (!node) return { error: `Node not found: ${id}` };
            return node;
        }

        case 'awareness_search': {
            if (!graph) return { error: 'Not initialized' };
            const { pattern, kind } = args as { pattern: string; kind?: NodeKind };
            let results = graph.searchNodes(pattern);
            if (kind) {
                results = results.filter(n => n.kind === kind);
            }
            return results.slice(0, 50); // Limit results
        }

        case 'awareness_depends_on': {
            if (!graph) return { error: 'Not initialized' };
            const { id, kind } = args as { id: string; kind?: EdgeKind };
            let results = graph.dependsOn(id);
            if (kind) {
                results = results.filter(r => r.edge.kind === kind);
            }
            return results;
        }

        case 'awareness_used_by': {
            if (!graph) return { error: 'Not initialized' };
            const { id, kind } = args as { id: string; kind?: EdgeKind };
            let results = graph.usedBy(id);
            if (kind) {
                results = results.filter(r => r.edge.kind === kind);
            }
            return results;
        }

        case 'awareness_inheritance': {
            if (!graph) return { error: 'Not initialized' };
            const { id } = args as { id: string };
            return graph.inheritanceChain(id);
        }

        case 'awareness_impact': {
            if (!graph) return { error: 'Not initialized' };
            const { id } = args as { id: string };
            return graph.impactOf(id);
        }

        case 'awareness_path': {
            if (!graph) return { error: 'Not initialized' };
            const { from, to } = args as { from: string; to: string };
            return { exists: graph.pathBetween(from, to) };
        }

        case 'awareness_cycles': {
            if (!graph) return { error: 'Not initialized' };
            return graph.getCycles();
        }

        case 'awareness_files': {
            if (!graph) return { error: 'Not initialized' };
            return graph.getNodesByKind('file').map(n => n.id);
        }

        case 'awareness_file_contents': {
            if (!graph) return { error: 'Not initialized' };
            const { filePath } = args as { filePath: string };
            return graph.getNodesInFile(filePath);
        }

        default:
            return { error: `Unknown tool: ${name}` };
    }
}

// ============================================================================
// HTTP Endpoints
// ============================================================================

app.post('/', async (req, res) => {
    const request = req.body as MCPRequest;

    try {
        let result: unknown;

        switch (request.method) {
            case 'initialize':
                result = {
                    protocolVersion: '2024-11-05',
                    serverInfo: { name: 'awareness', version: '0.1.0' },
                    capabilities: { tools: {} },
                };
                break;

            case 'tools/list':
                result = { tools };
                break;

            case 'tools/call': {
                const { name, arguments: args } = request.params as {
                    name: string;
                    arguments: Record<string, unknown>;
                };
                const toolResult = await handleTool(name, args ?? {});
                result = {
                    content: [{
                        type: 'text',
                        text: JSON.stringify(toolResult, null, 2),
                    }],
                };
                break;
            }

            default:
                res.json({
                    jsonrpc: '2.0',
                    id: request.id,
                    error: { code: -32601, message: `Unknown method: ${request.method}` },
                } satisfies MCPResponse);
                return;
        }

        res.json({
            jsonrpc: '2.0',
            id: request.id,
            result,
        } satisfies MCPResponse);

    } catch (err) {
        res.json({
            jsonrpc: '2.0',
            id: request.id,
            error: { code: -32000, message: String(err) },
        } satisfies MCPResponse);
    }
});

// Health check
app.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        initialized: graph !== null,
        watching: watcher !== null,
        summary: graph?.getSummary() ?? null,
    });
});

// ============================================================================
// Start
// ============================================================================

const PORT = parseInt(process.env.PORT ?? '7778', 10);

app.listen(PORT, () => {
    console.log(`[awareness] Server running on http://localhost:${PORT}`);
    console.log(`[awareness] Add to Claude: claude mcp add --transport http awareness http://localhost:${PORT}`);
});
