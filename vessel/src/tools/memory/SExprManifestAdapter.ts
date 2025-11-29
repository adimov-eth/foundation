/**
 * S-Expression Memory to Manifest Adapter
 *
 * Bridges the existing S-expression memory with ManifestGenerator
 * to create navigable 500-token descriptions without Neo4j.
 */

import { ManifestGenerator, type GraphManifest } from "./manifest/ManifestGenerator";
import type { MemoryItem } from "./types";

interface SExprMemoryItem {
  id: string;
  text: string;
  type: string;
  tags: string[];
  importance: number;
  energy: number;
  createdAt: number;
  updatedAt: number;
  lastAccessedAt: number;
  accessCount: number;
}

interface SExprEdge {
  from: string;
  to: string;
  relation: string;
  weight: number;
}

export class SExprManifestAdapter {
  private generator: ManifestGenerator;
  private lastManifest: GraphManifest | null = null;
  private lastGeneratedAt = 0;
  private readonly CACHE_DURATION = 60000; // 1 minute cache

  constructor() {
    this.generator = new ManifestGenerator();
  }

  /**
   * Convert S-expression memory state to MemoryItem format
   */
  private convertToMemoryItems(sexprItems: SExprMemoryItem[]): MemoryItem[] {
    return sexprItems.map(item => ({
      id: item.id,
      text: item.text,
      type: item.type as any,
      importance: item.importance,
      energy: item.energy,
      ttl: "perpetual", // Default for now
      tags: item.tags,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      lastAccessedAt: item.lastAccessedAt,
      accessCount: item.accessCount,
      success: 0,
      fail: 0
    }));
  }

  /**
   * Extract associations from memory text and tags
   * This infers relationships that aren't explicitly stored as edges
   */
  private inferAssociations(items: SExprMemoryItem[]): Array<{
    fromId: string;
    toId: string;
    relation: string;
    weight: number;
    count: number;
  }> {
    const associations: Array<{
      fromId: string;
      toId: string;
      relation: string;
      weight: number;
      count: number;
    }> = [];

    // Track existing edges to avoid duplicates
    const edgeSet = new Set<string>();
    const addAssociation = (from: string, to: string, relation: string, weight: number) => {
      const edgeKey = `${from}->${to}`;
      if (!edgeSet.has(edgeKey)) {
        edgeSet.add(edgeKey);
        associations.push({
          fromId: from,
          toId: to,
          relation,
          weight,
          count: 1
        });
      }
    };

    // Create tag-based associations
    const tagToItems = new Map<string, string[]>();
    for (const item of items) {
      for (const tag of item.tags) {
        if (!tagToItems.has(tag)) {
          tagToItems.set(tag, []);
        }
        tagToItems.get(tag)!.push(item.id);
      }
    }

    // Connect items that share important tags (limit connections)
    for (const [tag, itemIds] of tagToItems.entries()) {
      if (itemIds.length < 2 || itemIds.length > 10) continue; // Be more selective

      // Only connect first few items to avoid explosion
      const limit = Math.min(itemIds.length, 5);
      for (let i = 0; i < limit - 1; i++) {
        addAssociation(itemIds[i], itemIds[i + 1], `tag-${tag}`, 0.5);
      }
    }

    // Create temporal associations (items created close in time)
    const sortedByTime = [...items].sort((a, b) => a.createdAt - b.createdAt);
    for (let i = 0; i < sortedByTime.length - 1; i++) {
      const timeDiff = sortedByTime[i + 1].createdAt - sortedByTime[i].createdAt;
      if (timeDiff < 60000) { // Within 1 minute
        addAssociation(
          sortedByTime[i].id,
          sortedByTime[i + 1].id,
          "temporal-proximity",
          0.7
        );
      }
    }

    // Create importance-based associations (limit to avoid explosion)
    const importantItems = items.filter(i => i.importance > 0.9).slice(0, 20);
    for (let i = 0; i < importantItems.length - 1; i++) {
      // Only connect to next important item to avoid quadratic explosion
      addAssociation(
        importantItems[i].id,
        importantItems[i + 1].id,
        "high-importance",
        0.8
      );
    }

    return associations;
  }

  /**
   * Generate manifest from S-expression memory state
   */
  async generateFromSExprMemory(
    sexprItems: SExprMemoryItem[],
    sexprEdges?: SExprEdge[],
    forceRegenerate = false
  ): Promise<GraphManifest> {
    // Check cache
    if (!forceRegenerate &&
        this.lastManifest &&
        Date.now() - this.lastGeneratedAt < this.CACHE_DURATION) {
      return this.lastManifest;
    }

    // Convert to ManifestGenerator format
    const memoryItems = this.convertToMemoryItems(sexprItems);

    // Use provided edges or infer associations
    const associations = sexprEdges ?
      sexprEdges.map(e => ({
        fromId: e.from,
        toId: e.to,
        relation: e.relation,
        weight: e.weight,
        count: 1
      })) :
      this.inferAssociations(sexprItems);

    // Generate manifest
    this.lastManifest = await this.generator.generateManifest(memoryItems, associations);
    this.lastGeneratedAt = Date.now();

    return this.lastManifest;
  }

  /**
   * Get formatted description from last generated manifest
   */
  getDescription(): string {
    if (!this.lastManifest) {
      return "Memory: No manifest generated yet";
    }
    return this.generator.formatDescription(this.lastManifest);
  }

  /**
   * Generate manifest from raw memory stats
   */
  async generateFromStats(stats: {
    items: number;
    edges: number;
    topTags: Array<[string, number]>;
    avgDegree: number;
  }): Promise<string> {
    // Create a simplified description without full manifest generation
    const tagSummary = stats.topTags
      .slice(0, 5)
      .map(([tag, count]) => `${tag}:${count}`)
      .join(", ");

    return `Memory: ${stats.items} items, ${stats.edges} edges (${stats.avgDegree.toFixed(1)} avg degree)
Tags: ${tagSummary}
Status: Active memory system with spreading activation`;
  }

  /**
   * Synchronous wrapper for generateFromSExprMemory
   * Called from tool description getter (can't be async)
   */
  generateManifestFromState(sexprItems: SExprMemoryItem[], sexprEdges?: SExprEdge[]): void {
    console.log(`[SExprManifestAdapter] Triggering manifest generation for ${sexprItems.length} items, ${sexprEdges?.length || 0} edges`);
    // Fire and forget - updates cache for next getDescription() call
    this.generateFromSExprMemory(sexprItems, sexprEdges, false)
      .then(() => {
        console.log("[SExprManifestAdapter] Manifest generation complete");
      })
      .catch(err => {
        console.error("[SExprManifestAdapter] Manifest generation failed:", err);
      });
  }
}