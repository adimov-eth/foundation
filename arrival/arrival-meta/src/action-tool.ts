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
import { join } from "path";

type ExecutionContext = {
    projectPath: string;
};

export class CodeActionTool extends ActionToolInteraction<ExecutionContext> {
    static readonly name = 'code-action';

    readonly contextSchema = {
        projectPath: z.string().describe('Path to project root'),
    };

    readonly description = 'Safe code transformations via batch actions (atomic validation)';

    private project: Project | null = null;

    constructor(context: any, state: Record<string, any> = {}, executionContext?: any) {
        super(context, state, executionContext);
        this.registerActions();
    }

    /**
     * Get or initialize ts-morph project
     */
    private async getProject(context: ExecutionContext): Promise<Project> {
        if (this.project) return this.project;

        const tsConfigPath = `${context.projectPath}/tsconfig.json`;
        this.project = new Project({
            tsConfigFilePath: tsConfigPath,
        });

        return this.project;
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
                const project = await this.getProject(context);
                const sourceFile = project.getSourceFile(filePath);

                if (!sourceFile) {
                    throw new Error(`File not found: ${filePath}`);
                }

                // Find symbol
                const symbol = sourceFile
                    .getDescendantsOfKind(SyntaxKind.Identifier)
                    .find(id => id.getText() === oldName);

                if (!symbol) {
                    throw new Error(`Symbol not found: ${oldName}`);
                }

                // Get all references
                const references = symbol.findReferencesAsNodes();

                // Rename all references
                references.forEach(ref => ref.replaceWithText(newName));

                // Save changes
                await sourceFile.save();

                return {
                    action: 'rename-symbol',
                    renamed: references.length,
                    files: [filePath],
                };
            },
        });

        // ========================================
        // Extract Function
        // ========================================
        this.registerAction({
            name: 'extract-function',
            description: 'Extract code block into named function',
            props: {
                filePath: z.string().describe('File containing code'),
                startLine: z.number().describe('Start line number'),
                endLine: z.number().describe('End line number'),
                functionName: z.string().describe('Name for extracted function'),
            },
            handler: async (context, { filePath, startLine, endLine, functionName }) => {
                const project = await this.getProject(context);
                const sourceFile = project.getSourceFile(filePath);

                if (!sourceFile) {
                    throw new Error(`File not found: ${filePath}`);
                }

                // This is a simplified version - real implementation would:
                // 1. Analyze variable usage
                // 2. Determine parameters and return type
                // 3. Handle scope correctly
                // 4. Preserve comments

                return {
                    action: 'extract-function',
                    functionName,
                    status: 'not-implemented',
                    note: 'Simplified placeholder - real implementation requires scope analysis',
                };
            },
        });

        // ========================================
        // Inline Function
        // ========================================
        this.registerAction({
            name: 'inline-function',
            description: 'Inline function at all call sites',
            props: {
                filePath: z.string().describe('File containing function'),
                functionName: z.string().describe('Function to inline'),
            },
            handler: async (context, { filePath, functionName }) => {
                const project = await this.getProject(context);
                const sourceFile = project.getSourceFile(filePath);

                if (!sourceFile) {
                    throw new Error(`File not found: ${filePath}`);
                }

                // Find function declaration
                const func = sourceFile
                    .getFunctions()
                    .find(f => f.getName() === functionName);

                if (!func) {
                    throw new Error(`Function not found: ${functionName}`);
                }

                return {
                    action: 'inline-function',
                    functionName,
                    status: 'not-implemented',
                    note: 'Simplified placeholder',
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
                const project = await this.getProject(context);
                const sourceFile = project.getSourceFile(filePath);

                if (!sourceFile) {
                    throw new Error(`File not found: ${filePath}`);
                }

                // Check if import already exists
                const existingImport = sourceFile
                    .getImportDeclarations()
                    .find(imp => imp.getModuleSpecifierValue() === moduleSpecifier);

                if (existingImport) {
                    // Add to existing import
                    if (namedImports.length > 0) {
                        existingImport.addNamedImports(namedImports);
                    }
                    if (defaultImport && !existingImport.getDefaultImport()) {
                        existingImport.setDefaultImport(defaultImport);
                    }
                } else {
                    // Create new import
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
                const project = await this.getProject(context);
                const sourceFile = project.getSourceFile(filePath);

                if (!sourceFile) {
                    throw new Error(`File not found: ${filePath}`);
                }

                const imports = sourceFile.getImportDeclarations();
                const removed: string[] = [];

                for (const imp of imports) {
                    const namedImports = imp.getNamedImports();
                    const unusedNamed: string[] = [];

                    for (const named of namedImports) {
                        const nameNode = named.getNameNode();
                        // Check if it's actually an Identifier node
                        if (Node.isIdentifier(nameNode)) {
                            const refs = nameNode.findReferencesAsNodes();
                            // If only referenced in import (refs.length === 1), it's unused
                            if (refs.length <= 1) {
                                unusedNamed.push(named.getName());
                            }
                        }
                    }

                    // Remove unused named imports
                    for (const name of unusedNamed) {
                        const namedImport = namedImports.find(n => n.getName() === name);
                        namedImport?.remove();
                        removed.push(name);
                    }

                    // Remove entire import if empty (no named, default, or namespace imports)
                    if (imp.getNamedImports().length === 0 && !imp.getDefaultImport() && !imp.getNamespaceImport()) {
                        imp.remove();
                        removed.push(imp.getModuleSpecifierValue());
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
                const project = await this.getProject(context);
                const sourceFile = project.getSourceFile(filePath);

                if (!sourceFile) {
                    throw new Error(`File not found: ${filePath}`);
                }

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
