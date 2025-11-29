import Graph from "graphology";
import louvain from "graphology-communities-louvain";
import pagerank from "graphology-metrics/centrality/pagerank";
import betweennessCentrality from "graphology-metrics/centrality/betweenness";
import { density } from "graphology-metrics/graph/density";
import modularity from "graphology-metrics/graph/modularity";
import type { MemoryItem } from "../types";
import Anthropic from "@anthropic-ai/sdk";

export interface Association {
  fromId: string;
  toId: string;
  relation: string;
  weight: number;
  count?: number;
}

export interface Community {
  id: string;
  nodes: Set<string>;
  summary: string;
  keywords: string[];
  importance: number;
  volatility: number;
  centroid?: number[]; // Embedding vector if available
}

export interface TopologyMetrics {
  nodeCount: number;
  edgeCount: number;
  density: number;
  clusteringCoef: number;
  modularity: number;
  largestComponentRatio: number;
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

export class ManifestGenerator {
  private graph: Graph;
  private anthropic: Anthropic | null = null;

  constructor() {
    this.graph = new Graph({ type: "directed" });
    const apiKey = process.env.ANTHROPIC_API_KEY;
    console.log('[ManifestGenerator] Constructor - ANTHROPIC_API_KEY present:', !!apiKey);
    console.log('[ManifestGenerator] API key length:', apiKey?.length, 'starts with:', apiKey?.slice(0, 20));
    if (apiKey) {
      this.anthropic = new Anthropic({
        apiKey: apiKey.trim(), // Trim any whitespace
        timeout: 30000, // 30 second timeout
        maxRetries: 2 // Retry failed requests
      });
      console.log('[ManifestGenerator] Anthropic client initialized with timeout and retries');
    } else {
      console.log('[ManifestGenerator] No Anthropic client - API key missing');
    }
  }

  /**
   * Generate a manifest from memory state.
   * This creates the navigable 500-token description.
   */
  async generateManifest(
    items: MemoryItem[],
    associations: Association[]
  ): Promise<GraphManifest> {
    // Build graph from memory state
    this.buildGraph(items, associations);
    
    // 1. Community Detection (Louvain algorithm)
    const communities = await this.detectCommunities(items);
    
    // 2. Topology Metrics
    const topology = this.extractTopology();
    
    // 3. Temporal Layers
    const temporal = this.classifyTemporal(items);
    
    // 4. Bridge Detection
    const bridges = this.detectBridges(associations);
    
    // 5. Key Nodes (PageRank + Betweenness)
    const keyNodes = this.identifyKeyNodes(items);
    
    return {
      communities,
      topology,
      temporal,
      bridges,
      keyNodes,
      generated: Date.now()
    };
  }

  private buildGraph(items: MemoryItem[], associations: Association[]): void {
    // Clear existing graph
    this.graph.clear();
    
    // Add nodes
    for (const item of items) {
      this.graph.addNode(item.id, {
        text: item.text,
        type: item.type,
        importance: item.importance,
        timestamp: item.createdAt,
        lastAccessed: item.lastAccessedAt || item.createdAt,
        energy: item.energy || 0,
        tags: item.tags
      });
    }
    
    // Add edges (merge duplicates by summing weights)
    for (const assoc of associations) {
      if (this.graph.hasNode(assoc.fromId) && this.graph.hasNode(assoc.toId)) {
        const edgeKey = `${assoc.fromId}->${assoc.toId}`;
        if (this.graph.hasDirectedEdge(assoc.fromId, assoc.toId)) {
          // Merge with existing edge
          const existing = this.graph.getEdgeAttributes(assoc.fromId, assoc.toId);
          this.graph.setEdgeAttribute(assoc.fromId, assoc.toId, 'weight', existing.weight + assoc.weight);
          this.graph.setEdgeAttribute(assoc.fromId, assoc.toId, 'count', (existing.count || 1) + (assoc.count || 1));
        } else {
          this.graph.addDirectedEdge(
            assoc.fromId,
            assoc.toId,
            {
              weight: assoc.weight,
              relation: assoc.relation,
              count: assoc.count || 1
            }
          );
        }
      }
    }
  }

