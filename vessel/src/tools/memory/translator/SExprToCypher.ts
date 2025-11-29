/**
 * S-Expression to Cypher Query Translator
 * 
 * Translates LISP-like S-expressions into Neo4j Cypher queries.
 * This enables homoiconic query execution against the graph database.
 */

export interface CypherQuery {
  query: string;
  params: Record<string, any>;
}

export class SExprToCypher {
  /**
   * Parse and translate an S-expression to Cypher.
   * 
   * Examples:
   * (recall "consciousness" 10) -> MATCH query with text search
   * (associate "id1" "id2" "relates-to" 0.8) -> CREATE relationship
   * (remember "text" "type" 0.9 "30d" (list "tag1" "tag2")) -> CREATE node
   * (feedback "id" "success") -> UPDATE node properties
   */
  translate(sexpr: string): CypherQuery {
    const parsed = this.parseSExpr(sexpr);
    
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error(`Invalid S-expression: ${sexpr}`);
    }
    
    const [command, ...args] = parsed;
    
    switch (command) {
      case "recall":
        return this.translateRecall(args);
      case "remember":
        return this.translateRemember(args);
      case "associate":
        return this.translateAssociate(args);
      case "feedback":
        return this.translateFeedback(args);
      case "trace":
        return this.translateTrace(args);
      case "activate":
        return this.translateActivate(args);
      case "decay!":
        return this.translateDecay(args);
      case "consolidate":
        return this.translateConsolidate(args);
      case "stats":
        return this.translateStats();
      default:
        throw new Error(`Unknown command: ${command}`);
    }
  }

  private parseSExpr(sexpr: string): any {
    // Simple S-expression parser
    // This is a basic implementation - could be replaced with proper LISP parser
    
    sexpr = sexpr.trim();
    
    if (!sexpr.startsWith("(") || !sexpr.endsWith(")")) {
      throw new Error("S-expression must be wrapped in parentheses");
    }
    
    // Remove outer parentheses
    sexpr = sexpr.slice(1, -1).trim();
    
    // Tokenize (very basic - doesn't handle nested parens properly yet)
    const tokens: any[] = [];
    let current = "";
    let inString = false;
    let depth = 0;
    
    for (let i = 0; i < sexpr.length; i++) {
      const char = sexpr[i];
      
      if (char === '"' && sexpr[i - 1] !== "\\") {
        inString = !inString;
        current += char;
      } else if (!inString) {
        if (char === "(") {
          depth++;
          current += char;
        } else if (char === ")") {
          depth--;
          current += char;
        } else if (char === " " && depth === 0) {
          if (current) {
            tokens.push(this.parseToken(current));
            current = "";
          }
        } else {
          current += char;
        }
      } else {
        current += char;
      }
    }
    
    if (current) {
      tokens.push(this.parseToken(current));
    }
    
    return tokens;
  }

  private parseToken(token: string): any {
    // Parse individual token
    if (token.startsWith('"') && token.endsWith('"')) {
      return token.slice(1, -1); // String
    } else if (token.startsWith("(") && token.endsWith(")")) {
      return this.parseSExpr(token); // Nested list
    } else if (token === "nil") {
      return null;
    } else if (!isNaN(parseFloat(token))) {
      return parseFloat(token); // Number
    } else {
      return token; // Symbol
    }
  }

  private translateRecall(args: any[]): CypherQuery {
    const [query, limit = 10] = args;
    
    return {
      query: `
        MATCH (m:Memory)
        WHERE toLower(m.text) CONTAINS toLower($query)
           OR ANY(tag IN m.tags WHERE toLower(tag) CONTAINS toLower($query))
        RETURN m.id as id, m.text as text, m.type as type, 
               m.importance as importance, m.energy as energy,
               m.timestamp as timestamp, m.lastAccessed as lastAccessed,
               m.tags as tags
        ORDER BY m.energy DESC, m.importance DESC
        LIMIT $limit
      `,
      params: { query, limit }
    };
  }

  private translateRemember(args: any[]): CypherQuery {
    const [text, type, importance, ttl, tags] = args;
    const id = `m_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const timestamp = Date.now();
    
    // Parse tags if it's a list expression
    let tagList: string[] = [];
    if (typeof tags === "string" && tags.startsWith("(list")) {
      const tagExpr = tags.slice(5, -1).trim();
      tagList = tagExpr.split(" ").map(t => t.replace(/"/g, ""));
    } else if (Array.isArray(tags)) {
      tagList = tags.filter(t => t !== "list");
    }
    
    return {
      query: `
        CREATE (m:Memory {
          id: $id,
          text: $text,
          type: $type,
          importance: $importance,
          timestamp: $timestamp,
          lastAccessed: $timestamp,
          accessCount: 0,
          recallCount: 0,
          successCount: 0,
          failCount: 0,
          usefulness: 0,
          energy: $importance,
          ttl: $ttl
        })
        WITH m
        UNWIND $tags as tag
        MERGE (t:Tag {name: tag})
        CREATE (m)-[:TAGGED]->(t)
        RETURN m.id as id
      `,
      params: {
        id,
        text,
        type,
        importance,
        timestamp,
        ttl,
        tags: tagList
      }
    };
  }

  private translateAssociate(args: any[]): CypherQuery {
    const [fromId, toId, relation, weight] = args;
    
    return {
      query: `
        MATCH (from:Memory {id: $fromId})
        MATCH (to:Memory {id: $toId})
        MERGE (from)-[r:ASSOCIATED]->(to)
        SET r.relation = $relation,
            r.weight = $weight,
            r.count = COALESCE(r.count, 0) + 1
        RETURN from.id as fromId, to.id as toId, r.weight as weight
      `,
      params: { fromId, toId, relation, weight }
    };
  }

  private translateFeedback(args: any[]): CypherQuery {
    const [id, outcome] = args;
    const isSuccess = outcome === "success";
    
    return {
      query: `
        MATCH (m:Memory {id: $id})
        SET m.${isSuccess ? "successCount" : "failCount"} = 
            COALESCE(m.${isSuccess ? "successCount" : "failCount"}, 0) + 1,
            m.usefulness = 
              CASE 
                WHEN m.successCount + m.failCount > 0 
                THEN toFloat(m.successCount) / (m.successCount + m.failCount)
                ELSE 0
              END,
            m.energy = m.energy * ${isSuccess ? 1.1 : 0.9}
        RETURN m.id as id, m.usefulness as usefulness
      `,
      params: { id }
    };
  }

  private translateTrace(args: any[]): CypherQuery {
    const [startId, depth = 2] = args;
    
    return {
      query: `
        MATCH path = (start:Memory {id: $startId})-[:ASSOCIATED*1..${depth}]->(end:Memory)
        RETURN [node in nodes(path) | {
          id: node.id, 
          text: node.text,
          type: node.type
        }] as path,
        [rel in relationships(path) | {
          relation: rel.relation,
          weight: rel.weight
        }] as relations
      `,
      params: { startId }
    };
  }

  private translateActivate(args: any[]): CypherQuery {
    // Spreading activation from seed nodes
    const [seedIds, steps = 3, decayFactor = 0.85, threshold = 0.01] = args;
    
    // Parse seed IDs if it's a list expression
    let seeds: string[] = [];
    if (typeof seedIds === "string" && seedIds.startsWith("(list")) {
      const seedExpr = seedIds.slice(5, -1).trim();
      seeds = seedExpr.split(" ").map(s => s.replace(/"/g, ""));
    } else if (Array.isArray(seedIds)) {
      seeds = seedIds.filter(s => s !== "list");
    }
    
    // This would need a more complex implementation with APOC procedures
    // For now, return a simpler version
    return {
      query: `
        MATCH (m:Memory)
        WHERE m.id IN $seeds
        SET m.energy = 1.0
        WITH m
        MATCH (m)-[:ASSOCIATED*1..${steps}]-(connected:Memory)
        SET connected.energy = connected.energy * $decayFactor
        RETURN count(connected) as activated
      `,
      params: { seeds, decayFactor }
    };
  }

  private translateDecay(args: any[]): CypherQuery {
    const [halfLifeDays = 7] = args;
    const decayRate = Math.log(0.5) / (halfLifeDays * 24 * 60 * 60 * 1000);
    const now = Date.now();
    
    return {
      query: `
        MATCH (m:Memory)
        WITH m, $now - m.lastAccessed as timeSinceAccess
        SET m.energy = m.energy * exp($decayRate * timeSinceAccess)
        WHERE m.energy < 0.01
        SET m.energy = 0
        RETURN count(m) as decayed
      `,
      params: { now, decayRate }
    };
  }

  private translateConsolidate(args: any[]): CypherQuery {
    // Complex consolidation would require multiple queries
    // This is a simplified version
    return {
      query: `
        MATCH (m:Memory)
        WHERE m.energy < 0.1 AND m.accessCount < 2
        OPTIONAL MATCH (m)-[r:ASSOCIATED]-()
        DELETE r, m
        RETURN count(m) as pruned
      `,
      params: {}
    };
  }

  private translateStats(): CypherQuery {
    return {
      query: `
        MATCH (m:Memory)
        WITH count(m) as nodeCount, avg(m.energy) as avgEnergy
        MATCH ()-[r:ASSOCIATED]->()
        WITH nodeCount, avgEnergy, count(r) as edgeCount
        RETURN {
          nodes: nodeCount,
          edges: edgeCount,
          avgEnergy: avgEnergy,
          density: toFloat(edgeCount) / (nodeCount * (nodeCount - 1))
        } as stats
      `,
      params: {}
    };
  }

  /**
   * Execute a raw Cypher query from S-expression format.
   * Example: (cypher "MATCH (n) RETURN count(n)")
   */
  translateRawCypher(args: any[]): CypherQuery {
    const [query, params = {}] = args;
    return { query, params };
  }
}