import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { cata } from '../catamorphism.js';
import { extractAlg } from '../algebras/extract.js';

describe('Variable Export Extraction', () => {
    it('extracts exported const variables', () => {
        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile('test.ts', `
export const foo = 1;
export const bar = "test";
const baz = 3; // not exported
        `.trim());

        const metadata = cata(extractAlg)(sourceFile);

        const exportedNames = metadata.exports
            .filter(e => e.to === null)
            .flatMap(e => e.named);

        expect(exportedNames).toContain('foo');
        expect(exportedNames).toContain('bar');
        expect(exportedNames).not.toContain('baz');
    });

    it('extracts exported let variables', () => {
        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile('test.ts', `
export let isActive = false;
export const config = {};
        `.trim());

        const metadata = cata(extractAlg)(sourceFile);

        const exportedNames = metadata.exports
            .filter(e => e.to === null)
            .flatMap(e => e.named);

        expect(exportedNames).toContain('isActive');
        expect(exportedNames).toContain('config');
    });

    it('extracts multiple variables from same statement', () => {
        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile('test.ts', `
export const alpha = 1, beta = 2, gamma = 3;
        `.trim());

        const metadata = cata(extractAlg)(sourceFile);

        const exportedNames = metadata.exports
            .filter(e => e.to === null)
            .flatMap(e => e.named);

        expect(exportedNames).toContain('alpha');
        expect(exportedNames).toContain('beta');
        expect(exportedNames).toContain('gamma');
    });

    it('handles complex real-world case (utils/index.ts pattern)', () => {
        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile('test.ts', `
export let isTransacting = false;
export const pendingNotifications: Set<() => void> = new Set();

export const flushNotifications = () => {
    if (isTransacting) return;
    for (const fn of pendingNotifications) {
        fn();
    }
    pendingNotifications.clear();
};
        `.trim());

        const metadata = cata(extractAlg)(sourceFile);

        const exportedNames = metadata.exports
            .filter(e => e.to === null)
            .flatMap(e => e.named);

        expect(exportedNames).toContain('isTransacting');
        expect(exportedNames).toContain('pendingNotifications');
        expect(exportedNames).toContain('flushNotifications');
    });

    it('extracts destructured object exports', () => {
        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile('test.ts', `
export const { alpha, beta } = { alpha: 1, beta: 2 };
export const { x: renamed } = { x: 3 };
        `.trim());

        const metadata = cata(extractAlg)(sourceFile);

        const exportedNames = metadata.exports
            .filter(e => e.to === null)
            .flatMap(e => e.named);

        expect(exportedNames).toContain('alpha');
        expect(exportedNames).toContain('beta');
        expect(exportedNames).toContain('renamed');
        expect(exportedNames).not.toContain('x');
    });

    it('extracts destructured array exports', () => {
        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile('test.ts', `
export const [first, second] = [1, 2];
export const [x, , z] = [1, 2, 3];
        `.trim());

        const metadata = cata(extractAlg)(sourceFile);

        const exportedNames = metadata.exports
            .filter(e => e.to === null)
            .flatMap(e => e.named);

        expect(exportedNames).toContain('first');
        expect(exportedNames).toContain('second');
        expect(exportedNames).toContain('x');
        expect(exportedNames).toContain('z');
        expect(exportedNames.length).toBe(4); // no omitted element
    });
});
