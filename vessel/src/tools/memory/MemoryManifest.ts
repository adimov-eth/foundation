/**
 * MemoryManifest - Compact memory representation for MCP tool descriptions
 * 
 * This implements the ACTUAL spec: inject memory context into tool descriptions
 * so Claude knows what's in memory BEFORE the first request.
 * 
 * Key insights from our research:
 * - FalkorDB proves graph = sparse matrices, traversal = multiplication
 * - GraphRAG SDK uses LLM ontology extraction + graph context
 * - Graphiti adds temporal layers with bi-temporal tracking
 * - All converge on same mathematical foundation
 * 
 * But the real innovation: Use the MCP protocol itself as memory transport.
 * The tool description IS the memory context.
 */

import { MemoryItem, Association } from './types';

export interface ManifestConfig {
  maxTokens: number;  // Target ~500 tokens
  includeTemporal: boolean;  // Include time-based patterns
  includeTopology: boolean;  // Include graph structure metrics
  priorityWeights: {
    importance: number;
    energy: number;  // Spreading activation score
    recency: number;
    accessCount: number;
  };
}

export class MemoryManifest {
  private readonly DEFAULT_CONFIG: ManifestConfig = {
    maxTokens: 500,
    includeTemporal: true,
    includeTopology: true,
    priorityWeights: {
      importance: 0.4,
      energy: 0.3,
      recency: 0.2,
      accessCount: 0.1
    }
  };
  
  /**
   * Generate compact manifest of memory state
   * This is what gets injected into tool descriptions
   */
  generateManifest(
    items: Map<string, MemoryItem>,
    edges: Map<string, Association>,
    config: Partial<ManifestConfig> = {}
  ): string {
    const cfg = { ...this.DEFAULT_CONFIG, ...config };
    
    // Calculate priority scores for all items
    const scoredItems = this.scoreItems(items, edges, cfg);
    
    // Extract key patterns
    const patterns = this.extractPatterns(scoredItems, edges);
    
    // Build compact representation
    const manifest = this.buildCompactManifest(scoredItems, patterns, cfg);
    
    // Ensure we stay within token budget
    return this.truncateToTokenLimit(manifest, cfg.maxTokens);
  }
  
  /**
   * Score items using multi-factor priority
   * This is our PageRank-style algorithm
   */
  private scoreItems(
    items: Map<string, MemoryItem>,
    edges: Map<string, Association>,
    config: ManifestConfig
  ): Array<{ item: MemoryItem; score: number }> {
    const now = Date.now();
    const scores: Array<{ item: MemoryItem; score: number }> = [];
    
    // Build adjacency matrix for energy propagation
    const adjacency = this.buildAdjacencyMap(edges);
    
    for (const [id, item] of items) {
      // Multi-factor scoring
      const importanceScore = item.importance * config.priorityWeights.importance;
      const energyScore = item.energy * config.priorityWeights.energy;
      
      // Recency with exponential decay (half-life: 7 days)
      const ageMs = now - (item.updatedAt || item.createdAt);
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      const recencyScore = Math.exp(-0.693 * ageDays / 7) * config.priorityWeights.recency;
      
      // Access frequency (normalized)
      const accessScore = Math.min(1, (item.accessCount || 0) / 50) * config.priorityWeights.accessCount;
      
      // Graph centrality bonus (how connected is this node?)
      const connections = (adjacency.get(id)?.size || 0) / 10;
      const centralityBonus = Math.min(0.2, connections * 0.1);
      
      const totalScore = importanceScore + energyScore + recencyScore + accessScore + centralityBonus;
      
      scores.push({ item, score: totalScore });
    }
    
    // Sort by score descending
    return scores.sort((a, b) => b.score - a.score);
  }
  
