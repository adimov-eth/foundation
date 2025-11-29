# Technical Implementation: Graph → 500 Token Description

**Status:** Implementation Guide (V's specification from Aug 11, 2025)
**Source:** V's Telegram messages (Aug 11, 22:51) → committed Sept 15
**Last Updated:** September 15, 2025
**Canonical Vision:** [architecture-brief.md](./architecture-brief.md)
**Research:** [idea.md](./idea.md)

---

## Context

This document contains **V's exact technical specification** for implementing manifest generation (sent via Telegram Aug 11, committed to repo Sept 15).

**What it specifies:**
- Data structures (GraphManifest, Community, TopologyMetrics, TemporalLayers)
- Algorithm pipeline (Leiden → centrality → temporal → LLM summarization)
- Performance targets (<500ms for 10K nodes, 400-500 tokens output)
- Integration strategy (GraphitiWithManifest wrapper)

**Current status:** ManifestGenerator.ts implements most of this (Louvain instead of Leiden, Anthropic instead of OpenAI), but **not yet integrated into tool descriptions**.

---

## Data Structures

class GraphManifest:
    communities: Dict[str, Community]  # Leiden-detected clusters
    topology: TopologyMetrics
    temporal: TemporalLayers
    bridges: List[EdgeID]
    
class Community:
    id: str
    nodes: Set[NodeID]
    centroid: np.array  # 768-dim embedding
    summary: str  # LLM-generated, 50 tokens max
    keywords: List[str]  # Top 5 by TF-IDF
    importance: float  # PageRank sum of nodes
    volatility: float  # Update frequency last 7d
    
class TopologyMetrics:
    node_count: int
    edge_count: int
    density: float
    clustering_coef: float
    modularity: float
    largest_component_ratio: float
    
class TemporalLayers:
    stable: List[NodeID]  # >30d unchanged
    active: List[NodeID]  # accessed last 7d
    emerging: List[NodeID]  # created last 24h
### Algorithm Pipeline

def generate_manifest(graphiti_graph) -> str:
    # 1. Community Detection (practically ~O(K·M), iterations × edges)
    communities = leiden_algorithm(
        graph=graphiti_graph,
        resolution=1.0,  # Tune for 5-10 communities
        quality_function='RBPotts'
    )
    
    # 2. Topology Extraction (O(V + E))
    metrics = {
        'nodes': len(graph.nodes),
        'edges': len(graph.edges),
        'density': nx.density(graph),
        'clustering': nx.average_clustering(graph),
        'components': nx.number_connected_components(graph)
    }
    
    # 3. Centrality Computation (O(V·E) power iteration; library-optimized)
    pagerank = nx.pagerank(graph, alpha=0.85)
    # Select top-k by PageRank
    from heapq import nlargest
    top_nodes = [n for n, _ in nlargest(5, pagerank.items(), key=lambda x: x[1])]
    bridges = nx.bridges(graph)  # O(V + E) with Tarjan
    
    # 4. Temporal Analysis (O(V))
    temporal = classify_by_timestamps(
        nodes=graph.nodes,
        thresholds={'stable': 30*24*3600, 'active': 7*24*3600}
    )
    
    # 5. Community Summarization (LLM calls)
    for community in communities:
        # Extract subgraph
        subgraph = graph.subgraph(community.nodes)
        
        # Generate embedding (mean of node embeddings)
        community.centroid = np.mean([
            node.embedding for node in community.nodes
        ])
        
        # LLM summary (batched for efficiency)
        community.summary = llm_summarize(
            nodes=community.nodes[:10],  # Top by degree
            edges=subgraph.edges[:20],
            max_tokens=50
        )
        
    # 6. Description Assembly
    return format_description(communities, metrics, temporal, top_nodes)
### Retrieval Logic
class GraphitiWithManifest:
    def __init__(self, graphiti_instance):
        self.graphiti = graphiti_instance
        self.manifest = None
        self.router = None
        self.update_threshold = 100  # Regenerate after N updates
        self.updates_since_manifest = 0
        
    def add_episode(self, *args, **kwargs):
        # Delegate to Graphiti
        result = self.graphiti.add_episode(*args, **kwargs)
        
        # Track updates
        self.updates_since_manifest += 1
        
        # Regenerate manifest if needed
        if self.updates_since_manifest > self.update_threshold:
            self.regenerate_manifest()
            
        return result
    
    def regenerate_manifest(self):
        # Run async to not block writes
        asyncio.create_task(self._generate_manifest_async())
        
    async def _generate_manifest_async(self):
        self.manifest = generate_manifest(self.graphiti.graph)
        self.router = ManifestRouter(self.manifest)
        self.updates_since_manifest = 0
        
    def search(self, query: str, **kwargs):
        # Route through manifest first
        if self.router:
            communities = self.router.route_query(query)
            kwargs['node_filter'] = extract_node_ids(communities)
        
        # Then use Graphiti's search
        return self.graphiti.search(query, **kwargs)
    
    @property
    def tool_description(self) -> str:
        if not self.manifest:
            return "Memory system initializing..."
        
        return f"Memory: {format_description(self.manifest)}"
### Performance Targets

- Manifest generation: <500ms for 10K nodes
- Community detection: Leiden with early stopping at 10 iterations
- LLM summarization: Batch all communities in single call
- Index building: HNSW with M=16, ef_construction=100
- Query routing: <10ms for community selection
- Description size: 400-500 tokens (enforce via truncation)

### Critical Implementation Details

1. Use Graphiti's existing Neo4j backend - don't duplicate storage
2. Generate manifest on separate thread - never block operations
3. Cache community embeddings - recompute only on membership change
4. Batch LLM calls - single call for all community summaries
5. Incremental updates - track dirty communities, partial regeneration
6. Fail open - if manifest unavailable, pass through to Graphiti directly

This gives you a working system that adds <10ms to query latency while providing rich navigation context in the tool description.

---

## See Also

**Context:**
- [architecture-brief.md](./architecture-brief.md) - V's 3-part vision (this spec implements Part 2)
- [idea.md](./idea.md) - Research foundation for this specification

**Implementation:**
- [spec.md](./spec.md) - Complete system spec including this manifest generation
- [IMPLEMENTATION-STATUS.md](../IMPLEMENTATION-STATUS.md) - Current progress (90% complete)

**Code:**
- `packages/vessel/src/tools/memory/manifest/ManifestGenerator.ts` - Current implementation
- `packages/vessel/src/tools/memory/MemoryToolInteraction.ts` - Integration point (lines 244-318)