  private async detectCommunities(items: MemoryItem[]): Promise<Map<string, Community>> {
    // Run Louvain algorithm
    const communityMap = louvain(this.graph, {
      resolution: 1.0,
      getEdgeWeight: "weight"
    });
    
    // Group nodes by community
    const communities = new Map<string, Community>();
    const communityNodes = new Map<string, Set<string>>();
    
    for (const [nodeId, communityId] of Object.entries(communityMap)) {
      const commId = String(communityId);
      if (!communityNodes.has(commId)) {
        communityNodes.set(commId, new Set());
      }
      communityNodes.get(commId)!.add(nodeId);
    }
    
    // Generate community summaries
    for (const [communityId, nodeIds] of communityNodes.entries()) {
      const communityItems = items.filter(item => nodeIds.has(item.id));

      // Calculate community importance (sum of PageRank)
      let importance = 0;
      let pr: Record<string, number> = {};

      try {
        pr = pagerank(this.graph);
      } catch (err) {
        // PageRank can fail to converge for certain graph topologies
        console.warn("[ManifestGenerator] PageRank failed in detectCommunities, using uniform scores:", err);
        this.graph.forEachNode(node => {
          pr[node] = 1.0 / this.graph.order;
        });
      }

      for (const nodeId of nodeIds) {
        importance += pr[nodeId] || 0;
      }
      
      // Calculate volatility (update frequency)
      const now = Date.now();
      const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
      const recentUpdates = communityItems.filter(
        item => (item.lastAccessedAt || item.createdAt) > sevenDaysAgo
      ).length;
      const volatility = recentUpdates / nodeIds.size;
      
      // Extract keywords from tags
      const tagCounts = new Map<string, number>();
      for (const item of communityItems) {
        for (const tag of item.tags) {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        }
      }
      const keywords = Array.from(tagCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([tag]) => tag);
      
      // Placeholder summary (will be replaced with LLM-generated)
      const topNodes = communityItems
        .sort((a, b) => b.importance - a.importance)
        .slice(0, 3)
        .map(item => item.text.slice(0, 50))
        .join("; ");

      communities.set(communityId, {
        id: communityId,
        nodes: nodeIds,
        summary: topNodes, // Will be replaced with LLM theme name
        keywords,
        importance,
        volatility
      });
    }
    
    // Generate LLM theme names if Anthropic available
    console.log('[ManifestGenerator] Before LLM themes - communities:', communities.size, 'anthropic:', !!this.anthropic);
    if (this.anthropic && communities.size > 0) {
      console.log('[ManifestGenerator] Calling generateThemeNames for', communities.size, 'communities');
      await this.generateThemeNames(communities, items);
    } else {
      console.log('[ManifestGenerator] Skipping LLM themes - anthropic:', !!this.anthropic, 'communities:', communities.size);
    }

    return communities;
  }

