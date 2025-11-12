#!/usr/bin/env tsx
/**
 * Hypergraph Demo - Real usage on actual codebase files
 *
 * Shows:
 * 1. Build inheritance hypergraph from real code
 * 2. Build call hypergraph from same code
 * 3. Overlay them
 * 4. Interpret 5 ways (DOT, adjacency, metrics, cycles, paths)
 */

import { Project } from 'ts-morph';
import { cata } from './src/catamorphism.js';
import { extractAlg } from './src/algebras/extract.js';
import {
  metadataToInheritanceGraph,
  metadataToCallGraph,
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

// Load real file from this codebase
const project = new Project({ tsConfigFilePath: './tsconfig.json' });
const sourceFile = project.getSourceFile('src/discovery-tool.ts');

if (!sourceFile) {
  console.error('Could not load src/discovery-tool.ts');
  process.exit(1);
}

console.log('='.repeat(60));
console.log('Phase 3 Hypergraph Demo - Real Codebase Analysis');
console.log('='.repeat(60));
console.log(`\nAnalyzing: ${sourceFile.getFilePath()}`);

// Step 1: Extract metadata via catamorphism
console.log('\n[1] Extracting metadata via catamorphism...');
const metadata = cata(extractAlg)(sourceFile);
console.log(`   Found ${metadata.classes.length} classes`);
console.log(`   Found ${metadata.interfaces.length} interfaces`);
console.log(`   Found ${metadata.functions.length} functions`);

// Step 2: Build inheritance hypergraph
console.log('\n[2] Building inheritance hypergraph...');
const inheritance = metadataToInheritanceGraph(metadata);
const inheritanceMetrics = hypergraphMetrics(inheritance);
console.log(`   Vertices: ${inheritanceMetrics.vertices.size}`);
console.log(`   Edges: ${inheritanceMetrics.edges}`);
console.log(`   Density: ${inheritanceMetrics.density.toFixed(3)}`);

// Step 3: Build call hypergraph
console.log('\n[3] Building call hypergraph...');
const calls = metadataToCallGraph(metadata);
const callMetrics = hypergraphMetrics(calls);
console.log(`   Vertices: ${callMetrics.vertices.size}`);
console.log(`   Edges: ${callMetrics.edges}`);

// Step 4: Overlay graphs (composition!)
console.log('\n[4] Overlaying inheritance + calls...');
const combined = overlay(inheritance, calls);
const combinedMetrics = hypergraphMetrics(combined);
console.log(`   Combined vertices: ${combinedMetrics.vertices.size}`);
console.log(`   Combined edges: ${combinedMetrics.edges}`);
console.log(`   Density: ${combinedMetrics.density.toFixed(3)}`);

// Step 5: Interpret as adjacency list
console.log('\n[5] Converting to adjacency list...');
const adj = hypergraphToAdjacency(combined);
let edgeCount = 0;
for (const [vertex, neighbors] of adj.entries()) {
  if (neighbors.size > 0) {
    console.log(`   ${vertex} → [${Array.from(neighbors).join(', ')}]`);
    edgeCount += neighbors.size;
  }
}
console.log(`   Total edges: ${edgeCount}`);

// Step 6: Find cycles
console.log('\n[6] Checking for cycles...');
const cycles = toCycles(combined);
if (cycles.length === 0) {
  console.log('   ✓ No cycles detected (DAG)');
} else {
  console.log(`   Found ${cycles.length} cycles:`);
  cycles.forEach((cycle, i) => {
    console.log(`   Cycle ${i + 1}: ${cycle.join(' → ')}`);
  });
}

// Step 7: Check specific paths
console.log('\n[7] Path existence queries...');
const vertices = Array.from(combinedMetrics.vertices);
if (vertices.length >= 2) {
  const [from, to] = vertices;
  const hasPath = toPathChecker({ from, to })(combined);
  console.log(`   Path from "${from}" to "${to}": ${hasPath ? '✓' : '✗'}`);
}

// Step 8: Generate DOT visualization
console.log('\n[8] Generating DOT visualization...');
const dot = hypergraphToDOT(combined, 'ExtractAlgebra');
console.log(`   Generated ${dot.split('\n').length} lines of DOT`);
console.log('   First few lines:');
dot.split('\n').slice(0, 5).forEach(line => {
  console.log(`   ${line}`);
});

console.log('\n' + '='.repeat(60));
console.log('Demo complete! All 5 interpreters exercised.');
console.log('='.repeat(60));
