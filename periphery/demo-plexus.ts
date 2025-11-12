#!/usr/bin/env tsx
/**
 * Hypergraph Demo - PlexusModel Hierarchy
 *
 * Shows compositional graph construction on PlexusModel code
 */

import { Project } from 'ts-morph';
import { cata } from './src/catamorphism.js';
import { extractAlg } from './src/algebras/extract.js';
import { dependencyAlg } from './src/algebras/dependencies.js';
import {
  metadataToInheritanceGraph,
  metadataToCallGraph,
  dependencyGraphToHG,
  plexusModelGraph,
} from './src/algebras/ast-to-hypergraph.js';
import {
  hypergraphToDOT,
  hypergraphToAdjacency,
  hypergraphMetrics,
  toCycles,
  toPathChecker,
} from './src/algebras/hypergraph-interpreters.js';
import { overlay } from './src/hypergraph.js';

// Sample PlexusModel code
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
const sourceFile = project.createSourceFile('models.ts', sampleCode);

console.log('='.repeat(70));
console.log('Phase 3 Hypergraph Demo - PlexusModel Hierarchy Composition');
console.log('='.repeat(70));

// Step 1: Extract metadata
console.log('\n[1] Extracting metadata...');
const metadata = cata(extractAlg)(sourceFile);
console.log(`   Classes: ${metadata.classes.map(c => c.name).join(', ')}`);
console.log(`   Imports: ${metadata.imports.map(i => i.from).join(', ')}`);

// Step 2: Build inheritance hypergraph
console.log('\n[2] Building inheritance hypergraph...');
const inheritance = metadataToInheritanceGraph(metadata);
const inheritAdj = hypergraphToAdjacency(inheritance);
console.log('   Edges:');
for (const [from, tos] of inheritAdj.entries()) {
  if (tos.size > 0) {
    for (const to of tos) {
      console.log(`     ${from} → ${to}`);
    }
  }
}

// Step 3: Build PlexusModel subgraph (filtered)
console.log('\n[3] Building PlexusModel-only subgraph...');
const plexusGraph = plexusModelGraph(metadata);
const plexusMetrics = hypergraphMetrics(plexusGraph);
console.log(`   PlexusModel subclasses: ${Array.from(plexusMetrics.vertices).join(', ')}`);
console.log(`   Edges: ${plexusMetrics.edges}`);

// Step 4: Build call/reference graph
console.log('\n[4] Building call graph...');
const calls = metadataToCallGraph(metadata);
const callAdj = hypergraphToAdjacency(calls);
console.log('   Type references:');
for (const [from, tos] of callAdj.entries()) {
  if (tos.size > 0) {
    for (const to of tos) {
      console.log(`     ${from} references ${to}`);
    }
  }
}

// Step 5: Build dependency graph
console.log('\n[5] Building module dependency graph...');
const depGraph = cata(dependencyAlg('models.ts'))(sourceFile);
const deps = dependencyGraphToHG(depGraph);
const depAdj = hypergraphToAdjacency(deps);
console.log('   Module dependencies:');
for (const [from, tos] of depAdj.entries()) {
  if (tos.size > 0) {
    for (const to of tos) {
      console.log(`     ${from} imports ${to}`);
    }
  }
}

// Step 6: Compose all three graphs
console.log('\n[6] Composing all graphs (inheritance + calls + deps)...');
const combined = overlay(overlay(inheritance, calls), deps);
const combinedMetrics = hypergraphMetrics(combined);
console.log(`   Total vertices: ${combinedMetrics.vertices.size}`);
console.log(`   Total edges: ${combinedMetrics.edges}`);
console.log(`   Graph density: ${combinedMetrics.density.toFixed(3)}`);

// Step 7: Find cycles
console.log('\n[7] Detecting cycles...');
const cycles = toCycles(combined);
if (cycles.length === 0) {
  console.log('   ✓ No cycles (acyclic graph)');
} else {
  console.log(`   Found ${cycles.length} cycles:`);
  cycles.forEach((cycle, i) => {
    console.log(`   Cycle ${i + 1}: ${cycle.join(' → ')}`);
  });
}

// Step 8: Path queries
console.log('\n[8] Path existence queries...');
const queries = [
  ['Task', 'PlexusModel'],
  ['Team', 'PlexusModel'],
  ['Project', 'PlexusModel'],
  ['PlexusModel', 'Task'],
];
for (const [from, to] of queries) {
  const hasPath = toPathChecker({ from, to })(combined);
  const symbol = hasPath ? '✓' : '✗';
  console.log(`   ${symbol} Path ${from} → ${to}: ${hasPath}`);
}

// Step 9: Generate visualizations
console.log('\n[9] Generating DOT for Graphviz...');

console.log('\n   Inheritance graph:');
const inheritDot = hypergraphToDOT(inheritance, 'Inheritance');
console.log(inheritDot.split('\n').map(l => '   ' + l).join('\n'));

console.log('\n   Combined graph (first 10 lines):');
const combinedDot = hypergraphToDOT(combined, 'CombinedGraph');
combinedDot.split('\n').slice(0, 10).forEach(line => {
  console.log(`   ${line}`);
});

console.log('\n' + '='.repeat(70));
console.log('✓ Demo complete!');
console.log('');
console.log('What was demonstrated:');
console.log('  • Catamorphism-based metadata extraction');
console.log('  • AST → HyperGraph conversion (3 types)');
console.log('  • Graph composition via overlay');
console.log('  • 5 interpreters (adjacency, metrics, DOT, cycles, paths)');
console.log('  • Compositional construction (build complex from simple)');
console.log('='.repeat(70));
