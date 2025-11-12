/**
 * Pattern Detection Algebra - finds specific code patterns
 *
 * Demonstrates:
 * - Contextual analysis (examining node structure)
 * - Pattern matching on AST shape
 * - Practical application (finding Plexus patterns)
 * - Paramorphism for proper context tracking
 */

import type { CodePara } from '../catamorphism.js';
import { para } from '../catamorphism.js';
import type { SyntaxKind, Node } from 'ts-morph';

/**
 * A detected pattern
 */
export type Pattern = {
    type: string;
    description: string;
    location: {
        className?: string;
        methodName?: string;
    };
    confidence: number;  // 0-1
};

/**
 * Pattern result - list of detected patterns
 */
export type Patterns = Pattern[];

/**
 * Empty patterns - monoid identity
 */
const emptyPatterns: Patterns = [];

/**
 * Combine patterns - monoid operation (array concatenation)
 */
const combinePatterns = (a: Patterns, b: Patterns): Patterns => [
    ...a,
    ...b,
];

/**
 * Context tracker - maintains current class/method context
 *
 * With paramorphism, context flows naturally from parent to child patterns.
 */
type Context = {
    className?: string;
    methodName?: string;
};

/**
 * Pattern detectors - functions that detect specific patterns
 */

/**
 * Detect array.splice pattern (Plexus emancipation indicator)
 *
 * Looks for: array.splice(index, deleteCount, ...)
 */
const isSplicePattern = (
    target: any,
    args: any[],
    context: Context
): Pattern | null => ({
    type: 'array-splice',
    description: 'Array splice operation - potential Plexus emancipation',
    location: context,
    confidence: 0.6,
});

/**
 * Detect parent assignment pattern (Plexus adoption indicator)
 *
 * Looks for: object.parent = value
 * or: object[parentSymbol] = value
 */
const isParentAssignmentPattern = (
    object: any,
    property: string,
    context: Context
): Pattern | null =>
    (property === 'parent' || property.includes('parent')) ? {
        type: 'parent-assignment',
        description: 'Parent assignment - potential Plexus adoption',
        location: context,
        confidence: 0.7,
    } : null;

/**
 * Detect PlexusModel inheritance
 *
 * Looks for: class Foo extends PlexusModel
 */
const isPlexusModelPattern = (
    className: string,
    extendsNames: string[],
    context: Context
): Pattern | null =>
    extendsNames.some(name => name.includes('PlexusModel')) ? {
        type: 'plexus-model',
        description: `Class ${className} extends PlexusModel`,
        location: context,
        confidence: 1.0,
    } : null;

/**
 * Detect @syncing decorator pattern
 *
 * Would need decorator metadata, simplified here
 */
const isSyncingDecoratorPattern = (
    _propertyName: string,
    context: Context
): Pattern | null => null;

/**
 * Detect emancipate() method calls
 *
 * Looks for: this.#emancipate() or similar
 */
const isEmancipateCallPattern = (
    targetPatterns: Patterns,
    context: Context
): Pattern | null => {
    const hasEmancipate = targetPatterns.some(p =>
        p.type === 'property-access' &&
        (p.description === 'emancipate' || p.description === '#emancipate')
    );

    return hasEmancipate ? {
        type: 'emancipate-call',
        description: 'Call to emancipate method - Plexus parent removal',
        location: context,
        confidence: 0.8,
    } : null;
};

/**
 * Helper patterns used only for detection, not reported
 */
const isHelperPattern = (p: Pattern): boolean =>
    p.type === 'type-reference' || p.type === 'property-access';

/**
 * Filter out helper patterns from results
 */
const filterHelpers = (patterns: Patterns): Patterns =>
    patterns.filter(p => !isHelperPattern(p));

/**
 * Pattern detection algebra using paramorphism
 *
 * Strategy:
 * - Most cases combine children's patterns
 * - Specific cases detect patterns and add to list
 * - Helper patterns (type-reference, property-access) used for detection but filtered from results
 * - Context flows from ClassDecl → MethodDecl → child patterns
 */
