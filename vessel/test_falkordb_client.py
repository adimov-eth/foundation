#!/usr/bin/env python3
"""
Test FalkorDB Python client with our running container
"""

from falkordb import FalkorDB, Graph
import json
from pathlib import Path

# Connect to FalkorDB
db = FalkorDB(host='localhost', port=6379)

# Create or get graph
graph = db.select_graph("vessel_memory")

# Test basic operations
print("=" * 60)
print("TESTING FALKORDB CLIENT")
print("=" * 60)

# Create a test node
result = graph.query("CREATE (m:Memory {id: 'test_001', text: 'FalkorDB client works!', importance: 1.0}) RETURN m")
print(f"Created test node: {result.result_set}")

# Query nodes
result = graph.query("MATCH (m:Memory) RETURN m.id, m.text LIMIT 5")
print(f"\nExisting memories: {result.result_set}")

# Now let's migrate our actual vessel memory
print("\n" + "=" * 60)
print("MIGRATING VESSEL MEMORY")
print("=" * 60)

# Load vessel memory graph
GRAPH_FILE = Path('/Users/adimov/AGI/packages/mcp-server/.state/memory/graph.json')

if GRAPH_FILE.exists():
    with open(GRAPH_FILE, 'r') as f:
        vessel_graph = json.load(f)
    
    memories = vessel_graph.get('items', {})
    edges = vessel_graph.get('edges', [])
    
    print(f"Found {len(memories)} memories and {len(edges)} edges")
    
    # Migrate memories (batch for efficiency)
    migrated = 0
    for memory_id, memory in list(memories.items())[:10]:  # First 10 for testing
        try:
            # Escape text for Cypher
            text = memory.get('text', '').replace("'", "\\'").replace('"', '\\"')[:200]
            memory_type = memory.get('type', 'unknown')
            importance = float(memory.get('importance', 0))
            energy = float(memory.get('energy', 0))
            
            query = f"""
            CREATE (m:Memory {{
                id: '{memory_id}',
                text: '{text}',
                type: '{memory_type}',
                importance: {importance},
                energy: {energy}
            }})
            RETURN m.id
            """
            
            result = graph.query(query)
            migrated += 1
            print(f"  ✓ Migrated {memory_id[:20]}... ({memory_type})")
            
        except Exception as e:
            print(f"  ✗ Failed {memory_id[:20]}...: {e}")
    
    print(f"\nMigrated {migrated} memories")
    
    # Add some edges
    edge_count = 0
    for edge in edges[:10]:  # First 10 edges
        try:
            from_id = edge.get('from', '')
            to_id = edge.get('to', '')
            relation = edge.get('relation', 'RELATES_TO').replace(' ', '_').upper()
            weight = float(edge.get('weight', 0.5))
            
            query = f"""
            MATCH (from:Memory {{id: '{from_id}'}})
            MATCH (to:Memory {{id: '{to_id}'}})
            CREATE (from)-[r:{relation} {{weight: {weight}}}]->(to)
            RETURN r
            """
            
            result = graph.query(query)
            edge_count += 1
            
        except Exception as e:
            pass  # Edges might fail if nodes don't exist
    
    print(f"Created {edge_count} edges")

# Test graph traversal
print("\n" + "=" * 60)
print("TESTING GRAPH TRAVERSAL")
print("=" * 60)

# Find high-importance memories
result = graph.query("""
MATCH (m:Memory)
WHERE m.importance > 0.8
RETURN m.id, m.type, m.importance
ORDER BY m.importance DESC
LIMIT 5
""")

print("High-importance memories:")
for row in result.result_set:
    if row:
        print(f"  - {row[0][:30]}... ({row[1]}) [importance: {row[2]}]")

# Test spreading activation (1-hop neighbors)
result = graph.query("""
MATCH (m:Memory {type: 'convergent-pattern'})-[r]-(neighbor:Memory)
RETURN m.id, neighbor.id, neighbor.type
LIMIT 5
""")

print("\nSpreading activation from convergent patterns:")
for row in result.result_set:
    if row:
        print(f"  {row[0][:20]}... -> {row[1][:20]}... ({row[2]})")

print("\n" + "=" * 60)
print("FALKORDB CLIENT TEST COMPLETE")
print("  Access graph at: http://localhost:3000")
print("  Graph name: 'vessel_memory'")
print("=" * 60)