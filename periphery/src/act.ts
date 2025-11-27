/**
 * Unified Act Tool - Safe transformations via batch actions
 *
 * V's contextSchema pattern: discriminated unions with transforms resolve
 * entities at schema level. Handlers receive resolved entities.
 *
 * Target can be:
 * - File path: "src/foo.ts" → file-level actions
 * - Entity path: "src/foo.ts::MyClass" → entity-level actions
 * - Clone spec: { type: "clone", source: "...", name: "..." }
 * - New spec: { type: "class", name: "...", file: "..." }
 *
 * Montessori principle: Discovery first (read-only exploration), then Act (committed changes).
 * The separation isn't artificial - it's pedagogical. Explore, understand, then transform.
 */

import { ActionToolInteraction } from '@here.build/arrival-mcp';
import { Project, Node, SourceFile, SyntaxKind } from 'ts-morph';
import * as z from 'zod';
import { join, dirname, relative, isAbsolute, resolve } from "path";
import { existsSync } from "fs";
import { glob } from "glob";
import { walkUpUntil, findWorkspaceRoot } from "./utils.js";

// ============================================================================
// Types
// ============================================================================

type EntityKind = 'class' | 'function' | 'interface' | 'method' | 'property';

interface ResolvedFileTarget {
    type: 'file';
    filePath: string;
    sourceFile: SourceFile;
}

interface ResolvedEntityTarget {
    type: 'entity';
    filePath: string;
    sourceFile: SourceFile;
    entityPath: string[];
    entityKind: EntityKind;
    entityName: string;
    node: Node;
}

type ResolvedTarget = ResolvedFileTarget | ResolvedEntityTarget;

type ExecutionContext = {
    projectPath?: string;
    target?: ResolvedTarget;  // Resolved by schema transforms
};

// ============================================================================
// Unified Act Tool
// ============================================================================

export class Act extends ActionToolInteraction<ExecutionContext> {
    static readonly name = 'act';

    private projects: Map<string, Project> = new Map();
    private modifiedFiles: Set<SourceFile> = new Set();
    private currentProjectPath: string | null = null;

    /**
     * Context schema with transforms - V's pattern.
     * Each union variant resolves to ResolvedTarget at schema level.
     * Handlers receive resolved entities, not specs to parse.
     */
    readonly contextSchema = {
        projectPath: z.string().optional()
            .describe('Context property. Path to project root (optional - defaults to CWD)'),

        target: z.union([
            // String path → resolved file or entity
            z.string()
                .describe('File path "src/foo.ts" or entity path "src/foo.ts::ClassName"')
                .transform(async (path): Promise<ResolvedTarget> => {
                    if (path.includes('::')) {
                        return this.resolveEntityPath(path);
                    }
                    return this.resolveFilePath(path);
                }),

            // Clone spec → resolved source entity (with clone name)
            z.object({
                type: z.literal('clone'),
                source: z.string().describe('Source entity path to clone'),
                name: z.string().optional().describe('Name for the cloned entity'),
            }).transform(async (spec): Promise<ResolvedTarget> => {
                if (!spec.source.includes('::')) {
                    throw new Error(`Clone source must be entity path (file.ts::Entity), got: ${spec.source}`);
                }
                const resolved = await this.resolveEntityPath(spec.source);
                return {
                    ...resolved,
                    entityName: spec.name ?? `${resolved.entityName}Clone`,
                };
            }),

            // New class spec → created class entity
            z.object({
                type: z.literal('class'),
                name: z.string().describe('Name for the new class'),
                file: z.string().describe('File path for the new class'),
                extends: z.string().optional().describe('Base class to extend'),
            }).transform(async (spec): Promise<ResolvedTarget> => {
                return this.createNewClass(spec.file, spec.name, spec.extends);
            }),

            // New file spec → created file
            z.object({
                type: z.literal('file'),
                path: z.string().describe('Path for the new file'),
                template: z.string().optional().describe('Template content'),
            }).transform(async (spec): Promise<ResolvedTarget> => {
                return this.createNewFile(spec.path, spec.template);
            }),
        ]).optional()
            .describe('Context property. Target: file path, entity path, or specification object'),
    };