  /**
   * Generate theme names for communities using LLM batch call
   */
  private async generateThemeNames(
    communities: Map<string, Community>,
    items: MemoryItem[]
  ): Promise<void> {
    console.log('[ManifestGenerator] generateThemeNames called - anthropic client:', !!this.anthropic);
    if (!this.anthropic) {
      console.log('[ManifestGenerator] Returning early - no Anthropic client');
      return;
    }

    try {
      console.log('[ManifestGenerator] Processing', communities.size, 'communities for theme naming');

      // Sort communities by importance and take top 5
      const sortedCommunities = Array.from(communities.entries())
        .sort((a, b) => b[1].importance - a[1].importance)
        .slice(0, 5);

      console.log('[ManifestGenerator] Selected top 5 communities by importance:',
        sortedCommunities.map(([id, c]) => `${id}:${c.importance.toFixed(2)}`).join(', '));

      // Prepare prompts for batch call
      const prompts: Array<{ communityId: string; prompt: string }> = [];

      for (const [communityId, community] of sortedCommunities) {
        const communityItems = items.filter(item => community.nodes.has(item.id));
        const topItems = communityItems
          .sort((a, b) => b.importance - a.importance)
          .slice(0, 5);

        const itemDescriptions = topItems
          .map(item => `- ${item.type}: ${item.text.slice(0, 100)}`)
          .join('\n');

        const prompt = `Given these memory items from a knowledge graph community:

${itemDescriptions}

Keywords: ${community.keywords.join(', ')}

Generate a concise theme name (2-4 words) that captures what this community represents. Respond with just the theme name, nothing else.`;

        prompts.push({ communityId, prompt });
      }

      console.log('[ManifestGenerator] Prepared', prompts.length, 'prompts for theme generation');
      console.log('[ManifestGenerator] Using Anthropic API (self-synthesis) for theme generation...');

      // Call Anthropic API in parallel for all themes
      const results = await Promise.all(
        prompts.map(async ({ communityId, prompt }) => {
          try {
            const message = await this.anthropic!.messages.create({
              model: "claude-sonnet-4-20250514",
              max_tokens: 20,
              temperature: 0.3,
              messages: [{ role: "user", content: prompt }]
            });

            const themeName = message.content[0]?.type === 'text'
              ? message.content[0].text.trim()
              : '';
            console.log('[ManifestGenerator] Community', communityId, 'got theme:', themeName);
            return { communityId, themeName };
          } catch (err) {
            console.warn(`[ManifestGenerator] Theme naming failed for community ${communityId}:`, err);
            return { communityId, themeName: '' };
          }
        })
      );
      console.log('[ManifestGenerator] Anthropic API returned', results.length, 'results');

      // Update community summaries with theme names
      let updated = 0;
      for (const { communityId, themeName } of results) {
        console.log('[ManifestGenerator] Result:', { communityId, themeName, hasTheme: !!themeName, hasCommunity: communities.has(communityId) });
        if (themeName && communities.has(communityId)) {
          const community = communities.get(communityId)!;
          community.summary = themeName;
          updated++;
          console.log('[ManifestGenerator] Updated community', communityId, 'with theme:', themeName);
        }
      }
      console.log('[ManifestGenerator] Successfully updated', updated, 'of', results.length, 'community themes');
    } catch (error) {
      console.warn('[ManifestGenerator] LLM theme naming failed:', error);
      // Fallback to keyword-based themes already set
    }
  }

  private extractTopology(): TopologyMetrics {
    const nodeCount = this.graph.order;
    const edgeCount = this.graph.size;
    const graphDensity = density(this.graph);
    
    // Calculate clustering coefficient
    let clusteringSum = 0;
    let validNodes = 0;
    this.graph.forEachNode(node => {
      const neighbors = this.graph.neighbors(node);
      const k = neighbors.length;
      if (k >= 2) {
        let triangles = 0;
        for (let i = 0; i < neighbors.length; i++) {
          for (let j = i + 1; j < neighbors.length; j++) {
            if (this.graph.hasEdge(neighbors[i], neighbors[j])) {
              triangles++;
            }
          }
        }
        clusteringSum += (2 * triangles) / (k * (k - 1));
        validNodes++;
      }
    });
    const clusteringCoef = validNodes > 0 ? clusteringSum / validNodes : 0;
    
    // Calculate modularity (best-effort, may fail for graphs with complex topology)
    let modularityScore = 0;
    try {
      const communities = louvain(this.graph);

      // Ensure all nodes are in the partition (louvain might miss isolated nodes)
      const allNodes = new Set<string>();
      this.graph.forEachNode(node => allNodes.add(node));

      let maxCommunity = -1;
      Object.values(communities).forEach((c: any) => {
        if (typeof c === 'number' && c > maxCommunity) maxCommunity = c;
      });

      // Assign missing nodes to a new community
      const isolatedCommunity = maxCommunity + 1;
      allNodes.forEach(node => {
        if (!Object.prototype.hasOwnProperty.call(communities, node)) {
          communities[node] = isolatedCommunity;
        }
      });

      modularityScore = modularity(this.graph, communities);
    } catch (err) {
      // Modularity calculation can fail for certain graph topologies
      // This is not critical for manifest generation, so continue with 0
      console.warn("[ManifestGenerator] Modularity calculation failed, using 0:", err);
      modularityScore = 0;
    }
    
    // Find largest component ratio (for directed graph, use weakly connected)
    const componentSizes: number[] = [];
    const visited = new Set<string>();
    
    this.graph.forEachNode(node => {
      if (!visited.has(node)) {
        let componentSize = 0;
        const queue = [node];
        while (queue.length > 0) {
          const current = queue.shift()!;
          if (!visited.has(current)) {
            visited.add(current);
            componentSize++;
            // Add all neighbors (both in and out for weak connectivity)
            this.graph.forEachNeighbor(current, neighbor => {
              if (!visited.has(neighbor)) {
                queue.push(neighbor);
              }
            });
            this.graph.forEachInNeighbor(current, neighbor => {
              if (!visited.has(neighbor)) {
                queue.push(neighbor);
              }
            });
          }
        }
        componentSizes.push(componentSize);
      }
    });
    
    const largestComponent = Math.max(...componentSizes, 0);
    const largestComponentRatio = nodeCount > 0 ? largestComponent / nodeCount : 0;
    
    return {
      nodeCount,
      edgeCount,
      density: graphDensity,
      clusteringCoef,
      modularity: modularityScore,
      largestComponentRatio,
      avgDegree: nodeCount > 0 ? (edgeCount * 2) / nodeCount : 0
    };
  }

