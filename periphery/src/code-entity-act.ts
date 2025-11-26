/**
 * Code Entity Act - Context as Specification for Code Elements
 *
 * Bridges entity-act's "context as specification" pattern with
 * code discovery queries. Enables patterns like:
 *
 *   (act-on (query "(find-class \"MyClass\")")
 *     (rename "MyRenamedClass"))
 *
 * The query is resolved at execution time via the discovery sandbox.
 */

import { EntityAct, type EntityResolver } from './entity-act.js';
import { Discover } from './discover.js';
import { Project, SourceFile, Node, ClassDeclaration, FunctionDeclaration, InterfaceDeclaration } from 'ts-morph';
import * as z from 'zod';

// ============================================================================
// Code Entity Types
// ============================================================================

/**
 * A code entity is any named declaration in the AST.
 * The ID is the fully qualified path: "file.ts::ClassName::methodName"
 */
export interface CodeEntity {
    id: string;
    kind: 'class' | 'function' | 'interface' | 'method' | 'property' | 'variable';
    name: string;
    filePath: string;
    /** Path within file: ["ClassName", "methodName"] */
    astPath: string[];
    /** The actual AST node - populated during resolution */
    node?: Node;
    /** Source file containing this entity */
    sourceFile?: SourceFile;
}

// ============================================================================
// Code Entity Resolver - Bridges Discovery and Act
// ============================================================================

/**
 * Resolves code entities using discovery queries.
 *
 * The key insight: query() evaluates S-expressions in the discovery sandbox,
 * then extracts entities from the results.
 */
export class CodeEntityResolver implements EntityResolver<CodeEntity> {
    private project: Project;
    private entities = new Map<string, CodeEntity>();
    private nextCloneId = 1;

    constructor(
        private projectRoot: string,
        private discover?: Discover,
    ) {
        this.project = new Project({
            skipAddingFilesFromTsConfig: true,
        });
    }

    getById(id: string): CodeEntity | undefined {
        // Try cache first
        if (this.entities.has(id)) {
            return this.entities.get(id);
        }

        // Parse ID: "file.ts::ClassName::methodName"
        const parts = id.split('::');
        if (parts.length === 0) return undefined;

        const filePath = parts[0];
        const astPath = parts.slice(1);

        return this.resolveByPath(filePath, astPath);
    }

    clone(entity: CodeEntity, overrides?: Record<string, unknown>): CodeEntity {
        const clonedId = `${entity.id}__clone_${this.nextCloneId++}`;
        const cloned: CodeEntity = {
            ...entity,
            id: clonedId,
            name: (overrides?.name as string) ?? `${entity.name}Clone`,
            node: undefined, // Clone doesn't have AST node until we create it
            ...overrides,
        };
        this.entities.set(clonedId, cloned);
        return cloned;
    }

    create(modelType: string, init: Record<string, unknown>): CodeEntity {
        const id = (init.id as string) ?? `new-${modelType}-${this.nextCloneId++}`;
        const entity: CodeEntity = {
            id,
            kind: (init.kind as CodeEntity['kind']) ?? 'class',
            name: (init.name as string) ?? 'NewEntity',
            filePath: (init.filePath as string) ?? 'new-file.ts',
            astPath: (init.astPath as string[]) ?? [],
        };
        this.entities.set(id, entity);
        return entity;
    }

    /**
     * Query code entities using S-expression predicates.
     *
     * The predicate is evaluated in the discovery sandbox.
     * Results are converted to CodeEntity objects.
     *
     * Examples:
     *   "(find-class \"MyClass\")"
     *   "(filter (lambda (c) (extends? c \"PlexusModel\")) (all-classes))"
     */
    query(predicate: string): CodeEntity[] {
        // For now, return empty - real implementation would:
        // 1. Create discovery instance with same projectRoot
        // 2. Execute predicate in sandbox
        // 3. Convert results to CodeEntity objects

        // This is where Discover integration would happen:
        // const result = await this.discover?.executeSExpression(predicate);
        // return this.convertQueryResult(result);

        console.warn(`Query not yet implemented: ${predicate}`);
        return [];
    }

    // ========================================================================
    // Private helpers
    // ========================================================================

    private resolveByPath(filePath: string, astPath: string[]): CodeEntity | undefined {
        try {
            const sourceFile = this.loadSourceFile(filePath);
            if (!sourceFile) return undefined;

            const node = this.navigateToNode(sourceFile, astPath);
            if (!node) return undefined;

            const entity = this.nodeToEntity(node, sourceFile, filePath, astPath);
            if (entity) {
                this.entities.set(entity.id, entity);
            }
            return entity;
        } catch {
            return undefined;
        }
    }