    readonly description = `Safe code transformations via batch actions (atomic validation).

Target can be:
- Entity path: "file.ts::ClassName" or "file.ts::Class::method"
- Clone: { type: "clone", source: "file.ts::Class", name: "NewClass" }
- New: { type: "class", name: "X", file: "src/x.ts", extends: "Base" }

Actions:
- rename-symbol(filePath, oldName, newName) - cross-file rename
- add-import(filePath, moduleSpecifier, namedImports, defaultImport)
- remove-unused-imports(filePath)
- format-file(filePath)
- rename(newName) - requires target in context

Atomic: all actions validated before any execute. Rollback on failure.`;

    constructor(context: any, state: Record<string, any> = {}, executionContext?: any) {
        super(context, state, executionContext);
        this.registerActions();
    }

    // ========================================================================
    // Target Resolution (called by schema transforms)
    // ========================================================================

    private async resolveFilePath(filePath: string): Promise<ResolvedFileTarget> {
        const [sourceFile] = await this.loadSourceFile(filePath);
        return {
            type: 'file',
            filePath,
            sourceFile,
        };
    }

    private async resolveEntityPath(entityPath: string): Promise<ResolvedEntityTarget> {
        const [filePath, ...path] = entityPath.split('::');
        const [sourceFile] = await this.loadSourceFile(filePath);
        const node = this.navigateToNode(sourceFile, path);

        if (!node) {
            throw new Error(`Entity not found: ${entityPath}`);
        }

        const { kind, name } = this.getNodeInfo(node);
        if (!kind) {
            throw new Error(`Cannot determine entity kind for: ${entityPath}`);
        }

        return {
            type: 'entity',
            filePath,
            sourceFile,
            entityPath: path,
            entityKind: kind,
            entityName: name,
            node,
        };
    }

    private async createNewClass(
        filePath: string,
        className: string,
        extendsClass?: string
    ): Promise<ResolvedEntityTarget> {
        const [project] = await this.loadProject(filePath);
        const absolutePath = isAbsolute(filePath) ? filePath : resolve(findWorkspaceRoot(), filePath);

        let sourceFile = project.getSourceFile(absolutePath);
        if (!sourceFile) {
            sourceFile = project.createSourceFile(absolutePath, '', { overwrite: true });
        }

        const classDecl = sourceFile.addClass({
            name: className,
            isExported: true,
            extends: extendsClass,
        });

        return {
            type: 'entity',
            filePath,
            sourceFile,
            entityPath: [className],
            entityKind: 'class',
            entityName: className,
            node: classDecl,
        };
    }

    private async createNewFile(
        filePath: string,
        template?: string
    ): Promise<ResolvedFileTarget> {
        const [project] = await this.loadProject(filePath);
        const absolutePath = isAbsolute(filePath) ? filePath : resolve(findWorkspaceRoot(), filePath);

        const sourceFile = project.createSourceFile(absolutePath, template ?? '', { overwrite: true });

        return {
            type: 'file',
            filePath,
            sourceFile,
        };
    }

    // ========================================================================
    // Project/File Loading
    // ========================================================================

    private async findProjectPath(filePath: string): Promise<string> {
        const absPath = isAbsolute(filePath) ? filePath : resolve(findWorkspaceRoot(), filePath);
        const found = walkUpUntil(
            dirname(absPath),
            dir => existsSync(join(dir, 'tsconfig.json'))
        );
        if (!found) {
            throw new Error(`No tsconfig.json found in any parent directory of: ${filePath}`);
        }
        return found;
    }

    private async loadProject(filePath: string): Promise<[Project, string]> {
        // Use currentProjectPath if set, otherwise auto-discover from file
        let projectPath = this.currentProjectPath;
        if (!projectPath) {
            projectPath = await this.findProjectPath(filePath);
        }

        let project = this.projects.get(projectPath);
        if (!project) {
            project = new Project({
                tsConfigFilePath: `${projectPath}/tsconfig.json`,
            });
            this.projects.set(projectPath, project);
        }

        return [project, projectPath];
    }

    private async loadSourceFile(filePath: string): Promise<[SourceFile, string]> {
        const [project, projectPath] = await this.loadProject(filePath);
        const absolutePath = isAbsolute(filePath) ? filePath : resolve(findWorkspaceRoot(), filePath);

        let sourceFile = project.getSourceFile(absolutePath);

        if (!sourceFile) {
            sourceFile = project.addSourceFileAtPath(absolutePath);
        }

        if (!sourceFile) {
            throw new Error(`File not found: ${filePath}`);
        }

        return [sourceFile, projectPath];
    }

