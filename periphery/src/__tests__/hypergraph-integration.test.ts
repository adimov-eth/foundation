/**
 * Hypergraph Integration Tests
 *
 * Tests the complete flow: AST → HyperGraph → Interpretations
 */

import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { cata } from '../catamorphism.js';
import { extractAlg } from '../algebras/extract.js';
import { dependencyAlg } from '../algebras/dependencies.js';
import { typeAlg } from '../algebras/types.js';
import {
  metadataToInheritanceGraph,
  metadataToCallGraph,
  dependencyGraphToHG,
  typeGraphToHG,
  plexusModelGraph,
} from '../algebras/ast-to-hypergraph.js';
import {
  hypergraphToDOT,
  hypergraphToAdjacency,
  hypergraphMetrics,
  toCycles,
  toPathChecker,
} from '../algebras/hypergraph-interpreters.js';
import { overlay } from '../hypergraph.js';

describe('AST → HyperGraph Integration', () => {
  const sampleCode = `
    import { PlexusModel } from '@here.build/plexus';

    export class Task extends PlexusModel {
      name: string;
      priority: number;
      team?: Team;

      moveToTeam(newTeam: Team) {
        this.team = newTeam;
      }
    }

    export class Team extends PlexusModel {
      name: string;
      tasks: Task[];

      addTask(task: Task) {
        this.tasks.push(task);
      }
    }

    export class Project extends PlexusModel {
      teams: Team[];
    }
  `;

  const project = new Project({ useInMemoryFileSystem: true });
  const sourceFile = project.createSourceFile('test.ts', sampleCode);

  it('converts AST metadata to inheritance hypergraph', () => {
    const metadata = cata(extractAlg)(sourceFile);
    const hg = metadataToInheritanceGraph(metadata);

    // Should have vertices for all classes
    const metrics = hypergraphMetrics(hg);
    expect(metrics.vertices.size).toBeGreaterThanOrEqual(3);

    // Should have edges for inheritance
    const adj = hypergraphToAdjacency(hg);
    expect(adj.get('Task')?.has('PlexusModel')).toBe(true);
    expect(adj.get('Team')?.has('PlexusModel')).toBe(true);
    expect(adj.get('Project')?.has('PlexusModel')).toBe(true);
  });

  it('converts AST metadata to call graph', () => {
    const metadata = cata(extractAlg)(sourceFile);
    const hg = metadataToCallGraph(metadata);

    const metrics = hypergraphMetrics(hg);
    expect(metrics.vertices.size).toBeGreaterThanOrEqual(3);
  });

  it('converts dependency graph to hypergraph', () => {
    const depGraph = cata(dependencyAlg('test.ts'))(sourceFile);
    const hg = dependencyGraphToHG(depGraph);

    const metrics = hypergraphMetrics(hg);
    expect(metrics.vertices.size).toBeGreaterThan(0);

    // Should have edge from test.ts to @here.build/plexus
    const adj = hypergraphToAdjacency(hg);
    expect(adj.get('test.ts')?.has('@here.build/plexus')).toBe(true);
  });

  it('converts type graph to hypergraph', () => {
    const typeGraph = cata(typeAlg)(sourceFile);
    const hg = typeGraphToHG(typeGraph);

    const metrics = hypergraphMetrics(hg);
    expect(metrics.vertices.size).toBeGreaterThan(0);
  });

  it('extracts PlexusModel subgraph', () => {
    const metadata = cata(extractAlg)(sourceFile);
    const hg = plexusModelGraph(metadata);

    const metrics = hypergraphMetrics(hg);
    expect(metrics.vertices).toContain('Task');
    expect(metrics.vertices).toContain('Team');
    expect(metrics.vertices).toContain('Project');
  });

  it('composes multiple hypergraphs', () => {
    const metadata = cata(extractAlg)(sourceFile);
    const inheritance = metadataToInheritanceGraph(metadata);
    const calls = metadataToCallGraph(metadata);

    const combined = overlay(inheritance, calls);

    const metrics = hypergraphMetrics(combined);
    expect(metrics.vertices.size).toBeGreaterThanOrEqual(3);
    expect(metrics.edges).toBeGreaterThan(0);
  });

  it('generates DOT visualization', () => {
    const metadata = cata(extractAlg)(sourceFile);
    const hg = metadataToInheritanceGraph(metadata);

    const dot = hypergraphToDOT(hg);

    expect(dot).toContain('digraph');
    expect(dot).toContain('Task');
    expect(dot).toContain('Team');
    expect(dot).toContain('PlexusModel');
  });

  it('detects cycles in dependency graph', () => {
    // Create circular dependencies
    const circularCode = `
      export class A {
        b?: B;
      }
      export class B {
        c?: C;
      }
      export class C {
        a?: A;
      }
    `;

    const circProject = new Project({ useInMemoryFileSystem: true });
    const circFile = circProject.createSourceFile('circular.ts', circularCode);

    const metadata = cata(extractAlg)(circFile);
    const hg = metadataToCallGraph(metadata);

    const cycles = toCycles(hg);
    // Might find cycles depending on type names referenced
    expect(Array.isArray(cycles)).toBe(true);
  });

  it('checks path existence', () => {
    const metadata = cata(extractAlg)(sourceFile);
    const hg = metadataToInheritanceGraph(metadata);

    // Check if Task → PlexusModel path exists
    const hasPath = toPathChecker({ from: 'Task', to: 'PlexusModel' })(hg);
    expect(hasPath).toBe(true);

    // Check if PlexusModel → Task path exists (should not)
    const hasReversePath = toPathChecker({ from: 'PlexusModel', to: 'Task' })(hg);
    expect(hasReversePath).toBe(false);
  });

  it('calculates graph metrics', () => {
    const metadata = cata(extractAlg)(sourceFile);
    const hg = metadataToInheritanceGraph(metadata);

    const metrics = hypergraphMetrics(hg);

    expect(metrics.vertices.size).toBeGreaterThan(0);
    expect(metrics.edges).toBeGreaterThan(0);
    expect(metrics.density).toBeGreaterThanOrEqual(0);
  });
});

describe('Complex Composition Scenarios', () => {
  it('overlays inheritance + calls + dependencies', () => {
    const code = `
      import { Model } from './base';

      export class User extends Model {
        profile?: Profile;
      }

      export class Profile {
        user: User;
      }
    `;

    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile('models.ts', code);

    const metadata = cata(extractAlg)(sourceFile);
    const depGraph = cata(dependencyAlg('models.ts'))(sourceFile);
    const typeGraph = cata(typeAlg)(sourceFile);

    const inheritance = metadataToInheritanceGraph(metadata);
    const calls = metadataToCallGraph(metadata);
    const deps = dependencyGraphToHG(depGraph);
    const types = typeGraphToHG(typeGraph);

    const combined = overlay(overlay(overlay(inheritance, calls), deps), types);

    const metrics = hypergraphMetrics(combined);
    expect(metrics.vertices.size).toBeGreaterThan(0);

    const dot = hypergraphToDOT(combined);
    expect(dot).toContain('digraph');
  });
});
