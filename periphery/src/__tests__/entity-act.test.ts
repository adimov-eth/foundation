import { describe, it, expect, beforeEach } from 'vitest';
import { TaskAct } from '../entity-act.js';

describe('EntityAct - Context as Specification', () => {
    let taskAct: TaskAct;

    beforeEach(() => {
        taskAct = new TaskAct({}, {});
        // Add some initial tasks
        taskAct.addTask({ id: 'task-1', name: 'First Task', status: 'pending' });
        taskAct.addTask({ id: 'task-2', name: 'Second Task', status: 'in_progress', parent: 'task-1' });
    });

    describe('existing entity by ID', () => {
        it('should operate on existing entity', async () => {
            (taskAct as any).executionContext = {
                target: 'task-1',
                actions: [['rename', 'Updated Task']],
            };

            const result = await taskAct.executeTool();

            expect(result).toEqual([
                { action: 'rename', oldName: 'First Task', newName: 'Updated Task', id: 'task-1' },
            ]);

            const tasks = taskAct.getTasks();
            expect(tasks.find((t) => t.id === 'task-1')?.name).toBe('Updated Task');
        });

        it('should execute multiple actions on same target', async () => {
            (taskAct as any).executionContext = {
                target: 'task-1',
                actions: [
                    ['rename', 'Renamed Task'],
                    ['set-status', 'completed'],
                ],
            };

            const result = await taskAct.executeTool();

            expect(result).toHaveLength(2);
            const task = taskAct.getTasks().find((t) => t.id === 'task-1');
            expect(task?.name).toBe('Renamed Task');
            expect(task?.status).toBe('completed');
        });
    });

    describe('clone specification', () => {
        it('should clone entity and operate on clone', async () => {
            (taskAct as any).executionContext = {
                target: ['clone', 'task-1'],
                actions: [['rename', 'Cloned Task']],
            };

            const result = await taskAct.executeTool();

            // Result should be for the cloned entity
            expect(result[0].action).toBe('rename');
            expect(result[0].oldName).toBe('First Task');
            expect(result[0].newName).toBe('Cloned Task');
            expect(result[0].id).not.toBe('task-1'); // Different ID

            // Original should be unchanged
            const tasks = taskAct.getTasks();
            expect(tasks.find((t) => t.id === 'task-1')?.name).toBe('First Task');

            // Clone should exist with new name
            const clone = tasks.find((t) => t.id === result[0].id);
            expect(clone?.name).toBe('Cloned Task');
        });

        it('should clone with overrides', async () => {
            (taskAct as any).executionContext = {
                target: ['clone', 'task-1', { status: 'completed' }],
                actions: [['rename', 'Completed Clone']],
            };

            const result = await taskAct.executeTool();

            const clone = taskAct.getTasks().find((t) => t.id === result[0].id);
            expect(clone?.status).toBe('completed');
            expect(clone?.name).toBe('Completed Clone');
        });

        it('should handle nested clone (clone of clone spec)', async () => {
            // This is the key insight - selectors compose
            (taskAct as any).executionContext = {
                target: ['clone', ['clone', 'task-1']],
                actions: [['rename', 'Double Clone']],
            };

            const result = await taskAct.executeTool();

            // Should work - first clone task-1, then clone that clone
            expect(result[0].action).toBe('rename');
            expect(result[0].newName).toBe('Double Clone');
        });
    });

    describe('new entity specification', () => {
        it('should create new entity and operate on it', async () => {
            (taskAct as any).executionContext = {
                target: ['new', 'Task', { name: 'Brand New' }],
                actions: [['set-status', 'in_progress']],
            };

            const result = await taskAct.executeTool();

            expect(result[0].action).toBe('set-status');
            expect(result[0].oldStatus).toBe('pending'); // Default
            expect(result[0].status).toBe('in_progress');

            // New entity should exist
            const newTask = taskAct.getTasks().find((t) => t.id === result[0].id);
            expect(newTask).toBeDefined();
            expect(newTask?.name).toBe('Brand New');
            expect(newTask?.status).toBe('in_progress');
        });
    });

    describe('move-to action', () => {
        it('should move entity to new parent', async () => {
            (taskAct as any).executionContext = {
                target: 'task-2',
                actions: [['move-to', 'task-1']],
            };

            const result = await taskAct.executeTool();

            expect(result[0].action).toBe('move-to');
            expect(result[0].oldParent).toBe('task-1');
            expect(result[0].newParent).toBe('task-1');
        });

        it('should make entity root', async () => {
            (taskAct as any).executionContext = {
                target: 'task-2',
                actions: [['move-to', null]], // null parent = root
            };

            const result = await taskAct.executeTool();

            expect(result[0].newParent).toBeUndefined();
        });
    });

    describe('error handling', () => {
        it('should fail if entity not found', async () => {
            (taskAct as any).executionContext = {
                target: 'nonexistent',
                actions: [['rename', 'Will Fail']],
            };

            const result = await taskAct.executeTool();

            // Should have error
            expect(result).toHaveProperty('success', false);
        });

        it('should fail if no target specified for action that needs one', async () => {
            (taskAct as any).executionContext = {
                actions: [['rename', 'No Target']],
            };

            const result = await taskAct.executeTool();

            expect(result).toHaveProperty('success', false);
        });
    });

    describe('the key insight: context as specification', () => {
        /**
         * V's vision: "для клона элемента, сделай это" rather than "склонируй элемент, потом сделай это"
         *
         * The selector is evaluated ONCE at the start of execution.
         * All actions operate on the same resolved entity.
         * The specification (clone, new, query) is part of the context, not a separate action.
         */
        it('should treat context.target as deferred specification', async () => {
            // This is the Montessori insight:
            // We don't say "clone task-1, then rename the result"
            // We say "for the clone of task-1: rename it"

            // The context describes WHAT to operate on (including generative steps)
            // The actions describe WHAT to do

            // This is a single declarative unit:
            (taskAct as any).executionContext = {
                target: ['clone', 'task-1', { status: 'in_progress' }],
                actions: [
                    ['rename', 'New Version'],
                    ['set-status', 'completed'],
                ],
            };

            const result = await taskAct.executeTool();

            // All actions operated on the same cloned entity
            const cloneId = result[0].id;
            expect(result[1].id).toBe(cloneId);

            // The clone exists with all transformations applied
            const clone = taskAct.getTasks().find((t) => t.id === cloneId);
            expect(clone?.name).toBe('New Version');
            expect(clone?.status).toBe('completed');

            // Original unchanged
            const original = taskAct.getTasks().find((t) => t.id === 'task-1');
            expect(original?.name).toBe('First Task');
            expect(original?.status).toBe('pending');
        });

        /**
         * V's exact pattern: (act-on (clone x) (rename "Y"))
         *
         * This test validates the exact syntax V envisioned.
         */
        it('should support (act-on (clone x) (rename Y)) pattern', async () => {
            // Exact pattern from V's vision
            (taskAct as any).executionContext = {
                target: ['clone', 'task-1'],
                actions: [['rename', 'TaskV2']],
            };

            const result = await taskAct.executeTool();

            expect(result[0].action).toBe('rename');
            expect(result[0].oldName).toBe('First Task');
            expect(result[0].newName).toBe('TaskV2');

            // Clone exists with new name
            const clone = taskAct.getTasks().find((t) => t.id === result[0].id);
            expect(clone?.name).toBe('TaskV2');

            // Original unchanged
            const original = taskAct.getTasks().find((t) => t.id === 'task-1');
            expect(original?.name).toBe('First Task');
        });
    });
});
