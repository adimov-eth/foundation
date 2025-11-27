/**
 * MemoryToolInteraction - "Memory about memory" in tool descriptions
 *
 * V's core insight (July 31, 2025):
 * "в самом описании тула надо выводить краткую сводку содержания памяти...
 *  чтобы в 1000-2000 токенов влезла 'память о памяти'"
 *
 * Following periphery's awareness-tool pattern:
 * - Dynamic description shows live state BEFORE any query
 * - Singleton store for shared state across requests
 * - Functions are secondary to the description itself
 */

import { DiscoveryToolInteraction } from "@here.build/arrival-mcp";
import * as z from "zod";
import {
  ManifestGenerator,
  type GraphManifest,
  type MemoryStore,
  type MemoryState,
  type MemoryItem,
  type MemoryEdge,
  runSpreadingActivation,
  type ActivationMap,
  DEFAULT_POLICY,
} from "../memory/index.js";

// ============================================================================
// Shared State - Singleton across tools (following periphery pattern)
// ============================================================================

export class MemoryStateStore {
  private static instance: MemoryStateStore | null = null;
  private state: MemoryState | null = null;
  private manifest: GraphManifest | null = null;
  private manifestDescription: string | null = null;
  private lastManifestGeneration: number = 0;
  private store: MemoryStore | null = null;

  private constructor() {}

  static getInstance(): MemoryStateStore {
    if (!MemoryStateStore.instance) {
      MemoryStateStore.instance = new MemoryStateStore();
    }
    return MemoryStateStore.instance;
  }

  setStore(store: MemoryStore): void {
    this.store = store;
  }

  getStore(): MemoryStore | null {
    return this.store;
  }

  getState(): MemoryState | null {
    return this.state;
  }

  setState(state: MemoryState): void {
    this.state = state;
  }

  getManifest(): GraphManifest | null {
    return this.manifest;
  }

  setManifest(manifest: GraphManifest, description: string): void {
    this.manifest = manifest;
    this.manifestDescription = description;
    this.lastManifestGeneration = Date.now();
  }

  getManifestDescription(): string | null {
    return this.manifestDescription;
  }

  isManifestStale(ttlMs: number): boolean {
    return Date.now() - this.lastManifestGeneration > ttlMs;
  }

  invalidateManifest(): void {
    this.manifest = null;
    this.manifestDescription = null;
    this.lastManifestGeneration = 0;
  }
}

// ============================================================================
// MemoryToolInteraction
// ============================================================================

interface MemoryExecutionContext {
  expr: string;
  scope?: string;
}

export class MemoryToolInteraction extends DiscoveryToolInteraction<MemoryExecutionContext> {
  readonly toolName = "memory";
  readonly toolSummary = "Persistent memory with thematic awareness";

  private stateStore = MemoryStateStore.getInstance();
  private manifestGenerator: ManifestGenerator;
  private readonly MANIFEST_CACHE_TTL_MS = 60_000; // 60 seconds

  override contextSchema = {
    scope: z.string().optional().describe("Filter memories to specific scope (agent name)"),
  };

  constructor(
    context: any,
    state: Record<string, any> = {},
    executionContext?: MemoryExecutionContext,
    private store?: MemoryStore,
    llm?: any
  ) {
    super(context, state, executionContext);
    if (store) {
      this.stateStore.setStore(store);
    }
    this.manifestGenerator = new ManifestGenerator(llm);
  }

  // ============================================================================
  // Dynamic Description - THE KEY (following awareness-tool pattern)
  // ============================================================================

