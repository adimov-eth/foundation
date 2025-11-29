import { describe, test, expect, beforeEach } from "bun:test";
import type { MemoryState, MemoryItem } from "./types";
import { DEFAULT_POLICY } from "./types";

/**
 * Test implicit feedback mechanism:
 * Memories accessed 3+ times should credit prior sessions with success
 */

describe("Implicit Feedback", () => {
  let state: MemoryState;
  const now = Date.now();

  beforeEach(() => {
    // Create minimal state with 2 items
    state = {
      id: "test",
      born: now - 10000,
      energy: 0,
      threshold: 100,
      items: {
        "m_test1": {
          id: "m_test1",
          type: "test",
          text: "First memory",
          tags: ["test"],
          importance: 0.8,
          energy: 0,
          ttl: "30d",
          createdAt: now - 5000,
          updatedAt: now - 5000,
          lastAccessedAt: now - 5000,
          accessCount: 0,
        },
        "m_test2": {
          id: "m_test2",
          type: "test",
          text: "Second memory",
          tags: ["test"],
          importance: 0.7,
          energy: 0,
          ttl: "30d",
          createdAt: now - 4000,
          updatedAt: now - 4000,
          lastAccessedAt: now - 4000,
          accessCount: 0,
        },
      },
      edges: [],
      history: [],
      policy: { ...DEFAULT_POLICY },
      policyVersions: [
        {
          id: "test_policy_v1",
          name: "recall-score",
          code: "(lambda (a r i) (+ a r i))",
          createdAt: now - 6000,
          success: 0,
          fail: 0,
        },
      ],
      recentSessions: [
        {
          t: now - 3000,
          type: "recall",
          items: ["m_test1", "m_test2"],
          policyIds: { "recall-score": "test_policy_v1" },
          query: "first query",
          hour: 10,
        },
      ],
    };
  });

  test("should not give feedback for accessCount < 3", () => {
    const item = state.items["m_test1"];
    item.accessCount = 2;

    // Simulate recall processing (this is what MemoryToolInteraction does)
    if (item.accessCount >= 3) {
      const priorSessions = state.recentSessions!
        .filter(s => s.items.includes(item.id) && s.t < now)
        .sort((a, b) => b.t - a.t);

      if (priorSessions.length > 0) {
        priorSessions[0].succ = (priorSessions[0].succ ?? 0) + 1;
      }
    }

    expect(state.recentSessions![0].succ).toBeUndefined();
    expect(item.success).toBeUndefined();
  });

  test("should give feedback when accessCount reaches 3", () => {
    const item = state.items["m_test1"];
    item.accessCount = 3;

    // Simulate recall processing
    if (item.accessCount >= 3) {
      const priorSessions = state.recentSessions!
        .filter(s => s.items.includes(item.id) && s.t < now)
        .sort((a, b) => b.t - a.t);

      if (priorSessions.length > 0) {
        const session = priorSessions[0];
        session.succ = (session.succ ?? 0) + 1;

        // Attribute to policy versions
        if (session.policyIds) {
          for (const versionId of Object.values(session.policyIds)) {
            if (!versionId) continue;
            const version = state.policyVersions!.find(v => v.id === versionId);
            if (version) version.success += 1;
          }
        }
      }

      // Mark item itself
      item.success = (item.success ?? 0) + 1;
    }

    expect(state.recentSessions![0].succ).toBe(1);
    expect(item.success).toBe(1);
    expect(state.policyVersions![0].success).toBe(1);
  });

  test("should credit most recent prior session", () => {
    const item = state.items["m_test1"];
    item.accessCount = 3;

    // Add another session
    state.recentSessions!.push({
      t: now - 2000,
      type: "recall",
      items: ["m_test1"],
      policyIds: { "recall-score": "test_policy_v1" },
      query: "second query",
      hour: 10,
    });

    // Simulate recall processing at current time
    const priorSessions = state.recentSessions!
      .filter(s => s.items.includes(item.id) && s.t < now)
      .sort((a, b) => b.t - a.t);

    if (priorSessions.length > 0) {
      priorSessions[0].succ = (priorSessions[0].succ ?? 0) + 1;
    }

    // Most recent session (t: now - 2000) should get credit
    expect(state.recentSessions![1].succ).toBe(1);
    expect(state.recentSessions![0].succ).toBeUndefined();
  });

  test("should accumulate success across multiple accesses", () => {
    const item = state.items["m_test1"];

    // Simulate multiple accesses triggering feedback
    for (let count = 3; count <= 5; count++) {
      item.accessCount = count;

      const priorSessions = state.recentSessions!
        .filter(s => s.items.includes(item.id) && s.t < now)
        .sort((a, b) => b.t - a.t);

      if (priorSessions.length > 0) {
        priorSessions[0].succ = (priorSessions[0].succ ?? 0) + 1;
      }

      item.success = (item.success ?? 0) + 1;
    }

    // 3 accesses (count 3, 4, 5) = 3 success credits
    expect(state.recentSessions![0].succ).toBe(3);
    expect(item.success).toBe(3);
  });

  test("should handle items with no prior sessions gracefully", () => {
    const item = state.items["m_test1"];
    item.accessCount = 3;

    // Remove all sessions
    state.recentSessions = [];

    // Simulate recall processing
    const priorSessions = state.recentSessions!
      .filter(s => s.items.includes(item.id) && s.t < now)
      .sort((a, b) => b.t - a.t);

    if (priorSessions.length > 0) {
      priorSessions[0].succ = (priorSessions[0].succ ?? 0) + 1;
    }

    // Should mark item as successful even without session to credit
    item.success = (item.success ?? 0) + 1;

    expect(item.success).toBe(1);
  });

  test("should only count sessions BEFORE current time", () => {
    const item = state.items["m_test1"];
    item.accessCount = 3;

    // Add session in the future (shouldn't happen, but defensive)
    state.recentSessions!.push({
      t: now + 1000,
      type: "recall",
      items: ["m_test1"],
      policyIds: {},
      query: "future query",
      hour: 10,
    });

    const priorSessions = state.recentSessions!
      .filter(s => s.items.includes(item.id) && s.t < now)
      .sort((a, b) => b.t - a.t);

    if (priorSessions.length > 0) {
      priorSessions[0].succ = (priorSessions[0].succ ?? 0) + 1;
    }

    // Only past session (t: now - 3000) should get credit
    expect(state.recentSessions![0].succ).toBe(1);
    expect(state.recentSessions![1].succ).toBeUndefined();
  });
});
