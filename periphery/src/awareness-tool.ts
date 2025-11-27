/**
 * Awareness Tool - Ambient Project Context
 *
 * The description IS the primary value - ~500 tokens of project state
 * that sits in Claude's context before any queries.
 *
 * Functions are secondary: refresh, staleness check, diff since commit.
 */

import { DiscoveryToolInteraction } from '@here.build/arrival-mcp';
import { watch, type FSWatcher } from 'chokidar';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { basename, join, relative } from 'path';
import * as z from 'zod';

import {
    type AwarenessState,
    type TopEntity,
    type RecentChange,
    load,
    persist,
    getTopEntities,
    isStale,
    getAwarenessPath,
} from './awareness-persistence.js';
import type { GraphNode, GraphEdge, GraphNodeKind, GraphEdgeKind } from './discover.js';

// ============================================================================
// Shared State - Singleton across tools
// ============================================================================

/**
 * Shared awareness state - used by both Awareness and Discover tools.
 * Singleton pattern ensures consistency across MCP requests.
 */
export class AwarenessStore {
    private static instance: AwarenessStore | null = null;
    private state: AwarenessState | null = null;
    private watcher: FSWatcher | null = null;
    private pendingChanges: Map<string, RecentChange> = new Map();

    private constructor() {}

    static getInstance(): AwarenessStore {
        if (!AwarenessStore.instance) {
            AwarenessStore.instance = new AwarenessStore();
        }
        return AwarenessStore.instance;
    }

    getState(): AwarenessState | null {
        return this.state;
    }

    setState(state: AwarenessState): void {
        this.state = state;
    }

    getNodes(): Map<string, GraphNode> {
        return this.state?.nodes ?? new Map();
    }

    getEdges(): GraphEdge[] {
        return this.state?.edges ?? [];
    }

    getProjectRoot(): string | null {
        return this.state?.projectRoot ?? null;
    }

    isInitialized(): boolean {
        return this.state !== null;
    }

    // ========================================
    // Recent Changes Tracking
    // ========================================

    trackChange(file: string, change: 'added' | 'modified' | 'deleted'): void {
        this.pendingChanges.set(file, {
            file,
            change,
            timestamp: new Date().toISOString(),
        });

        // Keep only last 50 changes
        if (this.pendingChanges.size > 50) {
            const oldest = Array.from(this.pendingChanges.keys())[0];
            this.pendingChanges.delete(oldest);
        }
    }

    getRecentChanges(limit: number = 5): RecentChange[] {
        return Array.from(this.pendingChanges.values())
            .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
            .slice(0, limit);
    }

    clearChanges(): void {
        this.pendingChanges.clear();
    }

    // ========================================
    // File Watcher
    // ========================================

    startWatcher(projectRoot: string, onUpdate: (path: string) => void): void {
        if (this.watcher) {
            this.watcher.close();
        }

        this.watcher = watch('**/*.ts', {
            cwd: projectRoot,
            ignored: /node_modules|dist|\.git/,
            ignoreInitial: true,
            persistent: true,
        });

        let debounce: NodeJS.Timeout | null = null;

        this.watcher.on('all', (event, path) => {
            // Track the change
            const changeType = event === 'add' ? 'added'
                : event === 'unlink' ? 'deleted'
                : 'modified';
            this.trackChange(path, changeType);

            // Debounce updates
            if (debounce) clearTimeout(debounce);
            debounce = setTimeout(() => {
                onUpdate(path);
            }, 500);
        });
    }

    stopWatcher(): void {
        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
        }
    }
}

// ============================================================================
// Awareness Tool
// ============================================================================

interface AwarenessContext {
    projectPath?: string;
}

export class Awareness extends DiscoveryToolInteraction<AwarenessContext> {
    static readonly name = 'awareness';
    readonly description = 'Project awareness layer with live state';

    readonly contextSchema = {
        projectPath: z.string().optional().describe('Path to project root (optional - defaults to CWD)'),
    };

    private store = AwarenessStore.getInstance();

    private get projectRoot(): string {
        return this.executionContext?.projectPath ?? this.store.getProjectRoot() ?? process.cwd();
    }

    // ========================================
    // Initialization
    // ========================================

    /**
     * Initialize awareness from persisted state or build fresh.
     * Called on first access or explicit refresh.
     */
    async initialize(projectRoot: string): Promise<AwarenessState> {
        // Try to load persisted state
        let state = load(projectRoot);

        if (state && !isStale(state)) {
            this.store.setState(state);
            this.store.startWatcher(projectRoot, (path) => this.onFileChange(path));
            return state;
        }

        // Build fresh state
        state = await this.buildState(projectRoot);
        this.store.setState(state);
        await persist(state);

        this.store.startWatcher(projectRoot, (path) => this.onFileChange(path));

        return state;
    }

    private async buildState(projectRoot: string): Promise<AwarenessState> {
        // Import buildGraph utility
        const { buildGraphForProject } = await import('./graph-builder.js');

        // Build the graph and update the store
        const state = await buildGraphForProject(projectRoot, this.store);

        return state;
    }

    private onFileChange(path: string): void {
        // Mark state as potentially stale
        // Full incremental update would require re-parsing changed files
        // For now, just track changes for reporting
        console.log(`[awareness] File changed: ${path}`);
    }

    // ========================================
    // Dynamic Description - THE KEY
    // ========================================

