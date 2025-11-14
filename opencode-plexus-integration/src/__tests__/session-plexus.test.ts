/**
 * Tests for SessionPlexus - verifying structural guarantees
 */

import { describe, test, expect } from "bun:test";
import * as Y from "yjs";
import { SessionPlexus, AgentSession } from "../session-plexus.js";

describe("SessionPlexus", () => {
  test("creates session with initial state", async () => {
    const doc = new Y.Doc();
    const plexus = new SessionPlexus(doc);

    const session = await plexus.createSession(
      "/test/cwd",
      [],
      { providerID: "anthropic", modelID: "claude-sonnet-4" }
    );

    expect(session.id).toBeDefined();
    expect(session.cwd).toBe("/test/cwd");
    expect(session.model?.providerID).toBe("anthropic");
    expect(session.model?.modelID).toBe("claude-sonnet-4");
    expect(session.executionContext).toBe(null);
  });

  test("getSession retrieves existing session", async () => {
    const doc = new Y.Doc();
    const plexus = new SessionPlexus(doc);

    const created = await plexus.createSession("/test", [], null);
    const retrieved = await plexus.getSession(created.id);

    expect(retrieved.id).toBe(created.id);
    expect(retrieved.cwd).toBe(created.cwd);
  });

  test("getSession throws for non-existent session", async () => {
    const doc = new Y.Doc();
    const plexus = new SessionPlexus(doc);

    await expect(plexus.getSession("nonexistent")).rejects.toThrow("Session not found");
  });

  test("setModel updates session model", async () => {
    const doc = new Y.Doc();
    const plexus = new SessionPlexus(doc);

    const session = await plexus.createSession("/test", [], {
      providerID: "anthropic",
      modelID: "claude-sonnet-4"
    });

    await plexus.setModel(session.id, {
      providerID: "openai",
      modelID: "gpt-4"
    });

    expect(session.model?.providerID).toBe("openai");
    expect(session.model?.modelID).toBe("gpt-4");
  });

  test("setMode updates session mode", async () => {
    const doc = new Y.Doc();
    const plexus = new SessionPlexus(doc);

    const session = await plexus.createSession("/test", [], null);
    expect(session.modeId).toBe(null);

    await plexus.setMode(session.id, "plan");
    expect(session.modeId).toBe("plan");
  });

  test("listSessions returns all sessions", async () => {
    const doc = new Y.Doc();
    const plexus = new SessionPlexus(doc);

    await plexus.createSession("/test1", [], null);
    await plexus.createSession("/test2", [], null);
    await plexus.createSession("/test3", [], null);

    const sessions = await plexus.listSessions();
    expect(sessions.length).toBe(3);
  });

  test("deleteSession removes session", async () => {
    const doc = new Y.Doc();
    const plexus = new SessionPlexus(doc);

    const session = await plexus.createSession("/test", [], null);
    expect((await plexus.listSessions()).length).toBe(1);

    await plexus.deleteSession(session.id);
    expect((await plexus.listSessions()).length).toBe(0);
  });
});

