import { describe, it, expect, beforeEach } from "bun:test";
import type { MemoryState, MemoryItem } from "./types";
import { ManifestGenerator } from "./manifest/ManifestGenerator";
import type { Association } from "./manifest/ManifestGenerator";

describe("Memory Tool Integration - Theme Synthesis in Tool Descriptions", () => {
  let generator: ManifestGenerator;
  let realMemoryState: MemoryState;

  beforeEach(() => {
    generator = new ManifestGenerator();
    const now = Date.now();

    // Simulate realistic memory state with multiple communities
    realMemoryState = {
      id: "workspace",
      born: now - 2592000000, // 30 days ago
      energy: 0,
      threshold: 100,
      items: {},
      edges: [],
      history: [],
      policy: undefined,
      policyVersions: [],
      recentSessions: []
    };

    // Community 1: Agent orchestration (high importance)
    const agentItems: MemoryItem[] = [
      {
        id: "m_agent_orch1",
        text: "Self-critic agent catching helper mode in implementations",
        type: "insight",
        tags: ["agent-orchestration", "self-critic", "helper-mode", "2025-10-08"],
        importance: 0.95,
        energy: 0.7,
        ttl: "90d",
        createdAt: now - 604800000,
        updatedAt: now - 300000,
        accessCount: 15
      },
      {
        id: "m_agent_orch2",
        text: "Orchestrator-worker pattern with vessel persistence enables cross-session agent memory",
        type: "pattern",
        tags: ["agent-orchestration", "vessel", "architecture", "2025-10-08"],
        importance: 0.9,
        energy: 0.6,
        ttl: "90d",
        createdAt: now - 691200000,
        updatedAt: now - 600000,
        accessCount: 12
      },
      {
        id: "m_agent_orch3",
        text: "Thinker agent analyzed coupling topology using phase space methods",
        type: "analysis",
        tags: ["agent-orchestration", "thinker", "topology", "2025-10-09"],
        importance: 0.85,
        energy: 0.5,
        ttl: "60d",
        createdAt: now - 777600000,
        updatedAt: now - 900000,
        accessCount: 8
      }
    ];

    // Community 2: Memory systems (medium importance)
    const memoryItems: MemoryItem[] = [
      {
        id: "m_mem_sys1",
        text: "Spreading activation with 2-hop neighbors and 0.85 decay provides optimal recall",
        type: "technique",
        tags: ["memory", "spreading-activation", "recall", "2025-10-13"],
        importance: 0.8,
        energy: 0.6,
        ttl: "60d",
        createdAt: now - 259200000,
        updatedAt: now - 180000,
        accessCount: 20
      },
      {
        id: "m_mem_sys2",
        text: "Bootstrap context from .working-memory.json solves startup disorientation",
        type: "feature",
        tags: ["memory", "bootstrap", "continuity", "2025-10-16"],
        importance: 0.85,
        energy: 0.7,
        ttl: "90d",
        createdAt: now - 86400000,
        updatedAt: now - 60000,
        accessCount: 5
      },
      {
        id: "m_mem_sys3",
        text: "Louvain community detection enables theme synthesis at scale",
        type: "technique",
        tags: ["memory", "communities", "themes", "louvain", "2025-10-16"],
        importance: 0.9,
        energy: 0.8,
        ttl: "90d",
        createdAt: now - 43200000,
        updatedAt: now - 30000,
        accessCount: 10
      }
    ];

    // Community 3: Documentation work (lower importance)
    const docItems: MemoryItem[] = [
      {
        id: "m_doc1",
        text: "Aligned CLAUDE.md with actual infrastructure state",
        type: "maintenance",
        tags: ["documentation", "alignment", "2025-10-08"],
        importance: 0.6,
        energy: 0.3,
        ttl: "30d",
        createdAt: now - 691200000,
        updatedAt: now - 691200000,
        accessCount: 3
      },
      {
        id: "m_doc2",
        text: "Updated spec.md to reflect Part 2 completion",
        type: "maintenance",
        tags: ["documentation", "spec", "2025-10-16"],
        importance: 0.65,
        energy: 0.4,
        ttl: "30d",
        createdAt: now - 21600000,
        updatedAt: now - 21600000,
        accessCount: 2
      }
    ];

    // Add all items to state
    [...agentItems, ...memoryItems, ...docItems].forEach(item => {
      realMemoryState.items[item.id] = item;
    });

    // Create edges to form communities
    const edges = [
      // Agent orchestration community (dense connections)
      { from: "m_agent_orch1", to: "m_agent_orch2", relation: "relates-to", weight: 0.9 },
      { from: "m_agent_orch2", to: "m_agent_orch3", relation: "builds-on", weight: 0.8 },
      { from: "m_agent_orch3", to: "m_agent_orch1", relation: "supports", weight: 0.7 },

      // Memory systems community (dense connections)
      { from: "m_mem_sys1", to: "m_mem_sys2", relation: "enables", weight: 0.8 },
      { from: "m_mem_sys2", to: "m_mem_sys3", relation: "uses", weight: 0.9 },
      { from: "m_mem_sys3", to: "m_mem_sys1", relation: "improves", weight: 0.7 },

      // Documentation community (sparse connections)
      { from: "m_doc1", to: "m_doc2", relation: "continues", weight: 0.6 },

      // Cross-community bridges
      { from: "m_agent_orch2", to: "m_mem_sys3", relation: "uses", weight: 0.4 },
      { from: "m_mem_sys2", to: "m_doc2", relation: "documented-in", weight: 0.3 }
    ];

    edges.forEach(edge => {
      realMemoryState.edges.push({
        ...edge,
        lastReinforcedAt: now - 300000
      });
    });
  });

  describe("Full Integration: Memory State → Tool Description", () => {
    it("should generate manifest with LLM themes from memory state", async () => {
      const items = Object.values(realMemoryState.items);
      const associations: Association[] = realMemoryState.edges.map(e => ({
        fromId: e.from,
        toId: e.to,
        relation: e.relation,
        weight: e.weight
      }));

      const manifest = await generator.generateManifest(items, associations);

      // Should detect 3 communities
      expect(manifest.communities.size).toBeGreaterThanOrEqual(3);

      // Should generate topology metrics
      expect(manifest.topology.nodeCount).toBe(8);
      expect(manifest.topology.edgeCount).toBe(9);
      expect(manifest.topology.avgDegree).toBeGreaterThan(2);
    });

    it("should format manifest as tool description with themes visible", async () => {
      const items = Object.values(realMemoryState.items);
      const associations: Association[] = realMemoryState.edges.map(e => ({
        fromId: e.from,
        toId: e.to,
        relation: e.relation,
        weight: e.weight
      }));

      const manifest = await generator.generateManifest(items, associations);
      const description = generator.formatDescription(manifest);

      // Description should contain header
      expect(description).toContain("Memory Map");
      expect(description).toContain("8 items");
      expect(description).toContain("9 edges");

      // Should contain Themes section
      expect(description).toContain("Themes:");

      // Should list themes by importance
      expect(description).toMatch(/\d+\.\s+\w+/); // "1. ThemeName"

      // Should include keywords for each theme
      expect(description).toMatch(/agent-orchestration|memory|documentation/);

      // Should include graph metrics
      expect(description).toContain("Graph:");
      expect(description).toContain("avg degree");
      expect(description).toContain("density");
    });

    it("should show themes BEFORE user queries (the twist)", async () => {
      const items = Object.values(realMemoryState.items);
      const associations: Association[] = realMemoryState.edges.map(e => ({
        fromId: e.from,
        toId: e.to,
        relation: e.relation,
        weight: e.weight
      }));

      const manifest = await generator.generateManifest(items, associations);
      const description = generator.formatDescription(manifest);

      // This description would appear in tool schema BEFORE any query
      // Simulates what Claude Code sees when calling tools/list

      // Should provide meta-awareness of memory contents
      const lines = description.split("\n");
      const themesSection = lines.findIndex(line => line.includes("Themes:"));

      expect(themesSection).toBeGreaterThan(-1);

      // Should list multiple themes
      const themeLines = lines.slice(themesSection + 1, themesSection + 10);
      const themeCount = themeLines.filter(line => line.match(/^\d+\./)).length;

      expect(themeCount).toBeGreaterThanOrEqual(3);
    });

    it("should prioritize high-importance communities in description", async () => {
      const items = Object.values(realMemoryState.items);
      const associations: Association[] = realMemoryState.edges.map(e => ({
        fromId: e.from,
        toId: e.to,
        relation: e.relation,
        weight: e.weight
      }));

      const manifest = await generator.generateManifest(items, associations);
      const description = generator.formatDescription(manifest);

      // Agent orchestration (importance ~0.9) should appear before documentation (importance ~0.6)
      const agentIndex = description.indexOf("agent");
      const docIndex = description.indexOf("documentation");

      if (agentIndex > -1 && docIndex > -1) {
        expect(agentIndex).toBeLessThan(docIndex);
      }
    });

    it("should include recent activity indicators", async () => {
      const items = Object.values(realMemoryState.items);
      const associations: Association[] = realMemoryState.edges.map(e => ({
        fromId: e.from,
        toId: e.to,
        relation: e.relation,
        weight: e.weight
      }));

      const manifest = await generator.generateManifest(items, associations);
      const description = generator.formatDescription(manifest);

      // Should have recent activity section
      expect(description).toContain("Recent Activity:");

      // Should show tags from recent work
      expect(description).toMatch(/2025-10-16|bootstrap|themes/);
    });

    it("should keep description concise (under 2000 tokens)", async () => {
      const items = Object.values(realMemoryState.items);
      const associations: Association[] = realMemoryState.edges.map(e => ({
        fromId: e.from,
        toId: e.to,
        relation: e.relation,
        weight: e.weight
      }));

      const manifest = await generator.generateManifest(items, associations);
      const description = generator.formatDescription(manifest);

      // Estimate tokens (rough: ~4 chars per token)
      const estimatedTokens = description.length / 4;

      // V's spec: 1000-2000 tokens for tool description
      expect(estimatedTokens).toBeLessThan(2000);
      expect(estimatedTokens).toBeGreaterThan(200); // Should be substantial
    });
  });

  describe("V's Architecture Vision - 'Memory about Memory'", () => {
    it("should show WHAT knowledge exists, not just storage availability", async () => {
      const items = Object.values(realMemoryState.items);
      const associations: Association[] = realMemoryState.edges.map(e => ({
        fromId: e.from,
        toId: e.to,
        relation: e.relation,
        weight: e.weight
      }));

      const manifest = await generator.generateManifest(items, associations);
      const description = generator.formatDescription(manifest);

      // Standard memory: "You have memory available"
      // V's vision: "Your memory contains themes X, Y, Z"

      // Should NOT just say "memory available"
      expect(description).not.toMatch(/^Memory available/);
      expect(description).not.toMatch(/^Memory tool ready/);

      // Should describe CONTENTS
      expect(description).toContain("Themes:");

      // Should provide navigable structure
      const hasThemeNumbers = description.match(/\d+\./g);
      expect(hasThemeNumbers?.length).toBeGreaterThanOrEqual(3);
    });

    it("should enable Claude to navigate by theme without querying", async () => {
      const items = Object.values(realMemoryState.items);
      const associations: Association[] = realMemoryState.edges.map(e => ({
        fromId: e.from,
        toId: e.to,
        relation: e.relation,
        weight: e.weight
      }));

      const manifest = await generator.generateManifest(items, associations);
      const description = generator.formatDescription(manifest);

      // Claude should see theme names in tool description
      // Can then query: (recall "agent orchestration" 10)

      // Parse themes from description
      const lines = description.split("\n");
      const themeLines = lines.filter(line => line.match(/^\d+\./));

      // Each theme should have: name, importance, item count
      themeLines.forEach(themeLine => {
        expect(themeLine).toMatch(/importance:/);
        expect(themeLine).toMatch(/\d+ items/);
      });

      // Should enable semantic navigation
      expect(description).toMatch(/agent|memory|documentation/i);
    });

    it("should solve startup disorientation (the product goal)", async () => {
      const items = Object.values(realMemoryState.items);
      const associations: Association[] = realMemoryState.edges.map(e => ({
        fromId: e.from,
        toId: e.to,
        relation: e.relation,
        weight: e.weight
      }));

      const manifest = await generator.generateManifest(items, associations);
      const description = generator.formatDescription(manifest);

      // Problem: New session, Claude doesn't know what's in memory
      // Solution: Tool description shows themes immediately

      // User starts new session
      // Claude Code calls tools/list
      // Tool description includes this manifest
      // Claude sees: "Memory contains agent orchestration, memory systems, documentation"
      // Claude can orient: "Oh, we've been working on agent orchestration"

      // Description should provide orientation
      expect(description).toContain("Themes:");
      expect(description).toContain("Recent Activity:");

      // Should answer: "What have we been working on?"
      const hasRecentWork = description.includes("2025-10-16") ||
                           description.includes("bootstrap") ||
                           description.includes("themes");
      expect(hasRecentWork).toBe(true);
    });
  });

  describe("Performance Characteristics", () => {
    it("should generate manifest quickly for realistic memory size", async () => {
      const items = Object.values(realMemoryState.items);
      const associations: Association[] = realMemoryState.edges.map(e => ({
        fromId: e.from,
        toId: e.to,
        relation: e.relation,
        weight: e.weight
      }));

      const start = Date.now();
      const manifest = await generator.generateManifest(items, associations);
      const elapsed = Date.now() - start;

      // 8 items should be very fast
      // Note: LLM calls add ~2s latency, but this happens async/cached
      expect(elapsed).toBeLessThan(5000);
    });

    it("should format description efficiently", async () => {
      const items = Object.values(realMemoryState.items);
      const associations: Association[] = realMemoryState.edges.map(e => ({
        fromId: e.from,
        toId: e.to,
        relation: e.relation,
        weight: e.weight
      }));

      const manifest = await generator.generateManifest(items, associations);

      const start = Date.now();
      const description = generator.formatDescription(manifest);
      const elapsed = Date.now() - start;

      // Formatting should be instant (<10ms)
      expect(elapsed).toBeLessThan(100);
      expect(description.length).toBeGreaterThan(0);
    });
  });

  describe("Edge Cases", () => {
    it("should handle memory with no edges gracefully", async () => {
      const items = Object.values(realMemoryState.items);
      const associations: Association[] = []; // No edges

      const manifest = await generator.generateManifest(items, associations);
      const description = generator.formatDescription(manifest);

      expect(description).toContain("Memory Map");
      expect(description).toContain("8 items");
      expect(description).toContain("0 edges");
    });

    it("should handle empty memory gracefully", async () => {
      const manifest = await generator.generateManifest([], []);
      const description = generator.formatDescription(manifest);

      expect(description).toContain("Memory Map");
      expect(description).toContain("0 items");
    });

    it("should fallback to keyword themes if LLM unavailable", async () => {
      // This test runs without ANTHROPIC_API_KEY
      // Should use keyword-based summaries as fallback

      const items = Object.values(realMemoryState.items);
      const associations: Association[] = realMemoryState.edges.map(e => ({
        fromId: e.from,
        toId: e.to,
        relation: e.relation,
        weight: e.weight
      }));

      const manifest = await generator.generateManifest(items, associations);
      const description = generator.formatDescription(manifest);

      // Even without LLM, should have themes (from top items text)
      expect(description).toContain("Themes:");
      expect(manifest.communities.size).toBeGreaterThan(0);

      // Each community should have SOME summary
      for (const community of manifest.communities.values()) {
        expect(community.summary).toBeDefined();
        expect(community.summary.length).toBeGreaterThan(0);
      }
    });
  });
});
