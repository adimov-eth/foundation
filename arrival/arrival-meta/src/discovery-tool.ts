/**
 * Code Discovery Tool - Arrival MCP integration
 *
 * Exposes catamorphism-based analyses as Discovery tool primitives.
 * Composable via S-expressions in Scheme.
 */

import { DiscoveryToolInteraction } from '@here.build/arrival-mcp';
import { Project } from 'ts-morph';
import * as z from 'zod';
import { cata } from './catamorphism.js';
import {
  countAlg,
  countNodesAlg,
  type Counts,
} from './algebras/count.js';
import {
  extractAlg,
  type Metadata,
} from './algebras/extract.js';
import {
  findPatterns,
  filterPatterns,
  filterByConfidence,
  groupPatternsByType,
  type Patterns,
} from './algebras/patterns.js';
import {
  dependencyAlg,
  findCycles,
  topologicalSort,
  getDependencies,
  getDependents,
  toDOT as depsToDOT,
  type DependencyGraph,
} from './algebras/dependencies.js';
import {
  typeAlg,
  findSubtypes,
  findSupertypes,
  getInheritanceHierarchy,
  typeGraphToDOT,
  type TypeGraph,
} from './algebras/types.js';

/**
 * Code Discovery Tool
 *
 * Registers catamorphism-based analyses as composable primitives.
 */
export class CodeDiscovery extends DiscoveryToolInteraction<Record<string, never>> {
  static readonly name = 'code-discovery';
  readonly description = 'Compositional codebase exploration via catamorphisms';

  private project: Project | null = null;

  /**
   * Initialize ts-morph project
   */
  private async getProject(tsConfigPath?: string): Promise<Project> {
    if (this.project) return this.project;

    this.project = new Project({
      tsConfigFilePath: tsConfigPath ?? './tsconfig.json',
    });

    return this.project;
  }

  /**
   * Helper: get source file from path
   */
  private async getSourceFile(filePath: string, tsConfigPath?: string) {
    const project = await this.getProject(tsConfigPath);
    const sourceFile = project.getSourceFile(filePath);
    if (!sourceFile) {
      throw new Error(`File not found: ${filePath}`);
    }
    return sourceFile;
  }

