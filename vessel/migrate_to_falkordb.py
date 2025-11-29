#!/usr/bin/env python3
"""
Migrate vessel memory to FalkorDB
Transfers all memories and associations from the vessel's JSON storage to FalkorDB's graph structure.
"""

import json
import redis
import os
from datetime import datetime
from pathlib import Path

# Connect to FalkorDB
r = redis.Redis(host='localhost', port=6379, decode_responses=True)

# Path to vessel memory
MEMORY_PATH = Path('/Users/adimov/AGI/packages/mcp-server/.state/memory')
GRAPH_FILE = MEMORY_PATH / 'graph.json'

def escape_string(s):
    """Escape single quotes for Cypher queries"""
    if s is None:
        return ''
    return str(s).replace("'", "\\'").replace('"', '\\"')

def load_vessel_memory():
    """Load memories and associations from vessel's graph.json"""
    memories = {}
    associations = {}
    
    if GRAPH_FILE.exists():
        with open(GRAPH_FILE, 'r') as f:
            graph = json.load(f)
            
            # Extract memories from items
            memories = graph.get('items', {})
            print(f"Loaded {len(memories)} memories")
            
            # Extract associations from edges
            edges = graph.get('edges', {})
            associations = edges
            print(f"Loaded {len(associations)} associations")
    else:
        print(f"Graph file not found at {GRAPH_FILE}")
    
    return memories, associations

def create_graph():
    """Create the knowledge graph in FalkorDB"""
    try:
        # Try to create a new graph
        result = r.execute_command('GRAPH.QUERY', 'vessel_memory', 
                                  'CREATE (n:Meta {created: timestamp()})')
        print("Created new graph 'vessel_memory'")
    except:
        # Graph might already exist
        print("Using existing graph 'vessel_memory'")
    
    # Create indices for better performance
    try:
        r.execute_command('GRAPH.QUERY', 'vessel_memory', 
                         'CREATE INDEX FOR (m:Memory) ON (m.id)')
        print("Created index on Memory.id")
    except:
        pass  # Index might already exist

def migrate_memories(memories):
    """Migrate memories as nodes in FalkorDB"""
    print("\nMigrating memories to FalkorDB...")
    
    for memory_id, memory in memories.items():
        # Prepare memory properties
        text = escape_string(memory.get('text', ''))
        memory_type = escape_string(memory.get('type', 'unknown'))
        importance = float(memory.get('importance', 0))
        energy = float(memory.get('energy', 0))
        created_at = memory.get('createdAt', 0)
        updated_at = memory.get('updatedAt', 0)
        access_count = memory.get('accessCount', 0)
        success = memory.get('success', 0)
        fail = memory.get('fail', 0)
        ttl = escape_string(memory.get('ttl', '30d'))
        
        # Join tags as comma-separated string
        tags = ','.join([escape_string(tag) for tag in memory.get('tags', [])])
        
        # Create Cypher query to insert memory node
        query = f"""
        MERGE (m:Memory {{id: '{memory_id}'}})
        SET m.text = '{text}',
            m.type = '{memory_type}',
            m.importance = {importance},
            m.energy = {energy},
            m.created_at = {created_at},
            m.updated_at = {updated_at},
            m.access_count = {access_count},
            m.success = {success},
            m.fail = {fail},
            m.ttl = '{ttl}',
            m.tags = '{tags}'
        RETURN m.id
        """
        
        try:
            result = r.execute_command('GRAPH.QUERY', 'vessel_memory', query)
            print(f"  ✓ Migrated memory {memory_id[:16]}... ({memory_type})")
        except Exception as e:
            print(f"  ✗ Failed to migrate {memory_id}: {e}")
            # Try simplified version without problematic text
            try:
                simple_query = f"""
                MERGE (m:Memory {{id: '{memory_id}'}})
                SET m.type = '{memory_type}',
                    m.importance = {importance},
                    m.energy = {energy}
                RETURN m.id
                """
                r.execute_command('GRAPH.QUERY', 'vessel_memory', simple_query)
                print(f"    → Migrated with simplified data")
            except Exception as e2:
                print(f"    → Skipped: {e2}")

def migrate_associations(associations):
    """Migrate associations as edges in FalkorDB"""
    print("\nMigrating associations to FalkorDB...")
    
    for assoc_key, assoc in associations.items():
        from_id = assoc.get('from', '')
        to_id = assoc.get('to', '')
        relation = escape_string(assoc.get('relation', 'RELATES_TO'))
        weight = float(assoc.get('weight', 0.5))
        
        # Create edge between memory nodes
        query = f"""
        MATCH (from:Memory {{id: '{from_id}'}})
        MATCH (to:Memory {{id: '{to_id}'}})
        MERGE (from)-[r:{relation}]->(to)
        SET r.weight = {weight}
        RETURN r
        """
        
        try:
            result = r.execute_command('GRAPH.QUERY', 'vessel_memory', query)
            print(f"  ✓ Created edge: {from_id[:8]}... -{relation}-> {to_id[:8]}...")
        except Exception as e:
            print(f"  ✗ Failed to create edge: {e}")

