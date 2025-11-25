/**
 * Plexus-Aware Entity Act Tool
 *
 * This integrates the context-as-specification pattern with Plexus models.
 * Plexus provides:
 * - Stable identity through transformations (uuid survives clone/move)
 * - Operational transformation (operations compose correctly)
 * - Tree invariants (parent/child consistency via emancipate/adopt)
 *
 * The key insight from V: "Plexus gives you safe pointer descriptions"
 * When you say clone(a), Plexus knows what that means - it's not a raw memory copy,
 * it's a new entity with its own identity that maintains relationships correctly.
 */

import { EntityAct, type EntityResolver } from './entity-act.js';
import * as z from 'zod';

// Re-export for convenience
export { EntityAct } from './entity-act.js';

// ============================================================================
// Plexus Model Interface
// ============================================================================

/**
 * Minimal interface for Plexus models.
 * This allows PlexusAct to work with any PlexusModel without tight coupling.
 */
export interface PlexusLike {
    readonly uuid: string;
    readonly _type: string;
    readonly parent: PlexusLike | null;
    clone<T extends PlexusLike>(this: T, newProps?: Partial<T>): T;
    toJSON(): Record<string, unknown>;
}

/**
 * Plexus document interface - provides entity lookup and creation.
 */
export interface PlexusDocLike {
    getEntityById<T extends PlexusLike>(id: string): T | undefined;
    createEntity<T extends PlexusLike>(
        modelType: string,
        init: Record<string, unknown>,
    ): T;
    getEntitiesByType<T extends PlexusLike>(modelType: string): T[];
}

// ============================================================================
// Plexus Entity Resolver
// ============================================================================

/**
 * Resolver that operates on a Plexus document.
 * Handles the complexity of Plexus's identity and ownership model.
 */
export class PlexusResolver<T extends PlexusLike> implements EntityResolver<T> {
    constructor(
        private doc: PlexusDocLike,
        private modelRegistry: Map<string, new (init?: any) => T>,
    ) {}

    getById(id: string): T | undefined {
        return this.doc.getEntityById<T>(id);
    }

    clone(entity: T, overrides?: Record<string, unknown>): T {
        // Plexus clone handles all the complexity:
        // - Deep cloning of child fields
        // - Reference preservation for non-child fields
        // - New uuid generation
        return entity.clone(overrides as Partial<T>);
    }

    create(modelType: string, init: Record<string, unknown>): T {
        const Constructor = this.modelRegistry.get(modelType);
        if (!Constructor) {
            throw new Error(`Unknown model type: ${modelType}. Register it first.`);
        }
        return new Constructor(init);
    }

    query(predicate: string): T[] {
        // For now, simple type-based query
        // Full implementation would parse S-expression predicate
        const match = predicate.match(/\(type\s+"([^"]+)"\)/);
        if (match) {
            return this.doc.getEntitiesByType<T>(match[1]);
        }
        return [];
    }
}

// ============================================================================
// Plexus Act Base Class
// ============================================================================

/**
 * Base class for Plexus-aware entity actions.
 *
 * Subclass this and:
 * 1. Set up your Plexus document
 * 2. Register your model types
 * 3. Register your domain-specific actions
 *
 * Example:
 * ```typescript
 * class MyAct extends PlexusAct<MyModel> {
 *   constructor() {
 *     super();
 *     this.registerModel('Task', Task);
 *     this.registerModel('Project', Project);
 *     this.registerActions();
 *   }
 * }
 * ```
 */
export abstract class PlexusAct<T extends PlexusLike> extends EntityAct<T> {
    protected modelRegistry = new Map<string, new (init?: any) => T>();
    protected abstract getPlexusDoc(): PlexusDocLike;

    protected getResolver(): EntityResolver<T> {
        return new PlexusResolver(this.getPlexusDoc(), this.modelRegistry);
    }

    /**
     * Register a model type for creation via ["new", "TypeName", {...}] selectors.
     */
    protected registerModel(typeName: string, Constructor: new (init?: any) => T): void {
        this.modelRegistry.set(typeName, Constructor);
    }

    /**
     * Common actions that work with any Plexus model.
     * Override to add domain-specific actions.
     */
    protected registerCommonActions(): void {
        // Set a property value
        this.registerAction({
            name: 'set',
            description: 'Set a property on the target entity',
            props: {
                property: z.string().describe('Property name'),
                value: z.any().describe('New value'),
            },
            handler: async (_context, { property, value }) => {
                if (!this.resolvedTarget) {
                    throw new Error('No target entity specified');
                }
                const oldValue = (this.resolvedTarget as any)[property];
                (this.resolvedTarget as any)[property] = value;
                this.markModified(this.resolvedTarget);
                return {
                    action: 'set',
                    property,
                    oldValue,
                    newValue: value,
                    id: this.resolvedTarget.uuid,
                };
            },
        });

        // Get property value (for inspection during batch)
        this.registerAction({
            name: 'get',
            description: 'Get a property value from the target entity',
            props: {
                property: z.string().describe('Property name'),
            },
            handler: async (_context, { property }) => {
                if (!this.resolvedTarget) {
                    throw new Error('No target entity specified');
                }
                const value = (this.resolvedTarget as any)[property];
                return {
                    action: 'get',
                    property,
                    value,
                    id: this.resolvedTarget.uuid,
                };
            },
        });

        // Emancipate (remove from parent)
        this.registerAction({
            name: 'emancipate',
            description: 'Remove entity from its parent (make it orphan)',
            props: {},
            handler: async () => {
                if (!this.resolvedTarget) {
                    throw new Error('No target entity specified');
                }
                const oldParent = this.resolvedTarget.parent?.uuid;
                // Plexus emancipation is done by setting the parent reference to null
                // This triggers the emancipation protocol automatically
                if ('emancipate' in this.resolvedTarget && typeof (this.resolvedTarget as any).emancipate === 'function') {
                    (this.resolvedTarget as any).emancipate();
                }
                this.markModified(this.resolvedTarget);
                return {
                    action: 'emancipate',
                    oldParent,
                    id: this.resolvedTarget.uuid,
                };
            },
        });

        // Get full entity state
        this.registerAction({
            name: 'snapshot',
            description: 'Get full entity state as JSON',
            props: {},
            handler: async () => {
                if (!this.resolvedTarget) {
                    throw new Error('No target entity specified');
                }
                return {
                    action: 'snapshot',
                    id: this.resolvedTarget.uuid,
                    type: this.resolvedTarget._type,
                    data: this.resolvedTarget.toJSON(),
                    parent: this.resolvedTarget.parent?.uuid ?? null,
                };
            },
        });
    }
}

// ============================================================================
// In-Memory Plexus Document (for testing)
// ============================================================================

/**
 * Simple in-memory implementation of PlexusDocLike for testing.
 * Real usage would use actual Plexus with Y.js backing.
 */
export class InMemoryPlexusDoc implements PlexusDocLike {
    private entities = new Map<string, PlexusLike>();

    add(entity: PlexusLike): void {
        this.entities.set(entity.uuid, entity);
    }

    getEntityById<T extends PlexusLike>(id: string): T | undefined {
        return this.entities.get(id) as T | undefined;
    }

    createEntity<T extends PlexusLike>(
        _modelType: string,
        _init: Record<string, unknown>,
    ): T {
        throw new Error('Use registerModel and new selector instead');
    }

    getEntitiesByType<T extends PlexusLike>(modelType: string): T[] {
        return Array.from(this.entities.values()).filter(
            (e) => e._type === modelType,
        ) as T[];
    }

    all(): PlexusLike[] {
        return Array.from(this.entities.values());
    }
}
