/**
 * Entity-Level Act Tool - Context as Specification
 *
 * V's insight: "Операции над новым, существующим и клонированным элементом должны быть одинаковыми.
 * При этом ты не можешь указатель созданного элемента просто так передать в следующие действия.
 * Поэтому у тебя контекст сам по себе представляет набор безопасного описания указателя."
 *
 * Translation: Operations on new, existing, and cloned elements should be the same.
 * You can't just pass a pointer to a created element to subsequent actions.
 * So the context itself becomes a safe pointer description.
 *
 * This inverts the relationship:
 * - Old: "here's a thing, do operations on it"
 * - New: "here's a description of what to operate on (which may include generative steps), and here are the operations"
 *
 * Context.target: clone(a) + actions: [rename] forms a single declarative unit.
 * The system figures out how to execute it atomically.
 */

import { ActionToolInteraction } from '@here.build/arrival-mcp';
import * as z from 'zod';

// ============================================================================
// Entity Selector - Deferred Specification
// ============================================================================

/**
 * EntitySelector is a specification, not a pointer.
 * It describes what to operate on, which may include generative steps.
 */
type EntitySelector =
    | { type: 'id'; id: string }
    | { type: 'clone'; source: EntitySelector; overrides?: Record<string, unknown> }
    | { type: 'new'; modelType: string; init: Record<string, unknown> }
    | { type: 'query'; predicate: string }; // S-expression predicate

/**
 * Parse entity selector from S-expression-like input
 *
 * Examples:
 *   "abc123"                           -> { type: 'id', id: 'abc123' }
 *   ["clone", "abc123"]                -> { type: 'clone', source: { type: 'id', id: 'abc123' } }
 *   ["clone", "abc123", { name: "X" }] -> { type: 'clone', source: ..., overrides: { name: "X" } }
 *   ["new", "Task", { name: "Y" }]     -> { type: 'new', modelType: 'Task', init: { name: "Y" } }
 *   ["query", "(find ...)"]            -> { type: 'query', predicate: "(find ...)" }
 */
function parseEntitySelector(input: unknown): EntitySelector {
    if (typeof input === 'string') {
        return { type: 'id', id: input };
    }

    if (Array.isArray(input) && input.length >= 1) {
        const [op, ...args] = input;

        switch (op) {
            case 'clone':
                return {
                    type: 'clone',
                    source: parseEntitySelector(args[0]),
                    overrides: args[1] as Record<string, unknown> | undefined,
                };
            case 'new':
                return {
                    type: 'new',
                    modelType: args[0] as string,
                    init: (args[1] ?? {}) as Record<string, unknown>,
                };
            case 'query':
                return {
                    type: 'query',
                    predicate: args[0] as string,
                };
            default:
                throw new Error(`Unknown entity selector operation: ${op}`);
        }
    }

    throw new Error(`Invalid entity selector: ${JSON.stringify(input)}`);
}

// ============================================================================
// Entity Resolution - Deferred Evaluation
// ============================================================================

/**
 * EntityResolver resolves selectors to actual entities.
 * This is where Plexus integration would happen.
 *
 * For now, this is a minimal implementation that works with any object store.
 * The key insight: resolution happens ONCE at execution time, not at definition time.
 */
export interface EntityResolver<T> {
    getById(id: string): T | undefined;
    clone(entity: T, overrides?: Record<string, unknown>): T;
    create(modelType: string, init: Record<string, unknown>): T;
    query(predicate: string): T[];
}

async function resolveEntity<T>(
    selector: EntitySelector,
    resolver: EntityResolver<T>,
): Promise<T> {
    switch (selector.type) {
        case 'id': {
            const entity = resolver.getById(selector.id);
            if (!entity) {
                throw new Error(`Entity not found: ${selector.id}`);
            }
            return entity;
        }
        case 'clone': {
            const source = await resolveEntity(selector.source, resolver);
            return resolver.clone(source, selector.overrides);
        }
        case 'new': {
            return resolver.create(selector.modelType, selector.init);
        }
        case 'query': {
            const results = resolver.query(selector.predicate);
            if (results.length === 0) {
                throw new Error(`Query returned no results: ${selector.predicate}`);
            }
            if (results.length > 1) {
                throw new Error(`Query returned multiple results (${results.length}), expected single entity: ${selector.predicate}`);
            }
            return results[0];
        }
    }
}

