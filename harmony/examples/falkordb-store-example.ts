/**
 * Example usage of FalkorDBMemoryStore
 *
 * Prerequisites:
 * - FalkorDB running on localhost:6379
 * - Start with: docker run -p 6379:6379 -p 3000:3000 falkordb/falkordb:latest
 */

import { FalkorDBMemoryStore } from "../src/memory/store/FalkorDBMemoryStore.js";
import type { MemoryState, MemoryItem } from "../src/memory/types.js";

async function example() {
  // 1. Create store instance (lazy connection)
  const store = new FalkorDBMemoryStore({
    host: "localhost",
    port: 6379,
    graphName: "harmony_example",
  });

  console.log("Creating example memory state...");

  // 2. Create a sample memory state
  const state: MemoryState = {
    id: "example-agent",
    born: Date.now(),
    energy: 0.8,
    threshold: 0.2,
    items: {
      "m_001": {
        id: "m_001",
        type: "principle",
        text: "Relief signals when structure matches problem",
        tags: ["core", "signal"],
        importance: 0.95,
        energy: 0.9,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      "m_002": {
        id: "m_002",
        type: "technique",
        text: "Catamorphisms for recursive data processing",
        tags: ["functional", "recursion"],
        importance: 0.85,
        energy: 0.8,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      "m_003": {
        id: "m_003",
        type: "pattern",
        text: "Smart constructors for branded types",
        tags: ["typescript", "safety"],
        importance: 0.8,
        energy: 0.75,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    },
    edges: [
      {
        from: "m_001",
        to: "m_002",
        relation: "APPLIES_TO",
        weight: 0.7,
        lastReinforcedAt: Date.now(),
      },
      {
        from: "m_002",
        to: "m_003",
        relation: "USES",
        weight: 0.6,
        lastReinforcedAt: Date.now(),
      },
      {
        from: "m_001",
        to: "m_003",
        relation: "SUPPORTS",
        weight: 0.5,
        lastReinforcedAt: Date.now(),
      },
    ],
    history: [
      { t: Date.now(), op: "init" },
      { t: Date.now(), op: "add", args: { id: "m_001" } },
    ],
  };

  // 3. Save to FalkorDB
  console.log("Saving to FalkorDB...");
  await store.save(state);
  console.log("✓ Saved successfully");

  // 4. Load back from FalkorDB
  console.log("\nLoading from FalkorDB...");
  const loaded = await store.load();
  console.log("✓ Loaded", Object.keys(loaded?.items || {}).length, "items");
  console.log("✓ Loaded", loaded?.edges.length, "edges");

  // 5. Search for high-importance memories
  console.log("\nSearching for high-importance memories...");
  const searchResult = await store.search(
    "MATCH (m:Memory) WHERE m.importance > 0.8 RETURN m ORDER BY m.importance DESC",
    {},
    { limit: 5 }
  );

  if (searchResult.ok) {
    console.log(`✓ Found ${searchResult.value.length} high-importance memories:`);
    searchResult.value.forEach((item) => {
      console.log(`  - [${item.type}] ${item.text.substring(0, 50)}... (${item.importance})`);
    });
  }

  // 6. Get neighbors for spreading activation
  console.log("\nGetting neighbors of m_001 for spreading activation...");
  const neighborsResult = await store.getNeighbors("m_001", {
    maxDepth: 1,
    minWeight: 0.5,
    limit: 10,
  });

  if (neighborsResult.ok) {
    console.log(`✓ Found ${neighborsResult.value.length} neighbors:`);
    neighborsResult.value.forEach((item) => {
      console.log(`  - [${item.type}] ${item.text.substring(0, 50)}...`);
    });
  }

  // 7. Advanced Cypher query - find related functional programming concepts
  console.log("\nFinding functional programming concepts...");
  const fpResult = await store.search(
    "MATCH (m:Memory) WHERE m.tags CONTAINS 'functional' OR m.text CONTAINS 'catamorphism' RETURN m"
  );

  if (fpResult.ok) {
    console.log(`✓ Found ${fpResult.value.length} FP concepts`);
  }

  // 8. Graph traversal - multi-hop neighbors
  console.log("\nFinding 2-hop neighbors from m_001...");
  const twoHopResult = await store.getNeighbors("m_001", {
    maxDepth: 2,
    minWeight: 0.4,
    limit: 20,
  });

  if (twoHopResult.ok) {
    console.log(`✓ Found ${twoHopResult.value.length} nodes within 2 hops`);
  }

  // 9. Close connection
  console.log("\nClosing connection...");
  await store.close();
  console.log("✓ Connection closed");

  console.log("\n=== Example Complete ===");
  console.log("Access FalkorDB UI at: http://localhost:3000");
  console.log("Graph name: harmony_example");
}

// Run example
example().catch((error) => {
  console.error("Example failed:", error);
  process.exit(1);
});
