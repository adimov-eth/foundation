/**
 * Type Relationships Algebra - tracks type usage and inheritance
 *
 * Demonstrates:
 * - Type-level analysis
 * - Building relationship graphs
 * - Foundation for later hypergraph layer
 */

import type { CodeAlg } from '../catamorphism.js';
import { monoidAlg } from '../catamorphism.js';

/**
 * Type relationship kinds
 */
export type RelationKind =
  | 'extends'
  | 'implements'
  | 'has-property'
  | 'has-method'
  | 'parameter-type'
  | 'return-type'
  | 'type-argument';

/**
 * A relationship between types
 */
export type TypeRelation = {
  kind: RelationKind;
  from: string;  // Type name
  to: string;    // Related type name
  context?: string;  // Additional context
};

/**
 * Type information
 */
export type TypeInfo = {
  name: string;
  kind: 'class' | 'interface' | 'type-alias' | 'unknown';
  members: string[];
  typeParams: string[];
};

/**
 * Type graph
 */
export type TypeGraph = {
  types: Map<string, TypeInfo>;
  relations: TypeRelation[];
};

/**
 * Empty type graph - monoid identity
 */
export const emptyTypeGraph: TypeGraph = {
  types: new Map(),
  relations: [],
};

/**
 * Combine type graphs - monoid operation
 */
export const combineTypeGraphs = (
  a: TypeGraph,
  b: TypeGraph
): TypeGraph => {
  const types = new Map(a.types);
  for (const [name, info] of b.types) {
    types.set(name, info);
  }

  return {
    types,
    relations: [...a.relations, ...b.relations],
  };
};

/**
 * Type relationship algebra
 *
 * Strategy:
 * - Track type definitions (classes, interfaces, type aliases)
 * - Track usage relationships (extends, implements, uses)
 * - Build complete type graph
 */
export const typeAlg: CodeAlg<TypeGraph> = monoidAlg(
  emptyTypeGraph,
  combineTypeGraphs,
  {
    ClassDecl: (name, heritage, members, typeParams) => {
      const childGraph = [...heritage, ...members, ...typeParams].reduce(
        combineTypeGraphs,
        emptyTypeGraph
      );

      // Extract heritage type names
      const heritageTypes = heritage.flatMap(h =>
        Array.from(h.types.keys())
      );

      // Create extends relationships
      const extendsRelations: TypeRelation[] = heritageTypes.map(t => ({
        kind: 'extends' as const,
        from: name,
        to: t,
      }));

      // Extract member names (simplified)
      const memberNames = Array.from(childGraph.types.keys());

      // Extract type parameter names
      const typeParamNames = typeParams.flatMap(tp =>
        Array.from(tp.types.keys())
      );

      const typeInfo: TypeInfo = {
        name,
        kind: 'class',
        members: memberNames,
        typeParams: typeParamNames,
      };

      return {
        types: new Map([[name, typeInfo], ...childGraph.types]),
        relations: [...extendsRelations, ...childGraph.relations],
      };
    },

    InterfaceDecl: (name, heritage, members, typeParams) => {
      const childGraph = [...heritage, ...members, ...typeParams].reduce(
        combineTypeGraphs,
        emptyTypeGraph
      );

      const heritageTypes = heritage.flatMap(h =>
        Array.from(h.types.keys())
      );

      const extendsRelations: TypeRelation[] = heritageTypes.map(t => ({
        kind: 'extends' as const,
        from: name,
        to: t,
      }));

      const memberNames = Array.from(childGraph.types.keys());
      const typeParamNames = typeParams.flatMap(tp =>
        Array.from(tp.types.keys())
      );

      const typeInfo: TypeInfo = {
        name,
        kind: 'interface',
        members: memberNames,
        typeParams: typeParamNames,
      };

      return {
        types: new Map([[name, typeInfo], ...childGraph.types]),
        relations: [...extendsRelations, ...childGraph.relations],
      };
    },

    TypeAlias: (name, typeParams, type) => {
      const childGraph = [...typeParams, type].reduce(
        combineTypeGraphs,
        emptyTypeGraph
      );

      const typeParamNames = typeParams.flatMap(tp =>
        Array.from(tp.types.keys())
      );

      const typeInfo: TypeInfo = {
        name,
        kind: 'type-alias',
        members: [],
        typeParams: typeParamNames,
      };

      return {
        types: new Map([[name, typeInfo], ...childGraph.types]),
        relations: childGraph.relations,
      };
    },

    TypeReference: (name, typeArgs) => {
      const childGraph = typeArgs.reduce(
        combineTypeGraphs,
        emptyTypeGraph
      );

      // Create type-argument relationships
      const typeArgRelations: TypeRelation[] = typeArgs.flatMap(arg =>
        Array.from(arg.types.keys()).map(argType => ({
          kind: 'type-argument' as const,
          from: name,
          to: argType,
        }))
      );

      const typeInfo: TypeInfo = {
        name,
        kind: 'unknown',
        members: [],
        typeParams: [],
      };

      return {
        types: new Map([[name, typeInfo], ...childGraph.types]),
        relations: [...typeArgRelations, ...childGraph.relations],
      };
    },

    MethodDecl: (name, params, returnType, body) => {
      const childGraph = [
        ...params,
        ...(returnType ? [returnType] : []),
        ...(body ? [body] : []),
      ].reduce(combineTypeGraphs, emptyTypeGraph);

      // Add parameter-type and return-type relationships
      const paramTypes = params.flatMap(p => Array.from(p.types.keys()));
      const returnTypes = returnType
        ? Array.from(returnType.types.keys())
        : [];

      const paramRelations: TypeRelation[] = paramTypes.map(t => ({
        kind: 'parameter-type' as const,
        from: name,
        to: t,
      }));

      const returnRelations: TypeRelation[] = returnTypes.map(t => ({
        kind: 'return-type' as const,
        from: name,
        to: t,
      }));

      return {
        ...childGraph,
        relations: [
          ...paramRelations,
          ...returnRelations,
          ...childGraph.relations,
        ],
      };
    },
  }
);