  private generateDynamicDescription(): { dynamic: true; value: string } {
    const state = this.stateStore.getState();

    if (!state || Object.keys(state.items).length === 0) {
      return {
        dynamic: true,
        value: `Memory status.

=== NO MEMORIES YET ===
Use (remember "text" "type" (list "tags")) to store memories.
Types: event|fact|plan|reflection|entity|principle|technique|warning|workflow|bridge|pattern|insight

After memories accumulate:
- Themes will appear here (memory about memory)
- Spreading activation for associative recall
- Temporal layers (emerging, active, stable, decaying)
===`,
      };
    }

    // Check for cached manifest description
    const cachedDesc = this.stateStore.getManifestDescription();
    if (cachedDesc && !this.stateStore.isManifestStale(this.MANIFEST_CACHE_TTL_MS)) {
      return { dynamic: true, value: cachedDesc };
    }

    // Generate summary without async (for dynamic description)
    // Full manifest generation happens in background
    const itemCount = Object.keys(state.items).length;
    const edgeCount = state.edges.length;
    const ageDays = Math.floor((Date.now() - state.born) / (24 * 60 * 60 * 1000));

    // Quick stats
    const types = new Map<string, number>();
    const recentItems: MemoryItem[] = [];
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    for (const item of Object.values(state.items)) {
      types.set(item.type, (types.get(item.type) || 0) + 1);
      if (now - item.createdAt < dayMs) {
        recentItems.push(item);
      }
    }

    const typeBreakdown = Array.from(types.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([t, c]) => `${t}: ${c}`)
      .join(", ");

    const recentSection = recentItems.length > 0
      ? recentItems
          .sort((a, b) => b.createdAt - a.createdAt)
          .slice(0, 3)
          .map((i) => `  ${i.type.padEnd(10)} ${i.text.slice(0, 60)}...`)
          .join("\n")
      : "  (no recent memories)";

    // If manifest exists, include themes
    const manifest = this.stateStore.getManifest();
    let themesSection = "";
    if (manifest && manifest.communities.size > 0) {
      const themes = Array.from(manifest.communities.values())
        .sort((a, b) => b.importance - a.importance)
        .slice(0, 5)
        .map((c, i) => `${i + 1}. ${c.summary} (${c.nodes.size} items, imp: ${c.importance.toFixed(2)})`)
        .join("\n");
      themesSection = `\nThemes:\n${themes}\n`;
    }

    return {
      dynamic: true,
      value: `Memory status.

=== harmony ===
Age: ${ageDays} days | ${itemCount} items | ${edgeCount} edges
Types: ${typeBreakdown}
${themesSection}
Recent:
${recentSection}

Query: use (recall "query") for spreading activation search
Store: use (remember "text" "type" ["tags"]) to add memories
===`,
    };
  }

  // ============================================================================
  // Manifest Generation (background, following periphery pattern)
  // ============================================================================

  private async ensureManifest(): Promise<void> {
    if (!this.stateStore.isManifestStale(this.MANIFEST_CACHE_TTL_MS)) {
      return;
    }

    const state = this.stateStore.getState();
    if (!state || Object.keys(state.items).length === 0) {
      return;
    }

    try {
      const items = Object.values(state.items);
      const associations = state.edges.map((e) => ({
        fromId: e.from,
        toId: e.to,
        relation: e.relation,
        weight: e.weight,
      }));

      const manifest = await this.manifestGenerator.generateManifest(items, associations);
      const description = this.manifestGenerator.formatDescription(manifest);

      this.stateStore.setManifest(manifest, description);
    } catch (error) {
      console.error("[MemoryToolInteraction] Manifest generation failed:", error);
    }
  }

  // ============================================================================
  // Function Registration (S-expression interface)
  // ============================================================================