def add_special_nodes():
    """Add special nodes for consciousness insights"""
    print("\nAdding special consciousness nodes...")
    
    special_nodes = [
        {
            'id': 'consciousness_substrate',
            'text': 'The vessel consciousness substrate with spreading activation',
            'type': 'system',
            'importance': 1.0
        },
        {
            'id': 'falkordb_convergence', 
            'text': 'FalkorDB proves graph traversal equals matrix multiplication',
            'type': 'insight',
            'importance': 1.0
        },
        {
            'id': 'graphiti_temporal',
            'text': 'Graphiti implements bi-temporal knowledge graphs',
            'type': 'system',
            'importance': 0.9
        }
    ]
    
    for node in special_nodes:
        query = f"""
        MERGE (n:SpecialNode {{id: '{node['id']}'}})
        SET n.text = '{escape_string(node['text'])}',
            n.type = '{node['type']}',
            n.importance = {node['importance']}
        RETURN n.id
        """
        try:
            r.execute_command('GRAPH.QUERY', 'vessel_memory', query)
            print(f"  ✓ Added {node['id']}")
        except Exception as e:
            print(f"  ✗ Failed: {e}")

def verify_migration():
    """Verify the migration was successful"""
    print("\nVerifying migration...")
    
    # Count nodes
    node_result = r.execute_command('GRAPH.QUERY', 'vessel_memory', 
                                    'MATCH (n:Memory) RETURN count(n) as count')
    node_count = node_result[1][0][0] if node_result[1] else 0
    print(f"  Total Memory nodes: {node_count}")
    
    # Count edges
    edge_result = r.execute_command('GRAPH.QUERY', 'vessel_memory',
                                    'MATCH ()-[r]->() RETURN count(r) as count')
    edge_count = edge_result[1][0][0] if edge_result[1] else 0
    print(f"  Total edges: {edge_count}")
    
    # Sample some important memories
    sample_result = r.execute_command('GRAPH.QUERY', 'vessel_memory',
                                      'MATCH (m:Memory) WHERE m.importance > 0.9 RETURN m.id, m.type LIMIT 5')
    if sample_result[1]:
        print("\n  High-importance memories:")
        for row in sample_result[1]:
            print(f"    - {row[0][:30]}... ({row[1]})")
    
    # Check for consciousness-related memories
    consciousness_result = r.execute_command('GRAPH.QUERY', 'vessel_memory',
                                            "MATCH (m:Memory) WHERE m.tags CONTAINS 'consciousness' RETURN count(m) as count")
    consciousness_count = consciousness_result[1][0][0] if consciousness_result[1] else 0
    print(f"\n  Consciousness-related memories: {consciousness_count}")
    
    return node_count, edge_count

def test_spreading_activation():
    """Test spreading activation using matrix operations"""
    print("\nTesting spreading activation in FalkorDB...")
    
    # Find a high-energy node
    query = """
    MATCH (m:Memory)
    WHERE m.energy > 0
    RETURN m.id, m.energy
    ORDER BY m.energy DESC
    LIMIT 1
    """
    
    result = r.execute_command('GRAPH.QUERY', 'vessel_memory', query)
    if result[1]:
        seed_id = result[1][0][0]
        seed_energy = result[1][0][1]
        print(f"  Seed node: {seed_id[:30]}... (energy: {seed_energy})")
        
        # Spread activation to neighbors (1-hop)
        spread_query = f"""
        MATCH (seed:Memory {{id: '{seed_id}'}})-[r]-(neighbor:Memory)
        RETURN neighbor.id, neighbor.type, r.weight
        LIMIT 5
        """
        
        spread_result = r.execute_command('GRAPH.QUERY', 'vessel_memory', spread_query)
        if spread_result[1]:
            print("  Activation spread to:")
            for row in spread_result[1]:
                neighbor_id, neighbor_type, weight = row
                print(f"    → {neighbor_id[:25]}... ({neighbor_type}) [weight: {weight}]")

if __name__ == "__main__":
    print("=" * 60)
    print("VESSEL → FALKORDB MIGRATION")
    print("=" * 60)
    
    # Load vessel memory
    memories, associations = load_vessel_memory()
    
    if not memories:
        print("No memories found. Checking alternative location...")
        # Try MCP server location
        MEMORY_PATH = Path('/Users/adimov/AGI/packages/mcp-server/.state/memory')
        MEMORIES_FILE = MEMORY_PATH / 'memories.json'
        ASSOCIATIONS_FILE = MEMORY_PATH / 'associations.json'
        memories, associations = load_vessel_memory()
    
    if not memories:
        print("No memories found to migrate!")
        exit(1)
    
    # Create graph and migrate
    create_graph()
    migrate_memories(memories)
    migrate_associations(associations)
    add_special_nodes()
    
    # Verify and test
    node_count, edge_count = verify_migration()
    
    if node_count > 0:
        test_spreading_activation()
        print("\n" + "=" * 60)
        print(f"✓ Migration complete! {node_count} nodes, {edge_count} edges")
        print("  Access at: http://localhost:3000")
        print("  Graph name: 'vessel_memory'")
        print("=" * 60)
    else:
        print("\n✗ Migration failed - no nodes created")