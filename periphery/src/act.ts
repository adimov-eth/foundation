/**
 * Code Action Tool - Safe AST transformations via batch actions
 *
 * Demonstrates:
 * - Action batching with context immutability
 * - Atomic transformations (all validate before any execute)
 * - Integration with catamorphism-based analysis
 */

import { ActionToolInteraction } from '@here.build/arrival-mcp';
import { Project, Node, SourceFile, SyntaxKind } from 'ts-morph';
import * as z from 'zod';
import { join, dirname, relative, isAbsolute, resolve } from "path";
import { existsSync } from "fs";
import { glob } from "glob";
import { walkUpUntil, findWorkspaceRoot } from "./utils.js";

type ExecutionContext = {
    projectPath?: string;  // Optional - will auto-discover if not provided
    workspaceRoot?: string;  // Root directory for resolving relative paths (defaults to CWD)
};

export class Act extends ActionToolInteraction<ExecutionContext> {
    static readonly name = 'act';

    readonly contextSchema = {
        projectPath: z.string().optional().describe('Path to project root (optional - will auto-discover from file paths if not provided)'),
    };

    readonly description = 'Safe code transformations via batch actions (atomic validation)';

    private projects: Map<string, Project> = new Map();

    constructor(context: any, state: Record<string, any> = {}, executionContext?: any) {
        super(context, state, executionContext);
        this.registerActions();
    }

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

    private async loadProject(context: ExecutionContext, filePath?: string): Promise<[Project, string]> {
        let projectPath = context.projectPath;
        if (!projectPath) {
            if (!filePath) {
                throw new Error('Either projectPath or filePath must be provided for auto-discovery');
            }
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

    private async loadSourceFile(context: ExecutionContext, filePath: string): Promise<[SourceFile, string]> {
        const [project, projectPath] = await this.loadProject(context, filePath);
        const absolutePath = isAbsolute(filePath) ? filePath : resolve(findWorkspaceRoot(), filePath);
        const sourceFile = project.getSourceFile(absolutePath);

        if (!sourceFile) {
            throw new Error(`File not found: ${filePath}`);
        }

        return [sourceFile, projectPath];
    }

    registerActions() {
        // ========================================
        // Rename Symbol
        // ========================================
        this.registerAction({
            name: 'rename-symbol',
            description: 'Rename symbol across all references',
            props: {
                filePath: z.string().describe('File containing symbol'),
                oldName: z.string().describe('Current symbol name'),
                newName: z.string().describe('New symbol name'),
            },
            handler: async (context, { filePath, oldName, newName }) => {
                const [sourceFile] = await this.loadSourceFile(context, filePath);

                const symbol = sourceFile
                    .getDescendantsOfKind(SyntaxKind.Identifier)
                    .find(id => id.getText() === oldName);

                if (!symbol) {
                    throw new Error(`Symbol not found: ${oldName}`);
                }

                symbol.rename(newName);
                await sourceFile.save();

                return {
                    action: 'rename-symbol',
                    oldName,
                    newName,
                    files: [filePath],
                };
            },
        });

        // ========================================
        // Add Import
        // ========================================
        this.registerAction({
            name: 'add-import',
            description: 'Add import statement to file',
            props: {
                filePath: z.string().describe('File to add import to'),
                moduleSpecifier: z.string().describe('Module to import from'),
                namedImports: z.array(z.string()).default([]).describe('Named imports'),
                defaultImport: z.string().default('').describe('Default import name'),
            },
            handler: async (context, { filePath, moduleSpecifier, namedImports, defaultImport }) => {
                const [sourceFile] = await this.loadSourceFile(context, filePath);

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

                await sourceFile.save();

                return {
                    action: 'add-import',
                    filePath,
                    moduleSpecifier,
                    namedImports,
                    defaultImport,
                };
            },
        });

        // ========================================
        // Remove Unused Imports
        // ========================================
        this.registerAction({
            name: 'remove-unused-imports',
            description: 'Remove unused import statements from file',
            props: {
                filePath: z.string().describe('File to clean up'),
            },
            handler: async (context, { filePath }) => {
                const [sourceFile] = await this.loadSourceFile(context, filePath);

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

                await sourceFile.save();

                return {
                    action: 'remove-unused-imports',
                    filePath,
                    removed,
                };
            },
        });

        // ========================================
        // Format File
        // ========================================
        this.registerAction({
            name: 'format-file',
            description: 'Format file using ts-morph formatter',
            props: {
                filePath: z.string().describe('File to format'),
            },
            handler: async (context, { filePath }) => {
                const [sourceFile] = await this.loadSourceFile(context, filePath);

                sourceFile.formatText();
                await sourceFile.save();

                return {
                    action: 'format-file',
                    filePath,
                };
            },
        });
    }
}