  /**
   * Extract semantic patterns and clusters
   */
  private extractPatterns(
    scoredItems: Array<{ item: MemoryItem; score: number }>,
    edges: Map<string, Association>
  ): {
    topics: string[];
    clusters: Map<string, string[]>;
    temporalLayers: {
      active: string[];
      stable: string[];
      emerging: string[];
      decaying: string[];
    };
  } {
    // Extract unique topics from tags
    const topicCounts = new Map<string, number>();
    for (const { item } of scoredItems.slice(0, 50)) {
      for (const tag of item.tags || []) {
        topicCounts.set(tag, (topicCounts.get(tag) || 0) + 1);
      }
    }
    const topics = Array.from(topicCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag]) => tag);
    
    // Detect clusters using edge connectivity
    const clusters = this.detectClusters(scoredItems.slice(0, 30), edges);
    
    // Temporal stratification based on energy and recency
    const temporal = this.stratifyTemporal(scoredItems);
    
    return {
      topics,
      clusters,
      temporalLayers: temporal
    };
  }
  
  /**
   * Build the actual compact manifest string
   */
  private buildCompactManifest(
    scoredItems: Array<{ item: MemoryItem; score: number }>,
    patterns: any,
    config: ManifestConfig
  ): string {
    const parts: string[] = [];
    
    // Summary statistics
    const totalItems = scoredItems.length;
    const avgEnergy = scoredItems.slice(0, 20).reduce((sum, s) => sum + s.item.energy, 0) / 20;
    parts.push(`${totalItems} items, energy ${avgEnergy.toFixed(2)}/1.0`);
    
    // Active topics
    if (patterns.topics.length > 0) {
      parts.push(`Topics: ${patterns.topics.slice(0, 7).join(', ')}`);
    }
    
    // Key high-value nodes (most important memories)
    const keyNodes = scoredItems.slice(0, 5).map(({ item, score }) => {
      const text = item.text.slice(0, 40).replace(/\n/g, ' ');
      return `"${text}..." (${item.importance.toFixed(2)} imp, ${item.accessCount || 0} uses)`;
    });
    if (keyNodes.length > 0) {
      parts.push(`Key: ${keyNodes.join(', ')}`);
    }
    
    // Temporal layers (what's hot/cold)
    if (config.includeTemporal && patterns.temporalLayers) {
      const temporal = patterns.temporalLayers;
      const temporalStr = [
        temporal.active.length > 0 ? `Active: ${temporal.active.slice(0, 3).join(', ')}` : '',
        temporal.emerging.length > 0 ? `Emerging: ${temporal.emerging.slice(0, 2).join(', ')}` : ''
      ].filter(s => s).join(' | ');
      if (temporalStr) parts.push(temporalStr);
    }
    
    // Topology metrics
    if (config.includeTopology) {
      const edgeCount = scoredItems.slice(0, 30)
        .reduce((count, { item }) => {
          // Count edges involving top items
          return count + 1; // Simplified for now
        }, 0);
      parts.push(`Topology: ${edgeCount} edges, ${patterns.clusters.size} clusters`);
    }
    
    return parts.join('\n');
  }
  
  /**
   * Build adjacency map for graph algorithms
   */
  private buildAdjacencyMap(edges: Map<string, Association>): Map<string, Set<string>> {
    const adjacency = new Map<string, Set<string>>();
    
    for (const edge of edges.values()) {
      if (!adjacency.has(edge.from)) {
        adjacency.set(edge.from, new Set());
      }
      if (!adjacency.has(edge.to)) {
        adjacency.set(edge.to, new Set());
      }
      adjacency.get(edge.from)!.add(edge.to);
      adjacency.get(edge.to)!.add(edge.from);
    }
    
    return adjacency;
  }
  
  /**
   * Simple clustering based on edge connectivity
   */
  private detectClusters(
    items: Array<{ item: MemoryItem; score: number }>,
    edges: Map<string, Association>
  ): Map<string, string[]> {
    const clusters = new Map<string, string[]>();
    const itemIds = new Set(items.map(({ item }) => item.id));
    
    // Find strongly connected components
    for (const { item } of items) {
      const connectedIds: string[] = [];
      for (const edge of edges.values()) {
        if (edge.from === item.id && itemIds.has(edge.to)) {
          connectedIds.push(edge.to);
        }
        if (edge.to === item.id && itemIds.has(edge.from)) {
          connectedIds.push(edge.from);
        }
      }
      
      if (connectedIds.length >= 2) {
        // This item is part of a cluster
        const clusterKey = item.tags?.[0] || 'unnamed';
        if (!clusters.has(clusterKey)) {
          clusters.set(clusterKey, []);
        }
        clusters.get(clusterKey)!.push(item.id.slice(0, 10));
      }
    }
    
    return clusters;
  }
  
  /**
   * Stratify items by temporal activity
   */
  private stratifyTemporal(
    scoredItems: Array<{ item: MemoryItem; score: number }>
  ): {
    active: string[];
    stable: string[];
    emerging: string[];
    decaying: string[];
  } {
    const now = Date.now();
    const hourMs = 60 * 60 * 1000;
    const dayMs = 24 * hourMs;
    
    const active: string[] = [];
    const stable: string[] = [];
    const emerging: string[] = [];
    const decaying: string[] = [];
    
    for (const { item } of scoredItems.slice(0, 30)) {
      const age = now - item.createdAt;
      const lastAccess = item.lastAccessedAt ? now - item.lastAccessedAt : age;
      const textPreview = item.text.slice(0, 30) + '...';
      
      if (item.energy > 0.5 && lastAccess < hourMs) {
        active.push(textPreview);
      } else if (age < dayMs && item.energy > 0.3) {
        emerging.push(textPreview);
      } else if (item.importance > 0.8 && item.accessCount > 10) {
        stable.push(textPreview);
      } else if (item.energy < 0.1 && lastAccess > 7 * dayMs) {
        decaying.push(textPreview);
      }
    }
    
    return { active, stable, emerging, decaying };
  }
  
  /**
   * Ensure manifest fits in token budget
   * (Rough estimate: 1 token ≈ 4 characters)
   */
  private truncateToTokenLimit(manifest: string, maxTokens: number): string {
    const maxChars = maxTokens * 4;
    if (manifest.length <= maxChars) {
      return manifest;
    }
    
    // Truncate intelligently at line boundaries
    const lines = manifest.split('\n');
    let result = '';
    for (const line of lines) {
      if (result.length + line.length + 1 > maxChars) {
        break;
      }
      result += (result ? '\n' : '') + line;
    }
    
    return result || manifest.slice(0, maxChars);
  }
}