import { FalkorDB } from "falkordb";
import type { MemoryStore } from "./MemoryStore.js";
import type {
  MemoryState,
  MemoryItem,
  MemoryEdge,
  Result,
  MemoryError,
} from "../types.js";
import { Ok, Err, StorageError as makeStorageError } from "../types.js";

export interface FalkorDBConfig {
  host?: string;
  port?: number;
  graphName?: string;
  username?: string;
  password?: string;
}

export interface SearchOptions {
  limit?: number;
  minScore?: number;
}

export interface GetNeighborsOptions {
  maxDepth?: number;
  minWeight?: number;
  limit?: number;
}

/**
 * FalkorDB-backed memory store for spreading activation and graph queries.
 *
 * Schema:
 * - Nodes: (:Memory {id, type, text, tags, importance, energy, ...})
 * - Edges: (Memory)-[relation {weight, lastReinforcedAt}]->(Memory)
 *
 * Design decisions:
 * - Graph name configurable for multi-agent scenarios
 * - Tags stored as JSON array (FalkorDB doesn't have native list properties in all operations)
 * - History and sessions stored as graph-level metadata node
 * - Connection errors return graceful Results, not throws
 */
export class FalkorDBMemoryStore implements MemoryStore {
  private db: FalkorDB | null = null;
  private graphName: string;
  private graph: any; // FalkorDB Graph type
  private config: FalkorDBConfig;

  constructor(config: FalkorDBConfig = {}) {
    const {
      host = "localhost",
      port = 6379,
      graphName = "harmony_memory",
      username,
      password,
    } = config;

    this.graphName = graphName;
    this.config = config;
  }