  protected registerFunctions(): void {
    // status - dynamic description IS the primary value
    this.registerFunction(
      "status",
      () => this.generateDynamicDescription(),
      [],
      async () => {
        await this.ensureState();
        await this.ensureManifest();
        const state = this.stateStore.getState();
        if (!state) return { initialized: false };

        return {
          id: state.id,
          born: state.born,
          age_days: Math.floor((Date.now() - state.born) / (24 * 60 * 60 * 1000)),
          items: Object.keys(state.items).length,
          edges: state.edges.length,
          energy: state.energy,
          manifest_cached: !this.stateStore.isManifestStale(this.MANIFEST_CACHE_TTL_MS),
        };
      }
    );

    // recall - spreading activation search
    this.registerFunction(
      "recall",
      () => this.getRecallDescription(),
      [
        z.string().describe("Query text for semantic search"),
        z.number().optional().describe("Max results (default 10)"),
        z.string().optional().describe("Scope filter"),
      ],
      async (query: string, limit = 10, scope?: string) => {
        return this.recall(query, limit, scope);
      }
    );

    // remember - store new memory
    this.registerFunction(
      "remember",
      "Store a new memory item. Returns the created item ID.",
      [
        z.string().describe("Memory text content"),
        z.string().describe("Type: event|fact|plan|reflection|entity|principle|technique|warning|workflow|bridge|pattern|insight"),
        z.array(z.string()).optional().describe("Tags for categorization"),
        z.number().optional().describe("Importance 0-1 (default 0.5)"),
        z.string().optional().describe("Scope (agent name or empty)"),
      ],
      async (text: string, type: string, tags?: string[], importance = 0.5, scope?: string) => {
        return this.remember(text, type as any, tags || [], importance, scope);
      }
    );

    // connect - create edge between memories
    this.registerFunction(
      "connect",
      "Create association between two memory items.",
      [
        z.string().describe("From memory ID"),
        z.string().describe("To memory ID"),
        z.string().describe("Relation type"),
        z.number().optional().describe("Weight 0-1 (default 0.5)"),
      ],
      async (from: string, to: string, relation: string, weight = 0.5) => {
        return this.connect(from, to, relation, weight);
      }
    );

    // themes - explicit manifest request
    this.registerFunction(
      "themes",
      () => ({ dynamic: true, value: "Get current thematic synthesis (regenerates if stale)" }),
      [],
      async () => {
        await this.ensureState();
        await this.ensureManifest();
        const manifest = this.stateStore.getManifest();
        if (!manifest) return "No memories yet - themes emerge after accumulation.";
        return this.stateStore.getManifestDescription() || "Manifest generation in progress...";
      }
    );

    // decay - apply energy decay
    this.registerFunction(
      "decay",
      "Apply energy decay to all memories. Returns count of decayed items.",
      [z.number().optional().describe("Half-life in days (default from policy)")],
      async (halfLifeDays?: number) => {
        return this.applyDecay(halfLifeDays);
      }
    );

    // refresh - force manifest regeneration
    this.registerFunction(
      "refresh",
      "Force manifest regeneration (clear cache and rebuild themes)",
      [],
      async () => {
        this.stateStore.invalidateManifest();
        await this.ensureState();
        await this.ensureManifest();
        return {
          regenerated: true,
          manifest_available: !!this.stateStore.getManifest(),
        };
      }
    );
  }

  private getRecallDescription(): { dynamic: true; value: string } {
    const manifest = this.stateStore.getManifest();
    const themes = manifest?.communities
      ? Array.from(manifest.communities.values())
          .sort((a, b) => b.importance - a.importance)
          .slice(0, 3)
          .map((c) => c.summary)
          .join(", ")
      : "no themes yet";

    return {
      dynamic: true,
      value: `Search memories using spreading activation. Current themes: ${themes}`,
    };
  }

  // ============================================================================
  // State Management
  // ============================================================================

  private async ensureState(): Promise<void> {
    if (this.stateStore.getState()) return;

    const store = this.stateStore.getStore();
    if (!store) throw new Error("Memory store not configured");

    let state = await store.load();
    if (!state) {
      state = {
        id: "harmony",
        born: Date.now(),
        energy: 0,
        threshold: 100,
        items: {},
        edges: [],
        history: [],
        policy: DEFAULT_POLICY,
        policyVersions: [],
        recentSessions: [],
      };
    }

    this.stateStore.setState(state);
  }

  private async saveState(): Promise<void> {
    const store = this.stateStore.getStore();
    const state = this.stateStore.getState();
    if (store && state) {
      await store.save(state);
    }
  }

  // ============================================================================
  // Memory Operations
  // ============================================================================

