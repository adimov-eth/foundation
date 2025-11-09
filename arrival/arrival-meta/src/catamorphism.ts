/**
 * F-Algebras and Catamorphisms for TypeScript AST
 *
 * A catamorphism (generalized fold) separates "how to traverse" from "what to compute".
 *
 * Key insight: Write traversal logic ONCE, compose analyses as algebras.
 *
 * Type hierarchy:
 * - CodeAlg<A>: Algebra type - one case per AST node type
 * - cata<A>: Generic catamorphism - handles ALL recursion
 * - Algebras: count, extract, patterns, dependencies, types
 */

import { Node, SyntaxKind, ts } from 'ts-morph';
import type {
  ClassDeclaration,
  MethodDeclaration,
  PropertyDeclaration,
  CallExpression,
  PropertyAccessExpression,
  ImportDeclaration,
  ExportDeclaration,
  InterfaceDeclaration,
  TypeAliasDeclaration,
  FunctionDeclaration,
  VariableStatement,
} from 'ts-morph';

/**
 * The algebra type - one case per AST node we care about
 *
 * Each case receives:
 * - Relevant node data (names, modifiers, etc.)
 * - Already-computed results from children (type A)
 *
 * Returns: Result of type A
 *
 * This is the "F" in "F-algebra" - the functor describing one layer
 */
export type CodeAlg<A> = {
  // Declarations
  ClassDecl: (
    name: string,
    heritage: A[],
    members: A[],
    typeParams: A[]
  ) => A;

  InterfaceDecl: (
    name: string,
    heritage: A[],
    members: A[],
    typeParams: A[]
  ) => A;

  MethodDecl: (
    name: string,
    params: A[],
    returnType: A | null,
    body: A | null
  ) => A;

  PropertyDecl: (
    name: string,
    type: A | null,
    initializer: A | null
  ) => A;

  FunctionDecl: (
    name: string | null,
    params: A[],
    returnType: A | null,
    body: A | null
  ) => A;

  VariableStmt: (declarations: A[]) => A;

  TypeAlias: (
    name: string,
    typeParams: A[],
    type: A
  ) => A;

  // Expressions
  CallExpr: (
    target: A,
    args: A[],
    typeArgs: A[]
  ) => A;

  PropertyAccess: (
    object: A,
    property: string
  ) => A;

  // Imports/Exports
  ImportDecl: (
    moduleSpecifier: string,
    namedImports: string[],
    defaultImport: string | null
  ) => A;

  ExportDecl: (
    moduleSpecifier: string | null,
    namedExports: string[]
  ) => A;

  // Types
  TypeReference: (
    name: string,
    typeArgs: A[]
  ) => A;

  // Catch-all for other nodes
  Other: (kind: SyntaxKind, children: A[]) => A;
};

/**
 * Helper: sum array of numbers
 */
export const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);

/**
 * Helper: flatten array of arrays
 */
export const flatten = <T>(xss: T[][]): T[] => xss.flat();

/**
 * The catamorphism - generic fold over AST
 *
 * Takes an algebra, returns a function that folds any Node to A
 *
 * Implementation:
 * 1. Pattern match on node kind
 * 2. Recursively fold children
 * 3. Call appropriate algebra case with results
 *
 * This is where ALL traversal logic lives - only write this once!
 */
