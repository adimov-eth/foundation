import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { bootstrapContext } from "./BootstrapContext";
import type { MemoryState, MemoryItem } from "./types";
import * as fs from "fs";
import * as path from "path";

describe("BootstrapContext", () => {
  let state: MemoryState;
  const workingMemoryPath = path.join(process.cwd(), ".working-memory.json");
  let workingMemoryBackup: string | null = null;

  beforeEach(() => {
    const now = Date.now();

    // Backup existing working memory if it exists
    if (fs.existsSync(workingMemoryPath)) {
      workingMemoryBackup = fs.readFileSync(workingMemoryPath, "utf-8");
    }

    // Create test memory state with realistic items
    state = {
      id: "test",
      born: now,
      energy: 0,
      threshold: 100,
      items: {
        m_recent1: {
          id: "m_recent1",
          text: "Implemented theme synthesis with Louvain",
          type: "achievement",
          tags: ["theme-synthesis", "louvain", "2025-10-16"],
          importance: 0.9,
          energy: 0.6,
          ttl: "90d",
          createdAt: now - 3600000, // 1 hour ago
          updatedAt: now - 1800000, // 30 min ago
          accessCount: 5
        },
        m_recent2: {
          id: "m_recent2",
          text: "Bootstrap context from working memory patterns",
          type: "feature",
          tags: ["bootstrap", "continuity", "2025-10-16"],
          importance: 0.85,
          energy: 0.5,
          ttl: "90d",
          createdAt: now - 7200000, // 2 hours ago
          updatedAt: now - 3600000, // 1 hour ago
          accessCount: 3
        },
        m_old1: {
          id: "m_old1",
          text: "Agent orchestration pattern exploration",
          type: "research",
          tags: ["agents", "orchestration", "2025-10-08"],
          importance: 0.7,
          energy: 0.3,
          ttl: "60d",
          createdAt: now - 604800000, // 7 days ago
          updatedAt: now - 604800000,
          accessCount: 10
        },
        m_old2: {
          id: "m_old2",
          text: "Self-critic detected helper mode patterns",
          type: "insight",
          tags: ["self-critic", "helper-mode", "2025-10-08"],
          importance: 0.75,
          energy: 0.2,
          ttl: "60d",
          createdAt: now - 691200000, // 8 days ago
          updatedAt: now - 691200000,
          accessCount: 8
        },
        m_connected1: {
          id: "m_connected1",
          text: "Related pattern to theme synthesis",
          type: "pattern",
          tags: ["themes", "synthesis"],
          importance: 0.6,
          energy: 0.4,
          ttl: "30d",
          createdAt: now - 86400000, // 1 day ago
          updatedAt: now - 86400000,
          accessCount: 2
        },
        m_isolated: {
          id: "m_isolated",
          text: "Unrelated experimental feature",
          type: "experiment",
          tags: ["experimental"],
          importance: 0.3,
          energy: 0.1,
          ttl: "7d",
          createdAt: now - 1209600000, // 14 days ago
          updatedAt: now - 1209600000,
          accessCount: 1
        }
      },
      edges: [
        // Recent items connected
        { from: "m_recent1", to: "m_connected1", relation: "relates-to", weight: 0.7, lastReinforcedAt: now },
        { from: "m_recent2", to: "m_recent1", relation: "builds-on", weight: 0.6, lastReinforcedAt: now },
        { from: "m_connected1", to: "m_recent2", relation: "relates-to", weight: 0.5, lastReinforcedAt: now },

        // Old items connected
        { from: "m_old1", to: "m_old2", relation: "relates-to", weight: 0.8, lastReinforcedAt: now - 604800000 },

        // Bridge between old and recent
        { from: "m_old1", to: "m_recent1", relation: "evolves-to", weight: 0.4, lastReinforcedAt: now }
      ],
      history: [],
      policy: undefined,
      policyVersions: [],
      recentSessions: []
    };
  });

  afterEach(() => {
    // Restore backup if it existed
    if (workingMemoryBackup !== null) {
      fs.writeFileSync(workingMemoryPath, workingMemoryBackup, "utf-8");
    } else if (fs.existsSync(workingMemoryPath)) {
      fs.unlinkSync(workingMemoryPath);
    }
  });

  describe("with valid working memory", () => {
    beforeEach(() => {
      // Create working memory file with patterns_learned
      const workingMemory = {
        current_task: "Implementing theme synthesis",
        current_files: ["ManifestGenerator.ts", "BootstrapContext.ts"],
        failed_approaches: [],
        last_success: "Theme generation working",
        last_error: "",
        patterns_learned: [
          "vessel:m_recent1",
          "vessel:m_recent2",
          "vessel:m_old1"
        ],
        execution_trace: ["Implemented Louvain", "Added bootstrap"],
        timestamp: Date.now()
      };

      fs.writeFileSync(workingMemoryPath, JSON.stringify(workingMemory, null, 2), "utf-8");
    });

    it("should return context from working memory seeds", async () => {
      const context = await bootstrapContext(state);

      expect(context.length).toBeGreaterThan(0);
      expect(context.length).toBeLessThanOrEqual(10);
    });

    it("should prioritize recent items from seeds", async () => {
      const context = await bootstrapContext(state);

      // Top results should include recent seeds
      const topIds = context.slice(0, 3).map(item => item.id);

      // Should include at least one recent seed
      const hasRecentSeed = topIds.some(id => ["m_recent1", "m_recent2"].includes(id));
      expect(hasRecentSeed).toBe(true);
    });

    it("should use spreading activation from seeds", async () => {
      const context = await bootstrapContext(state);

      const contextIds = context.map(item => item.id);

      // Should include seed items
      expect(contextIds).toContain("m_recent1");
      expect(contextIds).toContain("m_recent2");

      // Should include connected items via spreading activation
      expect(contextIds).toContain("m_connected1");
    });

    it("should combine activation and recency in scoring", async () => {
      const context = await bootstrapContext(state);

      // Recent items should rank higher than old items even if old items have higher importance
      const recentIndex = context.findIndex(item => item.id === "m_recent1");
      const oldIndex = context.findIndex(item => item.id === "m_old1");

      // m_recent1 (importance 0.9, 1h ago) should rank higher than
      // m_old1 (importance 0.7, 7d ago) due to recency
      expect(recentIndex).toBeLessThan(oldIndex);
    });

    it("should limit results to top 10", async () => {
      const context = await bootstrapContext(state);

      expect(context.length).toBeLessThanOrEqual(10);
    });

    it("should not include isolated nodes without activation", async () => {
      const context = await bootstrapContext(state);

      const contextIds = context.map(item => item.id);

      // Isolated item not in seeds and not connected should not appear
      expect(contextIds).not.toContain("m_isolated");
    });
  });

  describe("with no working memory", () => {
    it("should return empty array when no working memory file", async () => {
      // Ensure no working memory file exists
      if (fs.existsSync(workingMemoryPath)) {
        fs.unlinkSync(workingMemoryPath);
      }

      const context = await bootstrapContext(state);

      expect(context).toEqual([]);
    });

    it("should return empty array when working memory has no patterns", async () => {
      const workingMemory = {
        current_task: "Testing",
        current_files: [],
        failed_approaches: [],
        last_success: "",
        last_error: "",
        patterns_learned: [], // Empty patterns
        execution_trace: [],
        timestamp: Date.now()
      };

      fs.writeFileSync(workingMemoryPath, JSON.stringify(workingMemory), "utf-8");

      const context = await bootstrapContext(state);

      expect(context).toEqual([]);
    });
  });

  describe("with invalid working memory", () => {
    it("should handle malformed JSON gracefully", async () => {
      fs.writeFileSync(workingMemoryPath, "{ invalid json", "utf-8");

      const context = await bootstrapContext(state);

      expect(context).toEqual([]);
    });

    it("should handle missing patterns_learned field", async () => {
      const workingMemory = {
        current_task: "Testing",
        timestamp: Date.now()
        // No patterns_learned field
      };

      fs.writeFileSync(workingMemoryPath, JSON.stringify(workingMemory), "utf-8");

      const context = await bootstrapContext(state);

      expect(context).toEqual([]);
    });

    it("should filter out invalid memory IDs", async () => {
      const workingMemory = {
        current_task: "Testing",
        patterns_learned: [
          "vessel:m_recent1",
          "vessel:invalid_id", // Not in state
          "vessel:m_nonexistent", // Not in state
          "vessel:m_recent2"
        ],
        timestamp: Date.now()
      };

      fs.writeFileSync(workingMemoryPath, JSON.stringify(workingMemory), "utf-8");

      const context = await bootstrapContext(state);

      // Should still work with valid IDs only
      expect(context.length).toBeGreaterThan(0);

      const contextIds = context.map(item => item.id);
      expect(contextIds).toContain("m_recent1");
      expect(contextIds).toContain("m_recent2");
    });
  });

  describe("spreading activation parameters", () => {
    beforeEach(() => {
      const workingMemory = {
        patterns_learned: ["vessel:m_recent1"],
        timestamp: Date.now()
      };
      fs.writeFileSync(workingMemoryPath, JSON.stringify(workingMemory), "utf-8");
    });

    it("should use 2-hop spreading activation", async () => {
      const context = await bootstrapContext(state);

      const contextIds = context.map(item => item.id);

      // Should reach 2-hop neighbors:
      // m_recent1 -> m_connected1 (1-hop)
      // m_connected1 -> m_recent2 (2-hop from m_recent1)
      expect(contextIds).toContain("m_recent1"); // seed
      expect(contextIds).toContain("m_connected1"); // 1-hop
      expect(contextIds).toContain("m_recent2"); // 2-hop
    });

    it("should apply 70/30 activation/recency weighting", async () => {
      const context = await bootstrapContext(state);

      // This is tested indirectly by checking that recent items
      // rank higher than old items with similar activation
      expect(context.length).toBeGreaterThan(0);

      // Recent items should dominate top results
      const topHalf = context.slice(0, Math.ceil(context.length / 2));
      const recentCount = topHalf.filter(item =>
        item.id.startsWith("m_recent") || item.id === "m_connected1"
      ).length;

      // Majority of top results should be recent
      expect(recentCount).toBeGreaterThan(topHalf.length / 2);
    });
  });

  describe("project scoping", () => {
    beforeEach(() => {
      // Add scope to some items
      state.items.m_recent1.scope = "project_a";
      state.items.m_recent2.scope = "project_a";
      state.items.m_old1.scope = "project_b";

      const workingMemory = {
        patterns_learned: ["vessel:m_recent1", "vessel:m_recent2", "vessel:m_old1"],
        timestamp: Date.now()
      };
      fs.writeFileSync(workingMemoryPath, JSON.stringify(workingMemory), "utf-8");
    });

    it("should filter by project ID when specified", async () => {
      const context = await bootstrapContext(state, "project_a");

      const contextIds = context.map(item => item.id);

      // Should include project_a items
      expect(contextIds).toContain("m_recent1");
      expect(contextIds).toContain("m_recent2");

      // Should NOT include project_b items
      expect(contextIds).not.toContain("m_old1");
    });

    it("should include all projects when no project specified", async () => {
      const context = await bootstrapContext(state);

      const contextIds = context.map(item => item.id);

      // Should include items from all projects
      expect(contextIds.some(id => state.items[id]?.scope === "project_a")).toBe(true);
      expect(contextIds.some(id => state.items[id]?.scope === "project_b")).toBe(true);
    });
  });

  describe("real-world scenario", () => {
    it("should provide useful startup context", async () => {
      // Simulate real working memory from PreCompact hook
      const workingMemory = {
        current_task: "Implementing Part 2 - Theme synthesis with meta-awareness",
        current_files: [
          "packages/vessel/src/tools/memory/manifest/ManifestGenerator.ts",
          "packages/vessel/src/tools/memory/BootstrapContext.ts",
          "spec/spec.md"
        ],
        failed_approaches: [
          "Tried manual theme naming - too subjective",
          "Considered GPT-4o-mini - went with Anthropic for consistency"
        ],
        last_success: "Louvain community detection integrated with LLM theme naming",
        last_error: "",
        patterns_learned: [
          "vessel:m_recent1", // Theme synthesis implementation
          "vessel:m_recent2"  // Bootstrap context feature
        ],
        execution_trace: [
          "[2025-10-16] Implemented ManifestGenerator with Louvain",
          "[2025-10-16] Added Anthropic API integration for theme naming",
          "[2025-10-16] Created BootstrapContext for session continuity"
        ],
        timestamp: Date.now()
      };

      fs.writeFileSync(workingMemoryPath, JSON.stringify(workingMemory, null, 2), "utf-8");

      const context = await bootstrapContext(state);

      // Should return relevant context
      expect(context.length).toBeGreaterThan(0);

      // Top results should relate to recent work
      const topItem = context[0];
      expect(topItem.tags.some(tag =>
        tag.includes("theme") ||
        tag.includes("bootstrap") ||
        tag.includes("2025-10-16")
      )).toBe(true);

      // Should help user understand "what were we working on?"
      const contextTexts = context.map(item => item.text).join(" ");
      expect(contextTexts).toMatch(/theme|synthesis|bootstrap|continuity/i);
    });
  });
});
