/**
 * Demo: Compositional Codebase Exploration
 *
 * Shows how catamorphisms enable:
 * - Writing traversal once
 * - Composing analyses
 * - S-expression-like composition (via function composition)
 *
 * Future: Actual S-expression composition via Scheme
 */

import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { cata } from '../catamorphism.js';
import { countAlg, countNodesAlg } from '../algebras/count.js';
import { extractAlg } from '../algebras/extract.js';
import { findPatterns, filterPatterns } from '../algebras/patterns.js';
import { dependencyAlg } from '../algebras/dependencies.js';
import { typeAlg, findSubtypes } from '../algebras/types.js';

describe('Catamorphism Demo', () => {
  // Sample TypeScript code for testing
  const sampleCode = `
    import { PlexusModel } from '@here.build/plexus';

    @syncing
    class Task extends PlexusModel {
      @syncing accessor name!: string;
      @syncing accessor priority!: number;

      #emancipate() {
        // Remove from old parent
        if (this.parent) {
          this.parent.children.splice(this.parent.children.indexOf(this), 1);
        }
      }

      moveToTeam(newTeam: Team) {
        this.#emancipate();
        newTeam.tasks.push(this);
      }
    }

    class Team extends PlexusModel {
      @syncing accessor name!: string;
      @syncing.child.list accessor tasks!: Task[];

      addTask(task: Task) {
        this.tasks.push(task);
      }
    }
  `;

  const project = new Project({ useInMemoryFileSystem: true });
  const sourceFile = project.createSourceFile('test.ts', sampleCode);

  it('counts nodes - demonstrates write traversal once', () => {
    // Count total nodes
    const totalNodes = cata(countNodesAlg)(sourceFile);
    expect(totalNodes).toBeGreaterThan(0);

    // Count by type - same traversal, different algebra
    const counts = cata(countAlg)(sourceFile);
    expect(counts.classes).toBe(2); // Task and Team
    expect(counts.methods).toBeGreaterThan(0);
  });

  it('extracts metadata - demonstrates non-numeric algebra', () => {
    const metadata = cata(extractAlg)(sourceFile);

    // Should find both classes
    expect(metadata.classes).toHaveLength(2);

    const task = metadata.classes.find(c => c.name === 'Task');
    expect(task).toBeDefined();
    expect(task!.extends).toContain('PlexusModel');

    // Should find import
    expect(metadata.imports).toHaveLength(1);
    expect(metadata.imports[0].from).toBe('@here.build/plexus');
  });

  it('finds patterns - demonstrates contextual analysis', () => {
    const patterns = findPatterns(sourceFile);

    // Should detect PlexusModel pattern
    const plexusPatterns = filterPatterns(patterns, 'plexus-model');
    expect(plexusPatterns.length).toBeGreaterThan(0);

    // Should detect emancipate call
    const emancipatePatterns = filterPatterns(patterns, 'emancipate-call');
    expect(emancipatePatterns.length).toBeGreaterThan(0);

    // Should detect splice pattern
    const splicePatterns = filterPatterns(patterns, 'array-splice');
    expect(splicePatterns.length).toBeGreaterThan(0);
  });

  it('builds dependency graph - demonstrates graph construction', () => {
    const graph = cata(dependencyAlg('test.ts'))(sourceFile);

    // Should have import edge
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0].from).toBe('test.ts');
    expect(graph.edges[0].to).toBe('@here.build/plexus');
    expect(graph.edges[0].symbols).toContain('PlexusModel');
  });

  it('builds type graph - demonstrates type relationships', () => {
    const graph = cata(typeAlg)(sourceFile);

    // Should have Task and Team types
    expect(graph.types.has('Task')).toBe(true);
    expect(graph.types.has('Team')).toBe(true);

    // Should track extends relationships
    const taskSubtypes = findSubtypes(graph, 'PlexusModel');
    expect(taskSubtypes).toContain('Task');
    expect(taskSubtypes).toContain('Team');
  });

  it('composes analyses - run multiple in parallel', () => {
    // In future: combine algebras to run in single pass
    // For now: demonstrate independent composition

    const counts = cata(countAlg)(sourceFile);
    const metadata = cata(extractAlg)(sourceFile);
    const patterns = findPatterns(sourceFile);

    // All should analyze same AST
    expect(counts.classes).toBe(metadata.classes.length);

    // Patterns should correlate with structure
    const plexusPatterns = filterPatterns(patterns, 'plexus-model');
    expect(plexusPatterns.length).toBe(
      metadata.classes.filter(c => c.extends.includes('PlexusModel')).length
    );
  });
});

describe('S-Expression Style Composition (Future)', () => {
  it('demonstrates compositional thinking', () => {
    // Today: function composition
    // Future: actual S-expressions via Scheme

    const project = new Project({ useInMemoryFileSystem: true });
    const file = project.createSourceFile(
      'example.ts',
      `
        class Foo extends PlexusModel {
          method() { return 42; }
        }
      `
    );

    // Composition today: functional
    const metadata = cata(extractAlg)(file);
    const plexusClasses = metadata.classes.filter(c =>
      c.extends.includes('PlexusModel')
    );

    // Composition tomorrow: S-expressions
    // (filter (lambda (c) (extends? c "PlexusModel"))
    //         (extract-classes file))

    expect(plexusClasses.length).toBe(1);
    expect(plexusClasses[0].name).toBe('Foo');
  });
});