/**
 * Utility: Find all types that extend a given type
 */
export const findSubtypes = (
  graph: TypeGraph,
  typeName: string
): string[] => {
  return graph.relations
    .filter(r => r.kind === 'extends' && r.to === typeName)
    .map(r => r.from);
};

/**
 * Utility: Find all types that a given type extends
 */
export const findSupertypes = (
  graph: TypeGraph,
  typeName: string
): string[] => {
  return graph.relations
    .filter(r => r.kind === 'extends' && r.from === typeName)
    .map(r => r.to);
};

/**
 * Utility: Get inheritance hierarchy (transitive closure)
 */
export const getInheritanceHierarchy = (
  graph: TypeGraph,
  typeName: string
): string[] => {
  const hierarchy: string[] = [];
  const visited = new Set<string>();

  const dfs = (name: string) => {
    if (visited.has(name)) return;
    visited.add(name);
    hierarchy.push(name);

    const supertypes = findSupertypes(graph, name);
    for (const supertype of supertypes) {
      dfs(supertype);
    }
  };

  dfs(typeName);
  return hierarchy;
};

/**
 * Utility: Convert type graph to DOT format
 */
export const typeGraphToDOT = (graph: TypeGraph): string => {
  const lines: string[] = ['digraph Types {'];

  // Add nodes with labels
  for (const [name, info] of graph.types) {
    const shape = info.kind === 'class' ? 'box' : 'ellipse';
    lines.push(`  "${name}" [shape=${shape}];`);
  }

  // Add edges
  for (const relation of graph.relations) {
    const style =
      relation.kind === 'extends' ? 'solid' :
      relation.kind === 'implements' ? 'dashed' :
      'dotted';
    const label = relation.kind;

    lines.push(
      `  "${relation.from}" -> "${relation.to}" [style=${style},label="${label}"];`
    );
  }

  lines.push('}');
  return lines.join('\n');
};
