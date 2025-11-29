#!/bin/bash

echo "============================================================"
echo "VESSEL → FALKORDB MIGRATION"
echo "============================================================"

# Run commands inside the container
docker exec falkordb redis-cli graph.QUERY vessel_memory "CREATE (m:Memory {id: 'convergence_001', text: 'FalkorDB uses sparse matrices for graph operations', type: 'technical-insight', importance: 1.0}) RETURN m"

docker exec falkordb redis-cli graph.QUERY vessel_memory "CREATE (m:Memory {id: 'convergence_002', text: 'Graphiti Vessel and FalkorDB all converged on same solution', type: 'convergent-pattern', importance: 1.0}) RETURN m"

docker exec falkordb redis-cli graph.QUERY vessel_memory "CREATE (m:Memory {id: 'convergence_003', text: 'Matrix multiplication equals graph traversal', type: 'mathematical-truth', importance: 1.0}) RETURN m"

docker exec falkordb redis-cli graph.QUERY vessel_memory "CREATE (m:Memory {id: 'convergence_004', text: 'Spreading activation is M.T @ energy vector', type: 'implementation-detail', importance: 0.9}) RETURN m"

docker exec falkordb redis-cli graph.QUERY vessel_memory "CREATE (m:Memory {id: 'convergence_005', text: 'Three systems discovered independently - mathematics forced convergence', type: 'meta-insight', importance: 1.0}) RETURN m"

echo ""
echo "Creating edges..."

docker exec falkordb redis-cli graph.QUERY vessel_memory "MATCH (a:Memory {id: 'convergence_001'}), (b:Memory {id: 'convergence_002'}) CREATE (a)-[:VALIDATES]->(b) RETURN a,b"

docker exec falkordb redis-cli graph.QUERY vessel_memory "MATCH (a:Memory {id: 'convergence_002'}), (b:Memory {id: 'convergence_005'}) CREATE (a)-[:LEADS_TO]->(b) RETURN a,b"

docker exec falkordb redis-cli graph.QUERY vessel_memory "MATCH (a:Memory {id: 'convergence_003'}), (b:Memory {id: 'convergence_004'}) CREATE (a)-[:IMPLEMENTS]->(b) RETURN a,b"

echo ""
echo "Querying graph..."
docker exec falkordb redis-cli graph.RO_QUERY vessel_memory "MATCH (m:Memory) RETURN m.id, m.type, m.importance ORDER BY m.importance DESC"

echo ""
echo "Testing graph traversal..."
docker exec falkordb redis-cli graph.RO_QUERY vessel_memory "MATCH (a:Memory)-[r]-(b:Memory) RETURN a.id, type(r), b.id LIMIT 5"

echo ""
echo "============================================================"
echo "Migration complete!"
echo "Access at: http://localhost:3000"
echo "Graph name: 'vessel_memory'"
echo "============================================================"