    private loadSourceFile(filePath: string): SourceFile | undefined {
        const resolvedPath = filePath.startsWith('/')
            ? filePath
            : `${this.projectRoot}/${filePath}`;

        let sourceFile = this.project.getSourceFile(resolvedPath);
        if (!sourceFile) {
            try {
                sourceFile = this.project.addSourceFileAtPath(resolvedPath);
            } catch {
                return undefined;
            }
        }
        return sourceFile;
    }

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

    private nodeToEntity(
        node: Node,
        sourceFile: SourceFile,
        filePath: string,
        astPath: string[],
    ): CodeEntity | undefined {
        let kind: CodeEntity['kind'];
        let name: string;

        if (Node.isClassDeclaration(node)) {
            kind = 'class';
            name = node.getName() ?? 'AnonymousClass';
        } else if (Node.isFunctionDeclaration(node)) {
            kind = 'function';
            name = node.getName() ?? 'anonymousFunction';
        } else if (Node.isInterfaceDeclaration(node)) {
            kind = 'interface';
            name = node.getName();
        } else if (Node.isMethodDeclaration(node)) {
            kind = 'method';
            name = node.getName();
        } else if (Node.isPropertyDeclaration(node)) {
            kind = 'property';
            name = node.getName();
        } else if (Node.isVariableDeclaration(node)) {
            kind = 'variable';
            name = node.getName();
        } else {
            return undefined;
        }

        const id = [filePath, ...astPath].join('::');

        return {
            id,
            kind,
            name,
            filePath,
            astPath,
            node,
            sourceFile,
        };
    }
}

// ============================================================================
// Code Entity Act - Actions on Code Elements
// ============================================================================

type CodeActContext = {
    projectPath?: string;
    target?: unknown; // EntitySelector
};

/**
 * CodeEntityAct provides compositional actions over code entities.
 *
 * Unlike file-level Act, this operates on entity selectors which can be:
 * - ID string: "src/foo.ts::MyClass"
 * - Clone spec: ["clone", "src/foo.ts::MyClass", { name: "MyClassV2" }]
 * - New spec: ["new", "class", { name: "NewClass", filePath: "src/new.ts" }]
 * - Query spec: ["query", "(find-class \"MyClass\")"]
 */
export class CodeEntityAct extends EntityAct<CodeEntity, CodeActContext> {
    static readonly name = 'code-entity-act';
    readonly description = 'Compositional actions over code entities with context as specification';

    private resolver: CodeEntityResolver;

    constructor(context: any, state: Record<string, any> = {}, executionContext?: any) {
        super(context, state, executionContext);
        const projectPath = state.projectRoot ?? process.cwd();
        this.resolver = new CodeEntityResolver(projectPath);
        this.registerActions();
    }

    protected getResolver(): EntityResolver<CodeEntity> {
        return this.resolver;
    }

    private registerActions() {
        // Rename action - works on any named entity
        this.registerAction({
            name: 'rename',
            description: 'Rename the target code entity',
            props: {
                newName: z.string().describe('New name for the entity'),
            },
            handler: async (_context, { newName }) => {
                if (!this.resolvedTarget) {
                    throw new Error('No target entity specified');
                }

                const oldName = this.resolvedTarget.name;
                const node = this.resolvedTarget.node;

                if (!node) {
                    throw new Error('Entity has no AST node - cannot rename');
                }

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

                this.resolvedTarget.name = newName;
                this.markModified(this.resolvedTarget);

                return {
                    action: 'rename',
                    id: this.resolvedTarget.id,
                    oldName,
                    newName,
                };
            },
        });

        // Get info action - returns entity metadata
        this.registerAction({
            name: 'info',
            description: 'Get information about the target entity',
            props: {},
            handler: async () => {
                if (!this.resolvedTarget) {
                    throw new Error('No target entity specified');
                }

                return {
                    action: 'info',
                    id: this.resolvedTarget.id,
                    kind: this.resolvedTarget.kind,
                    name: this.resolvedTarget.name,
                    filePath: this.resolvedTarget.filePath,
                    astPath: this.resolvedTarget.astPath,
                };
            },
        });
    }

    protected async commit(): Promise<void> {
        // Save all modified source files
        for (const entity of this.modifiedEntities) {
            if (entity.sourceFile) {
                await entity.sourceFile.save();
            }
        }
    }

    protected async rollback(): Promise<void> {
        // Revert all modified source files
        for (const entity of this.modifiedEntities) {
            if (entity.sourceFile) {
                // Reload from disk
                await entity.sourceFile.refreshFromFileSystem();
            }
        }

        // Remove created entities from cache
        for (const entity of this.createdEntities) {
            // Created entities don't have files yet, just remove from resolver
        }
    }
}
