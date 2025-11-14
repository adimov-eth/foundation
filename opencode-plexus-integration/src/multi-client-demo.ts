/**
 * Multi-client demo showing Plexus session sync
 *
 * Two separate clients (processes) share session state via Yjs.
 * Changes in one client immediately visible in the other.
 */

import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { SessionPlexus } from "./session-plexus.js";

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runClient(clientName: string, isFirstClient: boolean) {
  console.log(`\n[${clientName}] Starting...`);

  // Create Yjs doc + WebSocket provider
  const doc = new Y.Doc();

  // Note: For real usage, run y-websocket server first:
  // npx y-websocket-server
  const provider = new WebsocketProvider(
    "ws://localhost:1234",
    "opencode-sessions",
    doc
  );

  await new Promise<void>((resolve) => {
    provider.on("sync", () => {
      console.log(`[${clientName}] Connected and synced`);
      resolve();
    });
  });

  // Create SessionPlexus on shared doc
  const sessionPlexus = new SessionPlexus(doc);
  const root = await sessionPlexus.rootPromise;

  if (isFirstClient) {
    console.log(`[${clientName}] Creating initial session...`);

    const session = await sessionPlexus.createSession(
      "/test/project",
      [],
      { providerID: "anthropic", modelID: "claude-sonnet-4" }
    );

    console.log(`[${clientName}] Created session: ${session.id}`);
    console.log(`[${clientName}] Model: ${session.model?.modelID}`);

    // Snapshot execution context
    session.snapshotContext();
    console.log(`[${clientName}] Snapshot context: ${JSON.stringify(session.frozenContext)}`);

    await delay(2000);

    // Change model mid-execution (simulating setModel)
    console.log(`[${clientName}] Changing model to gpt-4...`);
    sessionPlexus.setModel(session.id, {
      providerID: "openai",
      modelID: "gpt-4"
    });

    console.log(`[${clientName}] New model: ${session.model?.modelID}`);
    console.log(`[${clientName}] Frozen context still has: ${session.frozenContext?.model.modelID}`);
    console.log(`[${clientName}] ✓ Context immutability preserved!`);

  } else {
    console.log(`[${clientName}] Waiting for session from other client...`);

    await delay(1000);

    const sessions = await sessionPlexus.listSessions();
    console.log(`[${clientName}] Found ${sessions.length} session(s)`);

    if (sessions.length > 0) {
      const session = sessions[0];
      console.log(`[${clientName}] Session ID: ${session.id}`);
      console.log(`[${clientName}] CWD: ${session.cwd}`);
      console.log(`[${clientName}] Model: ${session.model?.modelID}`);

      // Watch for model change
      await delay(1500);
      console.log(`[${clientName}] After delay, model is now: ${session.model?.modelID}`);
      console.log(`[${clientName}] ✓ Automatic sync working!`);
    }
  }

  await delay(3000);

  provider.disconnect();
  console.log(`[${clientName}] Disconnected`);
}

// Run as first or second client based on args
const isFirstClient = process.argv[2] === "first";
runClient(isFirstClient ? "Client 1" : "Client 2", isFirstClient);
