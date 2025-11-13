#!/usr/bin/env node
/**
 * Compositional Refactoring Demo
 *
 * Shows discover → analyze → transform → act as single continuous flow.
 *
 * Use case: Find emancipate() calls that might be unnecessary
 * and suggest removals.
 *
 * Current approach (separate tools):
 * 1. discover: find-pattern-type "emancipate-call"
 * 2. act: manually construct removal actions
 *
 * Compositional approach:
 * (refactor
 *   (find-patterns "src/Task.ts")
 *   (filter emancipate-call?)
 *   (analyze context)
 *   (suggest-removal))
 */

import { Project } from 'ts-morph';
import { findPatterns, filterPatterns, type Pattern } from './src/algebras/patterns.js';
import { join } from 'path';

// Compositional refactoring pipeline
type RefactorPipeline<A, B> = (input: A) => B;

// Compose functions
const compose = <A, B, C>(f: (b: B) => C, g: (a: A) => B): (a: A) => C =>
    (a: A) => f(g(a));

// Pipeline stages

// Stage 1: Discover patterns
const discoverPatterns = (filePath: string): Pattern[] => {
    const project = new Project();
    const sourceFile = project.addSourceFileAtPath(filePath);
    return findPatterns(sourceFile);
};

// Stage 2: Filter by pattern type
const filterPatternType = (type: string) => (patterns: Pattern[]): Pattern[] =>
    filterPatterns(patterns, type);

// Stage 3: Analyze context (for now, just add metadata)
type AnalyzedPattern = Pattern & {
    analysis: {
        inMethod: string | null;
        inClass: string | null;
        hasParentReassignment: boolean;
    };
};

const analyzeContext = (patterns: Pattern[]): AnalyzedPattern[] => {
    return patterns.map(p => ({
        ...p,
        analysis: {
            inMethod: p.location.methodName ?? null,
            inClass: p.location.className ?? null,
            // Would need deeper analysis to detect parent reassignment
            // For now, assume we can't prove it's necessary
            hasParentReassignment: false,
        }
    }));
};

// Stage 4: Suggest actions
type RefactorAction = {
    action: 'remove-call' | 'add-comment' | 'extract-function';
    file: string;
    location: Pattern['location'];
    reason: string;
};

const suggestActions = (filePath: string) => (patterns: AnalyzedPattern[]): RefactorAction[] => {
    return patterns
        .filter(p => !p.analysis.hasParentReassignment)
        .map(p => ({
            action: 'remove-call' as const,
            file: filePath,
            location: p.location,
            reason: `emancipate() call in ${p.location.className}.${p.location.methodName} might be unnecessary - no parent reassignment detected`
        }));
};

// Compositional pipeline
const findUnnecessaryEmancipate = (filePath: string): RefactorAction[] =>
    compose(
        compose(
            suggestActions(filePath),
            analyzeContext
        ),
        compose(
            filterPatternType('emancipate-call'),
            discoverPatterns
        )
    )(filePath);

// Execute
const main = () => {
    const targetFile = join(process.cwd(), '../plexus/plexus/src/PlexusModel.ts');

    console.log('Compositional Refactoring Demo\n');
    console.log('Target:', targetFile, '\n');

    // Single compositional call
    const actions = findUnnecessaryEmancipate(targetFile);

    console.log('Suggested Refactorings:\n');
    actions.forEach((action, i) => {
        console.log(`${i + 1}. ${action.action} at ${action.location.className}.${action.location.methodName}`);
        console.log(`   Reason: ${action.reason}\n`);
    });

    if (actions.length === 0) {
        console.log('No refactorings suggested.\n');
    }

    // Next step: Actually execute the actions using act tool
    console.log('Next: Feed these actions to act tool for atomic execution');
};

main();
