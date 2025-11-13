/**
 * Compositional Refactoring Framework
 *
 * Combines discovery (read-only exploration) with actions (atomic mutations)
 * into a single compositional pipeline.
 *
 * Vision: Express refactorings as S-expressions that compose naturally:
 *
 * (refactor
 *   (find-classes "src/Task.ts")
 *   (filter (extends? "PlexusModel"))
 *   (rename-all (prefix "Plexus")))
 *
 * This executes as:
 * 1. Discovery phase (read-only, returns data)
 * 2. Transformation phase (pure functions on data)
 * 3. Action phase (atomic execution via act tool)
 */

import type { Node, SourceFile } from 'ts-morph';
import { Project } from 'ts-morph';

// Core types

/**
 * RefactorAction - describes a transformation to apply
 */
export type RefactorAction =
    | { type: 'rename-symbol'; file: string; oldName: string; newName: string }
    | { type: 'add-import'; file: string; module: string; named: string[]; default: string }
    | { type: 'remove-unused-imports'; file: string }
    | { type: 'format-file'; file: string }
    | { type: 'extract-function'; file: string; startLine: number; endLine: number; name: string }
    | { type: 'inline-function'; file: string; functionName: string };

/**
 * Discovery result - any data shape that describes code
 */
export type DiscoveryResult = unknown;

/**
 * Refactor pipeline stage
 */
export type RefactorStage<In, Out> = (input: In) => Out;

/**
 * Full pipeline: Discovery → Transformation → Actions
 */
export type RefactorPipeline<D extends DiscoveryResult> = {
    discover: RefactorStage<string[], D>;
    transform: RefactorStage<D, RefactorAction[]>;
    execute: RefactorStage<RefactorAction[], Promise<unknown>>;
};

// Compositional operators

/**
 * Pipe - left-to-right composition
 */
export const pipe = <A, B, C>(
    f: (a: A) => B,
    g: (b: B) => C
): ((a: A) => C) => (a: A) => g(f(a));

/**
 * Compose - right-to-left composition (traditional)
 */
export const compose = <A, B, C>(
    f: (b: B) => C,
    g: (a: A) => B
): ((a: A) => C) => (a: A) => f(g(a));

// Discovery primitives (functional wrappers around algebras)

export type FileMetadata = {
    path: string;
    classes: Array<{ name: string; extends: string[]; methods: string[] }>;
    functions: Array<{ name: string | null; params: number }>;
    imports: Array<{ from: string; named: string[] }>;
};

/**
 * Discover: Load files and extract metadata
 */
export const discoverFiles = (filePaths: string[]): FileMetadata[] => {
    const project = new Project();
    return filePaths.map(path => {
        const sourceFile = project.addSourceFileAtPath(path);

        // Use existing algebras to extract metadata
        // For now, simplified extraction
        const classes: FileMetadata['classes'] = [];
        const functions: FileMetadata['functions'] = [];
        const imports: FileMetadata['imports'] = [];

        sourceFile.getClasses().forEach(cls => {
            classes.push({
                name: cls.getName() ?? '<anonymous>',
                extends: cls.getExtends()?.getText() ? [cls.getExtends()!.getText()] : [],
                methods: cls.getMethods().map(m => m.getName()),
            });
        });

        sourceFile.getFunctions().forEach(func => {
            functions.push({
                name: func.getName() ?? null,
                params: func.getParameters().length,
            });
        });

        sourceFile.getImportDeclarations().forEach(imp => {
            imports.push({
                from: imp.getModuleSpecifierValue(),
                named: imp.getNamedImports().map(n => n.getName()),
            });
        });

        return { path, classes, functions, imports };
    });
};

// Transformation primitives (filters, mappers, reducers)

/**
 * Filter: classes by predicate
 */
export const filterClasses = (
    predicate: (cls: FileMetadata['classes'][0]) => boolean
) => (metadata: FileMetadata[]): FileMetadata[] => {
    return metadata.map(file => ({
        ...file,
        classes: file.classes.filter(predicate),
    }));
};

/**
 * Map: rename all matching symbols
 */
export const planRenames = (
    matcher: (name: string) => boolean,
    newName: (oldName: string) => string
) => (metadata: FileMetadata[]): RefactorAction[] => {
    const actions: RefactorAction[] = [];

    for (const file of metadata) {
        for (const cls of file.classes) {
            if (matcher(cls.name)) {
                actions.push({
                    type: 'rename-symbol',
                    file: file.path,
                    oldName: cls.name,
                    newName: newName(cls.name),
                });
            }
        }
    }

    return actions;
};

/**
 * Execute actions atomically via Act tool
 *
 * Converts RefactorActions to Act tool format and executes atomically.
 */
export const executeActions = async (
    actions: RefactorAction[],
    dryRun: boolean = false
): Promise<void> => {
    if (dryRun) {
        console.log(`\nPlanned actions (${actions.length}):\n`);

        for (const action of actions) {
            console.log(`  ${action.type}:`);
            console.log(`    ${JSON.stringify(action, null, 2).split('\n').slice(1, -1).join('\n')}`);
        }

        console.log('\nDry run mode - no changes applied');
        return;
    }

    // Convert to Act tool format
    const { Act } = await import('./act.js');

    const actActions = actions.map(action => {
        switch (action.type) {
            case 'rename-symbol':
                return ['rename-symbol', action.file, action.oldName, action.newName];
            case 'add-import':
                return ['add-import', action.file, action.module, action.named, action.default];
            case 'remove-unused-imports':
                return ['remove-unused-imports', action.file];
            case 'format-file':
                return ['format-file', action.file];
            case 'extract-function':
                return ['extract-function', action.file, action.startLine, action.endLine, action.name];
            case 'inline-function':
                return ['inline-function', action.file, action.functionName];
        }
    });

    const tool = new Act({}, {}, { actions: actActions });
    const results = await tool.executeTool();

    if (typeof results === 'object' && 'success' in results && !results.success) {
        console.error('\nRefactoring failed:');
        console.error(results);
        throw new Error('Refactoring failed atomically - no changes applied');
    }

    console.log(`\n✓ Executed ${actions.length} refactoring actions atomically`);
};

// High-level compositional API

/**
 * Refactor - main entry point for compositional refactoring
 *
 * Example:
 * await refactor(
 *   ['src/models/*.ts'],
 *   pipe(
 *     filterClasses(cls => cls.extends.includes('PlexusModel')),
 *     planRenames(name => !name.startsWith('Plexus'), name => `Plexus${name}`)
 *   ),
 *   { dryRun: true }  // Optional: preview without executing
 * );
 */
export const refactor = async <D extends DiscoveryResult>(
    files: string[],
    pipeline: RefactorStage<D, RefactorAction[]>,
    options: { dryRun?: boolean } = {}
): Promise<void> => {
    // Discovery phase
    const discovered = discoverFiles(files) as D;

    // Transformation phase
    const actions = pipeline(discovered);

    // Execution phase
    await executeActions(actions, options.dryRun ?? false);
};
