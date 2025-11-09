/**
 * Pattern Detection Algebra - finds specific code patterns
 *
 * Demonstrates:
 * - Contextual analysis (examining node structure)
 * - Pattern matching on AST shape
 * - Practical application (finding Plexus patterns)
 */

import type { CodeAlg } from '../catamorphism.js';
import { cata, flatten, monoidAlg } from '../catamorphism.js';
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
 * This is a hack since catamorphisms are bottom-up.
 * A proper solution would use a paramorphism or track context differently.
 * For now, we'll pattern match on structure.
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
 * Pattern detection algebra
 *
 * Strategy:
 * - Most cases just combine children's patterns
 * - Specific cases check for patterns and add to list
 * - Helper patterns (type-reference, property-access) filtered from final results
 */
const patternAlg: CodeAlg<Patterns> = monoidAlg(
  emptyPatterns,
  combinePatterns,
  {
    ClassDecl: (name, heritage, members, typeParams) => {
      const childPatterns = [...heritage, ...members, ...typeParams].reduce(
        combinePatterns,
        emptyPatterns
      );

      // Extract type names from heritage patterns (look for type-reference patterns)
      const typeNames = heritage
        .flatMap(patterns => patterns.filter(p => p.type === 'type-reference'))
        .map(p => p.description);

      const plexusPattern = isPlexusModelPattern(
        name,
        typeNames,
        { className: name }
      );

      const filteredChildPatterns = filterHelpers(childPatterns);

      return plexusPattern
        ? [plexusPattern, ...filteredChildPatterns]
        : filteredChildPatterns;
    },

    MethodDecl: (name, params, returnType, body) => {
      const childPatterns = [
        ...params,
        ...(returnType ? [returnType] : []),
        ...(body ? [body] : []),
      ].reduce(combinePatterns, emptyPatterns);

      // Tag patterns in this method with method name
      return childPatterns.map(p => ({
        ...p,
        location: { ...p.location, methodName: name },
      }));
    },

    CallExpr: (target, args, typeArgs) => {
      const childPatterns = [target, ...args, ...typeArgs].reduce(
        combinePatterns,
        emptyPatterns
      );

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
        const splicePattern = isSplicePattern(target, args, {});
        if (splicePattern) {
          patterns.push(splicePattern);
        }
      }

      return [...patterns, ...filterHelpers(childPatterns)];
    },

    PropertyAccess: (object, property) => {
      const childPatterns = [object].reduce(
        combinePatterns,
        emptyPatterns
      );

      const patterns: Pattern[] = [];

      // Add a property-access marker pattern to carry the property name
      // This will be used by CallExpr to detect emancipate/splice calls
      patterns.push({
        type: 'property-access',
        description: property,
        location: {},
        confidence: 1.0,
      });

      // Detect parent access pattern
      const parentPattern = isParentAssignmentPattern(
        object,
        property,
        {}
      );
      if (parentPattern) {
        patterns.push(parentPattern);
      }

      return [...patterns, ...childPatterns];
    },

    TypeReference: (name, typeArgs) => {
      const childPatterns = typeArgs.reduce(combinePatterns, emptyPatterns);
      // Create a helper pattern to carry type information
      // This will be filtered out by parent cases but used to detect patterns
      const typeRefPattern: Pattern = {
        type: 'type-reference',
        description: name,
        location: {},
        confidence: 1.0,
      };
      return [typeRefPattern, ...childPatterns];
    },
  }
);

/**
 * Run pattern algebra and filter out helpers
 */
export const findPatterns = (node: Node): Patterns => {
  const allPatterns = cata(patternAlg)(node);
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
