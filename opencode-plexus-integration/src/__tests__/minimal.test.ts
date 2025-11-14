import { describe, test, expect } from "bun:test";
import * as Y from "yjs";
import { SessionPlexus } from "../session-plexus.js";

describe("Minimal", () => {
  test("can create plexus", async () => {
    const doc = new Y.Doc();
    const plexus = new SessionPlexus(doc);

    console.log("Created plexus");

    const root = await plexus.rootPromise;

    console.log("Got root:", root);
    console.log("Root sessions:", root.sessions);

    expect(root).toBeDefined();
  });
});