  private classifyTemporal(items: MemoryItem[]): TemporalLayers {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    const stable: string[] = [];
    const active: string[] = [];
    const emerging: string[] = [];
    const decaying: string[] = [];

    for (const item of items) {
      const lastAccess = item.lastAccessedAt || item.createdAt;

      // Emerging: created in last 24h
      if (item.createdAt > oneDayAgo) {
        emerging.push(item.id);
      }
      // Active: accessed in last 7d
      else if (lastAccess > sevenDaysAgo) {
        active.push(item.id);
      }
      // Stable: unchanged for 30d but still has energy
      else if (lastAccess < thirtyDaysAgo && item.energy > 0.1) {
        stable.push(item.id);
      }
      // Decaying: low energy and infrequent access
      else if (item.energy <= 0.1 && (item.accessCount || 0) < 3) {
        decaying.push(item.id);
      }
      // Default to active if doesn't fit other categories
      else {
        active.push(item.id);
      }
    }

    return { stable, active, emerging, decaying };
  }

  private detectBridges(associations: Association[]): Array<{ from: string; to: string; weight: number }> {
    // Find edges that connect different communities
    const communities = louvain(this.graph);
    const bridges: Array<{ from: string; to: string; weight: number }> = [];
    
    for (const assoc of associations) {
      const fromCommunity = communities[assoc.fromId];
      const toCommunity = communities[assoc.toId];
      
      // Edge connects different communities = bridge
      if (fromCommunity !== toCommunity) {
        bridges.push({
          from: assoc.fromId,
          to: assoc.toId,
          weight: assoc.weight
        });
      }
    }
    
    // Sort by weight and return top bridges
    return bridges
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 10);
  }

  private identifyKeyNodes(items: MemoryItem[]): Array<{ id: string; importance: number; label: string }> {
    // Combine PageRank and Betweenness Centrality
    let pr: Record<string, number> = {};

    try {
      pr = pagerank(this.graph);
    } catch (err) {
      // PageRank can fail to converge for certain graph topologies
      // Fallback to uniform distribution
      console.warn("[ManifestGenerator] PageRank failed to converge, using uniform scores:", err);
      this.graph.forEachNode(node => {
        pr[node] = 1.0 / this.graph.order;
      });
    }

    // Betweenness centrality (expensive, limit to top nodes)
    const topByPagerank = Object.entries(pr)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([id]) => id);

    const keyNodes: Array<{ id: string; importance: number; label: string }> = [];

    for (const nodeId of topByPagerank) {
      const item = items.find(i => i.id === nodeId);
      if (item) {
        const prScore = pr[nodeId] || 0;
        const energyScore = item.energy || 0;
        const importanceScore = item.importance || 0;

        // Combined importance metric
        const combinedScore = (prScore * 0.4) + (energyScore * 0.3) + (importanceScore * 0.3);

        keyNodes.push({
          id: nodeId,
          importance: combinedScore,
          label: item.text.slice(0, 50)
        });
      }
    }