    private generateDynamicDescription(): { dynamic: true; value: string } {
        const state = this.store.getState();

        if (!state) {
            return {
                dynamic: true,
                value: `Project awareness status.

=== NOT INITIALIZED ===
Call (status) to initialize awareness for current project.
This will build a semantic graph of the codebase.

After initialization:
- Top entities by usage will appear here
- Recent file changes will be tracked
- Query hints for graph exploration
===`
            };
        }

        const top = getTopEntities(state, 5);
        const recent = this.store.getRecentChanges(3);
        const stale = isStale(state);

        const topSection = top.length > 0
            ? top.map(e => `  ${e.kind.padEnd(9)} ${e.name} (${e.dependents} deps)`).join('\n')
            : '  (no entities with dependents)';

        const recentSection = recent.length > 0
            ? recent.map(c => `  ${c.change.padEnd(8)} ${c.file}`).join('\n')
            : '  (no recent changes)';

        const staleWarning = stale ? '\n[!] State may be stale. Call (refresh) to rebuild.' : '';

        return {
            dynamic: true,
            value: `Project awareness status.

=== ${state.projectName} ===
Generated: ${new Date(state.generated).toLocaleString()}
${state.summary.files} files | ${state.summary.classes} classes | ${state.summary.interfaces} interfaces | ${state.summary.functions} functions
${state.summary.methods} methods | ${state.summary.edges} edges

Top entities:
${topSection}

Recent changes:
${recentSection}
${staleWarning}
Graph queries: use 'discover' tool for (graph-search "X"), (graph-used-by "id")
===`
        };
    }

    // ========================================
    // Functions
    // ========================================

    registerFunctions(): void {
        // Primary function - description IS the value
        this.registerFunction(
            'status',
            () => this.generateDynamicDescription(),
            [],
            async () => {
                const root = this.projectRoot;
                let state = this.store.getState();

                if (!state || state.projectRoot !== root) {
                    state = await this.initialize(root);
                }

                return {
                    project: state.projectName,
                    root: state.projectRoot,
                    generated: state.generated,
                    summary: state.summary,
                    stale: isStale(state),
                    recentChanges: this.store.getRecentChanges(5),
                };
            }
        );

        this.registerFunction(
            'refresh',
            'Rebuild awareness graph from source files',
            [],
            async () => {
                const root = this.projectRoot;
                const state = await this.buildState(root);
                this.store.setState(state);
                this.store.clearChanges();
                await persist(state);

                return {
                    project: state.projectName,
                    generated: state.generated,
                    summary: state.summary,
                };
            }
        );

        this.registerFunction(
            'since',
            'Get changes since a git ref (commit, branch, tag)',
            [z.string()],
            async (ref: string) => {
                const root = this.projectRoot;

                try {
                    const output = execSync(
                        `git diff --name-status ${ref} HEAD -- "*.ts"`,
                        { cwd: root, encoding: 'utf-8' }
                    );

                    const changes: RecentChange[] = [];
                    for (const line of output.split('\n').filter(Boolean)) {
                        const [status, file] = line.split('\t');
                        const change = status === 'A' ? 'added'
                            : status === 'D' ? 'deleted'
                            : 'modified';
                        changes.push({ file, change, timestamp: '' });
                    }

                    return changes;
                } catch (error) {
                    return { error: `Failed to get changes since ${ref}: ${error}` };
                }
            }
        );

        this.registerFunction(
            'hot-files',
            'Get most frequently modified files (from git history)',
            [z.number().optional()],
            async (limit?: number) => {
                const n = limit ?? 10;
                const root = this.projectRoot;

                try {
                    // Get file modification frequency from git log
                    const output = execSync(
                        `git log --name-only --pretty=format: --since="30 days ago" -- "*.ts" | sort | uniq -c | sort -rn | head -${n}`,
                        { cwd: root, encoding: 'utf-8' }
                    );

                    const results: { file: string; changes: number }[] = [];
                    for (const line of output.split('\n').filter(Boolean)) {
                        const match = line.trim().match(/^(\d+)\s+(.+)$/);
                        if (match) {
                            results.push({ file: match[2], changes: parseInt(match[1], 10) });
                        }
                    }

                    return results;
                } catch (error) {
                    return { error: `Failed to get hot files: ${error}` };
                }
            }
        );

        this.registerFunction(
            'stale?',
            'Check if awareness state needs refresh',
            [],
            () => {
                const state = this.store.getState();
                if (!state) return { stale: true, reason: 'not initialized' };

                const stale = isStale(state);
                const pendingChanges = this.store.getRecentChanges(10).length;

                return {
                    stale,
                    generated: state.generated,
                    ageMinutes: Math.round((Date.now() - new Date(state.generated).getTime()) / 60000),
                    pendingChanges,
                    reason: stale ? 'state older than 1 hour' : pendingChanges > 0 ? 'files changed' : 'up to date',
                };
            }
        );

        this.registerFunction(
            'top',
            'Get top entities by dependent count',
            [z.number().optional()],
            (limit?: number) => {
                const state = this.store.getState();
                if (!state) return { error: 'Not initialized. Call (status) first.' };
                return getTopEntities(state, limit ?? 10);
            }
        );

        this.registerFunction(
            'path',
            'Get path to awareness file (.periphery/awareness.scm)',
            [],
            () => {
                return getAwarenessPath(this.projectRoot);
            }
        );
    }
}
