import type { MemoryState, MemoryItem, MemoryEdge, MemoryItemType } from "./types";
import { Neo4jMemoryStore } from "./store/Neo4jMemoryStore";
import { ManifestGenerator, type GraphManifest } from "./manifest/ManifestGenerator";
import { SExprToCypher } from "./translator/SExprToCypher";
import { runSpreadingActivation } from "./engine/SpreadingActivationEngine";

/**
 * GraphitiWithManifest - Real memory with navigable descriptions.
 * 
 * This wraps Neo4j storage with manifest generation to provide
 * rich 500-token descriptions for Claude's peripheral awareness.
 */
export class GraphitiWithManifest {
  private store: Neo4jMemoryStore;
  private manifestGenerator: ManifestGenerator;
  private translator: SExprToCypher;
  
  private manifest: GraphManifest | null = null;
  private updatesSinceManifest = 0;
  private readonly updateThreshold = 100; // Regenerate after N updates
  private isGeneratingManifest = false;
  
  // Cache for current memory state
  private memoryState: MemoryState | null = null;
  
  constructor(
    neo4jUri?: string,
    neo4jUser?: string,
    neo4jPassword?: string
  ) {
    this.store = new Neo4jMemoryStore(neo4jUri, neo4jUser, neo4jPassword);
    this.manifestGenerator = new ManifestGenerator();
    this.translator = new SExprToCypher();
  }
  
  /**
   * Initialize the memory system and load existing state.
   */
  async initialize(): Promise<void> {
    // Load existing memory state from Neo4j
    this.memoryState = await this.store.load();
    
    if (!this.memoryState) {
      // Initialize with empty state
      this.memoryState = {
        id: "workspace",
        born: Date.now(),
        energy: 0,
        threshold: 100,
        items: {},
        edges: [],
        history: []
      };
    }
    
    // Generate initial manifest if we have data
    if (Object.keys(this.memoryState.items).length > 0) {
      await this.regenerateManifest();
    }
  }
  
  /**
   * Execute an S-expression against the memory.
   * This is the main interface for homoiconic interaction.
   */
  async execute(sexpr: string): Promise<any> {
    // Translate S-expression to Cypher
    const cypherQuery = this.translator.translate(sexpr);
    
    // Execute against Neo4j
    const result = await this.store.runCypher(
      cypherQuery.query,
      cypherQuery.params
    );
    
    // Track updates for manifest regeneration
    const mutatingCommands = ["remember", "associate", "feedback", "decay!", "consolidate"];
    const command = sexpr.trim().slice(1).split(" ")[0];
    
    if (mutatingCommands.includes(command)) {
      this.updatesSinceManifest++;
      
      // Reload memory state after mutation
      this.memoryState = await this.store.load();
      
      // Check if we need to regenerate manifest
      if (this.updatesSinceManifest >= this.updateThreshold) {
        this.regenerateManifest(); // Async, non-blocking
      }
    }
    
    // Format result for return
    return this.formatResult(result.records);
  }
  
