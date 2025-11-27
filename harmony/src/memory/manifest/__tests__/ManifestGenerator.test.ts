/**
 * ManifestGenerator tests
 */

import { describe, test, expect } from 'bun:test';
import { ManifestGenerator } from '../ManifestGenerator';
import type { MemoryItem } from '../../types';
import type { Association } from '../ManifestGenerator';

describe('ManifestGenerator', () => {
  test('generates manifest for simple graph', async () => {
    const items: MemoryItem[] = [
      {
        id: 'm_1_00000001',
        type: 'fact',
        text: 'TypeScript uses structural typing',
        tags: ['typescript', 'types'],
        importance: 0.8,
        energy: 0.9,
        createdAt: Date.now() - 10 * 24 * 60 * 60 * 1000, // 10 days ago
        updatedAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
        lastAccessedAt: Date.now() - 2 * 24 * 60 * 60 * 1000, // 2 days ago
        accessCount: 5,
      },
      {
        id: 'm_2_00000002',
        type: 'technique',
        text: 'Use branded types for type safety',
        tags: ['typescript', 'types', 'branded'],
        importance: 0.9,
        energy: 0.85,
        createdAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
        updatedAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
        lastAccessedAt: Date.now() - 1 * 24 * 60 * 60 * 1000,
        accessCount: 8,
      },
      {
        id: 'm_3_00000003',
        type: 'pattern',
        text: 'Result monad for railway-oriented programming',
        tags: ['typescript', 'functional', 'error-handling'],
        importance: 0.85,
        energy: 0.8,
        createdAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
        updatedAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
        lastAccessedAt: Date.now() - 1 * 24 * 60 * 60 * 1000,
        accessCount: 6,
      },
      {
        id: 'm_4_00000004',
        type: 'insight',
        text: 'Memory decay based on usage patterns',
        tags: ['memory', 'decay', 'adaptive'],
        importance: 0.7,
        energy: 0.25, // Low energy for decay classification
        createdAt: Date.now() - 20 * 24 * 60 * 60 * 1000,
        updatedAt: Date.now() - 20 * 24 * 60 * 60 * 1000,
        lastAccessedAt: Date.now() - 35 * 24 * 60 * 60 * 1000, // Not accessed in >30d
        accessCount: 2,
      },
      {
        id: 'm_5_00000005',
        type: 'event',
        text: 'Implemented graph-based memory system',
        tags: ['memory', 'graph', 'implementation'],
        importance: 0.6,
        energy: 0.95,
        createdAt: Date.now() - 12 * 60 * 60 * 1000, // 12 hours ago
        updatedAt: Date.now() - 12 * 60 * 60 * 1000,
        lastAccessedAt: Date.now() - 1 * 60 * 60 * 1000,
        accessCount: 3,
      },
    ];

    const associations: Association[] = [
      { fromId: 'm_1_00000001', toId: 'm_2_00000002', relation: 'relates-to', weight: 0.8 },
      { fromId: 'm_2_00000002', toId: 'm_3_00000003', relation: 'supports', weight: 0.7 },
      { fromId: 'm_4_00000004', toId: 'm_5_00000005', relation: 'implements', weight: 0.9 },
      { fromId: 'm_1_00000001', toId: 'm_3_00000003', relation: 'enables', weight: 0.6 },
    ];

    const generator = new ManifestGenerator();
    const manifest = await generator.generateManifest(items, associations);

    // Verify structure
    expect(manifest.topology.nodeCount).toBe(5);
    expect(manifest.topology.edgeCount).toBe(4);
    expect(manifest.topology.density).toBeGreaterThan(0);
    expect(manifest.communities.size).toBeGreaterThan(0);

    // Verify temporal layers
    expect(manifest.temporal.emerging.length).toBeGreaterThan(0); // m_5
    expect(manifest.temporal.active.length).toBeGreaterThan(0); // m_1, m_2, m_3
    expect(manifest.temporal.decaying.length).toBeGreaterThan(0); // m_4

    // Verify key nodes exist
    expect(manifest.keyNodes.length).toBeGreaterThan(0);
  });

  test('formats manifest as readable description', async () => {
    const items: MemoryItem[] = [
      {
        id: 'm_1_00000001',
        type: 'fact',
        text: 'Relief is signal that structure matches problem',
        tags: ['relief', 'design', 'signal'],
        importance: 0.9,
        energy: 0.85,
        createdAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
        updatedAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
        lastAccessedAt: Date.now() - 1 * 24 * 60 * 60 * 1000,
        accessCount: 10,
      },
      {
        id: 'm_2_00000002',
        type: 'principle',
        text: 'Debug before delete - resist shame spiral',
        tags: ['debugging', 'shame', 'process'],
        importance: 0.85,
        energy: 0.8,
        createdAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
        updatedAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
        lastAccessedAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
        accessCount: 7,
      },
    ];

    const associations: Association[] = [
      { fromId: 'm_1_00000001', toId: 'm_2_00000002', relation: 'supports', weight: 0.75 },
    ];

    const generator = new ManifestGenerator();
    const manifest = await generator.generateManifest(items, associations);
    const description = generator.formatDescription(manifest);

    // Verify format includes key sections
    expect(description).toContain('=== MEMORY GRAPH MANIFEST ===');
    expect(description).toContain('items');
    expect(description).toContain('edges');
    expect(description).toContain('Top Themes:');
    expect(description).toContain('Temporal State:');
    expect(description).toContain('Key Nodes:');
    expect(description).toContain('Topology:');

    // Verify it's reasonably sized (target: 500-1000 tokens for full graph, ~4 chars/token)
    // For small test graph, just verify it has content
    expect(description.length).toBeGreaterThan(400);
    expect(description.length).toBeLessThan(6000);
  });

  test('handles empty graph', async () => {
    const generator = new ManifestGenerator();
    const manifest = await generator.generateManifest([], []);

    expect(manifest.topology.nodeCount).toBe(0);
    expect(manifest.topology.edgeCount).toBe(0);
    expect(manifest.communities.size).toBe(0);
    expect(manifest.keyNodes.length).toBe(0);
  });

  test('temporal classification', async () => {
    const now = Date.now();
    const items: MemoryItem[] = [
      {
        id: 'm_emerging',
        type: 'event',
        text: 'Just created',
        tags: [],
        importance: 0.5,
        energy: 0.9,
        createdAt: now - 2 * 60 * 60 * 1000, // 2h ago
        updatedAt: now - 2 * 60 * 60 * 1000,
      },
      {
        id: 'm_active',
        type: 'fact',
        text: 'Recently accessed',
        tags: [],
        importance: 0.7,
        energy: 0.8,
        createdAt: now - 10 * 24 * 60 * 60 * 1000,
        updatedAt: now - 10 * 24 * 60 * 60 * 1000,
        lastAccessedAt: now - 2 * 24 * 60 * 60 * 1000, // 2d ago
        accessCount: 5,
      },
      {
        id: 'm_stable',
        type: 'principle',
        text: 'Old and stable',
        tags: [],
        importance: 0.8,
        energy: 0.9,
        createdAt: now - 100 * 24 * 60 * 60 * 1000,
        updatedAt: now - 40 * 24 * 60 * 60 * 1000, // 40d ago
      },
      {
        id: 'm_decaying',
        type: 'fact',
        text: 'Low energy, not accessed',
        tags: [],
        importance: 0.5,
        energy: 0.2,
        createdAt: now - 60 * 24 * 60 * 60 * 1000,
        updatedAt: now - 60 * 24 * 60 * 60 * 1000,
        lastAccessedAt: now - 50 * 24 * 60 * 60 * 1000,
        accessCount: 1,
      },
    ];

    const generator = new ManifestGenerator();
    const manifest = await generator.generateManifest(items, []);

    expect(manifest.temporal.emerging).toContain('m_emerging');
    expect(manifest.temporal.active).toContain('m_active');
    expect(manifest.temporal.stable).toContain('m_stable');
    expect(manifest.temporal.decaying).toContain('m_decaying');
  });
});