// ============================================================================
// Entity Act Tool - Compositional Actions over Entities
// ============================================================================

type EntityActContext = {
    target?: unknown; // Entity selector (parsed at execution time)
};

/**
 * EntityAct - Entity-level compositional actions
 *
 * Unlike file-level Act which operates on paths, EntityAct operates on entity selectors.
 * The selector can be:
 * - An existing entity ID
 * - A clone specification
 * - A new entity specification
 * - A query that returns a single entity
 *
 * All actions in a batch share the same resolved target.
 * Resolution is deferred until execution - the selector is a specification, not a pointer.
 */
export abstract class EntityAct<
    TEntity,
    TContext extends EntityActContext = EntityActContext,
> extends ActionToolInteraction<TContext> {
    protected abstract getResolver(): EntityResolver<TEntity>;

    // The resolved target entity - available during action execution
    protected resolvedTarget: TEntity | null = null;

    // Track entities created during this batch for commit/rollback
    protected createdEntities: TEntity[] = [];
    protected modifiedEntities: Set<TEntity> = new Set();

    readonly contextSchema = {
        target: z
            .any()
            .optional()
            .describe(
                'Entity selector: ID string, or ["clone", source], or ["new", modelType, init], or ["query", predicate]',
            ),
    } as any;

    async act(actions: any[], transformedActionArgs: any[][]) {
        this.createdEntities = [];
        this.modifiedEntities.clear();

        // Resolve target if specified
        if (this.loadingExecutionContext.target !== undefined) {
            try {
                const selector = parseEntitySelector(this.loadingExecutionContext.target);
                this.resolvedTarget = await resolveEntity(selector, this.getResolver());

                // Track if target is newly created
                if (selector.type === 'clone' || selector.type === 'new') {
                    this.createdEntities.push(this.resolvedTarget);
                }
            } catch (error) {
                // Return structured error for resolution failures
                // Match the expected return type from ActionToolInteraction
                return {
                    success: false,
                    partial: true,
                    executed: 0,
                    total: actions.length,
                    results: [] as any[],
                    failedAction: {
                        actionIndex: -1,
                        action: 'resolve-target',
                        error: error instanceof Error ? error.message : String(error),
                    },
                    message: `Executed 0 of ${actions.length} actions before runtime failure; doing full rollback due to failed action resolve-target.` as `Executed ${number} of ${number} actions before runtime failure; doing full rollback due to failed action ${string}.`,
                } as const;
            }
        }

        try {
            const results = await super.act(actions, transformedActionArgs);

            // If super.act returned error, rollback
            if (typeof results === 'object' && 'success' in results && results.success === false) {
                await this.rollback();
                return results;
            }

            // All actions succeeded - commit
            await this.commit();
            return results;
        } catch (error) {
            await this.rollback();
            return {
                success: false,
                partial: true,
                executed: 0,
                total: actions.length,
                results: [] as any[],
                failedAction: {
                    actionIndex: -1,
                    action: 'unknown',
                    error: error instanceof Error ? error.message : String(error),
                },
                message: `Executed 0 of ${actions.length} actions before runtime failure; doing full rollback due to failed action unknown.` as `Executed ${number} of ${number} actions before runtime failure; doing full rollback due to failed action ${string}.`,
            } as const;
        } finally {
            this.resolvedTarget = null;
            this.createdEntities = [];
            this.modifiedEntities.clear();
        }
    }

    // Override in subclasses for actual persistence
    protected async commit(): Promise<void> {
        // Default: no-op (in-memory only)
    }

    protected async rollback(): Promise<void> {
        // Default: no-op (in-memory only)
        // Subclasses should undo created entities and modifications
    }

    // Helper for actions to mark entities as modified
    protected markModified(entity: TEntity): void {
        this.modifiedEntities.add(entity);
    }
}

// ============================================================================
// Generic Object Store Implementation
// ============================================================================