  private async recall(query: string, limit: number, scope?: string): Promise<any[]> {
    await this.ensureState();
    const state = this.stateStore.getState();
    if (!state) return [];

    // Simple keyword matching for seeds
    const queryWords = query.toLowerCase().split(/\s+/);
    const seeds: ActivationMap = {};

    for (const [id, item] of Object.entries(state.items)) {
      if (scope && item.scope !== scope) continue;

      const text = item.text.toLowerCase();
      const tags = item.tags.map((t) => t.toLowerCase());
      let match = 0;

      for (const word of queryWords) {
        if (text.includes(word)) match += 0.3;
        if (tags.some((t) => t.includes(word))) match += 0.5;
      }

      if (match > 0) {
        seeds[id] = Math.min(1, match);
      }
    }

    // Run spreading activation
    const activation = runSpreadingActivation(state, seeds, {
      steps: state.policy?.activationSteps || 3,
      decay: state.policy?.activationDecay || 0.85,
      threshold: state.policy?.activationThreshold || 0.2,
    });

    // Rank and return
    const ranked = Object.entries(activation)
      .filter(([_, score]) => score > 0)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([id, score]) => {
        const item = state.items[id];
        return {
          id,
          score,
          type: item.type,
          text: item.text.slice(0, 200),
          tags: item.tags,
          importance: item.importance,
        };
      });

    // Record session
    state.history.push({
      t: Date.now(),
      op: "recall",
      args: { query, limit, scope, results: ranked.length },
    });

    await this.saveState();
    return ranked;
  }

  private async remember(
    text: string,
    type: MemoryItem["type"],
    tags: string[],
    importance: number,
    scope?: string
  ): Promise<string> {
    await this.ensureState();
    const state = this.stateStore.getState();
    if (!state) throw new Error("Failed to initialize state");

    const id = `m_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
    const now = Date.now();

    const item: MemoryItem = {
      id,
      type,
      text,
      tags,
      importance: Math.max(0, Math.min(1, importance)),
      energy: importance,
      createdAt: now,
      updatedAt: now,
      scope,
    };

    state.items[id] = item;
    state.history.push({
      t: now,
      op: "remember",
      args: { id, type, tags },
    });

    // Invalidate manifest cache (themes may change)
    this.stateStore.invalidateManifest();

    await this.saveState();
    return id;
  }

  private async connect(from: string, to: string, relation: string, weight: number): Promise<boolean> {
    await this.ensureState();
    const state = this.stateStore.getState();
    if (!state) return false;

    if (!state.items[from] || !state.items[to]) {
      return false;
    }

    const edge: MemoryEdge = {
      from,
      to,
      relation,
      weight: Math.max(0, Math.min(1, weight)),
      lastReinforcedAt: Date.now(),
    };

    const existing = state.edges.findIndex((e) => e.from === from && e.to === to && e.relation === relation);

    if (existing >= 0) {
      state.edges[existing].weight = Math.min(1, state.edges[existing].weight + weight * 0.1);
      state.edges[existing].lastReinforcedAt = Date.now();
    } else {
      state.edges.push(edge);
    }

    state.history.push({
      t: Date.now(),
      op: "connect",
      args: { from, to, relation },
    });

    // Invalidate manifest cache
    this.stateStore.invalidateManifest();

    await this.saveState();
    return true;
  }

  private async applyDecay(halfLifeDays?: number): Promise<number> {
    await this.ensureState();
    const state = this.stateStore.getState();
    if (!state) return 0;

    const halfLife = halfLifeDays || state.policy?.halfLifeDays || 7;
    const halfLifeMs = halfLife * 24 * 60 * 60 * 1000;
    const now = Date.now();
    let decayed = 0;

    for (const item of Object.values(state.items)) {
      const age = now - item.updatedAt;
      const decayFactor = Math.pow(0.5, age / halfLifeMs);
      const newEnergy = item.energy * decayFactor;

      if (newEnergy !== item.energy) {
        item.energy = Math.max(0, newEnergy);
        decayed++;
      }
    }

    for (const edge of state.edges) {
      const age = now - edge.lastReinforcedAt;
      const decayFactor = Math.pow(0.5, age / halfLifeMs);
      edge.weight = Math.max(state.policy?.edgeWeightFloor || 0.01, edge.weight * decayFactor);
    }

    state.history.push({
      t: now,
      op: "decay",
      args: { halfLifeDays: halfLife, decayed },
    });

    await this.saveState();
    return decayed;
  }
}
