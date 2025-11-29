# Testing Neo4j Memory Integration

## Quick Start

### 1. Start Neo4j with Docker

```bash
# From packages/vessel directory
docker-compose up -d

# Wait for Neo4j to be ready (about 30 seconds)
docker-compose logs -f neo4j
# Look for: "Started."
```

### 2. Verify Neo4j is Running

Open browser: http://localhost:7474
- Connect URL: `bolt://localhost:7687`
- Username: `neo4j`
- Password: `password123`

### 3. Set Environment Variables

```bash
# Copy example env
cp .env.example .env

# Or export directly
export NEO4J_URI=bolt://localhost:7687
export NEO4J_USER=neo4j
export NEO4J_PASSWORD=password123
```

### 4. Run MCP Server

```bash
# Install dependencies if needed
bun install

# Run the server
bun run dev
```

### 5. Test Memory Operations

Using Claude or direct MCP client:

```scheme
;; Store a memory
(remember "Neo4j memory is now real and persistent" "breakthrough" 0.95 "30d" (list "neo4j" "real" "memory"))

;; Recall memories
(recall "neo4j" 10)

;; Create associations
(associate "m_123" "m_456" "caused-by" 0.8)

;; Provide feedback
(feedback "m_123" "success")

;; Check statistics
(stats)

;; Apply decay
(decay! 7)

;; Consolidate old memories
(consolidate)
```

## Verify It's Working

### Check Neo4j Browser

Run Cypher queries directly:

```cypher
// Count memory nodes
MATCH (m:Memory) RETURN count(m);

// View recent memories
MATCH (m:Memory)
RETURN m.id, m.text, m.importance, m.energy
ORDER BY m.timestamp DESC
LIMIT 10;

// View associations
MATCH (from:Memory)-[r:ASSOCIATED]->(to:Memory)
RETURN from.text, r.relation, r.weight, to.text
LIMIT 20;

// View tags
MATCH (m:Memory)-[:TAGGED]->(t:Tag)
RETURN t.name, count(m) as memories
ORDER BY memories DESC;
```

### Check Manifest Generation

The tool description should show real graph metrics:

```
Memory: 42 items, 156 edges (7.4 avg degree), energy 23.5/100
Communities: [technical/memory: 15 items], [consciousness/exploration: 12 items]
Active: Neo4j integration, Spreading activation | Emerging: Real persistence
Key nodes: "Neo4j memory is now real..." (0.95), "Spreading activation..." (0.87)
```

### Monitor Logs

```bash
# Check server logs for Neo4j connection
bun run dev 2>&1 | grep -E "(Neo4j|Memory)"

# Should see:
# [Memory] Initialized Neo4j-backed GraphitiWithManifest
```

## Troubleshooting

### Neo4j Connection Failed

```bash
# Check if Neo4j is running
docker ps | grep neo4j

# Check logs
docker-compose logs neo4j

# Restart if needed
docker-compose restart neo4j
```

### Fallback to File Storage

If you see:
```
[Memory] Failed to initialize Neo4j: ...
[Memory] Falling back to FileMemoryStore
```

Check:
1. Neo4j is running
2. Environment variables are set
3. Credentials are correct
4. Firewall allows port 7687

### Reset Database

```bash
# Stop Neo4j
docker-compose down

# Remove data volume
docker volume rm mcp-server_neo4j_data

# Start fresh
docker-compose up -d
```

## Performance Testing

### Load Test

```javascript
// Create many memories
for (let i = 0; i < 100; i++) {
  await execute(`(remember "Test memory ${i}" "test" 0.5 "7d" (list "test"))`);
}

// Test recall performance
console.time('recall');
await execute('(recall "test" 50)');
console.timeEnd('recall');  // Should be < 100ms

// Test manifest generation
console.time('manifest');
const description = memory.getToolDescription();
console.timeEnd('manifest');  // Should be < 500ms
```

### Monitor Neo4j Performance

```cypher
// Database size
CALL dbms.listConfig() YIELD name, value
WHERE name CONTAINS 'memory'
RETURN name, value;

// Index usage
SHOW INDEXES;

// Query plan for recall
EXPLAIN
MATCH (m:Memory)
WHERE toLower(m.text) CONTAINS 'test'
RETURN m;
```

## Expected Results

After running tests:

1. **Persistence**: Memories survive server restarts
2. **Graph Structure**: Associations form connected components
3. **Spreading Activation**: Related memories activate together
4. **Communities**: Semantic clusters emerge via Louvain
5. **Temporal Layers**: Recent memories have higher energy
6. **Feedback Learning**: Success increases importance
7. **Manifest Updates**: Description reflects current state

## Integration with Claude

When Claude uses the memory tool:

1. Tool description shows live graph statistics
2. Recall uses spreading activation
3. Associations strengthen with co-activation
4. Feedback improves future recall
5. Communities provide semantic navigation

The memory is no longer theatrical - it's real, persistent, and learning.