  /**
   * Ensure connection is established. Lazy initialization.
   */
  private async connect(): Promise<void> {
    if (this.db) return;

    const { host = "localhost", port = 6379, username, password } = this.config;

    try {
      this.db = await FalkorDB.connect({
        socket: {
          host,
          port,
        },
        ...(username && { username }),
        ...(password && { password }),
      });
      this.graph = this.db.selectGraph(this.graphName);
    } catch (error) {
      throw new Error(
        `FalkorDB connection failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Load entire MemoryState from FalkorDB graph.
   * Reconstructs items, edges, and metadata from nodes/relationships.
   */
  async load(): Promise<MemoryState | null> {
    await this.connect();

    try {
      // Load metadata node (contains state id, born, energy, threshold, history, policy)
      const metaResult = await this.graph.query(
        "MATCH (meta:Metadata) RETURN meta LIMIT 1"
      );

      if (!metaResult.resultSet || metaResult.resultSet.length === 0) {
        return null; // No state exists yet
      }

      const metaNode = metaResult.resultSet[0][0];
      const metadata = metaNode.properties;

      // Load all Memory nodes
      const itemsResult = await this.graph.query(
        "MATCH (m:Memory) RETURN m"
      );

      const items: Record<string, MemoryItem> = {};
      if (itemsResult.resultSet) {
        for (const row of itemsResult.resultSet) {
          const node = row[0];
          const props = node.properties;

          const item: MemoryItem = {
            id: props.id,
            type: props.type,
            text: props.text,
            tags: props.tags ? JSON.parse(props.tags) : [],
            importance: props.importance,
            energy: props.energy,
            createdAt: props.createdAt,
            updatedAt: props.updatedAt,
            ...(props.ttl && { ttl: props.ttl }),
            ...(props.scope && { scope: props.scope }),
            ...(props.lastAccessedAt && { lastAccessedAt: props.lastAccessedAt }),
            ...(props.accessCount && { accessCount: props.accessCount }),
            ...(props.success !== undefined && { success: props.success }),
            ...(props.fail !== undefined && { fail: props.fail }),
          };

          items[item.id] = item;
        }
      }

      // Load all edges (relationships between Memory nodes)
      const edgesResult = await this.graph.query(
        "MATCH (from:Memory)-[r]->(to:Memory) RETURN from.id, type(r), to.id, r.weight, r.lastReinforcedAt"
      );

      const edges: MemoryEdge[] = [];
      if (edgesResult.resultSet) {
        for (const row of edgesResult.resultSet) {
          edges.push({
            from: row[0],
            relation: row[1],
            to: row[2],
            weight: row[3] || 0.5,
            lastReinforcedAt: row[4] || Date.now(),
          });
        }
      }

      // Reconstruct full state
      const state: MemoryState = {
        id: metadata.id,
        born: metadata.born,
        energy: metadata.energy,
        threshold: metadata.threshold,
        items,
        edges,
        history: metadata.history ? JSON.parse(metadata.history) : [],
        ...(metadata.policy && { policy: JSON.parse(metadata.policy) }),
        ...(metadata.policyVersions && { policyVersions: JSON.parse(metadata.policyVersions) }),
        ...(metadata.recentSessions && { recentSessions: JSON.parse(metadata.recentSessions) }),
      };

      return state;
    } catch (error) {
      throw new Error(
        `Failed to load from FalkorDB: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Save entire MemoryState to FalkorDB.
   * Strategy: MERGE metadata, MERGE all Memory nodes, DELETE old edges, CREATE new edges.
   */
  async save(state: MemoryState): Promise<void> {
    await this.connect();

    try {
      // 1. Save/update metadata node
      const metadataProps = {
        id: state.id,
        born: state.born,
        energy: state.energy,
        threshold: state.threshold,
        history: JSON.stringify(state.history),
        ...(state.policy && { policy: JSON.stringify(state.policy) }),
        ...(state.policyVersions && { policyVersions: JSON.stringify(state.policyVersions) }),
        ...(state.recentSessions && { recentSessions: JSON.stringify(state.recentSessions) }),
      };

      const metaQuery = `
        MERGE (meta:Metadata {id: $id})
        SET meta.born = $born,
            meta.energy = $energy,
            meta.threshold = $threshold,
            meta.history = $history
            ${state.policy ? ", meta.policy = $policy" : ""}
            ${state.policyVersions ? ", meta.policyVersions = $policyVersions" : ""}
            ${state.recentSessions ? ", meta.recentSessions = $recentSessions" : ""}
        RETURN meta
      `;

      await this.graph.query(metaQuery, metadataProps);

      // 2. Upsert all Memory nodes
      for (const item of Object.values(state.items)) {
        const nodeProps = {
          id: item.id,
          type: item.type,
          text: item.text,
          tags: JSON.stringify(item.tags),
          importance: item.importance,
          energy: item.energy,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          ...(item.ttl && { ttl: item.ttl }),
          ...(item.scope && { scope: item.scope }),
          ...(item.lastAccessedAt && { lastAccessedAt: item.lastAccessedAt }),
          ...(item.accessCount && { accessCount: item.accessCount }),
          ...(item.success !== undefined && { success: item.success }),
          ...(item.fail !== undefined && { fail: item.fail }),
        };

        const nodeQuery = `
          MERGE (m:Memory {id: $id})
          SET m.type = $type,
              m.text = $text,
              m.tags = $tags,
              m.importance = $importance,
              m.energy = $energy,
              m.createdAt = $createdAt,
              m.updatedAt = $updatedAt
              ${item.ttl ? ", m.ttl = $ttl" : ""}
              ${item.scope ? ", m.scope = $scope" : ""}
              ${item.lastAccessedAt ? ", m.lastAccessedAt = $lastAccessedAt" : ""}
              ${item.accessCount ? ", m.accessCount = $accessCount" : ""}
              ${item.success !== undefined ? ", m.success = $success" : ""}
              ${item.fail !== undefined ? ", m.fail = $fail" : ""}
          RETURN m
        `;

        await this.graph.query(nodeQuery, nodeProps);
      }

      // 3. Delete all existing edges, then recreate from state
      await this.graph.query("MATCH (:Memory)-[r]->(:Memory) DELETE r");

      // 4. Create all edges
      for (const edge of state.edges) {
        // Sanitize relation name (Cypher relationship types must be alphanumeric + underscore)
        const relationType = edge.relation.replace(/[^a-zA-Z0-9_]/g, "_").toUpperCase();

        const edgeQuery = `
          MATCH (from:Memory {id: $from})
          MATCH (to:Memory {id: $to})
          CREATE (from)-[r:${relationType} {weight: $weight, lastReinforcedAt: $lastReinforcedAt}]->(to)
          RETURN r
        `;

        await this.graph.query(edgeQuery, {
          from: edge.from,
          to: edge.to,
          weight: edge.weight,
          lastReinforcedAt: edge.lastReinforcedAt,
        });
      }
    } catch (error) {
      throw new Error(
        `Failed to save to FalkorDB: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Search memories using Cypher query patterns.
   * Supports text matching, property filters, and graph patterns.
   *
   * Examples:
   * - "MATCH (m:Memory) WHERE m.text CONTAINS 'agent' RETURN m"
   * - "MATCH (m:Memory) WHERE m.importance > 0.8 RETURN m ORDER BY m.importance DESC"
   */
  async search(
    cypherQuery: string,
    params: Record<string, any> = {},
    options: SearchOptions = {}
  ): Promise<Result<MemoryItem[], MemoryError>> {
    await this.connect();

    try {
      const { limit = 10 } = options;

      // Append LIMIT if not already in query
      const finalQuery = cypherQuery.includes("LIMIT")
        ? cypherQuery
        : `${cypherQuery} LIMIT ${limit}`;

      const result = await this.graph.query(finalQuery, params);

      const items: MemoryItem[] = [];
      if (result.resultSet) {
        for (const row of result.resultSet) {
          const node = row[0];
          if (node && node.properties) {
            const props = node.properties;
            items.push({
              id: props.id,
              type: props.type,
              text: props.text,
              tags: props.tags ? JSON.parse(props.tags) : [],
              importance: props.importance,
              energy: props.energy,
              createdAt: props.createdAt,
              updatedAt: props.updatedAt,
              ...(props.ttl && { ttl: props.ttl }),
              ...(props.scope && { scope: props.scope }),
              ...(props.lastAccessedAt && { lastAccessedAt: props.lastAccessedAt }),
              ...(props.accessCount && { accessCount: props.accessCount }),
              ...(props.success !== undefined && { success: props.success }),
              ...(props.fail !== undefined && { fail: props.fail }),
            });
          }
        }
      }

      return Ok(items);
    } catch (error) {
      return Err(
        makeStorageError(
          "search",
          error instanceof Error ? error : new Error(String(error))
        )
      );
    }
  }

  /**
   * Get neighbors of a memory node for spreading activation.
   * Returns nodes connected to the given ID, optionally with depth control.
   *
   * Used for:
   * - Spreading activation (finding related memories)
   * - Context expansion (walking the graph)
   * - Co-activation tracking
   */
  async getNeighbors(
    memoryId: string,
    options: GetNeighborsOptions = {}
  ): Promise<Result<MemoryItem[], MemoryError>> {
    await this.connect();

    try {
      const { maxDepth = 1, minWeight = 0.0, limit = 20 } = options;

      // Build path pattern based on depth
      let pathPattern = "";
      if (maxDepth === 1) {
        pathPattern = "(m:Memory {id: $memoryId})-[r]-(neighbor:Memory)";
      } else {
        pathPattern = `(m:Memory {id: $memoryId})-[r*1..${maxDepth}]-(neighbor:Memory)`;
      }

      const query = `
        MATCH ${pathPattern}
        WHERE r.weight >= $minWeight
        RETURN DISTINCT neighbor
        LIMIT $limit
      `;

      const result = await this.graph.query(query, {
        memoryId,
        minWeight,
        limit,
      });

      const neighbors: MemoryItem[] = [];
      if (result.resultSet) {
        for (const row of result.resultSet) {
          const node = row[0];
          if (node && node.properties) {
            const props = node.properties;
            neighbors.push({
              id: props.id,
              type: props.type,
              text: props.text,
              tags: props.tags ? JSON.parse(props.tags) : [],
              importance: props.importance,
              energy: props.energy,
              createdAt: props.createdAt,
              updatedAt: props.updatedAt,
              ...(props.ttl && { ttl: props.ttl }),
              ...(props.scope && { scope: props.scope }),
              ...(props.lastAccessedAt && { lastAccessedAt: props.lastAccessedAt }),
              ...(props.accessCount && { accessCount: props.accessCount }),
              ...(props.success !== undefined && { success: props.success }),
              ...(props.fail !== undefined && { fail: props.fail }),
            });
          }
        }
      }

      return Ok(neighbors);
    } catch (error) {
      return Err(
        makeStorageError(
          "getNeighbors",
          error instanceof Error ? error : new Error(String(error))
        )
      );
    }
  }

  /**
   * Close the database connection.
   */
  async close(): Promise<void> {
    if (!this.db) return;

    try {
      await this.db.close();
      this.db = null;
      this.graph = null;
    } catch (error) {
      // Graceful close - log but don't throw
      console.error(
        `Error closing FalkorDB connection: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
