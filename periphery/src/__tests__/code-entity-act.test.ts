import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CodeEntityAct, CodeEntityResolver } from '../code-entity-act.js';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';

describe('CodeEntityAct - Context as Specification for Code', () => {
    const testDir = '/tmp/code-entity-act-test';
    const testFile = join(testDir, 'test.ts');

    beforeEach(() => {
        // Create test directory and file
        if (existsSync(testDir)) {
            rmSync(testDir, { recursive: true });
        }
        mkdirSync(testDir, { recursive: true });

        writeFileSync(testFile, `
export class MyClass {
    myMethod() {
        return 42;
    }
}

export function myFunction() {
    return "hello";
}

export interface MyInterface {
    name: string;
}
`.trim());
    });

    afterEach(() => {
        if (existsSync(testDir)) {
            rmSync(testDir, { recursive: true });
        }
    });

    describe('CodeEntityResolver', () => {
        it('should resolve entity by ID path', () => {
            const resolver = new CodeEntityResolver(testDir);
            const entity = resolver.getById('test.ts::MyClass');

            expect(entity).toBeDefined();
            expect(entity?.kind).toBe('class');
            expect(entity?.name).toBe('MyClass');
            expect(entity?.node).toBeDefined();
        });

        it('should resolve nested entity', () => {
            const resolver = new CodeEntityResolver(testDir);
            const entity = resolver.getById('test.ts::MyClass::myMethod');

            expect(entity).toBeDefined();
            expect(entity?.kind).toBe('method');
            expect(entity?.name).toBe('myMethod');
        });

        it('should resolve function', () => {
            const resolver = new CodeEntityResolver(testDir);
            const entity = resolver.getById('test.ts::myFunction');

            expect(entity).toBeDefined();
            expect(entity?.kind).toBe('function');
            expect(entity?.name).toBe('myFunction');
        });

        it('should resolve interface', () => {
            const resolver = new CodeEntityResolver(testDir);
            const entity = resolver.getById('test.ts::MyInterface');

            expect(entity).toBeDefined();
            expect(entity?.kind).toBe('interface');
            expect(entity?.name).toBe('MyInterface');
        });

        it('should clone entity with new name', () => {
            const resolver = new CodeEntityResolver(testDir);
            const original = resolver.getById('test.ts::MyClass')!;
            const cloned = resolver.clone(original, { name: 'MyClassClone' });

            expect(cloned.id).toContain('__clone_');
            expect(cloned.name).toBe('MyClassClone');
            expect(original.name).toBe('MyClass');
        });

        it('should create new entity', () => {
            const resolver = new CodeEntityResolver(testDir);
            const entity = resolver.create('class', {
                name: 'NewClass',
                filePath: 'new.ts',
            });

            expect(entity.kind).toBe('class');
            expect(entity.name).toBe('NewClass');
            expect(entity.filePath).toBe('new.ts');
        });
    });

    describe('CodeEntityAct - existing entity', () => {
        it('should get info about entity', async () => {
            const act = new CodeEntityAct({}, { projectRoot: testDir });

            (act as any).executionContext = {
                target: 'test.ts::MyClass',
                actions: [['info']],
            };

            const result = await act.executeTool();

            expect(result).toEqual([{
                action: 'info',
                id: 'test.ts::MyClass',
                kind: 'class',
                name: 'MyClass',
                filePath: 'test.ts',
                astPath: ['MyClass'],
            }]);
        });
    });

    describe('CodeEntityAct - clone specification', () => {
        it('should clone and get info', async () => {
            const act = new CodeEntityAct({}, { projectRoot: testDir });

            (act as any).executionContext = {
                target: ['clone', 'test.ts::MyClass', { name: 'ClonedClass' }],
                actions: [['info']],
            };

            const result = await act.executeTool();

            expect(result[0].action).toBe('info');
            expect(result[0].name).toBe('ClonedClass');
            expect(result[0].id).toContain('__clone_');
        });
    });

    describe('the key insight: context as specification for code', () => {
        /**
         * V's vision applied to code:
         * "для клона класса, сделай это" rather than "склонируй класс, потом сделай это"
         *
         * The clone specification is part of the context.
         * All actions operate on the same resolved entity.
         */
        it('should treat context.target as deferred specification', async () => {
            const act = new CodeEntityAct({}, { projectRoot: testDir });

            // Single declarative unit: for the clone of MyClass, get its info
            (act as any).executionContext = {
                target: ['clone', 'test.ts::MyClass', { name: 'MyClassV2' }],
                actions: [
                    ['info'],
                ],
            };

            const result = await act.executeTool();

            // The clone was created and info was retrieved
            expect(result[0].action).toBe('info');
            expect(result[0].name).toBe('MyClassV2');

            // Original unchanged
            const originalResolver = new CodeEntityResolver(testDir);
            const original = originalResolver.getById('test.ts::MyClass');
            expect(original?.name).toBe('MyClass');
        });
    });
});
