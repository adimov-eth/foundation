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
     *   "(@ (cata 'extract (parse-file \"src/foo.ts\")) :classes)"
     *   "(filter (lambda (c) (> (length (@ c :extends)) 0)) (@ (cata 'extract (parse-file \"src/foo.ts\")) :classes))"
     */
    async query(predicate: string): Promise<CodeEntity[]> {
        if (!this.discover) {
            console.warn('Query requires Discover instance');
            return [];
        }

        try {
            const results = await this.discover.query(predicate, this.projectRoot);
            return this.parseQueryResults(results);
        } catch (error) {
            console.warn(`Query failed: ${predicate}`, error);
            return [];
        }
    }

    /**
     * Parse S-expression query results into CodeEntity objects.
     *
     * Expects results to be class/function/interface metadata from cata 'extract.
     */
    private parseQueryResults(results: string[]): CodeEntity[] {
        const entities: CodeEntity[] = [];

        for (const result of results) {
            try {
                // Parse S-expression result - it's a list of entity metadata
                // Format: (list &(:type class :name Foo :extends (...) ...))
                const parsed = this.parseSExprResult(result);
                if (Array.isArray(parsed)) {
                    for (const item of parsed) {
                        const entity = this.metadataToEntity(item);
                        if (entity) {
                            entities.push(entity);
                            this.entities.set(entity.id, entity);
                        }
                    }
                } else if (parsed && typeof parsed === 'object') {
                    const entity = this.metadataToEntity(parsed);
                    if (entity) {
                        entities.push(entity);
                        this.entities.set(entity.id, entity);
                    }
                }
            } catch {
                // Skip unparseable results
            }
        }

        return entities;
    }

    /**
     * Very basic S-expression parser for query results.
     * Handles the keyword object format: &(:key value ...)
     */
    private parseSExprResult(sexpr: string): any {
        // Handle nil
        if (sexpr === 'nil' || sexpr === '()') return null;

        // Handle list wrapper
        const listMatch = sexpr.match(/^\(list\s+(.*)\)$/s);
        if (listMatch) {
            return this.parseListContents(listMatch[1]);
        }

        // Handle single keyword object
        if (sexpr.startsWith('&(')) {
            return this.parseKeywordObject(sexpr);
        }

        return sexpr;
    }

    private parseListContents(contents: string): any[] {
        const items: any[] = [];
        let depth = 0;
        let current = '';

        for (let i = 0; i < contents.length; i++) {
            const char = contents[i];

            // Track parenthesis depth only (not &)
            if (char === '(') depth++;
            if (char === ')') depth--;

            // Check for & starting a keyword object at depth 0
            if (depth === 0 && char === '&') {
                // Push any accumulated content
                if (current.trim()) {
                    items.push(this.parseSExprResult(current.trim()));
                }
                current = char;
                continue;
            }

            // At depth 0, whitespace separates items
            if (depth === 0 && /\s/.test(char)) {
                if (current.trim()) {
                    items.push(this.parseSExprResult(current.trim()));
                }
                current = '';
            } else {
                current += char;
            }
        }

        if (current.trim()) {
            items.push(this.parseSExprResult(current.trim()));
        }

        return items.filter(x => x !== null);
    }

    private parseKeywordObject(sexpr: string): Record<string, any> {
        // &(:type class :name Foo :extends (list Bar))
        const inner = sexpr.slice(2, -1); // Remove &( and )
        const obj: Record<string, any> = {};

        const keywordRegex = /:(\w+)\s+/g;
        let match;
        const keys: { key: string; start: number }[] = [];

        while ((match = keywordRegex.exec(inner)) !== null) {
            keys.push({ key: match[1], start: match.index + match[0].length });
        }

        for (let i = 0; i < keys.length; i++) {
            const { key, start } = keys[i];
            const end = i + 1 < keys.length ? inner.lastIndexOf(`:${keys[i + 1].key}`) : inner.length;
            const value = inner.slice(start, end).trim();
            obj[key] = this.parseValue(value);
        }

        return obj;
    }

    private parseValue(value: string): any {
        if (value === 'nil') return null;
        if (value.startsWith("'")) return value.slice(1);
        if (value.startsWith('"') && value.endsWith('"')) return value.slice(1, -1);
        if (value.startsWith('(list')) return this.parseListContents(value.slice(5, -1));
        if (/^\d+$/.test(value)) return parseInt(value, 10);
        return value;
    }

    /**
     * Convert cata 'extract metadata to CodeEntity
     */
    private metadataToEntity(meta: Record<string, any>): CodeEntity | undefined {
        if (!meta || typeof meta !== 'object') return undefined;

        const type = meta.type as string;
        const name = meta.name as string;

        if (!type || !name) return undefined;

        // We need to find which file this came from - it's in the query context
        // For now, construct a partial entity that can be resolved later
        const kind = this.typeToKind(type);
        if (!kind) return undefined;

        // ID format: we don't know the file yet, so use name as temp ID
        // Real resolution happens when getById is called with full path
        const id = `query::${name}`;

        return {
            id,
            kind,
            name,
            filePath: 'unknown', // Would need query context to know
            astPath: [name],
        };
    }

    private typeToKind(type: string): CodeEntity['kind'] | undefined {
        switch (type) {
            case 'class': return 'class';
            case 'function': return 'function';
            case 'interface': return 'interface';
            case 'method': return 'method';
            case 'property': return 'property';
            case 'variable': return 'variable';
            default: return undefined;
        }
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
        const discover = state.discover as Discover | undefined;
        this.resolver = new CodeEntityResolver(projectPath, discover);
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
