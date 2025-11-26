/**
 * File watcher for incremental graph updates
 */

import { watch, type FSWatcher } from 'chokidar';
import { ProjectGraph } from './project-graph.js';

export interface WatcherOptions {
    ignored?: string[];
    debounceMs?: number;
}

export class ProjectWatcher {
    private watcher: FSWatcher | null = null;
    private graph: ProjectGraph;
    private projectRoot: string;
    private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
    private debounceMs: number;

    constructor(graph: ProjectGraph, projectRoot: string, options: WatcherOptions = {}) {
        this.graph = graph;
        this.projectRoot = projectRoot;
        this.debounceMs = options.debounceMs ?? 100;
    }

    start(): void {
        if (this.watcher) return;

        this.watcher = watch(`${this.projectRoot}/**/*.ts`, {
            ignored: [
                '**/node_modules/**',
                '**/dist/**',
                '**/.git/**',
            ],
            persistent: true,
            ignoreInitial: true,
        });

        this.watcher.on('change', (path) => this.handleChange(path, 'change'));
        this.watcher.on('add', (path) => this.handleChange(path, 'add'));
        this.watcher.on('unlink', (path) => this.handleChange(path, 'unlink'));

        console.log(`[awareness] Watching ${this.projectRoot} for changes`);
    }

    stop(): void {
        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
        }

        for (const timer of this.debounceTimers.values()) {
            clearTimeout(timer);
        }
        this.debounceTimers.clear();
    }

    private handleChange(path: string, event: 'change' | 'add' | 'unlink'): void {
        // Debounce rapid changes to same file
        const existing = this.debounceTimers.get(path);
        if (existing) {
            clearTimeout(existing);
        }

        this.debounceTimers.set(path, setTimeout(() => {
            this.debounceTimers.delete(path);
            this.processChange(path, event);
        }, this.debounceMs));
    }

    private processChange(path: string, event: 'change' | 'add' | 'unlink'): void {
        console.log(`[awareness] ${event}: ${path}`);

        try {
            switch (event) {
                case 'add':
                    this.graph.addNewFile(path);
                    break;
                case 'change':
                    this.graph.updateFile(path);
                    break;
                case 'unlink':
                    this.graph.updateFile(path); // Will detect missing and remove
                    break;
            }
        } catch (err) {
            console.error(`[awareness] Error processing ${event} for ${path}:`, err);
        }
    }
}