/**
 * Simple in-memory entity store for testing/demonstration.
 * Real implementation would use Plexus.
 */
export class InMemoryEntityStore<T extends { id: string }> implements EntityResolver<T> {
    private entities = new Map<string, T>();
    private nextId = 1;

    constructor(
        private createEntity: (modelType: string, init: Record<string, unknown>) => T,
        private cloneEntity: (entity: T, overrides?: Record<string, unknown>) => T,
    ) {}

    add(entity: T): void {
        this.entities.set(entity.id, entity);
    }

    getById(id: string): T | undefined {
        return this.entities.get(id);
    }

    clone(entity: T, overrides?: Record<string, unknown>): T {
        const cloned = this.cloneEntity(entity, overrides);
        this.entities.set(cloned.id, cloned);
        return cloned;
    }

    create(modelType: string, init: Record<string, unknown>): T {
        const entity = this.createEntity(modelType, {
            ...init,
            id: init.id ?? `entity-${this.nextId++}`,
        });
        this.entities.set(entity.id, entity);
        return entity;
    }

    query(_predicate: string): T[] {
        // Minimal implementation - real version would evaluate S-expression predicate
        return [];
    }

    all(): T[] {
        return Array.from(this.entities.values());
    }
}

// ============================================================================
// Example: Task Entity Act
// ============================================================================

interface Task {
    id: string;
    name: string;
    status: 'pending' | 'in_progress' | 'completed';
    parent?: string;
}

/**
 * Example implementation showing how EntityAct works with a simple Task model.
 */
export class TaskAct extends EntityAct<Task> {
    static readonly name = 'task-act';
    readonly description = 'Compositional actions over Task entities';

    private store = new InMemoryEntityStore<Task>(
        (_modelType, init) => ({
            id: init.id as string,
            name: (init.name as string) ?? 'Untitled',
            status: (init.status as Task['status']) ?? 'pending',
            parent: init.parent as string | undefined,
        }),
        (entity, overrides) => ({
            ...entity,
            ...overrides,
            id: `${entity.id}-clone-${Date.now()}`,
        }),
    );

    constructor(context: any, state: Record<string, any> = {}, executionContext?: any) {
        super(context, state, executionContext);
        this.registerActions();
    }

    protected getResolver(): EntityResolver<Task> {
        return this.store;
    }

    private registerActions() {
        this.registerAction({
            name: 'rename',
            description: 'Rename the target entity',
            props: {
                newName: z.string().describe('New name for the entity'),
            },
            handler: async (_context, { newName }) => {
                if (!this.resolvedTarget) {
                    throw new Error('No target entity specified');
                }
                const oldName = this.resolvedTarget.name;
                this.resolvedTarget.name = newName;
                this.markModified(this.resolvedTarget);
                return { action: 'rename', oldName, newName, id: this.resolvedTarget.id };
            },
        });

        this.registerAction({
            name: 'set-status',
            description: 'Set status of the target entity',
            props: {
                status: z.enum(['pending', 'in_progress', 'completed']).describe('New status'),
            },
            handler: async (_context, { status }) => {
                if (!this.resolvedTarget) {
                    throw new Error('No target entity specified');
                }
                const oldStatus = this.resolvedTarget.status;
                this.resolvedTarget.status = status;
                this.markModified(this.resolvedTarget);
                return { action: 'set-status', oldStatus, status, id: this.resolvedTarget.id };
            },
        });

        this.registerAction({
            name: 'move-to',
            description: 'Move entity to new parent',
            props: {
                parentId: z.string().nullish().describe('New parent ID, or null/omit to make root'),
            },
            handler: async (_context, { parentId }) => {
                if (!this.resolvedTarget) {
                    throw new Error('No target entity specified');
                }
                const oldParent = this.resolvedTarget.parent;
                this.resolvedTarget.parent = parentId ?? undefined;
                this.markModified(this.resolvedTarget);
                return { action: 'move-to', oldParent, newParent: parentId ?? undefined, id: this.resolvedTarget.id };
            },
        });
    }

    // For testing
    addTask(task: Task): void {
        this.store.add(task);
    }

    getTasks(): Task[] {
        return this.store.all();
    }
}
