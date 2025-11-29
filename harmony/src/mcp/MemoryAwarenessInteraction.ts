/**
 * MemoryAwarenessInteraction - "Memory about memory" in tool description
 *
 * V's core insight (July 31, 2025):
 * "в самом описании тула надо выводить краткую сводку содержания памяти...
 *  чтобы в 1000-2000 токенов влезла 'память о памяти'"
 *
 * This tool's description IS the value. Claude sees thematic landscape BEFORE any query.
 */

import { DiscoveryToolInteraction } from "@here.build/arrival-mcp";
import * as z from "zod";
import {
  ManifestGenerator,
  type GraphManifest,
  type MemoryStore,
  type MemoryState,
  DEFAULT_POLICY,
} from "../memory/index.js";

// ============================================================================
// Shared State - Singleton across tools
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

  async ensureState(): Promise<MemoryState> {
    if (this.state) return this.state;

    const store = this.store;
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

    this.state = state;
    return state;
  }

  async saveState(): Promise<void> {
    const store = this.store;
    const state = this.state;
    if (store && state) {
      await store.save(state);
    }
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
// MemoryAwarenessInteraction - THE KEY: manifest in description
// ============================================================================

interface AwarenessExecutionContext {
  expr: string;
}

export class MemoryAwarenessInteraction extends DiscoveryToolInteraction<AwarenessExecutionContext> {
  static readonly name = "MemoryAwarenessInteraction";
  readonly toolName = "harmony";
  readonly toolSummary = "Memory thematic awareness - see what you know";

  private stateStore = MemoryStateStore.getInstance();
  private manifestGenerator: ManifestGenerator;
  private readonly MANIFEST_CACHE_TTL_MS = 60_000; // 60 seconds

  constructor(
    context: any,
    state: Record<string, any> = {},
    executionContext?: AwarenessExecutionContext,
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
  // THE KEY: Dynamic description IS the value
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

    // Use cached manifest description if available
    const cachedDesc = this.stateStore.getManifestDescription();
    if (cachedDesc && !this.stateStore.isManifestStale(this.MANIFEST_CACHE_TTL_MS)) {
      return { dynamic: true, value: cachedDesc };
    }

    // Generate quick summary without full manifest
    const itemCount = Object.keys(state.items).length;
    const edgeCount = state.edges.length;

    // Quick stats
    const types = new Map<string, number>();
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    let emergingCount = 0;
    let activeCount = 0;
    let stableCount = 0;

    for (const item of Object.values(state.items)) {
      types.set(item.type, (types.get(item.type) || 0) + 1);
      const age = now - item.createdAt;
      if (age < dayMs) emergingCount++;
      else if (age < 7 * dayMs) activeCount++;
      else if (age > 30 * dayMs) stableCount++;
    }

    // If manifest exists, include themes
    const manifest = this.stateStore.getManifest();
    let themesSection = "";
    if (manifest && manifest.communities.size > 0) {
      const themes = Array.from(manifest.communities.values())
        .sort((a, b) => b.importance - a.importance)
        .slice(0, 5)
        .map((c) => `  ${c.summary} (importance: ${c.importance.toFixed(2)})`)
        .join("\n");
      themesSection = `\nTop Themes:\n${themes}\n`;
    }

    // Key nodes by importance
    const keyNodes = Object.values(state.items)
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 5)
      .map((item) => `  ${item.text.slice(0, 50)}... (importance: ${item.importance.toFixed(2)})`)
      .join("\n");

    // Compute simple topology
    const avgDegree = edgeCount > 0 ? (edgeCount * 2 / itemCount).toFixed(1) : "0";
    const density = itemCount > 1 ? (edgeCount / (itemCount * (itemCount - 1) / 2)).toFixed(3) : "0.000";

    return {
      dynamic: true,
      value: `Memory status.

=== ${state.id.toUpperCase()} ===
Generated: ${new Date().toLocaleString()}
${itemCount} items | ${edgeCount} edges | density ${density}
${themesSection}
Temporal State:
  Emerging: ${emergingCount} items (last 24h)
  Active: ${activeCount} items (last 7d)
  Stable: ${stableCount} items (>30d unchanged)
  Decaying: ${Object.values(state.items).filter(i => i.energy < 0.3).length} items (low energy)

Key Nodes:
${keyNodes}

Topology:
  Modularity: ${manifest?.topology?.modularity?.toFixed(3) ?? "0.000"} (${(manifest?.topology?.modularity ?? 0) > 0.4 ? "well-connected" : "loosely connected"})
  Avg degree: ${avgDegree}
  Communities: ${manifest?.communities?.size ?? 0}
  Bridges: ${manifest?.bridges?.length ?? 0} cross-community connections
===`,
    };
  }

  // ============================================================================
  // Manifest Generation (background)
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
      console.error("[MemoryAwarenessInteraction] Manifest generation failed:", error);
    }
  }

  // ============================================================================
  // Minimal Functions - description is primary
  // ============================================================================

  protected registerFunctions(): void {
    // status - THE dynamic description generator
    this.registerFunction(
      "status",
      () => this.generateDynamicDescription(),
      [],
      async () => {
        await this.stateStore.ensureState();
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

    // themes - explicit manifest request
    this.registerFunction(
      "themes",
      () => ({ dynamic: true, value: "Get current thematic synthesis (regenerates if stale)" }),
      [],
      async () => {
        await this.stateStore.ensureState();
        await this.ensureManifest();
        const manifest = this.stateStore.getManifest();
        if (!manifest) return "No memories yet - themes emerge after accumulation.";
        return this.stateStore.getManifestDescription() || "Manifest generation in progress...";
      }
    );

    // refresh - force manifest regeneration
    this.registerFunction(
      "refresh",
      "Force manifest regeneration (clear cache and rebuild themes)",
      [],
      async () => {
        this.stateStore.invalidateManifest();
        await this.stateStore.ensureState();
        await this.ensureManifest();
        return {
          regenerated: true,
          manifest_available: !!this.stateStore.getManifest(),
        };
      }
    );
  }
}