export const cata = <A>(alg: CodeAlg<A>) => {
  const go = (node: Node): A => {
    const kind = node.getKind();

    // Class declaration
    if (Node.isClassDeclaration(node)) {
      const name = node.getName() ?? '';
      const heritage = node.getExtends() ? [go(node.getExtends()!)] : [];
      const implementsTypes = node.getImplements().map(go);
      const members = node.getMembers().map(go);
      const typeParams = node.getTypeParameters().map(go);
      return alg.ClassDecl(name, [...heritage, ...implementsTypes], members, typeParams);
    }

    // Interface declaration
    if (Node.isInterfaceDeclaration(node)) {
      const name = node.getName();
      const heritage = node.getExtends().map(go);
      const members = node.getMembers().map(go);
      const typeParams = node.getTypeParameters().map(go);
      return alg.InterfaceDecl(name, heritage, members, typeParams);
    }

    // Method declaration
    if (Node.isMethodDeclaration(node)) {
      const name = node.getName();
      const params = node.getParameters().map(go);
      const returnType = node.getReturnTypeNode();
      const body = node.getBody();
      return alg.MethodDecl(
        name,
        params,
        returnType ? go(returnType) : null,
        body ? go(body) : null
      );
    }

    // Property declaration
    if (Node.isPropertyDeclaration(node)) {
      const name = node.getName();
      const type = node.getTypeNode();
      const init = node.getInitializer();
      return alg.PropertyDecl(
        name,
        type ? go(type) : null,
        init ? go(init) : null
      );
    }

    // Function declaration
    if (Node.isFunctionDeclaration(node)) {
      const name = node.getName() ?? null;
      const params = node.getParameters().map(go);
      const returnType = node.getReturnTypeNode();
      const body = node.getBody();
      return alg.FunctionDecl(
        name,
        params,
        returnType ? go(returnType) : null,
        body ? go(body) : null
      );
    }

    // Variable statement
    if (Node.isVariableStatement(node)) {
      const declarations = node.getDeclarations().map(go);
      return alg.VariableStmt(declarations);
    }

    // Type alias
    if (Node.isTypeAliasDeclaration(node)) {
      const name = node.getName();
      const typeParams = node.getTypeParameters().map(go);
      const typeNode = node.getTypeNode();
      if (!typeNode) {
        throw new Error(`Type alias ${name} has no type node`);
      }
      return alg.TypeAlias(name, typeParams, go(typeNode));
    }

    // Call expression
    if (Node.isCallExpression(node)) {
      const target = go(node.getExpression());
      const args = node.getArguments().map(go);
      const typeArgs = node.getTypeArguments().map(go);
      return alg.CallExpr(target, args, typeArgs);
    }

    // Property access
    if (Node.isPropertyAccessExpression(node)) {
      const object = go(node.getExpression());
      const property = node.getName();
      return alg.PropertyAccess(object, property);
    }

    // Import declaration
    if (Node.isImportDeclaration(node)) {
      const moduleSpec = node.getModuleSpecifierValue();
      const defaultImport = node.getDefaultImport()?.getText() ?? null;
      const namedImports = node.getNamedImports().map(i => i.getName());
      return alg.ImportDecl(moduleSpec, namedImports, defaultImport);
    }

    // Export declaration
    if (Node.isExportDeclaration(node)) {
      const moduleSpec = node.getModuleSpecifierValue() ?? null;
      const namedExports = node.getNamedExports().map(e => e.getName());
      return alg.ExportDecl(moduleSpec, namedExports);
    }

    // Type reference
    if (Node.isTypeReference(node)) {
      const name = node.getTypeName().getText();
      const typeArgs = node.getTypeArguments().map(go);
      return alg.TypeReference(name, typeArgs);
    }

    // Expression with type arguments (used in extends/implements clauses)
    if (Node.isExpressionWithTypeArguments(node)) {
      const name = node.getExpression().getText();
      const typeArgs = node.getTypeArguments().map(go);
      return alg.TypeReference(name, typeArgs);
    }

    // Catch-all: fold all children
    const children = node.getChildren().map(go);
    return alg.Other(kind, children);
  };

  return go;
};

/**
 * Monoid algebra: combines results with a monoid operation
 *
 * Useful when algebra returns a monoid (numbers, arrays, sets, etc.)
 * Default behavior: combine children via monoid
 */
export const monoidAlg = <A>(
  empty: A,
  concat: (a: A, b: A) => A,
  cases: Partial<CodeAlg<A>> = {}
): CodeAlg<A> => {
  const combineAll = (xs: A[]): A => xs.reduce(concat, empty);

  return {
    ClassDecl: cases.ClassDecl ?? ((_name, heritage, members, typeParams) =>
      combineAll([...heritage, ...members, ...typeParams])
    ),

    InterfaceDecl: cases.InterfaceDecl ?? ((_name, heritage, members, typeParams) =>
      combineAll([...heritage, ...members, ...typeParams])
    ),

    MethodDecl: cases.MethodDecl ?? ((_name, params, returnType, body) =>
      combineAll([...params, ...(returnType ? [returnType] : []), ...(body ? [body] : [])])
    ),

    PropertyDecl: cases.PropertyDecl ?? ((_name, type, initializer) =>
      combineAll([...(type ? [type] : []), ...(initializer ? [initializer] : [])])
    ),

    FunctionDecl: cases.FunctionDecl ?? ((_name, params, returnType, body) =>
      combineAll([...params, ...(returnType ? [returnType] : []), ...(body ? [body] : [])])
    ),

    VariableStmt: cases.VariableStmt ?? ((declarations) =>
      combineAll(declarations)
    ),

    TypeAlias: cases.TypeAlias ?? ((_name, typeParams, type) =>
      combineAll([...typeParams, type])
    ),

    CallExpr: cases.CallExpr ?? ((target, args, typeArgs) =>
      combineAll([target, ...args, ...typeArgs])
    ),

    PropertyAccess: cases.PropertyAccess ?? ((object, _property) =>
      object
    ),

    ImportDecl: cases.ImportDecl ?? ((_moduleSpecifier, _namedImports, _defaultImport) =>
      empty
    ),

    ExportDecl: cases.ExportDecl ?? ((_moduleSpecifier, _namedExports) =>
      empty
    ),

    TypeReference: cases.TypeReference ?? ((_name, typeArgs) =>
      combineAll(typeArgs)
    ),

    Other: cases.Other ?? ((_kind, children) =>
      combineAll(children)
    ),
  };
};
