import type { MemoryState, MemoryItem } from "./types";
import { runSpreadingActivation } from "./engine/SpreadingActivationEngine";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

interface WorkingMemory {
  current_task: string;
  current_files: string[];
  failed_approaches: string[];
  last_success: string;
  last_error: string;
  patterns_learned: string[]; // vessel:m_xxx IDs
  execution_trace: string[];
  timestamp: number;
}

/**
 * Bootstrap context for session startup.
 * Uses .working-memory.json patterns_learned as seeds for spreading activation.
 * Returns memories relevant to recent work.
 */
export async function bootstrapContext(
  state: MemoryState,
  projectId?: string
): Promise<MemoryItem[]> {
  // 1. Read working memory from user's home directory
  const workingMemoryPath = path.join(process.cwd(), ".working-memory.json");

  let workingMemory: WorkingMemory | null = null;
  try {
    if (fs.existsSync(workingMemoryPath)) {
      const content = fs.readFileSync(workingMemoryPath, "utf-8");
      workingMemory = JSON.parse(content);
      console.log(`[BootstrapContext] Loaded working memory with ${workingMemory?.patterns_learned?.length || 0} patterns`);
    } else {
      console.log("[BootstrapContext] No working memory file found");
      return [];
    }
  } catch (err) {
    console.warn("[BootstrapContext] Failed to load working memory:", err);
    return [];
  }

  if (!workingMemory || !workingMemory.patterns_learned || workingMemory.patterns_learned.length === 0) {
    console.log("[BootstrapContext] No patterns in working memory");
    return [];
  }

  // 2. Parse vessel: prefixed IDs
  const seedIds = workingMemory.patterns_learned
    .map(p => p.replace("vessel:", ""))
    .filter(id => id.startsWith("m_") && state.items[id]);

  console.log(`[BootstrapContext] Found ${seedIds.length} valid seed IDs from working memory`);

  if (seedIds.length === 0) {
    return [];
  }

  // 3. Filter by project if specified
  const projectFilteredSeeds = projectId
    ? seedIds.filter(id => {
        const item = state.items[id];
        return item && (!item.scope || item.scope === projectId);
      })
    : seedIds;

  console.log(`[BootstrapContext] ${projectFilteredSeeds.length} seeds after project filter`);

  if (projectFilteredSeeds.length === 0) {
    return [];
  }

  // 4. Build seed activation map (all seeds start with 1.0 activation)
  const seeds: Record<string, number> = {};
  for (const id of projectFilteredSeeds) {
    seeds[id] = 1.0;
  }

  // 5. Run spreading activation
  const activation = runSpreadingActivation(
    state,
    seeds,
    {
      steps: 2,           // 2-hop neighbors
      decay: 0.85,        // High retention
      threshold: 0.1      // Include items with >0.1 activation
    }
  );

  // 6. Rank by activation + recency boost
  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;

  const ranked = Object.entries(activation)
    // Only consider items that were actually activated (above threshold)
    .filter(([id, act]) => act > 0.1)
    // Apply project filter if specified
    .filter(([id]) => {
      if (!projectId) return true;
      const item = state.items[id];
      return item && (!item.scope || item.scope === projectId);
    })
    .map(([id, act]) => {
      const item = state.items[id];
      if (!item) return null;

      // Recency score: 1.0 for today, decays over 30 days
      const age = now - (item.lastAccessedAt || item.updatedAt || item.createdAt);
      const recency = Math.max(0, 1 - (age / (30 * DAY_MS)));

      // Combined score: 70% activation, 30% recency
      const score = act * 0.7 + recency * 0.3;

      return { item, score, activation: act, recency };
    })
    .filter(r => r !== null)
    .sort((a, b) => b!.score - a!.score)
    .slice(0, 10);

  console.log(`[BootstrapContext] Returning ${ranked.length} context items`);
  console.log(`[BootstrapContext] Top 3 scores:`, ranked.slice(0, 3).map(r => ({
    id: r!.item.id,
    score: r!.score.toFixed(3),
    act: r!.activation.toFixed(3),
    rec: r!.recency.toFixed(3)
  })));

  return ranked.map(r => r!.item);
}
