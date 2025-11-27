/**
 * ManifestGenerator - "memory about memory"
 *
 * Compresses memory graph into 500-1000 token summary for tool descriptions.
 * Uses graphology + Louvain communities + PageRank + temporal analysis.
 *
 * V's core insight:
 * "в самом описании тула надо выводить краткую сводку содержания памяти...
 *  чтобы в 1000-2000 токенов влезла 'память о памяти'"
 */

import Graph from 'graphology';
import louvain from 'graphology-communities-louvain';
import pagerank from 'graphology-metrics/centrality/pagerank.js';
import { density } from 'graphology-metrics/graph/density.js';
import modularity from 'graphology-metrics/graph/modularity.js';
import type { MemoryItem, MemoryEdge } from '../types.js';

// ============================================================================
// Types
// ============================================================================

export interface Association {
  fromId: string;
  toId: string;
  relation: string;
  weight: number;
}

export interface Community {
  id: string;
  nodes: Set<string>;
  summary: string;
  keywords: string[];
  importance: number;
  volatility: number;
}

export interface TopologyMetrics {
  nodeCount: number;
  edgeCount: number;
  density: number;
  clusteringCoef: number;
  modularity: number;
  avgDegree: number;
}

export interface TemporalLayers {
  stable: string[];    // >30d unchanged
  active: string[];    // accessed last 7d
  emerging: string[];  // created last 24h
  decaying: string[];  // low energy, infrequent access
}

export interface GraphManifest {
  communities: Map<string, Community>;
  topology: TopologyMetrics;
  temporal: TemporalLayers;
  bridges: Array<{ from: string; to: string; weight: number }>;
  keyNodes: Array<{ id: string; importance: number; label: string }>;
  generated: number;
}

// ============================================================================
// Optional LLM Integration
// ============================================================================

interface LLMClient {
  messages: {
    create(params: {
      model: string;
      max_tokens: number;
      messages: Array<{ role: string; content: string }>;
    }): Promise<{ content: Array<{ text?: string }> }>;
  };
}

// ============================================================================
// ManifestGenerator
// ============================================================================

export class ManifestGenerator {
  private llm?: LLMClient;

  constructor(llm?: LLMClient) {
    this.llm = llm;
  }

  /**
   * Generate compressed manifest from memory graph
   */
  async generateManifest(
    items: MemoryItem[],
    associations: Association[]
  ): Promise<GraphManifest> {
    const now = Date.now();

    // Build graph
    const graph = this.buildGraph(items, associations);

    // Detect communities
    const communities = await this.detectCommunities(graph, items);

    // Calculate topology metrics
    const topology = this.calculateTopology(graph);

    // Temporal analysis
    const temporal = this.analyzeTemporal(items, now);

    // Find bridges (edges connecting different communities)
    const bridges = this.findBridges(graph, communities);

    // Find key nodes (high PageRank + energy)
    const keyNodes = this.findKeyNodes(graph, items);

    return {
      communities,
      topology,
      temporal,
      bridges,
      keyNodes,
      generated: now,
    };
  }

  /**
   * Format manifest as 500-1000 token description
   */
  formatDescription(manifest: GraphManifest): string {
    const lines: string[] = [];

    // Header
    lines.push('=== MEMORY GRAPH MANIFEST ===');
    lines.push(`Generated: ${new Date(manifest.generated).toLocaleString()}`);
    lines.push(`${manifest.topology.nodeCount} items | ${manifest.topology.edgeCount} edges | density ${manifest.topology.density.toFixed(3)}`);
    lines.push('');

    // Top themes (communities)
    lines.push('Top Themes:');
    const topCommunities = Array.from(manifest.communities.values())
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 5);

    for (const comm of topCommunities) {
      const volatilityLabel = comm.volatility > 0.7 ? '(active)' : comm.volatility < 0.3 ? '(stable)' : '';
      lines.push(`  ${comm.summary} ${volatilityLabel}`);
      lines.push(`    ${comm.nodes.size} items | keywords: ${comm.keywords.slice(0, 5).join(', ')}`);
    }
    lines.push('');

    // Temporal state
    lines.push('Temporal State:');
    lines.push(`  Emerging: ${manifest.temporal.emerging.length} items (last 24h)`);
    lines.push(`  Active: ${manifest.temporal.active.length} items (last 7d)`);
    lines.push(`  Stable: ${manifest.temporal.stable.length} items (>30d unchanged)`);
    lines.push(`  Decaying: ${manifest.temporal.decaying.length} items (low energy)`);
    lines.push('');

    // Key nodes
    lines.push('Key Nodes:');
    for (const node of manifest.keyNodes.slice(0, 5)) {
      lines.push(`  ${node.label} (importance: ${node.importance.toFixed(2)})`);
    }
    lines.push('');

