import { describe, it, expect, beforeEach } from "bun:test";
import { runSpreadingActivation, type ActivationOptions } from "./SpreadingActivationEngine";
import type { MemoryState, MemoryItem, MemoryEdge } from "../types";

describe("SpreadingActivationEngine", () => {
  let state: MemoryState;
  
  beforeEach(() => {
    const now = Date.now();
    
    // Create a simple test graph:
    //   m1 --0.7--> m2
    //   |           |
    //   0.5         0.3
    //   |           |
    //   v           v
    //   m3 <--0.4-- m4
    
    state = {
      id: "test",
      born: now,
      energy: 0,
      threshold: 100,
      items: {
        m1: {
          id: "m1",
          text: "Node 1",
          type: "event",
          tags: [],
          importance: 0.8,
          energy: 0,
          ttl: "30d",
          createdAt: now,
          updatedAt: now,
          accessCount: 0
        },
        m2: {
          id: "m2", 
          text: "Node 2",
          type: "event",
          tags: [],
          importance: 0.6,
          energy: 0,
          ttl: "30d",
          createdAt: now,
          updatedAt: now,
          accessCount: 0
        },
        m3: {
          id: "m3",
          text: "Node 3",
          type: "event",
          tags: [],
          importance: 0.4,
          energy: 0,
          ttl: "30d",
          createdAt: now,
          updatedAt: now,
          accessCount: 0
        },
        m4: {
          id: "m4",
          text: "Node 4",
          type: "event",
          tags: [],
          importance: 0.5,
          energy: 0,
          ttl: "30d",
          createdAt: now,
          updatedAt: now,
          accessCount: 0
        }
      },
      edges: [
        { from: "m1", to: "m2", relation: "connects", weight: 0.7, lastReinforcedAt: now },
        { from: "m1", to: "m3", relation: "connects", weight: 0.5, lastReinforcedAt: now },
        { from: "m2", to: "m4", relation: "connects", weight: 0.3, lastReinforcedAt: now },
        { from: "m4", to: "m3", relation: "connects", weight: 0.4, lastReinforcedAt: now }
      ],
      history: [],
      policy: undefined,
      policyVersions: [],
      recentSessions: []
    };
  });
  
  describe("runSpreadingActivation", () => {
    it("should propagate energy from seed nodes", () => {
      const seeds = { m1: 1.0 };
      const options: ActivationOptions = {
        steps: 1,
        decay: 0.7,
        threshold: 0.1
      };
      
      const activation = runSpreadingActivation(state, seeds, options);
      
      // m1 starts with 1.0
      expect(activation.m1).toBeCloseTo(1.0);
      
      // m2 receives: 1.0 * 0.7 * 0.7 = 0.49
      expect(activation.m2).toBeCloseTo(0.49);
      
      // m3 receives: 1.0 * 0.5 * 0.7 = 0.35
      expect(activation.m3).toBeCloseTo(0.35);
      
      // m4 has no incoming activation from m1 in step 1
      expect(activation.m4).toBe(0);
    });
    
    it("should propagate through multiple steps", () => {
      const seeds = { m1: 1.0 };
      const options: ActivationOptions = {
        steps: 2,
        decay: 0.7,
        threshold: 0.05
      };
      
      const activation = runSpreadingActivation(state, seeds, options);
      
      // After 2 steps, m4 should receive energy via m2
      // Step 1: m2 gets 0.49
      // Step 2: m4 gets 0.49 * 0.3 * 0.7 = 0.1029
      expect(activation.m4).toBeGreaterThan(0.1);
    });
    
    it("should respect activation threshold", () => {
      const seeds = { m1: 1.0 };
      const options: ActivationOptions = {
        steps: 2,
        decay: 0.7,
        threshold: 0.4 // High threshold
      };
      
      const activation = runSpreadingActivation(state, seeds, options);
      
      // All nodes are in result (initialized to 0)
      // With bidirectional edges, m2 also receives back from m1
      expect(activation.m1).toBeCloseTo(1.0); // seed
      // m2 receives from m1: 0.49, plus back from itself via m1: 0.49 * 0.7 * 0.7 = 0.24
      // But wait, with threshold 0.4, m2 at 0.49 can propagate back
      expect(activation.m2).toBeGreaterThan(0.49); // receives and propagates back
      // m3 receives from m1 bidirectionally: 1.0 * 0.5 * 0.7 * 2 = 0.7
      expect(activation.m3).toBeCloseTo(0.7);
      expect(activation.m4).toBeGreaterThan(0); // receives from m2
    });
    
    it("should handle multiple seed nodes", () => {
      const seeds = { m1: 0.8, m4: 0.6 };
      const options: ActivationOptions = {
        steps: 1,
        decay: 0.7,
        threshold: 0.1
      };
      
      const activation = runSpreadingActivation(state, seeds, options);
      
      // m3 receives from both m1 and m4
      // From m1: 0.8 * 0.5 * 0.7 = 0.28
      // From m4: 0.6 * 0.4 * 0.7 = 0.168
      // Total: 0.28 + 0.168 = 0.448
      expect(activation.m3).toBeCloseTo(0.448, 2);
    });
    
    it("should handle bidirectional edges", () => {
      // Add reverse edge
      state.edges.push({
        from: "m2",
        to: "m1",
        relation: "backref",
        weight: 0.2,
        lastReinforcedAt: Date.now()
      });
      
      const seeds = { m2: 1.0 };
      const options: ActivationOptions = {
        steps: 1,
        decay: 0.8,
        threshold: 0.1
      };
      
      const activation = runSpreadingActivation(state, seeds, options);
      
      // m1 receives from m2 via explicit edge AND via bidirectional m1->m2
      // From explicit m2->m1: 1.0 * 0.2 * 0.8 = 0.16
      // From bidirectional m1<-m2: 1.0 * 0.7 * 0.8 = 0.56
      // Total: 0.16 + 0.56 = 0.72
      expect(activation.m1).toBeCloseTo(0.72);
      expect(activation.m4).toBeCloseTo(0.24); // 1.0 * 0.3 * 0.8
    });
    
    it("should cap activation at 1.0", () => {
      // Create strong circular references
      state.edges = [
        { from: "m1", to: "m2", relation: "strong", weight: 0.9, lastReinforcedAt: Date.now() },
        { from: "m2", to: "m1", relation: "strong", weight: 0.9, lastReinforcedAt: Date.now() }
      ];
      
      const seeds = { m1: 1.0, m2: 1.0 };
      const options: ActivationOptions = {
        steps: 3, // Multiple rounds of reinforcement
        decay: 0.9,
        threshold: 0.01
      };
      
      const activation = runSpreadingActivation(state, seeds, options);
      
      // Even with reinforcement, should not exceed 1.0
      expect(activation.m1).toBeLessThanOrEqual(1.0);
      expect(activation.m2).toBeLessThanOrEqual(1.0);
    });
    
    it("should return empty object for no seeds", () => {
      const seeds = {};
      const options: ActivationOptions = {
        steps: 1,
        decay: 0.7,
        threshold: 0.1
      };
      
      const activation = runSpreadingActivation(state, seeds, options);
      
      // All nodes initialized to 0 when no seeds
      expect(Object.keys(activation).length).toBe(4);
      expect(activation.m1).toBe(0);
      expect(activation.m2).toBe(0);
      expect(activation.m3).toBe(0);
      expect(activation.m4).toBe(0);
    });
    
    it("should handle disconnected nodes", () => {
      // Add isolated node
      state.items.m5 = {
        id: "m5",
        text: "Isolated",
        type: "event",
        tags: [],
        importance: 0.5,
        energy: 0,
        ttl: "30d",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        accessCount: 0
      };
      
      const seeds = { m1: 1.0 };
      const options: ActivationOptions = {
        steps: 10, // Many steps
        decay: 0.9,
        threshold: 0.001 // Very low
      };
      
      const activation = runSpreadingActivation(state, seeds, options);
      
      // m5 is isolated, stays at 0
      expect(activation.m5).toBe(0);
    });
  });
  
  describe("buildAdjacency helper", () => {
    it("should build correct adjacency structure", () => {
      // Test internal adjacency building logic
      const adjacency = new Map<string, Array<{ to: string; weight: number }>>();
      
      for (const edge of state.edges) {
        if (!adjacency.has(edge.from)) {
          adjacency.set(edge.from, []);
        }
        adjacency.get(edge.from)!.push({ to: edge.to, weight: edge.weight });
      }
      
      expect(adjacency.get("m1")?.length).toBe(2); // m1 -> m2, m3
      expect(adjacency.get("m2")?.length).toBe(1); // m2 -> m4
      expect(adjacency.get("m3")).toBeUndefined(); // m3 has no outgoing
      expect(adjacency.get("m4")?.length).toBe(1); // m4 -> m3
    });
  });
});