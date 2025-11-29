#!/usr/bin/env python3
"""
Migration script to run INSIDE the FalkorDB container
This avoids the module loading issues with external connections
"""

import json
import redis

# Connect locally inside container
r = redis.Redis(host='localhost', port=6379, decode_responses=True)

print("=" * 60)
print("VESSEL → FALKORDB MIGRATION (INSIDE CONTAINER)")
print("=" * 60)

# Test graph module
try:
    result = r.execute_command('graph.LIST')
    print(f"Existing graphs: {result}")
except Exception as e:
    print(f"Graph module test: {e}")

# Create vessel_memory graph
graph_name = 'vessel_memory'

# Create test node
result = r.execute_command(
    'graph.QUERY', 
    graph_name,
    "CREATE (m:Memory {id: 'test_container', text: 'Migration from inside container works!', importance: 1.0}) RETURN m"
)
print(f"Created test node: Success")

# Load the vessel memory data (simplified for container execution)
memories_data = """
{
  "m_mf7cnc3s_8850e015": {
    "text": "FalkorDB: Revolutionary graph database using SPARSE MATRICES",
    "type": "technical-insight",
    "importance": 1.0,
    "energy": 0.5
  },
  "m_mf7cnwii_b0e0609c": {
    "text": "CONVERGENT DISCOVERY: FalkorDB, Graphiti, Vessel all use sparse matrices",
    "type": "convergent-pattern",
    "importance": 1.0,
    "energy": 0.8
  },
  "m_mf7ctxmx_e5342809": {
    "text": "Three projects solving same problem differently",
    "type": "meta-insight",
    "importance": 1.0,
    "energy": 0.7
  }
}
"""

memories = json.loads(memories_data)

# Migrate memories
print(f"\nMigrating {len(memories)} key memories...")
for memory_id, memory in memories.items():
    text = memory['text'].replace("'", "\\'")
    query = f"""
    CREATE (m:Memory {{
        id: '{memory_id}',
        text: '{text}',
        type: '{memory['type']}',
        importance: {memory['importance']},
        energy: {memory['energy']}
    }})
    RETURN m.id
    """
    
    try:
        result = r.execute_command('graph.QUERY', graph_name, query)
        print(f"  ✓ Migrated {memory_id[:20]}...")
    except Exception as e:
        print(f"  ✗ Failed: {e}")

# Create edges
print("\nCreating knowledge edges...")
edges = [
    ("m_mf7cnc3s_8850e015", "m_mf7cnwii_b0e0609c", "VALIDATES"),
    ("m_mf7cnwii_b0e0609c", "m_mf7ctxmx_e5342809", "IMPLEMENTS")
]

for from_id, to_id, relation in edges:
    query = f"""
    MATCH (from:Memory {{id: '{from_id}'}})
    MATCH (to:Memory {{id: '{to_id}'}})
    CREATE (from)-[r:{relation}]->(to)
    RETURN r
    """
    
    try:
        result = r.execute_command('graph.QUERY', graph_name, query)
        print(f"  ✓ Created edge {relation}")
    except Exception as e:
        print(f"  ✗ Failed: {e}")

# Query the graph
print("\nQuerying knowledge graph...")
result = r.execute_command(
    'graph.QUERY',
    graph_name,
    "MATCH (m:Memory) RETURN m.id, m.type, m.importance ORDER BY m.importance DESC"
)

print("High-importance memories:")
# Parse result (FalkorDB returns specific format)
if len(result) > 1:
    for row in result[1]:
        if row:
            print(f"  - {row[0][:30]}... ({row[1]}) [{row[2]}]")

print("\n" + "=" * 60)
print("MIGRATION COMPLETE")
print("Graph: 'vessel_memory' created in FalkorDB")
print("=" * 60)