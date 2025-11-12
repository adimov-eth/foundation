/**
 * Action Tool Tests
 *
 * Verifies auto-discovery and action execution with observable effects
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { Act } from '../act.js';

describe('Act Auto-Discovery', () => {
    const testDir = join(process.cwd(), '__test-workspace__');
    const pkg1Dir = join(testDir, 'package1');
    const pkg2Dir = join(testDir, 'package2');

    beforeAll(() => {
        // Create test workspace
        if (existsSync(testDir)) rmSync(testDir, { recursive: true });
        mkdirSync(pkg1Dir, { recursive: true });
        mkdirSync(join(pkg1Dir, 'src'), { recursive: true });
        mkdirSync(pkg2Dir, { recursive: true });
        mkdirSync(join(pkg2Dir, 'src'), { recursive: true });

        // Workspace root marker
        writeFileSync(join(testDir, 'pnpm-workspace.yaml'), 'packages:\n  - package1\n  - package2\n');

        // Package 1 tsconfig
        writeFileSync(join(pkg1Dir, 'tsconfig.json'), JSON.stringify({
            compilerOptions: { target: 'ES2020', module: 'ESNext' },
            include: ['src/**/*']
        }));

        // Package 1 test file
        writeFileSync(join(pkg1Dir, 'src', 'test.ts'), `
import { unused1, unused2 } from 'fake';

export const testSymbol = 42;

function helper() {
  return testSymbol * 2;
}

export function main() {
  return helper() + testSymbol;
}
`);

        // Package 2 tsconfig
        writeFileSync(join(pkg2Dir, 'tsconfig.json'), JSON.stringify({
            compilerOptions: { target: 'ES2020', module: 'ESNext' },
            include: ['src/**/*']
        }));

        // Package 2 test file
        writeFileSync(join(pkg2Dir, 'src', 'other.ts'), `
export const value = 100;
`);
    });

    afterAll(() => {
        if (existsSync(testDir)) rmSync(testDir, { recursive: true });
    });

    it('auto-discovers workspace root', () => {
        const tool = new Act({}, {});
        const root = (tool as any).findWorkspaceRoot();
        expect(root).toContain('foundation');
    });

    it('auto-discovers project path from file', async () => {
        const tool = new Act({}, {});
        const filePath = join(pkg1Dir, 'src', 'test.ts');
        const projectPath = await (tool as any).findProjectPath(filePath);
        expect(projectPath).toBe(pkg1Dir);
    });

    it('maintains separate projects per package', async () => {
        const tool = new Act({}, {});

        const file1 = join(pkg1Dir, 'src', 'test.ts');
        const file2 = join(pkg2Dir, 'src', 'other.ts');

        const [project1, path1] = await (tool as any).loadProject({}, file1);
        const [project2, path2] = await (tool as any).loadProject({}, file2);

        expect(path1).toBe(pkg1Dir);
        expect(path2).toBe(pkg2Dir);
        expect(project1).not.toBe(project2);
    });

    it('throws on invalid path', async () => {
        const tool = new Act({}, {});
        const invalidPath = '/nonexistent/path/file.ts';

        await expect(
            (tool as any).findProjectPath(invalidPath)
        ).rejects.toThrow('No tsconfig.json found');
    });
});

describe('Act Actions', () => {
    const testDir = join(process.cwd(), '__test-actions__');
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

    it('format-file works', async () => {
        const filePath = join(srcDir, 'format-test.ts');
        writeFileSync(filePath, `export   const   value  =   42;`);

        const tool = new Act({}, {});
        const handler = (tool as any).actions['format-file'].handler;
        const result = await handler({}, { filePath });

        expect(result.action).toBe('format-file');

        const formatted = require('fs').readFileSync(filePath, 'utf-8');
        expect(formatted).not.toContain('   ');
    });

    it('rename-symbol renames declaration + references', async () => {
        const filePath = join(srcDir, 'rename-test.ts');
        writeFileSync(filePath, `
export const oldName = 42;

function helper() {
  return oldName * 2;
}

export function main() {
  const x = oldName;
  return x + helper();
}
`);

        const tool = new Act({}, {});
        const handler = (tool as any).actions['rename-symbol'].handler;
        const result = await handler({}, { filePath, oldName: 'oldName', newName: 'newName' });

        expect(result.action).toBe('rename-symbol');
        expect(result.oldName).toBe('oldName');
        expect(result.newName).toBe('newName');

        const content = require('fs').readFileSync(filePath, 'utf-8');
        expect(content).toContain('const newName = 42');
        expect(content).toContain('return newName * 2');
        expect(content).toContain('const x = newName');
        expect(content).not.toContain('oldName');
    });

    it('add-import deduplicates', async () => {
        const filePath = join(srcDir, 'import-test.ts');
        writeFileSync(filePath, `
import { resolve } from 'path';

export const x = resolve('.');
`);

        const tool = new Act({}, {});
        const handler = (tool as any).actions['add-import'].handler;

        // Add resolve (already exists) + join (new)
        await handler({}, {
            filePath,
            moduleSpecifier: 'path',
            namedImports: ['resolve', 'join'],
            defaultImport: ''
        });

        const content = require('fs').readFileSync(filePath, 'utf-8');
        const resolveCount = (content.match(/\bresolve\b/g) || []).length;

        // Should appear once in import, once in usage
        expect(resolveCount).toBe(2);
        expect(content).toContain('join');
    });

    it('remove-unused-imports removes unused', async () => {
        const filePath = join(srcDir, 'unused-test.ts');
        writeFileSync(filePath, `
import { resolve, join } from 'path';

export const x = resolve('.');
`);

        const tool = new Act({}, {});
        const handler = (tool as any).actions['remove-unused-imports'].handler;
        const result = await handler({}, { filePath });

        expect(result.removed).toContain('join');
        expect(result.removed).not.toContain('resolve');

        const content = require('fs').readFileSync(filePath, 'utf-8');
        expect(content).toContain('resolve');
        expect(content).not.toContain('join');
    });
});