    // Topology
    lines.push('Topology:');
    lines.push(`  Modularity: ${manifest.topology.modularity.toFixed(3)} (${this.interpretModularity(manifest.topology.modularity)})`);
    lines.push(`  Avg degree: ${manifest.topology.avgDegree.toFixed(1)}`);
    lines.push(`  Communities: ${manifest.communities.size}`);
    lines.push(`  Bridges: ${manifest.bridges.length} cross-community connections`);

    return lines.join('\n');
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private buildGraph(items: MemoryItem[], associations: Association[]): Graph {
    const graph = new Graph({ multi: false, type: 'directed' });

    // Add nodes
    for (const item of items) {
      graph.addNode(item.id, {
        type: item.type,
        text: item.text,
        tags: item.tags,
        importance: item.importance,
        energy: item.energy,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        lastAccessedAt: item.lastAccessedAt,
        accessCount: item.accessCount || 0,
      });
    }

    // Add edges
    for (const assoc of associations) {
      if (graph.hasNode(assoc.fromId) && graph.hasNode(assoc.toId)) {
        graph.addEdge(assoc.fromId, assoc.toId, {
          relation: assoc.relation,
          weight: assoc.weight,
        });
      }
    }

    return graph;
  }

  private async detectCommunities(
    graph: Graph,
    items: MemoryItem[]
  ): Promise<Map<string, Community>> {
    // Run Louvain algorithm
    louvain.assign(graph, { resolution: 1.0 });

    // Group nodes by community
    const communityNodes = new Map<string, Set<string>>();
    graph.forEachNode((node, attrs) => {
      const commId = attrs.community as string;
      if (!communityNodes.has(commId)) {
        communityNodes.set(commId, new Set());
      }
      communityNodes.get(commId)!.add(node);
    });

    // Build community objects
    const communities = new Map<string, Community>();

    for (const [commId, nodes] of communityNodes.entries()) {
      if (nodes.size < 3) continue; // Skip tiny communities

      const nodeItems = Array.from(nodes).map(id =>
        items.find(item => item.id === id)!
      ).filter(Boolean);

      // Calculate importance (avg of node importances weighted by PageRank)
      const ranks = pagerank(graph);
      const importance = nodeItems.reduce((sum, item) =>
        sum + (item.importance * (ranks[item.id] || 0)), 0
      ) / nodeItems.length;

      // Calculate volatility (how recently changed)
      const now = Date.now();
      const avgRecency = nodeItems.reduce((sum, item) =>
        sum + (now - item.updatedAt), 0
      ) / nodeItems.length;
      const volatility = Math.max(0, 1 - (avgRecency / (30 * 24 * 60 * 60 * 1000)));

      // Extract keywords
      const keywords = this.extractKeywords(nodeItems);

      // Generate summary (LLM if available, otherwise fallback)
      const summary = await this.generateCommunitySummary(nodeItems, keywords);

      communities.set(commId, {
        id: commId,
        nodes,
        summary,
        keywords,
        importance,
        volatility,
      });
    }

    return communities;
  }

  private calculateTopology(graph: Graph): TopologyMetrics {
    const nodeCount = graph.order;
    const edgeCount = graph.size;

    // Handle empty graph
    if (nodeCount === 0 || edgeCount === 0) {
      return {
        nodeCount,
        edgeCount,
        density: 0,
        clusteringCoef: 0,
        modularity: 0,
        avgDegree: 0,
      };
    }

    const graphDensity = density(graph);

    // Calculate modularity based on detected communities
    const graphModularity = modularity(graph);

    // Calculate average degree
    let totalDegree = 0;
    graph.forEachNode((node) => {
      totalDegree += graph.degree(node);
    });
    const avgDegree = nodeCount > 0 ? totalDegree / nodeCount : 0;

    // Clustering coefficient (simplified - full calculation is expensive)
    let clusteringCoef = 0;
    if (nodeCount > 0) {
      let sumCoef = 0;
      let count = 0;
      graph.forEachNode((node) => {
        const neighbors = graph.neighbors(node);
        if (neighbors.length < 2) return;

        let triangles = 0;
        const maxTriangles = neighbors.length * (neighbors.length - 1) / 2;

        for (let i = 0; i < neighbors.length; i++) {
          for (let j = i + 1; j < neighbors.length; j++) {
            if (graph.hasEdge(neighbors[i], neighbors[j])) {
              triangles++;
            }
          }
        }

        sumCoef += maxTriangles > 0 ? triangles / maxTriangles : 0;
        count++;
      });
      clusteringCoef = count > 0 ? sumCoef / count : 0;
    }

    return {
      nodeCount,
      edgeCount,
      density: graphDensity,
      clusteringCoef,
      modularity: graphModularity,
      avgDegree,
    };
  }

