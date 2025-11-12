/**
 * Rollback Tests
 *
 * Verifies atomic rollback on mid-batch failures
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { Act } from '../act.js';

describe('Act Rollback', () => {
    const testDir = join(process.cwd(), '__test-rollback__');
    const srcDir = join(testDir, 'src');

    beforeAll(() => {
        if (existsSync(testDir)) rmSync(testDir, { recursive: true });
        mkdirSync(srcDir, { recursive: true });

        writeFileSync(join(testDir, 'pnpm-workspace.yaml'), 'packages:\n  - .\n');
        writeFileSync(join(testDir, 'tsconfig.json'), JSON.stringify({
            compilerOptions: { target: 'ES2020', module: 'ESNext' },
            include: ['src/**/*']
        }));
    });

    afterAll(() => {
        if (existsSync(testDir)) rmSync(testDir, { recursive: true });
    });

    it('rolls back all changes on mid-batch failure', async () => {
        const filePath = join(srcDir, 'rollback-test.ts');
        const originalContent = `export const testValue = 100;`;
        writeFileSync(filePath, originalContent);

        const tool = new Act({}, {}, {
            actions: [
                ['rename-symbol', filePath, 'testValue', 'newValue'],  // Should succeed
                ['rename-symbol', filePath, 'nonExistentSymbol', 'x'], // Should fail
            ]
        });

        const results = await tool.executeTool();

        // Should return error object
        expect(results).toHaveProperty('success', false);
        expect(results).toHaveProperty('partial', true);
        expect(results).toHaveProperty('executed', 1);

        // File should be UNCHANGED (rollback)
        const content = readFileSync(filePath, 'utf-8');
        expect(content).toBe(originalContent);
        expect(content).toContain('testValue');
        expect(content).not.toContain('newValue');
    });

    it('rolls back formatting on subsequent failure', async () => {
        const filePath = join(srcDir, 'format-rollback.ts');
        const originalContent = `export   const   badFormat  =   42;`;
        writeFileSync(filePath, originalContent);

        const tool = new Act({}, {}, {
            actions: [
                ['format-file', filePath],                             // Should succeed (in-memory)
                ['rename-symbol', filePath, 'nonExistent', 'fail'],   // Should fail
            ]
        });

        const results = await tool.executeTool();

        expect(results).toHaveProperty('success', false);

        // File should still have bad formatting (rollback)
        const content = readFileSync(filePath, 'utf-8');
        expect(content).toBe(originalContent);
        expect(content).toContain('   '); // Bad formatting preserved
    });

    it('commits all changes when all succeed', async () => {
        const filePath = join(srcDir, 'success-test.ts');
        writeFileSync(filePath, `export const oldName = 42;`);

        const tool = new Act({}, {}, {
            actions: [
                ['rename-symbol', filePath, 'oldName', 'newName'],
                ['format-file', filePath],
            ]
        });

        const results = await tool.executeTool();

        expect(Array.isArray(results)).toBe(true);
        expect(results).toHaveLength(2);

        // Both changes should be saved
        const content = readFileSync(filePath, 'utf-8');
        expect(content).toContain('newName');
        expect(content).not.toContain('oldName');
        expect(content).not.toContain('  '); // Formatted
    });
});
