import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CodeEntityAct, CodeEntityResolver } from '../code-entity-act.js';
import { Discover } from '../discover.js';
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

    describe('CodeEntityResolver - query bridge', () => {
        it('should return empty array when no Discover instance', async () => {
            const resolver = new CodeEntityResolver(testDir);
            const results = await resolver.query('(some predicate)');
            expect(results).toEqual([]);
        });

        it('should call Discover.query and parse results', async () => {
            // Create a mock Discover
            const mockDiscover = {
                query: vi.fn().mockResolvedValue([
                    '(list &(:type class :name MyClass))',
                ]),
            } as unknown as Discover;

            const resolver = new CodeEntityResolver(testDir, mockDiscover);
            const results = await resolver.query('(@ (cata \'extract (parse-file "test.ts")) :classes)');

            expect(mockDiscover.query).toHaveBeenCalledWith(
                '(@ (cata \'extract (parse-file "test.ts")) :classes)',
                testDir,
            );
            expect(results.length).toBe(1);
            expect(results[0].name).toBe('MyClass');
            expect(results[0].kind).toBe('class');
        });

        it('should handle query failures gracefully', async () => {
            const mockDiscover = {
                query: vi.fn().mockRejectedValue(new Error('Sandbox error')),
            } as unknown as Discover;

            const resolver = new CodeEntityResolver(testDir, mockDiscover);
            const results = await resolver.query('(broken query)');
            expect(results).toEqual([]);
        });
    });

    describe('CodeEntityAct - query selector', () => {
        it('should resolve entity via query selector', async () => {
            const mockDiscover = {
                query: vi.fn().mockResolvedValue([
                    '&(:type class :name MyClass)',
                ]),
            } as unknown as Discover;

            const act = new CodeEntityAct({}, { projectRoot: testDir, discover: mockDiscover });

            (act as any).executionContext = {
                target: ['query', '(@ (cata \'extract (parse-file "test.ts")) :classes)'],
                actions: [['info']],
            };

            const result = await act.executeTool();

            expect(mockDiscover.query).toHaveBeenCalled();
            expect(result[0].action).toBe('info');
            expect(result[0].name).toBe('MyClass');
        });

        it('should fail when query returns no results', async () => {
            const mockDiscover = {
                query: vi.fn().mockResolvedValue([]),
            } as unknown as Discover;

            const act = new CodeEntityAct({}, { projectRoot: testDir, discover: mockDiscover });

            (act as any).executionContext = {
                target: ['query', '(find-nothing)'],
                actions: [['info']],
            };

            const result = await act.executeTool() as any;

            expect(result.success).toBe(false);
            expect(result.failedAction.error).toContain('Query returned no results');
        });

        it('should fail when query returns multiple results', async () => {
            const mockDiscover = {
                query: vi.fn().mockResolvedValue([
                    '(list &(:type class :name Class1) &(:type class :name Class2))',
                ]),
            } as unknown as Discover;

            const act = new CodeEntityAct({}, { projectRoot: testDir, discover: mockDiscover });

            (act as any).executionContext = {
                target: ['query', '(all-classes)'],
                actions: [['info']],
            };

            const result = await act.executeTool();

            // Result should be an error object, not action results
            expect((result as any).success).toBe(false);
            expect((result as any).failedAction.error).toContain('Query returned multiple results');
        });
    });

    describe('S-expression Act integration via Discover', () => {
        /**
         * Tests for the act-on function registered in the discovery sandbox.
         * This validates the full pipeline: S-expression → ActionSpec → CodeEntityAct
         */

        it('should execute act-on with string target', async () => {
            const discover = new Discover({} as any, { projectRoot: testDir });

            // Set up executionContext with S-expression
            (discover as any).executionContext = {
                expr: `(act-on "test.ts::MyClass" (list (info)))`,
                projectPath: testDir,
            };

            const result = await discover.executeTool();

            // Result should be JSON string with action result
            const parsed = JSON.parse(result as string);
            expect(parsed.action).toBe('info');
            expect(parsed.name).toBe('MyClass');
            expect(parsed.kind).toBe('class');
        });

        it('should execute act-on with clone target', async () => {
            const discover = new Discover({} as any, { projectRoot: testDir });

            (discover as any).executionContext = {
                expr: `(act-on (clone "test.ts::MyClass") (list (info)))`,
                projectPath: testDir,
            };

            const result = await discover.executeTool();

            const parsed = JSON.parse(result as string);
            expect(parsed.action).toBe('info');
            expect(parsed.name).toBe('MyClassClone');
            expect(parsed.id).toContain('__clone_');
        });

        it('should execute act-on with entity from cata extract', async () => {
            const discover = new Discover({} as any, { projectRoot: testDir });

            (discover as any).executionContext = {
                expr: `
                    (define file "test.ts")
                    (define classes (@ (cata 'extract (parse-file file)) :classes))
                    (define entity (with-file file (car classes)))
                    (act-on entity (list (info)))
                `,
                projectPath: testDir,
            };

            const result = await discover.executeTool();

            const parsed = JSON.parse(result as string);
            expect(parsed.action).toBe('info');
            expect(parsed.name).toBe('MyClass');
            expect(parsed.filePath).toBe('test.ts');
        });

        it('should handle clone on entity from discovery', async () => {
            // Clone without overrides - the default behavior appends "Clone" to name
            const discover = new Discover({} as any, { projectRoot: testDir });

            (discover as any).executionContext = {
                expr: `
                    (define file "test.ts")
                    (define classes (@ (cata 'extract (parse-file file)) :classes))
                    (define entity (with-file file (car classes)))
                    (act-on (clone entity) (list (info)))
                `,
                projectPath: testDir,
            };

            const result = await discover.executeTool();

            const parsed = JSON.parse(result as string);
            expect(parsed.action).toBe('info');
            expect(parsed.name).toBe('MyClassClone'); // Default clone naming
            expect(parsed.id).toContain('__clone_');
        });

        it('should return info for method entity', async () => {
            const discover = new Discover({} as any, { projectRoot: testDir });

            (discover as any).executionContext = {
                expr: `(act-on "test.ts::MyClass::myMethod" (list (info)))`,
                projectPath: testDir,
            };

            const result = await discover.executeTool();

            const parsed = JSON.parse(result as string);
            expect(parsed.action).toBe('info');
            expect(parsed.name).toBe('myMethod');
            expect(parsed.kind).toBe('method');
        });

        it('should return discovery result when no act-on', async () => {
            const discover = new Discover({} as any, { projectRoot: testDir });

            (discover as any).executionContext = {
                expr: `(@ (cata 'extract (parse-file "test.ts")) :classes)`,
                projectPath: testDir,
            };

            const result = await discover.executeTool();

            // Result is an array of S-expression strings
            const resultStr = Array.isArray(result) ? result[0] : result;
            expect(resultStr).toContain(':type class');
            expect(resultStr).toContain(':name MyClass');
        });
    });
});
