import { Database } from "bun:sqlite";
import type { MemoryState, MemoryItem, MemoryEdge } from "../types";
import { DEFAULT_POLICY } from "../types";
import type { MemoryStore } from "./MemoryStore";
import { existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";

export class SQLiteMemoryStore implements MemoryStore {
  private db: Database;
  private dbPath: string;

  constructor(path?: string) {
    // Default to ~/.vessel/memory.db
    this.dbPath = path || join(
      process.env.HOME || process.env.USERPROFILE || "/tmp",
      ".vessel",
      "memory.db"
    );

    // Ensure directory exists
    const dir = dirname(this.dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(this.dbPath);
    this.initializeSchema();
  }

  private initializeSchema(): void {
    // Enable WAL mode for better concurrency
    this.db.exec("PRAGMA journal_mode = WAL");

    // Core tables
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memory_state (
        id TEXT PRIMARY KEY,
        born INTEGER NOT NULL,
        energy REAL NOT NULL DEFAULT 0,
        threshold REAL NOT NULL DEFAULT 100,
        history_size INTEGER NOT NULL DEFAULT 1000,
        policy_json TEXT,
        policy_versions_json TEXT,
        recent_sessions_json TEXT
      );

      CREATE TABLE IF NOT EXISTS memory_items (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        text TEXT NOT NULL,
        tags TEXT NOT NULL,
        importance REAL NOT NULL,
        energy REAL NOT NULL DEFAULT 0,
        ttl TEXT NOT NULL,
        scope TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        last_accessed_at INTEGER,
        access_count INTEGER DEFAULT 0,
        success REAL
      );

      CREATE INDEX IF NOT EXISTS idx_items_importance ON memory_items(importance DESC);
      CREATE INDEX IF NOT EXISTS idx_items_created ON memory_items(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_items_scope ON memory_items(scope);
      CREATE INDEX IF NOT EXISTS idx_items_type ON memory_items(type);

      CREATE TABLE IF NOT EXISTS memory_edges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_id TEXT NOT NULL,
        to_id TEXT NOT NULL,
        relation TEXT NOT NULL,
        weight REAL NOT NULL DEFAULT 1.0,
        context TEXT,
        FOREIGN KEY (from_id) REFERENCES memory_items(id) ON DELETE CASCADE,
        FOREIGN KEY (to_id) REFERENCES memory_items(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_edges_from ON memory_edges(from_id);
      CREATE INDEX IF NOT EXISTS idx_edges_to ON memory_edges(to_id);
      CREATE INDEX IF NOT EXISTS idx_edges_relation ON memory_edges(relation);

      CREATE TABLE IF NOT EXISTS memory_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        query TEXT NOT NULL,
        result_ids TEXT NOT NULL,
        scope TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_history_timestamp ON memory_history(timestamp DESC);
    `);

    // FTS5 virtual table for full-text search
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS memory_items_fts USING fts5(
        text,
        tags,
        content='memory_items',
        content_rowid='rowid'
      );
    `);

    // Check if FTS table needs initial population
    const ftsCount = this.db.prepare("SELECT COUNT(*) as count FROM memory_items_fts").get() as { count: number };
    const itemsCount = this.db.prepare("SELECT COUNT(*) as count FROM memory_items").get() as { count: number };

    if (ftsCount.count === 0 && itemsCount.count > 0) {
      // Populate FTS from existing items
      this.db.exec(`
        INSERT INTO memory_items_fts(rowid, text, tags)
        SELECT rowid, text, tags FROM memory_items;
      `);
    }

    // Triggers to keep FTS in sync
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS memory_items_ai AFTER INSERT ON memory_items BEGIN
        INSERT INTO memory_items_fts(rowid, text, tags)
        VALUES (new.rowid, new.text, new.tags);
      END;

      CREATE TRIGGER IF NOT EXISTS memory_items_ad AFTER DELETE ON memory_items BEGIN
        INSERT INTO memory_items_fts(memory_items_fts, rowid, text, tags)
        VALUES('delete', old.rowid, old.text, old.tags);
      END;

      CREATE TRIGGER IF NOT EXISTS memory_items_au AFTER UPDATE ON memory_items BEGIN
        INSERT INTO memory_items_fts(memory_items_fts, rowid, text, tags)
        VALUES('delete', old.rowid, old.text, old.tags);
        INSERT INTO memory_items_fts(rowid, text, tags)
        VALUES (new.rowid, new.text, new.tags);
      END;
    `);
  }

  async load(): Promise<MemoryState> {
    // Load state
    const stateRow = this.db.prepare("SELECT * FROM memory_state WHERE id = ?").get("workspace") as any;

    // Load items
    const itemRows = this.db.prepare("SELECT * FROM memory_items").all() as any[];
    const items: Record<string, MemoryItem> = {};
    for (const row of itemRows) {
      items[row.id] = {
        id: row.id,
        type: row.type,
        text: row.text,
        tags: JSON.parse(row.tags),
        importance: row.importance,
        energy: row.energy,
        ttl: row.ttl,
        scope: row.scope,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        lastAccessedAt: row.last_accessed_at,
        accessCount: row.access_count,
        success: row.success
      };
    }

    // Load edges
    const edgeRows = this.db.prepare("SELECT * FROM memory_edges").all() as any[];
    const edges: MemoryEdge[] = edgeRows.map(row => ({
      from: row.from_id,
      to: row.to_id,
      relation: row.relation,
      weight: row.weight,
      context: row.context
    }));

    // Load history (convert from SQL format to MemoryState format)
    const historyRows = this.db.prepare("SELECT * FROM memory_history ORDER BY timestamp DESC LIMIT 100").all() as any[];
    const history = historyRows.map(row => ({
      t: row.timestamp,
      op: row.query, // Store query as op for now
      args: JSON.parse(row.result_ids)
    }));

    if (!stateRow) {
      // Initialize new workspace
      const initialState: MemoryState = {
        id: "workspace",
        born: Date.now(),
        energy: 0,
        threshold: 100,
        items: {},
        edges: [],
        history: [],
        historySize: 1000,
        policy: {
          decayHalfLife: 30,
          activationThreshold: 0.1,
          maxSpreadingSteps: 3,
          explorationFactor: 0.2
        },
        policyVersions: [],
        recentSessions: []
      };

      await this.save(initialState);
      return initialState;
    }

    return {
      id: stateRow.id,
      born: stateRow.born,
      energy: stateRow.energy,
      threshold: stateRow.threshold,
      items,
      edges,
      history,
      historySize: stateRow.history_size,
      policy: { ...DEFAULT_POLICY, ...JSON.parse(stateRow.policy_json || "{}") },
      policyVersions: JSON.parse(stateRow.policy_versions_json || "[]"),
      recentSessions: JSON.parse(stateRow.recent_sessions_json || "[]")
    };
  }

  async save(state: MemoryState): Promise<void> {
    const transaction = this.db.transaction(() => {
      // Save state
      this.db.prepare(`
        INSERT OR REPLACE INTO memory_state (id, born, energy, threshold, history_size, policy_json, policy_versions_json, recent_sessions_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        state.id,
        state.born,
        state.energy,
        state.threshold,
        state.historySize,
        JSON.stringify(state.policy),
        JSON.stringify(state.policyVersions),
        JSON.stringify(state.recentSessions)
      );

      // Save items (upsert)
      const upsertItem = this.db.prepare(`
        INSERT OR REPLACE INTO memory_items
        (id, type, text, tags, importance, energy, ttl, scope, created_at, updated_at, last_accessed_at, access_count, success)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of Object.values(state.items)) {
        upsertItem.run(
          item.id,
          item.type,
          item.text,
          JSON.stringify(item.tags),
          item.importance,
          item.energy,
          item.ttl,
          item.scope,
          item.createdAt,
          item.updatedAt,
          item.lastAccessedAt,
          item.accessCount,
          item.success
        );
      }

      // Clear and rebuild edges (simpler than diffing)
      this.db.prepare("DELETE FROM memory_edges").run();
      const insertEdge = this.db.prepare(`
        INSERT INTO memory_edges (from_id, to_id, relation, weight, context)
        VALUES (?, ?, ?, ?, ?)
      `);

      for (const edge of state.edges) {
        insertEdge.run(edge.from, edge.to, edge.relation, edge.weight, edge.context);
      }

      // Save recent history (limit to last 100) - convert MemoryState format to SQL format
      this.db.prepare("DELETE FROM memory_history").run();
      const insertHistory = this.db.prepare(`
        INSERT INTO memory_history (timestamp, query, result_ids, scope)
        VALUES (?, ?, ?, ?)
      `);

      for (const entry of state.history.slice(0, 100)) {
        // MemoryState history format: {t, op, args}
        // SQL format: {timestamp, query, result_ids, scope}
        insertHistory.run(
          entry.t, // timestamp
          entry.op, // query (operation name)
          JSON.stringify(entry.args || {}), // result_ids (args as JSON)
          null // scope (not tracked in MemoryState history)
        );
      }
    });

    transaction();
  }

  /**
   * FTS5 full-text search across memory items
   * Returns ranked results with relevance scores
   */
  async search(query: string, limit: number = 10, scope?: string): Promise<Array<{ id: string; rank: number }>> {
    // Escape FTS5 special characters
    const escapedQuery = this.escapeFTS5(query);

    let sql = `
      SELECT
        mi.id,
        mf.rank
      FROM memory_items_fts mf
      JOIN memory_items mi ON mi.rowid = mf.rowid
      WHERE mf.text MATCH ?
    `;

    const params: any[] = [escapedQuery];

    if (scope) {
      sql += " AND mi.scope = ?";
      params.push(scope);
    }

    sql += " ORDER BY mf.rank LIMIT ?";
    params.push(limit);

    const results = this.db.prepare(sql).all(...params) as Array<{ id: string; rank: number }>;
    return results;
  }

  /**
   * Escape FTS5 special characters in user input
   */
  private escapeFTS5(text: string): string {
    // Escape internal double quotes by doubling them
    let escaped = text.replace(/"/g, '""');
    // Wrap in double quotes for phrase search
    return `"${escaped}"`;
  }

  async close(): Promise<void> {
    this.db.close();
  }
}
