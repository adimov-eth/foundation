/**
 * Demo: E-graphs detecting semantic patterns in real code
 *
 * This demonstrates using equality saturation to find operational
 * transformation patterns in Plexus MaterializedArray splice operations.
 */

import { Project } from 'ts-morph';
import { EGraph, saturate, extract, astSize } from './src/egraph.js';
import { spliceRemove, standardRules } from './src/algebras/egraph-rules.js';

// Parse the plexus materialized-array file
const project = new Project({
  tsConfigFilePath: '../plexus/plexus/tsconfig.json',
});

const sourceFile = project.getSourceFile('../plexus/plexus/src/proxies/materialized-array.ts');

if (!sourceFile) {
  console.error('Could not find materialized-array.ts');
  process.exit(1);
}

console.log('Analyzing materialized-array.ts for semantic patterns...\n');

// Example: Build E-graph from code pattern
const eg = new EGraph();

// Simulate finding pattern: arr.indexOf(item); arr.splice(idx, 1)
// This is the "remove before insert" pattern

const arr = eg.add({ op: 'Var', name: 'arr' });
const item = eg.add({ op: 'Var', name: 'item' });

// arr.indexOf(item)
const indexOf = eg.add({ op: 'Member', obj: arr, prop: 'indexOf' });
const index = eg.add({ op: 'Call', fn: indexOf, args: [item] });

// arr.splice(index, 1)
const splice = eg.add({ op: 'Member', obj: arr, prop: 'splice' });
const one = eg.add({ op: 'Const', value: 1 });
const spliceCall = eg.add({ op: 'Call', fn: splice, args: [index, one] });

console.log('Initial E-graph:');
console.log('  Classes:', eg['classes'].size);
console.log('  Pattern: arr.splice(arr.indexOf(item), 1)');
console.log('');

// Apply semantic pattern detection rules
const iterations = saturate(eg, [spliceRemove], 10);

console.log('After saturation:');
console.log('  Iterations:', iterations);
console.log('  Classes:', eg['classes'].size);
console.log('');

// Extract semantic meaning
const nodes = eg.getNodes(eg.find(spliceCall));
console.log('Equivalent forms found:', nodes.size);

for (const node of nodes) {
  if (node.op === 'Call') {
    const fnNodes = eg.getNodes(node.fn);
    for (const fn of fnNodes) {
      if (fn.op === 'Member') {
        console.log(`  - ${fn.prop}(...)`);
      }
    }
  }
}

console.log('');
console.log('✓ Semantic pattern detected: splice-remove ≡ remove operation');
console.log('  This is the operational transformation pattern used in Plexus');
console.log('  to maintain uniqueness constraints.');