const patternPara: CodePara<Patterns> = {
    ClassDecl: (name, heritagePairs, memberPairs, typeParamPairs) => {
        // Extract patterns from children
        const heritagePatterns = heritagePairs.map(([p]) => p).reduce(combinePatterns, emptyPatterns);
        const memberPatterns = memberPairs.map(([p]) => p).reduce(combinePatterns, emptyPatterns);
        const typeParamPatterns = typeParamPairs.map(([p]) => p).reduce(combinePatterns, emptyPatterns);

        const childPatterns = combinePatterns(
            combinePatterns(heritagePatterns, memberPatterns),
            typeParamPatterns
        );

        // Extract type names from heritage patterns
        const typeNames = heritagePatterns
            .filter(p => p.type === 'type-reference')
            .map(p => p.description);

        // Detect PlexusModel pattern
        const plexusPattern = isPlexusModelPattern(
            name,
            typeNames,
            { className: name }
        );

        // Tag all child patterns with class context
        const taggedPatterns = childPatterns.map(p => ({
            ...p,
            location: { ...p.location, className: name }
        }));

        const filteredPatterns = filterHelpers(taggedPatterns);

        return plexusPattern
            ? [plexusPattern, ...filteredPatterns]
            : filteredPatterns;
    },

    InterfaceDecl: (name, heritagePairs, memberPairs, typeParamPairs) => {
        // Just combine children for interfaces
        const patterns = [
            ...heritagePairs.map(([p]) => p),
            ...memberPairs.map(([p]) => p),
            ...typeParamPairs.map(([p]) => p)
        ].reduce(combinePatterns, emptyPatterns);

        return filterHelpers(patterns);
    },

    MethodDecl: (name, paramsPairs, returnTypePair, bodyPair) => {
        // Combine all child patterns
        const childPatterns = [
            ...paramsPairs.map(([p]) => p),
            ...(returnTypePair ? [returnTypePair[0]] : []),
            ...(bodyPair ? [bodyPair[0]] : [])
        ].reduce(combinePatterns, emptyPatterns);

        // Tag all patterns with method context
        return childPatterns.map(p => ({
            ...p,
            location: { ...p.location, methodName: name }
        }));
    },

    PropertyDecl: (name, typePair, initializerPair) => {
        // Combine child patterns
        const childPatterns = [
            ...(typePair ? [typePair[0]] : []),
            ...(initializerPair ? [initializerPair[0]] : [])
        ].reduce(combinePatterns, emptyPatterns);

        return childPatterns;
    },

    FunctionDecl: (name, paramsPairs, returnTypePair, bodyPair) => {
        // Combine child patterns
        const childPatterns = [
            ...paramsPairs.map(([p]) => p),
            ...(returnTypePair ? [returnTypePair[0]] : []),
            ...(bodyPair ? [bodyPair[0]] : [])
        ].reduce(combinePatterns, emptyPatterns);

        return childPatterns;
    },

    VariableStmt: (declarationsPairs) => {
        return declarationsPairs
            .map(([p]) => p)
            .reduce(combinePatterns, emptyPatterns);
    },

    TypeAlias: (name, typeParamsPairs, [typePattern, typeNode]) => {
        const childPatterns = [
            ...typeParamsPairs.map(([p]) => p),
            typePattern
        ].reduce(combinePatterns, emptyPatterns);

        return childPatterns;
    },

    CallExpr: ([targetPattern, targetNode], argsPairs, typeArgsPairs) => {
        const childPatterns = [
            targetPattern,
            ...argsPairs.map(([p]) => p),
            ...typeArgsPairs.map(([p]) => p)
        ].reduce(combinePatterns, emptyPatterns);

        const patterns: Pattern[] = [];

        // Detect emancipate call pattern
        const emancipatePattern = isEmancipateCallPattern(childPatterns, {});
        if (emancipatePattern) {
            patterns.push(emancipatePattern);
        }

        // Detect splice pattern
        const hasSpliceAccess = childPatterns.some(p =>
            p.type === 'property-access' && p.description === 'splice'
        );
        if (hasSpliceAccess) {
            const splicePattern = isSplicePattern(targetPattern, argsPairs.map(([p]) => p), {});
            if (splicePattern) {
                patterns.push(splicePattern);
            }
        }

        return [...patterns, ...filterHelpers(childPatterns)];
    },

    PropertyAccess: ([objectPattern, objectNode], property) => {
        const patterns: Pattern[] = [];

        // Add a property-access marker pattern to carry the property name
        patterns.push({
            type: 'property-access',
            description: property,
            location: {},
            confidence: 1.0,
        });

        // Detect parent access pattern
        const parentPattern = isParentAssignmentPattern(
            objectPattern,
            property,
            {}
        );
        if (parentPattern) {
            patterns.push(parentPattern);
        }

        return [...patterns, ...objectPattern];
    },

    ImportDecl: (moduleSpecifier, namedImports, defaultImport) => {
        return emptyPatterns;
    },

    ExportDecl: (moduleSpecifier, namedExports) => {
        return emptyPatterns;
    },

    TypeReference: (name, typeArgsPairs) => {
        const childPatterns = typeArgsPairs
            .map(([p]) => p)
            .reduce(combinePatterns, emptyPatterns);

        // Create a helper pattern to carry type information
        const typeRefPattern: Pattern = {
            type: 'type-reference',
            description: name,
            location: {},
            confidence: 1.0,
        };

        return [typeRefPattern, ...childPatterns];
    },

    Other: (kind, childrenPairs) => {
        return childrenPairs
            .map(([p]) => p)
            .reduce(combinePatterns, emptyPatterns);
    }
};

/**
 * Run pattern algebra and filter out helpers
 */
export const findPatterns = (node: Node): Patterns => {
    const allPatterns = para(patternPara)(node);
    return filterHelpers(allPatterns);
};

/**
 * Utility: filter patterns by type
 */
export const filterPatterns = (
    patterns: Patterns,
    type: string
): Patterns => patterns.filter(p => p.type === type);

/**
 * Utility: filter patterns by confidence threshold
 */
export const filterByConfidence = (
    patterns: Patterns,
    minConfidence: number
): Patterns => patterns.filter(p => p.confidence >= minConfidence);

/**
 * Utility: group patterns by type
 */
export const groupPatternsByType = (
    patterns: Patterns
): Record<string, Patterns> => {
    const groups: Record<string, Patterns> = {};
    for (const pattern of patterns) {
        if (!groups[pattern.type]) {
            groups[pattern.type] = [];
        }
        groups[pattern.type].push(pattern);
    }
    return groups;
};
