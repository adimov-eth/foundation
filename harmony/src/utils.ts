import { existsSync } from 'fs';
import { dirname, join } from 'path';

/**
 * Walk up directory tree until predicate matches
 */
export function walkUpUntil(startDir: string, predicate: (dir: string) => boolean): string | null {
    let currentDir = startDir;

    while (true) {
        if (predicate(currentDir)) return currentDir;

        const parent = dirname(currentDir);
        if (parent === currentDir) return null;
        currentDir = parent;
    }
}

/**
 * Find workspace root by looking for pnpm-workspace.yaml or .git
 */
export function findWorkspaceRoot(startDir: string = process.cwd()): string {
    return walkUpUntil(
        startDir,
        dir => existsSync(join(dir, 'pnpm-workspace.yaml')) || existsSync(join(dir, '.git'))
    ) ?? startDir;
}

/**
 * Find memory storage directory
 * Defaults to .harmony in workspace root
 */
export function findMemoryDir(startDir: string = process.cwd()): string {
    const workspaceRoot = findWorkspaceRoot(startDir);
    return join(workspaceRoot, '.harmony');
}