    // ========================================================================
    // AST Navigation
    // ========================================================================

    private navigateToNode(sourceFile: SourceFile, path: string[]): Node | null {
        if (path.length === 0) return sourceFile;

        let current: Node = sourceFile;

        for (const segment of path) {
            let found: Node | undefined;

            if (Node.isSourceFile(current)) {
                found = current.getClass(segment)
                    ?? current.getFunction(segment)
                    ?? current.getInterface(segment)
                    ?? current.getVariableDeclaration(segment);
            } else if (Node.isClassDeclaration(current)) {
                found = current.getMethod(segment)
                    ?? current.getProperty(segment)
                    ?? current.getGetAccessor(segment)
                    ?? current.getSetAccessor(segment);
            } else if (Node.isInterfaceDeclaration(current)) {
                found = current.getMethod(segment) ?? current.getProperty(segment);
            }

            if (!found) return null;
            current = found;
        }

        return current;
    }

    private getNodeInfo(node: Node): { kind: EntityKind | undefined; name: string } {
        if (Node.isClassDeclaration(node)) {
            return { kind: 'class', name: node.getName() ?? 'AnonymousClass' };
        }
        if (Node.isFunctionDeclaration(node)) {
            return { kind: 'function', name: node.getName() ?? 'anonymousFunction' };
        }
        if (Node.isInterfaceDeclaration(node)) {
            return { kind: 'interface', name: node.getName() };
        }
        if (Node.isMethodDeclaration(node)) {
            return { kind: 'method', name: node.getName() };
        }
        if (Node.isPropertyDeclaration(node)) {
            return { kind: 'property', name: node.getName() };
        }
        return { kind: undefined, name: 'unknown' };
    }

    // ========================================================================
    // Actions Registration
    // ========================================================================

