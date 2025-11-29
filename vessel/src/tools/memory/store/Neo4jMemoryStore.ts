import neo4j, { Driver, Session, Result } from "neo4j-driver";
import type { MemoryState, MemoryItem, MemoryEdge } from "../types";

export interface Association {
  fromId: string;
  toId: string;
  relation: string;
  weight: number;
  count?: number;
}
import type { MemoryStore } from "./MemoryStore";

/**
 * Neo4j-backed memory store for real graph persistence.
 * Implements bi-temporal model: event time + ingestion time.
 */
export class Neo4jMemoryStore implements MemoryStore {
  private driver: Driver | null = null;
  private readonly uri: string;
  private readonly user: string;
  private readonly password: string;

  constructor(
    uri = process.env.NEO4J_URI || "bolt://localhost:7687",
    user = process.env.NEO4J_USER || "neo4j", 
    password = process.env.NEO4J_PASSWORD || "password"
  ) {
    this.uri = uri;
    this.user = user;
    this.password = password;
  }

  private async connect(): Promise<Driver> {
    if (!this.driver) {
      this.driver = neo4j.driver(this.uri, neo4j.auth.basic(this.user, this.password));
      
      // Verify connection
      const session = this.driver.session();
      try {
        await session.run("RETURN 1");
      } finally {
        await session.close();
      }
      
      // Create indexes for performance
      await this.createIndexes();
    }
    return this.driver;
  }

  private async createIndexes(): Promise<void> {
    const session = this.driver!.session();
    try {
      // Create indexes for memory items
      await session.run(
        "CREATE INDEX memory_id IF NOT EXISTS FOR (m:Memory) ON (m.id)"
      );
      await session.run(
        "CREATE INDEX memory_timestamp IF NOT EXISTS FOR (m:Memory) ON (m.timestamp)"
      );
      await session.run(
        "CREATE INDEX memory_type IF NOT EXISTS FOR (m:Memory) ON (m.type)"
      );
      
      // Create index for tags
      await session.run(
        "CREATE INDEX tag_name IF NOT EXISTS FOR (t:Tag) ON (t.name)"
      );
    } finally {
      await session.close();
    }
  }

  async load(): Promise<MemoryState | null> {
    const driver = await this.connect();
    const session = driver.session();
    
    try {
      // Load all memory items
      const itemsResult = await session.run(`
        MATCH (m:Memory)
        OPTIONAL MATCH (m)-[:TAGGED]->(t:Tag)
        RETURN m.id as id, m.text as text, m.type as type, 
               m.importance as importance, m.timestamp as timestamp,
               m.lastAccessed as lastAccessed, m.accessCount as accessCount,
               m.recallCount as recallCount, m.successCount as successCount,
               m.failCount as failCount, m.usefulness as usefulness,
               m.energy as energy, m.ttl as ttl,
               collect(DISTINCT t.name) as tags
        ORDER BY m.timestamp DESC
      `);
      
      const itemsArray: MemoryItem[] = itemsResult.records.map(record => ({
        id: record.get("id"),
        text: record.get("text"),
        type: record.get("type"),
        importance: record.get("importance"),
        energy: record.get("energy") || 0,
        ttl: record.get("ttl"),
        tags: record.get("tags") || [],
        createdAt: record.get("timestamp"),
        updatedAt: record.get("timestamp"),
        lastAccessedAt: record.get("lastAccessed"),
        accessCount: record.get("accessCount") || 0,
        success: record.get("successCount") || 0,
        fail: record.get("failCount") || 0
      }));
      
      // Convert to Record format
      const items: Record<string, MemoryItem> = {};
      for (const item of itemsArray) {
        items[item.id] = item;
      }
      
      // Load associations
      const assocResult = await session.run(`
        MATCH (from:Memory)-[r:ASSOCIATED]->(to:Memory)
        RETURN from.id as fromId, to.id as toId, 
               r.relation as relation, r.weight as weight, r.count as count
      `);
      
      const edges: MemoryEdge[] = assocResult.records.map(record => ({
        from: record.get("fromId"),
        to: record.get("toId"),
        relation: record.get("relation"),
        weight: record.get("weight"),
        lastReinforcedAt: Date.now()
      }));
      
      // Load policy state if exists
      const policyResult = await session.run(`
        MATCH (p:Policy)
        RETURN p.state as state
        LIMIT 1
      `);
      
      const policyState = policyResult.records.length > 0 
        ? JSON.parse(policyResult.records[0].get("state"))
        : undefined;
      
      return {
        id: "workspace",
        born: Date.now(),
        energy: 0,
        threshold: 100,
        items,
        edges,
        history: [],
        policy: policyState
      };
    } finally {
      await session.close();
    }
  }

