/**
 * Count Algebra - counts nodes by type
 *
 * Demonstrates:
 * - Monoid algebra (numbers under addition)
 * - Selective counting (only certain node types)
 * - Composition (combine with other algebras)
 */

import type { CodeAlg } from '../catamorphism.js';
import { sum, monoidAlg } from '../catamorphism.js';

/**
 * Count result - counts for each node type
 */
export type Counts = {
  classes: number;
  interfaces: number;
  methods: number;
  properties: number;
  functions: number;
  imports: number;
  exports: number;
  callExprs: number;
  total: number;
};

/**
 * Empty count - identity for addition
 */
const emptyCounts: Counts = {
  classes: 0,
  interfaces: 0,
  methods: 0,
  properties: 0,
  functions: 0,
  imports: 0,
  exports: 0,
  callExprs: 0,
  total: 0,
};

/**
 * Combine counts - monoid operation
 */
const combineCounts = (a: Counts, b: Counts): Counts => ({
  classes: a.classes + b.classes,
  interfaces: a.interfaces + b.interfaces,
  methods: a.methods + b.methods,
  properties: a.properties + b.properties,
  functions: a.functions + b.functions,
  imports: a.imports + b.imports,
  exports: a.exports + b.exports,
  callExprs: a.callExprs + b.callExprs,
  total: a.total + b.total,
});

/**
 * Count algebra - counts all node types
 *
 * Strategy: Each case increments its count + sums children
 */
export const countAlg: CodeAlg<Counts> = monoidAlg(
  emptyCounts,
  combineCounts,
  {
    ClassDecl: (_, heritage, members, typeParams) => {
      const heritageCount = heritage.reduce(combineCounts, emptyCounts);
      const membersCount = members.reduce(combineCounts, emptyCounts);
      const typeParamsCount = typeParams.reduce(combineCounts, emptyCounts);
      const childCounts = combineCounts(
        heritageCount,
        combineCounts(membersCount, typeParamsCount)
      );
      return {
        ...childCounts,
        classes: childCounts.classes + 1,
        total: childCounts.total + 1,
      };
    },

    InterfaceDecl: (_, heritage, members, typeParams) => {
      const heritageCount = heritage.reduce(combineCounts, emptyCounts);
      const membersCount = members.reduce(combineCounts, emptyCounts);
      const typeParamsCount = typeParams.reduce(combineCounts, emptyCounts);
      const childCounts = combineCounts(
        heritageCount,
        combineCounts(membersCount, typeParamsCount)
      );
      return {
        ...childCounts,
        interfaces: childCounts.interfaces + 1,
        total: childCounts.total + 1,
      };
    },

    MethodDecl: (_, params, returnType, body) => {
      const paramsCount = params.reduce(combineCounts, emptyCounts);
      const childCounts = combineCounts(
        paramsCount,
        returnType ?? emptyCounts
      );
      const withBody = body ? combineCounts(childCounts, body) : childCounts;
      return {
        ...withBody,
        methods: withBody.methods + 1,
        total: withBody.total + 1,
      };
    },

    PropertyDecl: (_, type, initializer) => {
      const childCounts = combineCounts(
        type ?? emptyCounts,
        initializer ?? emptyCounts
      );
      return {
        ...childCounts,
        properties: childCounts.properties + 1,
        total: childCounts.total + 1,
      };
    },

    FunctionDecl: (_, params, returnType, body) => {
      const paramsCount = params.reduce(combineCounts, emptyCounts);
      const childCounts = combineCounts(
        paramsCount,
        combineCounts(returnType ?? emptyCounts, body ?? emptyCounts)
      );
      return {
        ...childCounts,
        functions: childCounts.functions + 1,
        total: childCounts.total + 1,
      };
    },

    ImportDecl: (_, __, ___) => ({
      ...emptyCounts,
      imports: 1,
      total: 1,
    }),

    ExportDecl: (_, __) => ({
      ...emptyCounts,
      exports: 1,
      total: 1,
    }),

    CallExpr: (target, args, typeArgs) => {
      const argsCount = args.reduce(combineCounts, emptyCounts);
      const typeArgsCount = typeArgs.reduce(combineCounts, emptyCounts);
      const childCounts = combineCounts(
        combineCounts(target, argsCount),
        typeArgsCount
      );
      return {
        ...childCounts,
        callExprs: childCounts.callExprs + 1,
        total: childCounts.total + 1,
      };
    },
  }
);

/**
 * Simple count algebra - just counts total nodes
 *
 * Simpler example for demonstration
 */
export const countNodesAlg: CodeAlg<number> = monoidAlg(0, (a, b) => a + b, {
  ClassDecl: (_, heritage, members, typeParams) =>
    1 + sum(heritage) + sum(members) + sum(typeParams),

  InterfaceDecl: (_, heritage, members, typeParams) =>
    1 + sum(heritage) + sum(members) + sum(typeParams),

  MethodDecl: (_, params, returnType, body) =>
    1 + sum(params) + (returnType ?? 0) + (body ?? 0),

  PropertyDecl: (_, type, initializer) =>
    1 + (type ?? 0) + (initializer ?? 0),

  FunctionDecl: (_, params, returnType, body) =>
    1 + sum(params) + (returnType ?? 0) + (body ?? 0),

  VariableStmt: (decls) => 1 + sum(decls),

  TypeAlias: (_, typeParams, type) => 1 + sum(typeParams) + type,

  CallExpr: (target, args, typeArgs) => 1 + target + sum(args) + sum(typeArgs),

  PropertyAccess: (object, _) => 1 + object,

  ImportDecl: () => 1,

  ExportDecl: () => 1,

  TypeReference: (_, typeArgs) => 1 + sum(typeArgs),

  Other: (_, children) => 1 + sum(children),
});