    registerActions() {
        // ========================================
        // File-Level Actions
        // ========================================

        this.registerAction({
            name: 'rename-symbol',
            description: 'Rename symbol across all references.',
            props: {
                filePath: z.string().describe('File containing symbol'),
                oldName: z.string().describe('Current symbol name'),
                newName: z.string().describe('New symbol name'),
            },
            handler: async (_context, { filePath, oldName, newName }) => {
                const [sourceFile] = await this.loadSourceFile(filePath);
                const [project] = await this.loadProject(filePath);

                const absolutePath = sourceFile.getFilePath();
                const dir = dirname(absolutePath);
                const tsFiles = await glob(`${dir}/**/*.ts`);

                for (const file of tsFiles) {
                    if (!project.getSourceFile(file)) {
                        project.addSourceFileAtPath(file);
                    }
                }

                const symbol = sourceFile
                    .getDescendantsOfKind(SyntaxKind.Identifier)
                    .find(id => id.getText() === oldName);

                if (!symbol) {
                    throw new Error(`Symbol not found: ${oldName}`);
                }

                symbol.rename(newName);

                const modifiedFiles = project.getSourceFiles().filter(sf => {
                    return sf.getDescendantsOfKind(SyntaxKind.Identifier)
                        .some(id => id.getText() === newName);
                });

                const modifiedPaths = modifiedFiles.map(sf => sf.getFilePath());

                for (const sf of modifiedFiles) {
                    this.modifiedFiles.add(sf);
                }

                return {
                    action: 'rename-symbol',
                    oldName,
                    newName,
                    files: modifiedPaths,
                };
            },
        });

        this.registerAction({
            name: 'add-import',
            description: 'Add import statement to file.',
            props: {
                filePath: z.string().describe('File to add import to'),
                moduleSpecifier: z.string().describe('Module to import from'),
                namedImports: z.array(z.string()).default([]).describe('Named imports'),
                defaultImport: z.string().default('').describe('Default import name'),
            },
            handler: async (_context, { filePath, moduleSpecifier, namedImports, defaultImport }) => {
                const [sourceFile] = await this.loadSourceFile(filePath);

                const existingImport = sourceFile
                    .getImportDeclarations()
                    .find(imp => imp.getModuleSpecifierValue() === moduleSpecifier);

                if (existingImport) {
                    if (namedImports.length > 0) {
                        const existingNames = new Set(
                            existingImport.getNamedImports().map(n => n.getName())
                        );
                        const newImports = namedImports.filter(n => !existingNames.has(n));
                        if (newImports.length > 0) {
                            existingImport.addNamedImports(newImports);
                        }
                    }
                    if (defaultImport && !existingImport.getDefaultImport()) {
                        existingImport.setDefaultImport(defaultImport);
                    }
                } else {
                    sourceFile.addImportDeclaration({
                        moduleSpecifier,
                        namedImports: namedImports.length > 0 ? namedImports : undefined,
                        defaultImport: defaultImport || undefined,
                    });
                }

                this.modifiedFiles.add(sourceFile);

                return {
                    action: 'add-import',
                    filePath,
                    moduleSpecifier,
                    namedImports,
                    defaultImport,
                };
            },
        });

        this.registerAction({
            name: 'remove-unused-imports',
            description: 'Remove unused import statements from file.',
            props: {
                filePath: z.string().describe('File to clean up'),
            },
            handler: async (_context, { filePath }) => {
                const [sourceFile] = await this.loadSourceFile(filePath);

                const importsBefore = new Set<string>();
                for (const imp of sourceFile.getImportDeclarations()) {
                    for (const named of imp.getNamedImports()) {
                        importsBefore.add(named.getName());
                    }
                }

                sourceFile.fixUnusedIdentifiers();

                const importsAfter = new Set<string>();
                for (const imp of sourceFile.getImportDeclarations()) {
                    for (const named of imp.getNamedImports()) {
                        importsAfter.add(named.getName());
                    }
                }

                const removed: string[] = [];
                for (const name of importsBefore) {
                    if (!importsAfter.has(name)) {
                        removed.push(name);
                    }
                }

                this.modifiedFiles.add(sourceFile);

                return {
                    action: 'remove-unused-imports',
                    filePath,
                    removed,
                };
            },
        });

        this.registerAction({
            name: 'format-file',
            description: 'Format file using ts-morph formatter.',
            props: {
                filePath: z.string().describe('File to format'),
            },
            handler: async (_context, { filePath }) => {
                const [sourceFile] = await this.loadSourceFile(filePath);

                this.modifiedFiles.add(sourceFile);
                sourceFile.formatText();

                return {
                    action: 'format-file',
                    filePath,
                };
            },
        });

        // ========================================
        // Entity-Level Actions (use resolved target from context)
        // ========================================

        this.registerAction({
            name: 'rename',
            description: 'Rename the target entity (requires target in context).',
            props: {
                newName: z.string().describe('New name for the entity'),
            },
            handler: async (_context, { newName }) => {
                const target = this.loadingExecutionContext.target;
                if (!target || target.type !== 'entity') {
                    throw new Error('rename action requires entity target in context');
                }

                const { node, entityName, sourceFile, filePath, entityPath } = target;

                const oldName = entityName;

                // Use ts-morph rename
                if (Node.isClassDeclaration(node) ||
                    Node.isFunctionDeclaration(node) ||
                    Node.isInterfaceDeclaration(node) ||
                    Node.isMethodDeclaration(node) ||
                    Node.isPropertyDeclaration(node)) {

                    const nameNode = (node as any).getNameNode?.();
                    if (nameNode) {
                        nameNode.rename(newName);
                    }
                }

                this.modifiedFiles.add(sourceFile);

                return {
                    action: 'rename',
                    oldName,
                    newName,
                    target: `${filePath}::${entityPath.join('::')}`,
                };
            },
        });

    }

    // ========================================================================
    // Execution Override
    // ========================================================================

    protected async beforeAct(_context: ExecutionContext) {
        // Set project path from context (used by loadProject/loadSourceFile)
        this.currentProjectPath = this.loadingExecutionContext.projectPath ?? null;
        this.modifiedFiles.clear();
    }

    async act(actions: any[], transformedActionArgs: any[][]) {
        // Target already resolved by schema transforms - stored in loadingExecutionContext.target

        const results = await super.act(actions, transformedActionArgs);

        // If super.act returned error object, don't save (rollback)
        if (typeof results === 'object' && 'success' in results && results.success === false) {
            return results;
        }

        // All actions succeeded - commit by saving all modified files
        for (const sourceFile of this.modifiedFiles) {
            await sourceFile.save();
        }

        this.modifiedFiles.clear();
        return results;
    }
}
