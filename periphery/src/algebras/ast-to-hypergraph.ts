/**
 * AST to HyperGraph Converters
 *
 * Transforms AST analysis results into hypergraphs for:
 * - Composition (overlay multiple graphs)
 * - Visualization (toDOT)
 * - Analysis (cycles, metrics, paths)
 */

import type { Metadata } from './extract.js';
import type { DependencyGraph } from './dependencies.js';
import type { TypeGraph } from './types.js';
import { vertex, edge, overlay, overlays, edges } from '../hypergraph.js';
import type { HyperGraph } from '../hypergraph.js';

/**
 * Metadata → Inheritance HyperGraph
 *
 * Creates graph of class inheritance relationships.
 * Edge: subclass → superclass
 */
export const metadataToInheritanceGraph = (metadata: Metadata): HyperGraph => {
  const edgeList: string[][] = [];

  for (const cls of metadata.classes) {
    // For each superclass, create edge: cls → superclass
    for (const superclass of cls.extends) {
      edgeList.push([cls.name, superclass]);
    }

    // For each interface, create edge: cls → interface
    for (const iface of cls.implements) {
      edgeList.push([cls.name, iface]);
    }
  }

  // Also add interfaces extending other interfaces
  for (const iface of metadata.interfaces) {
    for (const superIface of iface.extends) {
      edgeList.push([iface.name, superIface]);
    }
  }

  return edges(edgeList);
};

/**
 * Metadata → Call HyperGraph (simplified)
 *
 * Creates graph showing which classes/types are referenced.
 * This is a simplified version - full call graph would require more analysis.
 */
export const metadataToCallGraph = (metadata: Metadata): HyperGraph => {
  const edgeList: string[][] = [];

  // Connect classes to types they reference (extends/implements)
  for (const cls of metadata.classes) {
    const referencedTypes = new Set([...cls.extends, ...cls.implements]);
    for (const type of referencedTypes) {
      edgeList.push([cls.name, type]);
    }
  }

  return edges(edgeList);
};

/**
 * DependencyGraph → HyperGraph
 *
 * Converts module dependency graph to hypergraph.
 * Edge: importer → imported module
 */
export const dependencyGraphToHG = (depGraph: DependencyGraph): HyperGraph => {
  const edgeList: string[][] = depGraph.edges.map(e => [e.from, e.to]);
  return edges(edgeList);
};

/**
 * TypeGraph → HyperGraph
 *
 * Converts type relationship graph to hypergraph.
 */
export const typeGraphToHG = (typeGraph: TypeGraph): HyperGraph => {
  const edgeList: string[][] = [];

  for (const relation of typeGraph.relations) {
    edgeList.push([relation.from, relation.to]);
  }

  return edges(edgeList);
};

/**
 * PlexusModel Subclass Graph
 *
 * Creates a graph of just PlexusModel subclasses.
 * Useful for visualizing Plexus model hierarchy.
 */
export const plexusModelGraph = (metadata: Metadata): HyperGraph => {
  const edgeList: string[][] = [];
  const plexusClasses = metadata.classes.filter(c =>
    c.extends.some(s => s.includes('PlexusModel'))
  );

  // Connect each PlexusModel subclass to PlexusModel
  for (const cls of plexusClasses) {
    const plexusBase = cls.extends.find(s => s.includes('PlexusModel'));
    if (plexusBase) {
      edgeList.push([cls.name, plexusBase]);
    }
  }

  // Also include inheritance between PlexusModel subclasses
  for (const cls of plexusClasses) {
    for (const superclass of cls.extends) {
      // If superclass is also a PlexusModel subclass
      if (plexusClasses.some(c => c.name === superclass)) {
        edgeList.push([cls.name, superclass]);
      }
    }
  }

  return edges(edgeList);
};

/**
 * Combined Code Graph
 *
 * Overlays multiple graph types for comprehensive visualization.
 */
export const combinedCodeGraph = (
  metadata: Metadata,
  depGraph: DependencyGraph,
  typeGraph: TypeGraph
): HyperGraph => {
  return overlays([
    metadataToInheritanceGraph(metadata),
    dependencyGraphToHG(depGraph),
    typeGraphToHG(typeGraph),
  ]);
};