  private analyzeTemporal(items: MemoryItem[], now: number): TemporalLayers {
    const DAY_MS = 24 * 60 * 60 * 1000;

    const stable: string[] = [];
    const active: string[] = [];
    const emerging: string[] = [];
    const decaying: string[] = [];

    for (const item of items) {
      const age = now - item.createdAt;
      const lastChange = now - item.updatedAt;
      const lastAccess = item.lastAccessedAt ? now - item.lastAccessedAt : Infinity;

      // Emerging: created in last 24h
      if (age < DAY_MS) {
        emerging.push(item.id);
      }

      // Active: accessed in last 7d
      if (lastAccess < 7 * DAY_MS) {
        active.push(item.id);
      }

      // Stable: unchanged for >30d, high energy
      if (lastChange > 30 * DAY_MS && item.energy > 0.5) {
        stable.push(item.id);
      }

      // Decaying: low energy (<0.3), not accessed recently (or never accessed and old)
      if (item.energy < 0.3) {
        if (lastAccess > 30 * DAY_MS || (lastAccess === Infinity && age > 30 * DAY_MS)) {
          decaying.push(item.id);
        }
      }
    }

    return { stable, active, emerging, decaying };
  }

  private findBridges(
    graph: Graph,
    communities: Map<string, Community>
  ): Array<{ from: string; to: string; weight: number }> {
    const bridges: Array<{ from: string; to: string; weight: number }> = [];

    // Get community membership for each node
    const nodeCommunity = new Map<string, string>();
    for (const [commId, comm] of communities.entries()) {
      for (const node of comm.nodes) {
        nodeCommunity.set(node, commId);
      }
    }

    // Find edges that cross communities
    graph.forEachEdge((edge, attrs, source, target) => {
      const sourceCommunity = nodeCommunity.get(source);
      const targetCommunity = nodeCommunity.get(target);

      if (sourceCommunity && targetCommunity && sourceCommunity !== targetCommunity) {
        bridges.push({
          from: sourceCommunity,
          to: targetCommunity,
          weight: attrs.weight || 1,
        });
      }
    });

    // Sort by weight and return top bridges
    return bridges
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 10);
  }

  private findKeyNodes(
    graph: Graph,
    items: MemoryItem[]
  ): Array<{ id: string; importance: number; label: string }> {
    if (graph.order === 0) {
      return [];
    }

    const ranks = pagerank(graph);
    const itemMap = new Map(items.map(item => [item.id, item]));

    const keyNodes = Array.from(graph.nodes())
      .map(nodeId => {
        const item = itemMap.get(nodeId);
        if (!item) return null;

        // Combined score: PageRank * energy * importance
        const score = (ranks[nodeId] || 0) * item.energy * item.importance;

        // Generate label from text
        const label = this.makeLabel(item);

        return { id: nodeId, importance: score, label };
      })
      .filter((n): n is NonNullable<typeof n> => n !== null)
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 10);

    return keyNodes;
  }

  private extractKeywords(items: MemoryItem[]): string[] {
    // Aggregate all tags
    const tagCounts = new Map<string, number>();

    for (const item of items) {
      for (const tag of item.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }

    // Extract common words from text
    const wordCounts = new Map<string, number>();

    for (const item of items) {
      const words = item.text
        .toLowerCase()
        .split(/\W+/)
        .filter(w => w.length > 3);

      for (const word of words) {
        wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
      }
    }

    // Combine tags and words, sort by frequency
    const keywords = [
      ...Array.from(tagCounts.entries()),
      ...Array.from(wordCounts.entries()),
    ]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([word]) => word);

    return keywords;
  }

  private async generateCommunitySummary(
    items: MemoryItem[],
    keywords: string[]
  ): Promise<string> {
    // If LLM available, generate smart summary
    if (this.llm) {
      try {
        const typeCounts = new Map<string, number>();
        for (const item of items) {
          typeCounts.set(item.type, (typeCounts.get(item.type) || 0) + 1);
        }

        const typeStr = Array.from(typeCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([type, count]) => `${count} ${type}`)
          .join(', ');

        const sampleTexts = items
          .slice(0, 5)
          .map(item => item.text.slice(0, 100))
          .join('\n');

        const response = await this.llm.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 100,
          messages: [{
            role: 'user',
            content: `Generate a 3-5 word theme name for this memory cluster:
Types: ${typeStr}
Keywords: ${keywords.slice(0, 8).join(', ')}
Samples:
${sampleTexts}

Theme name (3-5 words):`,
          }],
        });

        const text = response.content[0]?.text?.trim();
        if (text && text.length > 0 && text.length < 60) {
          return text;
        }
      } catch (err) {
        // Fallback on error
      }
    }

    // Fallback: keyword-based summary
    return keywords.slice(0, 4).join(' / ');
  }

  private makeLabel(item: MemoryItem): string {
    // Create readable label from text (first 50 chars)
    const text = item.text.replace(/\s+/g, ' ').trim();
    return text.length > 50 ? text.slice(0, 47) + '...' : text;
  }

  private interpretModularity(modularity: number): string {
    if (modularity > 0.5) return 'highly clustered';
    if (modularity > 0.3) return 'moderately clustered';
    return 'loosely connected';
  }
}