  /**
   * Remember a new memory item.
   */
  async remember(
    text: string,
    type: string,
    importance: number,
    ttl: string,
    tags: string[]
  ): Promise<string> {
    // Pattern validation at write time
    const { patternValidator } = await import('./validation/PatternValidator');
    const validation = await patternValidator.validate({
      text,
      type,
      importance,
      tags
    });

    // Reject if validation fails
    if (!validation.valid) {
      console.error(`Memory validation failed (confidence ${validation.confidence.toFixed(2)}):`, validation.signals);
      throw new Error(`Pattern validation failed: ${validation.signals.join(', ')}`);
    }

    // Use adjusted importance if provided
    const finalImportance = validation.adjustedImportance ?? importance;

    const id = `m_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const timestamp = Date.now();

    const newItem: MemoryItem = {
      id,
      text,
      type: type as MemoryItemType,
      importance: finalImportance,
      energy: finalImportance,
      ttl,
      tags,
      createdAt: timestamp,
      updatedAt: timestamp,
      lastAccessedAt: timestamp,
      accessCount: 0,
      success: 0,
      fail: 0
    };

    // Add to in-memory state
    if (this.memoryState) {
      this.memoryState.items[id] = newItem;

      // Save to Neo4j
      await this.store.save(this.memoryState, "");

      this.updatesSinceManifest++;
      if (this.updatesSinceManifest >= this.updateThreshold) {
        this.regenerateManifest();
      }
    }

    return id;
  }
  
  /**
   * Recall memories using spreading activation.
   */
  async recall(query: string, limit = 10): Promise<any[]> {
    if (!this.memoryState) {
      return [];
    }
    
    // Find seed nodes matching query
    const items = Object.values(this.memoryState.items);
    const seeds = items
      .filter(item => 
        item.text.toLowerCase().includes(query.toLowerCase()) ||
        item.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
      )
      .map(item => item.id);
    
    if (seeds.length === 0) {
      return [];
    }
    
    // Run spreading activation
    const activations = runSpreadingActivation(
      this.memoryState,
      Object.fromEntries(seeds.map(id => [id, 1.0])),
      {
        steps: 3,
        decay: 0.85,
        threshold: 0.1
      }
    );
    
    // Sort items by activation
    const results = items
      .filter(item => activations[item.id] > 0)
      .sort((a, b) => (activations[b.id] || 0) - (activations[a.id] || 0))
      .slice(0, limit);
    
    // Update access counts
    for (const item of results) {
      item.lastAccessedAt = Date.now();
      item.accessCount = (item.accessCount || 0) + 1;
    }
    
    return results;
  }
  
  /**
   * Create association between memories.
   */
  async associate(
    fromId: string,
    toId: string,
    relation: string,
    weight: number
  ): Promise<void> {
    if (!this.memoryState) {
      return;
    }
    
    // Check if association exists
    const existing = this.memoryState.edges.find(
      e => e.from === fromId && e.to === toId && e.relation === relation
    );
    
    if (existing) {
      // Strengthen existing association
      existing.weight = Math.min(1.0, existing.weight + weight * 0.1);
      existing.lastReinforcedAt = Date.now();
    } else {
      // Create new association
      this.memoryState.edges.push({
        from: fromId,
        to: toId,
        relation,
        weight,
        lastReinforcedAt: Date.now()
      });
    }
    
    // Save to Neo4j
    await this.store.save(this.memoryState, "");
    
    this.updatesSinceManifest++;
    if (this.updatesSinceManifest >= this.updateThreshold) {
      this.regenerateManifest();
    }
  }
  
  /**
   * Provide feedback on a memory's usefulness.
   */
  async feedback(id: string, outcome: "success" | "fail"): Promise<void> {
    if (!this.memoryState) {
      return;
    }
    
    const item = this.memoryState.items[id];
    if (!item) {
      return;
    }
    
    if (outcome === "success") {
      item.success = (item.success || 0) + 1;
      item.energy = Math.min(1.0, item.energy * 1.1);
    } else {
      item.fail = (item.fail || 0) + 1;
      item.energy = Math.max(0, item.energy * 0.9);
    }
    
    // Update importance based on feedback
    const total = (item.success || 0) + (item.fail || 0);
    if (total > 0) {
      item.importance = Math.min(1.0, (item.success || 0) / total);
    }
    
    // Save to Neo4j
    await this.store.save(this.memoryState, "");
    
    this.updatesSinceManifest++;
  }
  
  /**
   * Regenerate the manifest asynchronously.
   */
  private async regenerateManifest(): Promise<void> {
    if (this.isGeneratingManifest || !this.memoryState) {
      return;
    }
    
    this.isGeneratingManifest = true;
    
    try {
      // Generate new manifest
      const items = Object.values(this.memoryState.items);
      const associations = this.memoryState.edges.map(e => ({
        fromId: e.from,
        toId: e.to,
        relation: e.relation,
        weight: e.weight,
        count: 1
      }));
      this.manifest = await this.manifestGenerator.generateManifest(
        items,
        associations as any
      );
      
      this.updatesSinceManifest = 0;
    } catch (error) {
      console.error("Failed to generate manifest:", error);
    } finally {
      this.isGeneratingManifest = false;
    }
  }
  
  /**
   * Get the tool description with manifest.
   * This is what Claude sees in the tool metadata.
   */
  getToolDescription(): string {
    if (!this.manifest) {
      return "Memory: Initializing...";
    }
    
    return this.manifestGenerator.formatDescription(this.manifest);
  }
  
  /**
   * Get current statistics.
   */
  async getStats(): Promise<any> {
    const stats = await this.store.getGraphStats();
    
    return {
      ...stats,
      manifest: this.manifest ? {
        communities: this.manifest.communities.size,
        keyNodes: this.manifest.keyNodes.length,
        bridges: this.manifest.bridges.length,
        generated: new Date(this.manifest.generated).toISOString()
      } : null,
      updatesSinceManifest: this.updatesSinceManifest
    };
  }
  
  /**
   * Apply temporal decay to all memories.
   */
  async decay(halfLifeDays = 7): Promise<number> {
    if (!this.memoryState) {
      return 0;
    }
    
    const decayRate = Math.log(0.5) / (halfLifeDays * 24 * 60 * 60 * 1000);
    const now = Date.now();
    let decayedCount = 0;
    
    const items = Object.values(this.memoryState.items);
    for (const item of items) {
      const timeSinceAccess = now - (item.lastAccessedAt || item.createdAt);
      const decayFactor = Math.exp(decayRate * timeSinceAccess);
      
      item.energy *= decayFactor;
      
      if (item.energy < 0.01) {
        item.energy = 0;
        decayedCount++;
      }
    }
    
    // Also decay association weights
    for (const edge of this.memoryState.edges) {
      edge.weight *= 0.95; // Gentle decay
    }
    
    // Save to Neo4j
    await this.store.save(this.memoryState, "");
    
    this.updatesSinceManifest++;
    if (this.updatesSinceManifest >= this.updateThreshold) {
      this.regenerateManifest();
    }
    
    return decayedCount;
  }
  
  /**
   * Consolidate memories by pruning low-energy items.
   */
  async consolidate(): Promise<number> {
    if (!this.memoryState) {
      return 0;
    }
    
    const items = Object.values(this.memoryState.items);
    const before = items.length;
    
    // Remove very low energy items with no recent access
    const keepItems = items.filter(
      item => item.energy > 0.05 || (item.accessCount || 0) > 5
    );
    
    // Rebuild items record
    this.memoryState.items = {};
    for (const item of keepItems) {
      this.memoryState.items[item.id] = item;
    }
    
    // Remove associations to deleted items
    const validIds = new Set(Object.keys(this.memoryState.items));
    this.memoryState.edges = this.memoryState.edges.filter(
      edge => validIds.has(edge.from) && validIds.has(edge.to)
    );
    
    // Save to Neo4j
    await this.store.save(this.memoryState, "");
    
    const pruned = before - Object.keys(this.memoryState.items).length;
    
    // Regenerate manifest after consolidation
    await this.regenerateManifest();
    
    return pruned;
  }
  
  /**
   * Close connections and cleanup.
   */
  async close(): Promise<void> {
    await this.store.close();
  }
  
  private formatResult(records: any[]): any {
    if (records.length === 0) {
      return null;
    }
    
    if (records.length === 1) {
      const record = records[0];
      if (record.keys.length === 1) {
        return record.get(record.keys[0]);
      }
      
      const result: any = {};
      for (const key of record.keys) {
        result[key] = record.get(key);
      }
      return result;
    }
    
    return records.map(record => {
      if (record.keys.length === 1) {
        return record.get(record.keys[0]);
      }
      
      const result: any = {};
      for (const key of record.keys) {
        result[key] = record.get(key);
      }
      return result;
    });
  }
}