import { Plexus, PlexusModel, syncing } from "@here.build/plexus";
import * as Y from "yjs";

/**
 * McpServer configuration - copied from OpenCode's ACP types
 */
export type McpServerConfig =
  | {
      name: string;
      type: "remote";
      url: string;
      headers: Record<string, string>;
    }
  | {
      name: string;
      type: "local";
      command: string[];
      environment: Record<string, string>;
    };

/**
 * Model configuration (providerID + modelID pair)
*/
export interface ModelConfig {
  providerID: string;
  modelID: string;
}

/**
 * Execution context - frozen per prompt execution
 * All tools in a batch see this exact snapshot
 */
export interface ExecutionContext {
  timestamp: number;
  model: ModelConfig;
  modeId: string;
  [key: string]: any;
}

/**
 * AgentSession - represents a single agent session with frozen execution context
 *
 * Key innovation: executionContext is immutable per prompt.
 * Tools cannot see context drift mid-execution.
 */
@syncing
export class AgentSession extends PlexusModel {
  @syncing accessor id!: string;
  @syncing accessor cwd!: string;
  @syncing accessor modelJSON!: string | null; // Serialized ModelConfig
  @syncing accessor modeId!: string | null;
  @syncing accessor mcpServersJSON!: string; // Serialized McpServerConfig[]
  @syncing accessor createdAt!: number;

  // Execution context - set at prompt start, frozen during execution
  @syncing accessor executionContextJSON!: string | null; // Serialized ExecutionContext

  /**
   * Computed properties for convenience
   */
  get model(): ModelConfig | null {
    return this.modelJSON ? JSON.parse(this.modelJSON) : null;
  }

  set model(value: ModelConfig | null) {
    this.modelJSON = value ? JSON.stringify(value) : null;
  }

  get mcpServers(): McpServerConfig[] {
    return JSON.parse(this.mcpServersJSON);
  }

  set mcpServers(value: McpServerConfig[]) {
    this.mcpServersJSON = JSON.stringify(value);
  }

  get executionContext(): ExecutionContext | null {
    return this.executionContextJSON ? JSON.parse(this.executionContextJSON) : null;
  }

  set executionContext(value: ExecutionContext | null) {
    this.executionContextJSON = value ? JSON.stringify(value) : null;
  }

  /**
   * Get frozen context for current execution
   * Returns immutable snapshot - tools cannot modify
   */
  get frozenContext(): Readonly<ExecutionContext> | null {
    if (!this.executionContext) return null;
    return Object.freeze({ ...this.executionContext });
  }

  /**
   * Snapshot context for new prompt execution
   * Called at start of prompt() - freezes world state
   */
  snapshotContext(): void {
    this.executionContext = {
      timestamp: Date.now(),
      model: this.model ? { ...this.model } : { providerID: "unknown", modelID: "unknown" },
      modeId: this.modeId ?? "build"
    };
  }

  /**
   * Clear execution context after prompt completes
   */
  clearContext(): void {
    this.executionContext = null;
  }
}

/**
 * SessionRoot - owns all sessions
 *
 * Using @syncing.child.map ensures:
 * - Sessions cannot exist without being in this map
 * - Moving sessions between roots automatically updates parent tracking
 * - Orphaned sessions are structurally impossible
 */
@syncing
export class SessionRoot extends PlexusModel {
  @syncing.child.map accessor sessions!: Record<string, AgentSession>;
}

/**
 * SessionPlexus - manages collaborative session state
 *
 * Replaces OpenCode's ACPSessionManager Map with Plexus:
 * - Automatic sync across clients (via Yjs)
 * - Structural guarantees (no orphans, parent tracking)
 * - Undo/redo via transactions
 * - Context immutability per execution
 */
export class SessionPlexus extends Plexus<SessionRoot> {
  createDefaultRoot(): SessionRoot {
    return new SessionRoot();
  }

  /**
   * Create new session
   * Returns session that's automatically tracked in Plexus
   */
  async createSession(
    cwd: string,
    mcpServers: McpServerConfig[],
    model?: ModelConfig | null
  ): Promise<AgentSession> {
    const root = await this.rootPromise;

    const session = new AgentSession();
    session.id = crypto.randomUUID();
    session.cwd = cwd;
    session.mcpServersJSON = JSON.stringify(mcpServers);
    session.modelJSON = model ? JSON.stringify(model) : null;
    session.modeId = null;
    session.createdAt = Date.now();
    session.executionContextJSON = null;

    // Add to root - now tracked by Plexus
    root.sessions[session.id] = session;

    return session;
  }

  /**
   * Get session by ID
   * Throws if not found (matches OpenCode's behavior)
   */
  async getSession(sessionId: string): Promise<AgentSession> {
    const root = await this.rootPromise;
    const session = root.sessions[sessionId];

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    return session;
  }

  /**
   * Set session model
   * Mutates live session state (like OpenCode's setModel)
   */
  async setModel(sessionId: string, model: ModelConfig): Promise<AgentSession> {
    const session = await this.getSession(sessionId);
    session.model = model;
    return session;
  }

  /**
   * Set session mode
   */
  async setMode(sessionId: string, modeId: string): Promise<AgentSession> {
    const session = await this.getSession(sessionId);
    session.modeId = modeId;
    return session;
  }

  /**
   * List all sessions
   */
  async listSessions(): Promise<AgentSession[]> {
    const root = await this.rootPromise;
    return Object.values(root.sessions);
  }

  /**
   * Delete session
   * Plexus ensures proper cleanup
   */
  async deleteSession(sessionId: string): Promise<void> {
    const root = await this.rootPromise;
    delete root.sessions[sessionId];
  }
}