  async registerFunctions() {
    // ========================================
    // Count Algebra
    // ========================================

    this.registerFunction(
      'count-nodes',
      'Count total AST nodes in a file',
      [z.string(), z.string().optional()],
      async (filePath: string, tsConfigPath?: string) => {
        const sourceFile = await this.getSourceFile(filePath, tsConfigPath);
        return cata(countNodesAlg)(sourceFile);
      }
    );

    this.registerFunction(
      'count-by-type',
      'Count nodes by type (classes, methods, etc.)',
      [z.string(), z.string().optional()],
      async (filePath: string, tsConfigPath?: string) => {
        const sourceFile = await this.getSourceFile(filePath, tsConfigPath);
        return cata(countAlg)(sourceFile);
      }
    );

    // ========================================
    // Extract Algebra
    // ========================================

    this.registerFunction(
      'extract-metadata',
      'Extract structured metadata (classes, interfaces, functions, imports)',
      [z.string(), z.string().optional()],
      async (filePath: string, tsConfigPath?: string) => {
        const sourceFile = await this.getSourceFile(filePath, tsConfigPath);
        return cata(extractAlg)(sourceFile);
      }
    );

    this.registerFunction(
      'find-classes',
      'Find all classes in a file',
      [z.string(), z.string().optional()],
      async (filePath: string, tsConfigPath?: string) => {
        const sourceFile = await this.getSourceFile(filePath, tsConfigPath);
        const metadata = cata(extractAlg)(sourceFile);
        return metadata.classes;
      }
    );

    this.registerFunction(
      'find-interfaces',
      'Find all interfaces in a file',
      [z.string(), z.string().optional()],
      async (filePath: string, tsConfigPath?: string) => {
        const sourceFile = await this.getSourceFile(filePath, tsConfigPath);
        const metadata = cata(extractAlg)(sourceFile);
        return metadata.interfaces;
      }
    );

    // ========================================
    // Pattern Detection Algebra
    // ========================================

    this.registerFunction(
      'find-patterns',
      'Find all code patterns in a file',
      [z.string(), z.string().optional()],
      async (filePath: string, tsConfigPath?: string) => {
        const sourceFile = await this.getSourceFile(filePath, tsConfigPath);
        return findPatterns(sourceFile);
      }
    );

    this.registerFunction(
      'find-pattern-type',
      'Find patterns of a specific type',
      [z.string(), z.string(), z.string().optional()],
      async (
        filePath: string,
        patternType: string,
        tsConfigPath?: string
      ) => {
        const sourceFile = await this.getSourceFile(filePath, tsConfigPath);
        const patterns = findPatterns(sourceFile);
        return filterPatterns(patterns, patternType);
      }
    );

    this.registerFunction(
      'find-high-confidence-patterns',
      'Find patterns above confidence threshold',
      [z.string(), z.number(), z.string().optional()],
      async (
        filePath: string,
        minConfidence: number,
        tsConfigPath?: string
      ) => {
        const sourceFile = await this.getSourceFile(filePath, tsConfigPath);
        const patterns = findPatterns(sourceFile);
        return filterByConfidence(patterns, minConfidence);
      }
    );

    this.registerFunction(
      'group-patterns',
      'Group patterns by type',
      [z.string(), z.string().optional()],
      async (filePath: string, tsConfigPath?: string) => {
        const sourceFile = await this.getSourceFile(filePath, tsConfigPath);
        const patterns = findPatterns(sourceFile);
        return groupPatternsByType(patterns);
      }
    );

    // ========================================
    // Dependency Graph Algebra
    // ========================================

    this.registerFunction(
      'dependency-graph',
      'Build module dependency graph',
      [z.string(), z.string().optional()],
      async (filePath: string, tsConfigPath?: string) => {
        const sourceFile = await this.getSourceFile(filePath, tsConfigPath);
        const graph = cata(dependencyAlg(filePath))(sourceFile);
        return {
          edges: graph.edges,
          modules: Array.from(graph.modules),
        };
      }
    );

    this.registerFunction(
      'find-cycles',
      'Find circular dependencies',
      [z.string(), z.string().optional()],
      async (filePath: string, tsConfigPath?: string) => {
        const sourceFile = await this.getSourceFile(filePath, tsConfigPath);
        const graph = cata(dependencyAlg(filePath))(sourceFile);
        return findCycles(graph);
      }
    );

    this.registerFunction(
      'topological-sort',
      'Sort modules in dependency order',
      [z.string(), z.string().optional()],
      async (filePath: string, tsConfigPath?: string) => {
        const sourceFile = await this.getSourceFile(filePath, tsConfigPath);
        const graph = cata(dependencyAlg(filePath))(sourceFile);
        return topologicalSort(graph);
      }
    );

    this.registerFunction(
      'deps-to-dot',
      'Convert dependency graph to DOT format',
      [z.string(), z.string().optional()],
      async (filePath: string, tsConfigPath?: string) => {
        const sourceFile = await this.getSourceFile(filePath, tsConfigPath);
        const graph = cata(dependencyAlg(filePath))(sourceFile);
        return depsToDOT(graph);
      }
    );

    // ========================================
    // Type Graph Algebra
    // ========================================

    this.registerFunction(
      'type-graph',
      'Build type relationship graph',
      [z.string(), z.string().optional()],
      async (filePath: string, tsConfigPath?: string) => {
        const sourceFile = await this.getSourceFile(filePath, tsConfigPath);
        const graph = cata(typeAlg)(sourceFile);
        return {
          types: Array.from(graph.types.entries()).map(([, info]) => info),
          relations: graph.relations,
        };
      }
    );

    this.registerFunction(
      'find-subtypes',
      'Find all types that extend a given type',
      [z.string(), z.string(), z.string().optional()],
      async (
        filePath: string,
        typeName: string,
        tsConfigPath?: string
      ) => {
        const sourceFile = await this.getSourceFile(filePath, tsConfigPath);
        const graph = cata(typeAlg)(sourceFile);
        return findSubtypes(graph, typeName);
      }
    );

    this.registerFunction(
      'inheritance-hierarchy',
      'Get complete inheritance hierarchy for a type',
      [z.string(), z.string(), z.string().optional()],
      async (
        filePath: string,
        typeName: string,
        tsConfigPath?: string
      ) => {
        const sourceFile = await this.getSourceFile(filePath, tsConfigPath);
        const graph = cata(typeAlg)(sourceFile);
        return getInheritanceHierarchy(graph, typeName);
      }
    );

    this.registerFunction(
      'type-graph-to-dot',
      'Convert type graph to DOT format',
      [z.string(), z.string().optional()],
      async (filePath: string, tsConfigPath?: string) => {
        const sourceFile = await this.getSourceFile(filePath, tsConfigPath);
        const graph = cata(typeAlg)(sourceFile);
        return typeGraphToDOT(graph);
      }
    );
  }
}
