#!/usr/bin/env node
/**
 * Executable Compositional Refactoring
 *
 * Shows full pipeline: discover → analyze → transform → execute
 *
 * Simpler example: Find all functions without JSDoc → Add JSDoc → Execute
 */

import { Project, Node, SyntaxKind } from 'ts-morph';
import { join } from 'path';
import { writeFileSync, readFileSync } from 'fs';

// Discovery: Find functions without JSDoc
type FunctionInfo = {
    name: string;
    line: number;
    hasJSDoc: boolean;
    params: string[];
    file: string;
};

const discoverFunctions = (filePath: string): FunctionInfo[] => {
    const project = new Project();
    const sourceFile = project.addSourceFileAtPath(filePath);
    const functions: FunctionInfo[] = [];

    sourceFile.forEachDescendant(node => {
        if (Node.isFunctionDeclaration(node)) {
            const name = node.getName() ?? '<anonymous>';
            const jsDocs = node.getJsDocs();
            const params = node.getParameters().map(p => p.getName());

            functions.push({
                name,
                line: node.getStartLineNumber(),
                hasJSDoc: jsDocs.length > 0,
                params,
                file: filePath,
            });
        }
    });

    return functions;
};

// Filter: Only functions without JSDoc
const needsJSDoc = (funcs: FunctionInfo[]): FunctionInfo[] =>
    funcs.filter(f => !f.hasJSDoc);

// Transform: Generate JSDoc text (without /** */ markers - API adds them)
const generateJSDoc = (func: FunctionInfo): string => {
    const paramDocs = func.params.map(p => `@param ${p}`).join('\n');
    return `${func.name}${paramDocs ? '\n' + paramDocs : ''}`;
};

// Action: Add JSDoc to source file
type AddJSDocAction = {
    file: string;
    line: number;
    jsDoc: string;
};

const planActions = (funcs: FunctionInfo[]): AddJSDocAction[] =>
    funcs.map(f => ({
        file: f.file,
        line: f.line,
        jsDoc: generateJSDoc(f),
    }));

// Execute: Apply all actions atomically
const executeActions = (actions: AddJSDocAction[]): void => {
    if (actions.length === 0) {
        console.log('No actions to execute.\n');
        return;
    }

    // Group by file
    const byFile = new Map<string, AddJSDocAction[]>();
    for (const action of actions) {
        if (!byFile.has(action.file)) {
            byFile.set(action.file, []);
        }
        byFile.get(action.file)!.push(action);
    }

    // Execute per file (in-memory, then save atomically)
    for (const [filePath, fileActions] of byFile) {
        const project = new Project();
        const sourceFile = project.addSourceFileAtPath(filePath);

        // Sort by line DESC so insertions don't shift line numbers
        fileActions.sort((a, b) => b.line - a.line);

        for (const action of fileActions) {
            // Find function at line
            const func = sourceFile.getFunctions().find(
                f => f.getStartLineNumber() === action.line
            );

            if (func) {
                func.insertJsDoc(0, action.jsDoc);
            }
        }

        sourceFile.saveSync();
        console.log(`✓ Modified ${filePath} (${fileActions.length} JSDoc blocks added)`);
    }
};

// Compositional pipeline
const addMissingJSDocs = (filePath: string): void => {
    console.log('Compositional Refactoring: Add Missing JSDoc\n');
    console.log(`Target: ${filePath}\n`);

    // Discover → Filter → Plan → Execute
    const allFunctions = discoverFunctions(filePath);
    console.log(`Found ${allFunctions.length} functions`);

    const missing = needsJSDoc(allFunctions);
    console.log(`${missing.length} missing JSDoc\n`);

    if (missing.length === 0) {
        console.log('All functions have JSDoc!\n');
        return;
    }

    console.log('Functions to document:');
    missing.forEach(f => {
        console.log(`  - ${f.name} at line ${f.line}`);
    });
    console.log();

    const actions = planActions(missing);
    console.log('Executing actions atomically...\n');
    executeActions(actions);
    console.log('\nDone!');
};

// Test on a simple demo file
const createTestFile = () => {
    const testFile = join(process.cwd(), 'test-jsdoc-demo.ts');
    const content = `
export function add(a: number, b: number): number {
    return a + b;
}

/**
 * Already documented
 * @param x
 */
export function documented(x: string): void {
    console.log(x);
}

export function multiply(a: number, b: number): number {
    return a * b;
}
`;
    writeFileSync(testFile, content);
    return testFile;
};

const main = () => {
    // Create test file
    const testFile = createTestFile();
    console.log(`Created test file: ${testFile}\n`);
    console.log('Before:\n');
    console.log(readFileSync(testFile, 'utf-8'));
    console.log('\n' + '='.repeat(60) + '\n');

    // Run compositional refactoring
    addMissingJSDocs(testFile);

    console.log('\n' + '='.repeat(60) + '\n');
    console.log('After:\n');
    console.log(readFileSync(testFile, 'utf-8'));
};

main();
