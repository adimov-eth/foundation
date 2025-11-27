/**
 * Graph Builder - Shared graph construction logic
 *
 * Extracts the graph building logic from Discover to be reusable
 * by both Discover (via graph-init) and Awareness (for initial load).
 */

import { Project, type SourceFile } from 'ts-morph';
import { glob } from 'glob';
import { relative, basename, dirname, join, isAbsolute, resolve } from 'path';
import { existsSync } from 'fs';
import type { GraphNode, GraphEdge } from './discover.js';
import type { AwarenessState } from './awareness-persistence.js';
import type { AwarenessStore } from './awareness-tool.js';

// Project and file caches
const projects: Map<string, Project> = new Map();
const sourceFiles: Map<string, SourceFile> = new Map();

function findNearestTsConfig(filePath: string, projectRoot: string): string | null {
    let currentDir = dirname(filePath);

    while (currentDir.startsWith(projectRoot)) {
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

async function loadProject(tsConfigPath?: string): Promise<Project> {
    const key = tsConfigPath ?? '__default__';

    if (projects.has(key)) {
        return projects.get(key)!;
    }

    const project = new Project({
        skipAddingFilesFromTsConfig: true,
        ...(tsConfigPath ? { tsConfigFilePath: tsConfigPath } : {}),
    });

    projects.set(key, project);
    return project;
}

async function loadSourceFile(filePath: string, projectRoot: string, tsConfigPath?: string): Promise<SourceFile> {
    const resolvedPath = isAbsolute(filePath) ? filePath : resolve(projectRoot, filePath);

    if (sourceFiles.has(resolvedPath)) {
        return sourceFiles.get(resolvedPath)!;
    }

    if (!tsConfigPath) {
        tsConfigPath = findNearestTsConfig(resolvedPath, projectRoot) ?? undefined;
    }

    const project = await loadProject(tsConfigPath);

    let sourceFile = project.getSourceFile(resolvedPath);

    if (!sourceFile) {
        sourceFile = project.addSourceFileAtPath(resolvedPath);
    }

    if (!sourceFile) {
        throw new Error(`File not found: ${resolvedPath}`);
    }

    sourceFiles.set(resolvedPath, sourceFile);
    return sourceFile;
}

/**
 * Build a graph for a project directory and update the store.
 */
export async function buildGraphForProject(
    projectRoot: string,
    store: AwarenessStore
): Promise<AwarenessState> {
    const nodes = new Map<string, GraphNode>();
    const edges: GraphEdge[] = [];

    // Get all TS files
    const files = await glob('**/*.ts', {
        cwd: projectRoot,
        ignore: ['**/node_modules/**', '**/dist/**', '**/*.d.ts'],
        absolute: true,
    });

    for (const filePath of files) {
        const sourceFile = await loadSourceFile(filePath, projectRoot);
        const relPath = relative(projectRoot, filePath);

        // File node
        nodes.set(relPath, { id: relPath, kind: 'file', name: relPath, filePath: relPath });

        // Classes
        for (const cls of sourceFile.getClasses()) {
            const name = cls.getName();
            if (!name) continue;
            const classId = `${relPath}::${name}`;
            nodes.set(classId, { id: classId, kind: 'class', name, filePath: relPath, line: cls.getStartLineNumber() });
            edges.push({ from: relPath, to: classId, kind: 'contains' });

            // Extends
            const baseClass = cls.getBaseClass();
            if (baseClass) {
                const baseFile = relative(projectRoot, baseClass.getSourceFile().getFilePath());
                const baseName = baseClass.getName();
                if (baseName) {
                    const baseId = `${baseFile}::${baseName}`;
                    edges.push({ from: classId, to: baseId, kind: 'extends' });
                }
            }

            // Implements
            for (const impl of cls.getImplements()) {
                const symbol = impl.getType().getSymbol();
                if (symbol) {
                    const decls = symbol.getDeclarations();
                    if (decls.length > 0) {
                        const implFile = relative(projectRoot, decls[0].getSourceFile().getFilePath());
                        const implId = `${implFile}::${impl.getText()}`;
                        edges.push({ from: classId, to: implId, kind: 'implements' });
                    }
                }
            }

            // Methods
            for (const method of cls.getMethods()) {
                const methodName = method.getName();
                const methodId = `${classId}::${methodName}`;
                nodes.set(methodId, { id: methodId, kind: 'method', name: methodName, filePath: relPath, line: method.getStartLineNumber() });
                edges.push({ from: classId, to: methodId, kind: 'contains' });
            }
        }

        // Interfaces
        for (const iface of sourceFile.getInterfaces()) {
            const name = iface.getName();
            const ifaceId = `${relPath}::${name}`;
            nodes.set(ifaceId, { id: ifaceId, kind: 'interface', name, filePath: relPath, line: iface.getStartLineNumber() });
            edges.push({ from: relPath, to: ifaceId, kind: 'contains' });
        }

        // Functions
        for (const fn of sourceFile.getFunctions()) {
            const name = fn.getName();
            if (!name) continue;
            const fnId = `${relPath}::${name}`;
            nodes.set(fnId, { id: fnId, kind: 'function', name, filePath: relPath, line: fn.getStartLineNumber() });
            edges.push({ from: relPath, to: fnId, kind: 'contains' });
        }

        // Imports
        for (const imp of sourceFile.getImportDeclarations()) {
            const specifier = imp.getModuleSpecifierValue();
            if (specifier.startsWith('.')) {
                const resolved = imp.getModuleSpecifierSourceFile();
                if (resolved) {
                    const targetPath = relative(projectRoot, resolved.getFilePath());
                    edges.push({ from: relPath, to: targetPath, kind: 'imports' });
                }
            }
        }
    }

    // Build summary
    const summary = {
        files: 0,
        classes: 0,
        interfaces: 0,
        functions: 0,
        methods: 0,
        edges: edges.length,
    };
    for (const node of nodes.values()) {
        switch (node.kind) {
            case 'file': summary.files++; break;
            case 'class': summary.classes++; break;
            case 'interface': summary.interfaces++; break;
            case 'function': summary.functions++; break;
            case 'method': summary.methods++; break;
        }
    }

    const state: AwarenessState = {
        projectName: basename(projectRoot),
        projectRoot,
        generated: new Date().toISOString(),
        version: 1,
        summary,
        nodes,
        edges,
    };

    // Update the store
    store.setState(state);

    return state;
}