  async save(state: MemoryState, snapshotSExpr: string): Promise<void> {
    const driver = await this.connect();
    const session = driver.session();
    const tx = session.beginTransaction();
    
    try {
      // Clear existing data
      await tx.run("MATCH (n) DETACH DELETE n");
      
      // Save memory items
      for (const item of Object.values(state.items)) {
        // Create memory node
        await tx.run(`
          CREATE (m:Memory {
            id: $id,
            text: $text,
            type: $type,
            importance: $importance,
            timestamp: $timestamp,
            lastAccessed: $lastAccessed,
            accessCount: $accessCount,
            recallCount: $recallCount,
            successCount: $successCount,
            failCount: $failCount,
            usefulness: $usefulness,
            energy: $energy,
            ttl: $ttl
          })
        `, {
          ...item,
          timestamp: item.createdAt,
          lastAccessed: item.lastAccessedAt || item.createdAt,
          successCount: item.success || 0,
          failCount: item.fail || 0,
          usefulness: item.importance
        });
        
        // Create tags and relationships
        for (const tag of item.tags) {
          await tx.run(`
            MATCH (m:Memory {id: $itemId})
            MERGE (t:Tag {name: $tag})
            CREATE (m)-[:TAGGED]->(t)
          `, { itemId: item.id, tag });
        }
      }
      
      // Save edges
      for (const edge of state.edges) {
        await tx.run(`
          MATCH (from:Memory {id: $fromId})
          MATCH (to:Memory {id: $toId})
          CREATE (from)-[:ASSOCIATED {
            relation: $relation,
            weight: $weight,
            lastReinforcedAt: $lastReinforcedAt
          }]->(to)
        `, {
          fromId: edge.from,
          toId: edge.to,
          relation: edge.relation,
          weight: edge.weight,
          lastReinforcedAt: edge.lastReinforcedAt
        });
      }
      
      // Save policy state
      if (state.policy) {
        await tx.run(`
          MERGE (p:Policy)
          SET p.state = $state
        `, { state: JSON.stringify(state.policy) });
      }
      
      // Save S-expression snapshot as property
      await tx.run(`
        MERGE (s:Snapshot)
        SET s.sexpr = $sexpr, s.timestamp = $timestamp
      `, { 
        sexpr: snapshotSExpr, 
        timestamp: Date.now() 
      });
      
      await tx.commit();
    } catch (error) {
      await tx.rollback();
      throw error;
    } finally {
      await session.close();
    }
  }

  async close(): Promise<void> {
    if (this.driver) {
      await this.driver.close();
      this.driver = null;
    }
  }

  /**
   * Run a Cypher query directly on the graph.
   * This enables S-expression to Cypher translation.
   */
  async runCypher(query: string, params?: Record<string, any>): Promise<Result> {
    const driver = await this.connect();
    const session = driver.session();
    
    try {
      return await session.run(query, params);
    } finally {
      await session.close();
    }
  }

  /**
   * Get graph statistics for manifest generation.
   */
  async getGraphStats(): Promise<{
    nodeCount: number;
    edgeCount: number;
    density: number;
    avgDegree: number;
  }> {
    const driver = await this.connect();
    const session = driver.session();
    
    try {
      const result = await session.run(`
        MATCH (n:Memory)
        WITH count(n) as nodeCount
        MATCH ()-[r:ASSOCIATED]->()
        WITH nodeCount, count(r) as edgeCount
        RETURN nodeCount, edgeCount,
               toFloat(edgeCount) / (nodeCount * (nodeCount - 1)) as density,
               toFloat(edgeCount) * 2.0 / nodeCount as avgDegree
      `);
      
      const record = result.records[0];
      return {
        nodeCount: record.get("nodeCount").toNumber(),
        edgeCount: record.get("edgeCount").toNumber(),
        density: record.get("density"),
        avgDegree: record.get("avgDegree")
      };
    } finally {
      await session.close();
    }
  }
}