    return keyNodes
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 5);
  }

  /**
   * Format the manifest as "memory about memory" thematic synthesis.
   * Target: 500-1000 tokens showing themes, not just items.
   */
  formatDescription(manifest: GraphManifest): string {
    const lines: string[] = [];

    // Header
    lines.push(
      `Memory Map (${manifest.topology.nodeCount} items, ${manifest.topology.edgeCount} edges):\n`
    );

    // Themes section - the core innovation
    const topCommunities = Array.from(manifest.communities.values())
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 5);

    if (topCommunities.length > 0) {
      lines.push('Themes:');
      topCommunities.forEach((comm, idx) => {
        const keywords = comm.keywords.slice(0, 3).join(', ');
        const recentItem = this.getRecentItemFromCommunity(comm);
        lines.push(
          `${idx + 1}. ${comm.summary} (importance: ${comm.importance.toFixed(2)}, ${comm.nodes.size} items)`
        );
        if (keywords) {
          lines.push(`   - ${keywords}`);
        }
        if (recentItem) {
          lines.push(`   - Recent: ${recentItem}`);
        }
      });
      lines.push('');
    }

    // Unresolved questions (high importance items without resolution edges)
    const unresolved = this.findUnresolvedQuestions(manifest);
    if (unresolved.length > 0) {
      lines.push('Unresolved Questions:');
      unresolved.forEach(q => {
        lines.push(`- ${q}`);
      });
      lines.push('');
    }

    // Recent activity summary
    const recentSummary = this.summarizeRecentActivity(manifest);
    if (recentSummary) {
      lines.push(`Recent Activity: ${recentSummary}`);
      lines.push('');
    }

    // Topology summary (condensed)
    lines.push(
      `Graph: ${manifest.topology.avgDegree.toFixed(1)} avg degree, ` +
      `${manifest.topology.density.toFixed(3)} density, ` +
      `${manifest.topology.modularity.toFixed(2)} modularity`
    );

    return lines.join('\n');
  }

  private getRecentItemFromCommunity(community: Community): string | null {
    const nodeIds = Array.from(community.nodes);
    let mostRecent: any = null;
    let latestTime = 0;

    for (const nodeId of nodeIds) {
      if (!this.graph.hasNode(nodeId)) continue;
      const attrs = this.graph.getNodeAttributes(nodeId);
      const time = attrs.lastAccessed || attrs.timestamp || 0;
      if (time > latestTime) {
        latestTime = time;
        mostRecent = attrs;
      }
    }

    return mostRecent ? mostRecent.text.slice(0, 60) : null;
  }

  private findUnresolvedQuestions(manifest: GraphManifest): string[] {
    const questions: string[] = [];
    const highImportanceThreshold = 0.7;

    this.graph.forEachNode((nodeId, attrs) => {
      // High importance items that are questions or plans without many outgoing edges
      if (attrs.importance >= highImportanceThreshold) {
        const outDegree = this.graph.outDegree(nodeId);
        const type = attrs.type;

        if ((type === 'plan' || type === 'bridge') && outDegree < 2) {
          questions.push(attrs.text.slice(0, 80));
        }
      }
    });

    return questions.slice(0, 3);
  }

  private summarizeRecentActivity(manifest: GraphManifest): string | null {
    const recent = manifest.temporal.emerging.concat(manifest.temporal.active).slice(0, 5);
    if (recent.length === 0) return null;

    const tags = new Map<string, number>();
    for (const nodeId of recent) {
      if (!this.graph.hasNode(nodeId)) continue;
      const attrs = this.graph.getNodeAttributes(nodeId);
      if (attrs.tags) {
        attrs.tags.forEach((tag: string) => tags.set(tag, (tags.get(tag) || 0) + 1));
      }
    }

    const topTags = Array.from(tags.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([tag]) => tag);

    return topTags.length > 0 ? topTags.join(', ') : null;
  }

  private calculateTotalEnergy(manifest: GraphManifest): number {
    let totalEnergy = 0;
    let nodeCount = 0;
    
    this.graph.forEachNode((node, attributes) => {
      totalEnergy += attributes.energy || 0;
      nodeCount++;
    });
    
    // Normalize to 0-100 scale
    return nodeCount > 0 ? Math.min(100, (totalEnergy / nodeCount) * 100) : 0;
  }

  private summarizeNodes(nodeIds: string[]): string {
    return nodeIds
      .map(id => {
        const attrs = this.graph.getNodeAttributes(id);
        return attrs?.text?.slice(0, 20) || id.slice(0, 10);
      })
      .join(", ");
  }

  private getNodeLabel(nodeId: string): string {
    const attrs = this.graph.getNodeAttributes(nodeId);
    return attrs?.text || nodeId;
  }
}