describe("AgentSession - Context Immutability", () => {
  test("snapshotContext creates frozen context", async () => {
    const doc = new Y.Doc();
    const plexus = new SessionPlexus(doc);

    const session = await plexus.createSession("/test", [], {
      providerID: "anthropic",
      modelID: "claude-sonnet-4"
    });

    session.modeId = "build";
    session.snapshotContext();

    const frozen = session.frozenContext;
    expect(frozen).toBeDefined();
    expect(frozen?.model.providerID).toBe("anthropic");
    expect(frozen?.model.modelID).toBe("claude-sonnet-4");
    expect(frozen?.modeId).toBe("build");
    expect(frozen?.timestamp).toBeGreaterThan(0);
  });

  test("frozenContext remains immutable when session changes", async () => {
    const doc = new Y.Doc();
    const plexus = new SessionPlexus(doc);

    const session = await plexus.createSession("/test", [], {
      providerID: "anthropic",
      modelID: "claude-sonnet-4"
    });

    session.modeId = "build";
    session.snapshotContext();

    const frozen = session.frozenContext!;
    const originalModelID = frozen.model.modelID;
    const originalModeId = frozen.modeId;

    // Change live session state
    await plexus.setModel(session.id, {
      providerID: "openai",
      modelID: "gpt-4"
    });
    await plexus.setMode(session.id, "plan");

    // Frozen context should NOT change
    expect(frozen.model.modelID).toBe(originalModelID);
    expect(frozen.modeId).toBe(originalModeId);

    // But live session should change
    expect(session.model?.modelID).toBe("gpt-4");
    expect(session.modeId).toBe("plan");

    // Getting frozen context again should still return snapshot
    const frozen2 = session.frozenContext!;
    expect(frozen2.model.modelID).toBe("claude-sonnet-4");
    expect(frozen2.modeId).toBe("build");
  });

  test("clearContext removes execution context", async () => {
    const doc = new Y.Doc();
    const plexus = new SessionPlexus(doc);

    const session = await plexus.createSession("/test", [], {
      providerID: "anthropic",
      modelID: "claude-sonnet-4"
    });

    session.snapshotContext();
    expect(session.executionContext).toBeDefined();

    session.clearContext();
    expect(session.executionContext).toBe(null);
    expect(session.frozenContext).toBe(null);
  });

  test("context freeze prevents top-level modification", async () => {
    const doc = new Y.Doc();
    const plexus = new SessionPlexus(doc);

    const session = await plexus.createSession("/test", [], {
      providerID: "anthropic",
      modelID: "claude-sonnet-4"
    });

    session.snapshotContext();
    const frozen = session.frozenContext!;

    // Attempt to modify frozen context at top level should fail
    expect(() => {
      (frozen as any).modeId = "hacked";
    }).toThrow();

    // Nested objects can be modified (shallow freeze), but since frozen
    // is a fresh copy created by spread, changes don't affect the original
    const originalModel = session.executionContext!.model;
    frozen.model.modelID = "hacked";
    expect(originalModel.modelID).toBe("claude-sonnet-4"); // Original unchanged
  });
});

describe("SessionPlexus - Structural Guarantees", () => {
  test("sessions are owned by root (no orphans possible)", async () => {
    const doc = new Y.Doc();
    const plexus = new SessionPlexus(doc);
    const root = await plexus.rootPromise;

    const session = await plexus.createSession("/test", [], null);

    // Session is in root.sessions map
    expect(root.sessions[session.id]).toBe(session);

    // Session knows its parent
    expect(session.parent).toBe(root);

    // Delete removes from map
    await plexus.deleteSession(session.id);
    expect(root.sessions[session.id]).toBeUndefined();
  });

  test("multi-doc sync - session created in one doc visible in another", async () => {
    const doc1 = new Y.Doc();
    const doc2 = new Y.Doc();

    // Simulate sync by applying updates
    doc1.on("update", (update: Uint8Array) => {
      Y.applyUpdate(doc2, update);
    });
    doc2.on("update", (update: Uint8Array) => {
      Y.applyUpdate(doc1, update);
    });

    const plexus1 = new SessionPlexus(doc1);
    const plexus2 = new SessionPlexus(doc2);

    await plexus1.rootPromise;
    await plexus2.rootPromise;

    // Create session in doc1
    const session1 = await plexus1.createSession("/test", [], {
      providerID: "anthropic",
      modelID: "claude-sonnet-4"
    });

    // Should appear in doc2
    const session2 = await plexus2.getSession(session1.id);
    expect(session2.id).toBe(session1.id);
    expect(session2.cwd).toBe("/test");
    expect(session2.model?.modelID).toBe("claude-sonnet-4");
  });

  test("model changes in one doc sync to other doc", async () => {
    const doc1 = new Y.Doc();
    const doc2 = new Y.Doc();

    doc1.on("update", (update: Uint8Array) => {
      Y.applyUpdate(doc2, update);
    });
    doc2.on("update", (update: Uint8Array) => {
      Y.applyUpdate(doc1, update);
    });

    const plexus1 = new SessionPlexus(doc1);
    const plexus2 = new SessionPlexus(doc2);

    await plexus1.rootPromise;
    await plexus2.rootPromise;

    const session1 = await plexus1.createSession("/test", [], {
      providerID: "anthropic",
      modelID: "claude-sonnet-4"
    });

    // Change model in doc1
    await plexus1.setModel(session1.id, {
      providerID: "openai",
      modelID: "gpt-4"
    });

    // Should sync to doc2
    const session2 = await plexus2.getSession(session1.id);
    expect(session2.model?.modelID).toBe("gpt-4");
  });
});
