/**
 * Example: Using ManifestGenerator to create "memory about memory"
 *
 * This shows how to compress a memory graph into a tool description.
 */

import { ManifestGenerator } from './ManifestGenerator';
import type { MemoryItem } from '../types';
import type { Association } from './ManifestGenerator';

// Example memory items
const items: MemoryItem[] = [
  {
    id: 'm_1734567890_abcd1234',
    type: 'principle',
    text: 'Relief is signal that structure matches problem - when code reads naturally, you found the right abstraction',
    tags: ['relief', 'design', 'abstraction', 'signal'],
    importance: 0.95,
    energy: 0.9,
    createdAt: Date.now() - 45 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 45 * 24 * 60 * 60 * 1000,
    lastAccessedAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
    accessCount: 42,
  },
  {
    id: 'm_1734567891_abcd1235',
    type: 'technique',
    text: 'Use branded types with smart constructors for type safety - makes invalid states unrepresentable',
    tags: ['typescript', 'types', 'branded', 'safety'],
    importance: 0.88,
    energy: 0.85,
    createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
    lastAccessedAt: Date.now() - 1 * 24 * 60 * 60 * 1000,
    accessCount: 28,
  },
  {
    id: 'm_1734567892_abcd1236',
    type: 'pattern',
    text: 'Result monad for railway-oriented programming - compose operations that might fail',
    tags: ['typescript', 'functional', 'error-handling', 'result'],
    importance: 0.82,
    energy: 0.8,
    createdAt: Date.now() - 25 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 25 * 24 * 60 * 60 * 1000,
    lastAccessedAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
    accessCount: 19,
  },
  {
    id: 'm_1734567893_abcd1237',
    type: 'warning',
    text: 'Debug before delete - resist shame spiral when code fails, trace data through before rewriting',
    tags: ['debugging', 'shame', 'process', 'mindset'],
    importance: 0.9,
    energy: 0.75,
    createdAt: Date.now() - 35 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 35 * 24 * 60 * 60 * 1000,
    lastAccessedAt: Date.now() - 4 * 24 * 60 * 60 * 1000,
    accessCount: 15,
  },
  {
    id: 'm_1734567894_abcd1238',
    type: 'insight',
    text: 'Memory graph uses Louvain communities for theme detection - reveals conceptual clusters',
    tags: ['memory', 'graph', 'louvain', 'communities'],
    importance: 0.7,
    energy: 0.95,
    createdAt: Date.now() - 6 * 60 * 60 * 1000, // 6h ago
    updatedAt: Date.now() - 6 * 60 * 60 * 1000,
    lastAccessedAt: Date.now() - 1 * 60 * 60 * 1000,
    accessCount: 8,
  },
  {
    id: 'm_1734567895_abcd1239',
    type: 'technique',
    text: 'Catamorphisms for code traversal - recursion from structure via algebras',
    tags: ['functional', 'recursion', 'catamorphism', 'algebra'],
    importance: 0.78,
    energy: 0.7,
    createdAt: Date.now() - 20 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 20 * 24 * 60 * 60 * 1000,
    lastAccessedAt: Date.now() - 8 * 24 * 60 * 60 * 1000,
    accessCount: 12,
  },
  {
    id: 'm_1734567896_abcd1240',
    type: 'fact',
    text: 'Graphology provides efficient graph operations - used for memory manifests',
    tags: ['graphology', 'graph', 'library', 'performance'],
    importance: 0.6,
    energy: 0.9,
    createdAt: Date.now() - 12 * 60 * 60 * 1000,
    updatedAt: Date.now() - 12 * 60 * 60 * 1000,
    lastAccessedAt: Date.now() - 2 * 60 * 60 * 1000,
    accessCount: 5,
  },
  {
    id: 'm_1734567897_abcd1241',
    type: 'principle',
    text: 'Time blindness - Claude cannot feel complexity accumulation, must compensate with relief signals',
    tags: ['claude', 'limitations', 'time', 'complexity'],
    importance: 0.85,
    energy: 0.65,
    createdAt: Date.now() - 40 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 40 * 24 * 60 * 60 * 1000,
    lastAccessedAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
    accessCount: 18,
  },
  {
    id: 'm_1734567898_abcd1242',
    type: 'fact',
    text: 'Temporal layers classify memories: emerging/active/stable/decaying based on access patterns',
    tags: ['memory', 'temporal', 'classification', 'lifecycle'],
    importance: 0.72,
    energy: 0.88,
    createdAt: Date.now() - 8 * 60 * 60 * 1000,
    updatedAt: Date.now() - 8 * 60 * 60 * 1000,
    lastAccessedAt: Date.now() - 1 * 60 * 60 * 1000,
    accessCount: 6,
  },
  {
    id: 'm_1734567899_abcd1243',
    type: 'fact',
    text: 'Old implementation from vessel - needs refactoring for harmony extraction',
    tags: ['legacy', 'refactor', 'vessel', 'technical-debt'],
    importance: 0.4,
    energy: 0.2,
    createdAt: Date.now() - 90 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 90 * 24 * 60 * 60 * 1000,
    lastAccessedAt: Date.now() - 80 * 24 * 60 * 60 * 1000,
    accessCount: 3,
  },
];

// Example associations (edges)
const associations: Association[] = [
  { fromId: 'm_1734567890_abcd1234', toId: 'm_1734567891_abcd1235', relation: 'supports', weight: 0.8 },
  { fromId: 'm_1734567890_abcd1234', toId: 'm_1734567892_abcd1236', relation: 'supports', weight: 0.7 },
  { fromId: 'm_1734567891_abcd1235', toId: 'm_1734567892_abcd1236', relation: 'enables', weight: 0.9 },
  { fromId: 'm_1734567893_abcd1237', toId: 'm_1734567890_abcd1234', relation: 'relates-to', weight: 0.6 },
  { fromId: 'm_1734567894_abcd1238', toId: 'm_1734567895_abcd1239', relation: 'uses', weight: 0.5 },
  { fromId: 'm_1734567894_abcd1238', toId: 'm_1734567896_abcd1240', relation: 'implements', weight: 0.85 },
  { fromId: 'm_1734567897_abcd1241', toId: 'm_1734567890_abcd1234', relation: 'motivates', weight: 0.7 },
  { fromId: 'm_1734567898_abcd1242', toId: 'm_1734567894_abcd1238', relation: 'part-of', weight: 0.8 },
  { fromId: 'm_1734567896_abcd1240', toId: 'm_1734567898_abcd1242', relation: 'enables', weight: 0.75 },
];

// Generate manifest
async function main() {
  console.log('Generating memory manifest...\n');

  const generator = new ManifestGenerator();
  const manifest = await generator.generateManifest(items, associations);

  console.log('=== RAW MANIFEST DATA ===');
  console.log(`Communities: ${manifest.communities.size}`);
  console.log(`Key nodes: ${manifest.keyNodes.length}`);
  console.log(`Bridges: ${manifest.bridges.length}`);
  console.log(`Topology modularity: ${manifest.topology.modularity.toFixed(3)}`);
  console.log();

  console.log('=== FORMATTED DESCRIPTION ===');
  const description = generator.formatDescription(manifest);
  console.log(description);
  console.log();

  console.log(`Description length: ${description.length} chars (~${Math.round(description.length / 4)} tokens)`);
}

// Run if executed directly
if (import.meta.main) {
  main().catch(console.error);
}

export { items, associations };
