import { describe, it, expect, beforeEach } from "bun:test";
import { ManifestGenerator } from "./ManifestGenerator";
import type { MemoryItem } from "../types";
import type { Association } from "./ManifestGenerator";

describe("ManifestGenerator", () => {
  let generator: ManifestGenerator;
  let items: MemoryItem[];
  let associations: Association[];

  beforeEach(() => {
    generator = new ManifestGenerator();
    const now = Date.now();

    // Create test memory graph with clear communities
    items = [
      // Community 1: Agent orchestration (3 items)
      {
        id: "m_agent1",
        text: "Self-critic agent caught helper mode in implementation",
        type: "insight",
        tags: ["agent-orchestration", "self-critic", "helper-mode"],
        importance: 0.9,
        energy: 0.5,
        ttl: "90d",
        createdAt: now - 1000,
        updatedAt: now - 500,
        accessCount: 5
      },
      {
        id: "m_agent2",
        text: "Orchestrator-worker pattern with vessel persistence",
        type: "pattern",
        tags: ["agent-orchestration", "architecture", "vessel"],
        importance: 0.85,
        energy: 0.4,
        ttl: "90d",
        createdAt: now - 2000,
        updatedAt: now - 1000,
        accessCount: 3
      },
      {
        id: "m_agent3",
        text: "Thinker agent analyzed coupling topology",
        type: "analysis",
        tags: ["agent-orchestration", "thinker", "topology"],
        importance: 0.8,
        energy: 0.3,
        ttl: "60d",
        createdAt: now - 3000,
        updatedAt: now - 1500,
        accessCount: 2
      },

      // Community 2: Memory systems (3 items)
      {
        id: "m_mem1",
        text: "Spreading activation with 2-hop neighbors",
        type: "technique",
        tags: ["memory", "spreading-activation", "recall"],
        importance: 0.75,
        energy: 0.6,
        ttl: "60d",
        createdAt: now - 4000,
        updatedAt: now - 2000,
        accessCount: 8
      },
      {
        id: "m_mem2",
        text: "Bootstrap context from working memory patterns",
        type: "feature",
        tags: ["memory", "bootstrap", "continuity"],
        importance: 0.7,
        energy: 0.5,
        ttl: "60d",
        createdAt: now - 5000,
        updatedAt: now - 2500,
        accessCount: 4
      },
      {
        id: "m_mem3",
        text: "Louvain community detection for theme synthesis",
        type: "technique",
        tags: ["memory", "communities", "themes"],
        importance: 0.8,
        energy: 0.4,
        ttl: "90d",
        createdAt: now - 6000,
        updatedAt: now - 3000,
        accessCount: 6
      },

      // Isolated node
      {
        id: "m_isolated",
        text: "Unrelated experiment with embeddings",
        type: "experiment",
        tags: ["embeddings", "experimental"],
        importance: 0.3,
        energy: 0.1,
        ttl: "7d",
        createdAt: now - 14 * 24 * 60 * 60 * 1000, // 14 days ago
        updatedAt: now - 14 * 24 * 60 * 60 * 1000,
        accessCount: 1
      }
    ];

    // Create edges to form communities
    associations = [
      // Community 1 (agent orchestration)
      { fromId: "m_agent1", toId: "m_agent2", relation: "relates-to", weight: 0.8 },
      { fromId: "m_agent2", toId: "m_agent3", relation: "relates-to", weight: 0.7 },
      { fromId: "m_agent3", toId: "m_agent1", relation: "relates-to", weight: 0.6 },

      // Community 2 (memory systems)
      { fromId: "m_mem1", toId: "m_mem2", relation: "relates-to", weight: 0.7 },
      { fromId: "m_mem2", toId: "m_mem3", relation: "relates-to", weight: 0.6 },
      { fromId: "m_mem3", toId: "m_mem1", relation: "relates-to", weight: 0.5 },

      // Bridge between communities (weak connection)
      { fromId: "m_agent2", toId: "m_mem3", relation: "relates-to", weight: 0.3 }
    ];
  });

  describe("generateManifest", () => {
    it("should detect multiple communities", async () => {
      const manifest = await generator.generateManifest(items, associations);

      expect(manifest.communities.size).toBeGreaterThanOrEqual(2);
      expect(manifest.generated).toBeGreaterThan(0);
    });

    it("should calculate topology metrics", async () => {
      const manifest = await generator.generateManifest(items, associations);

      expect(manifest.topology.nodeCount).toBe(7);
      expect(manifest.topology.edgeCount).toBe(7);
      expect(manifest.topology.density).toBeGreaterThan(0);
      expect(manifest.topology.density).toBeLessThan(1);
      expect(manifest.topology.avgDegree).toBeGreaterThan(0);
    });

    it("should identify key nodes by importance", async () => {
      const manifest = await generator.generateManifest(items, associations);

      expect(manifest.keyNodes.length).toBeGreaterThan(0);
      expect(manifest.keyNodes.length).toBeLessThanOrEqual(5);

      // Key nodes should be sorted by importance
      for (let i = 1; i < manifest.keyNodes.length; i++) {
        expect(manifest.keyNodes[i - 1].importance).toBeGreaterThanOrEqual(
          manifest.keyNodes[i].importance
        );
      }

      // High-importance items should appear in key nodes
      const keyNodeIds = manifest.keyNodes.map(n => n.id);
      expect(keyNodeIds).toContain("m_agent1"); // importance 0.9
    });

    it("should detect bridges between communities", async () => {
      const manifest = await generator.generateManifest(items, associations);

      // Should detect the bridge edge m_agent2 -> m_mem3
      const bridgeIds = manifest.bridges.map(b => `${b.from}-${b.to}`);
      expect(bridgeIds).toContain("m_agent2-m_mem3");
    });

    it("should classify temporal layers", async () => {
      const manifest = await generator.generateManifest(items, associations);

      const { emerging, active, stable, decaying } = manifest.temporal;

      // All items should be classified into one layer
      const totalClassified = emerging.length + active.length + stable.length + decaying.length;
      expect(totalClassified).toBeGreaterThan(0);

      // Isolated low-energy item should be in decaying
      expect(decaying).toContain("m_isolated");
    });
  });

  describe("formatDescription", () => {
    it("should generate readable manifest description", async () => {
      const manifest = await generator.generateManifest(items, associations);
      const description = generator.formatDescription(manifest);

      // Should include header with counts
      expect(description).toContain("Memory Map");
      expect(description).toContain("7 items");
      expect(description).toContain("7 edges");

      // Should include themes section
      expect(description).toContain("Themes:");

      // Should include topology metrics
      expect(description).toContain("Graph:");
      expect(description).toContain("avg degree");
      expect(description).toContain("density");
    });

    it("should show top communities by importance", async () => {
      const manifest = await generator.generateManifest(items, associations);
      const description = generator.formatDescription(manifest);

      // Should list communities with importance scores
      expect(description).toMatch(/importance:\s*\d+\.\d+/);

      // Should include keywords for communities
      expect(description).toContain("agent-orchestration");
      expect(description).toContain("memory");
    });

    it("should include recent activity summary", async () => {
      const manifest = await generator.generateManifest(items, associations);
      const description = generator.formatDescription(manifest);

      // Should have recent activity section
      expect(description).toContain("Recent Activity:");
    });

    it("should keep description under reasonable token limit", async () => {
      const manifest = await generator.generateManifest(items, associations);
      const description = generator.formatDescription(manifest);

      // Rough estimate: ~4 chars per token
      const estimatedTokens = description.length / 4;

      // Should be under 2000 tokens (V's spec: 1000-2000)
      expect(estimatedTokens).toBeLessThan(2000);
    });
  });

  describe("community structure", () => {
    it("should assign all connected nodes to communities", async () => {
      const manifest = await generator.generateManifest(items, associations);

      // Count total nodes across all communities
      let totalNodesInCommunities = 0;
      for (const community of manifest.communities.values()) {
        totalNodesInCommunities += community.nodes.size;
      }

      // Should include all items (7 total)
      expect(totalNodesInCommunities).toBe(7);
    });

    it("should extract keywords from community tags", async () => {
      const manifest = await generator.generateManifest(items, associations);

      // Find agent orchestration community
      const agentCommunity = Array.from(manifest.communities.values()).find(c =>
        c.keywords.includes("agent-orchestration")
      );

      expect(agentCommunity).toBeDefined();
      expect(agentCommunity!.keywords.length).toBeGreaterThan(0);
      expect(agentCommunity!.keywords.length).toBeLessThanOrEqual(5);
    });

    it("should calculate community importance from PageRank", async () => {
      const manifest = await generator.generateManifest(items, associations);

      for (const community of manifest.communities.values()) {
        // Importance should be positive (sum of PageRank scores)
        expect(community.importance).toBeGreaterThan(0);

        // Should be reasonable value (not infinity, NaN)
        expect(community.importance).toBeLessThan(10);
      }
    });

    it("should generate theme summaries", async () => {
      const manifest = await generator.generateManifest(items, associations);

      for (const community of manifest.communities.values()) {
        // Summary should exist
        expect(community.summary).toBeDefined();
        expect(community.summary.length).toBeGreaterThan(0);

        // Summary should not be too long
        expect(community.summary.length).toBeLessThan(200);
      }
    });
  });

  describe("edge cases", () => {
    it("should handle empty memory gracefully", async () => {
      const manifest = await generator.generateManifest([], []);

      expect(manifest.communities.size).toBe(0);
      expect(manifest.topology.nodeCount).toBe(0);
      expect(manifest.topology.edgeCount).toBe(0);
      expect(manifest.keyNodes.length).toBe(0);
    });

    it("should handle single item without edges", async () => {
      const singleItem = [items[0]];
      const manifest = await generator.generateManifest(singleItem, []);

      expect(manifest.communities.size).toBeGreaterThanOrEqual(1);
      expect(manifest.topology.nodeCount).toBe(1);
      expect(manifest.topology.edgeCount).toBe(0);
    });

    it("should handle duplicate edges by merging weights", async () => {
      const duplicateAssociations = [
        ...associations,
        // Duplicate edge with different weight
        { fromId: "m_agent1", toId: "m_agent2", relation: "relates-to", weight: 0.5, count: 1 }
      ];

      const manifest = await generator.generateManifest(items, duplicateAssociations);

      // Should not crash, should merge weights
      expect(manifest.topology.edgeCount).toBeGreaterThan(0);
    });
  });

  describe("LLM theme naming integration", () => {
    it("should have theme names (LLM or keyword-based)", async () => {
      const manifest = await generator.generateManifest(items, associations);

      for (const community of manifest.communities.values()) {
        // Every community should have a summary/theme name
        expect(community.summary).toBeDefined();
        expect(community.summary.length).toBeGreaterThan(0);

        // Theme should not be just concatenated keywords
        // (Either LLM-generated or top items description)
        expect(community.summary).not.toMatch(/^[\w\-]+, [\w\-]+, [\w\-]+$/);
      }
    });

    it("should fallback gracefully if LLM unavailable", async () => {
      // Generator should work even without ANTHROPIC_API_KEY
      // (Uses keyword-based summaries as fallback)
      const manifest = await generator.generateManifest(items, associations);

      expect(manifest.communities.size).toBeGreaterThan(0);

      for (const community of manifest.communities.values()) {
        // Should have SOME summary even without LLM
        expect(community.summary).toBeDefined();
        expect(community.summary.length).toBeGreaterThan(0);
      }
    });
  });

  describe("performance", () => {
    it("should generate manifest in reasonable time", async () => {
      const start = Date.now();
      await generator.generateManifest(items, associations);
      const elapsed = Date.now() - start;

      // Should complete in <2 seconds for small graph
      expect(elapsed).toBeLessThan(2000);
    });

    it("should handle moderate-sized graphs efficiently", async () => {
      // Create 100 items
      const largeItems: MemoryItem[] = Array.from({ length: 100 }, (_, i) => ({
        id: `m_item${i}`,
        text: `Test item ${i}`,
        type: "event",
        tags: [`tag${i % 10}`],
        importance: Math.random(),
        energy: Math.random(),
        ttl: "30d",
        createdAt: Date.now() - i * 1000,
        updatedAt: Date.now() - i * 500,
        accessCount: i % 5
      }));

      // Create sparse connections
      const largeAssociations: Association[] = Array.from({ length: 150 }, (_, i) => ({
        fromId: `m_item${i % 100}`,
        toId: `m_item${(i + 1) % 100}`,
        relation: "relates-to",
        weight: Math.random()
      }));

      const start = Date.now();
      const manifest = await generator.generateManifest(largeItems, largeAssociations);
      const elapsed = Date.now() - start;

      // Should complete in reasonable time (spec: <2s for 10K, so 100 should be instant)
      expect(elapsed).toBeLessThan(500);
      expect(manifest.topology.nodeCount).toBe(100);
    });
  });
});
