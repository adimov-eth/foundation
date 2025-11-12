/**
 * Algebraic Hypergraphs - Free Algebra for Compositional Graph Construction
 *
 * A hypergraph where:
 * - Vertices are strings
 * - Edges can connect multiple vertices (n-ary)
 * - Construction is compositional via overlay and connect
 *
 * Key properties:
 * - Overlay: associative, commutative, idempotent (union)
 * - Connect: associative (cross-product of edges)
 * - Empty: identity for both operations
 *
 * Interpretation via folds - one graph definition, infinite interpretations.
 */

/**
 * Vertex identifier
 */
export type Vertex = string;

/**
 * HyperGraph - Free algebra for graph construction
 *
 * This is the "AST" of graph operations. Building a graph creates
 * a tree of these constructors. Interpretation happens via folds.
 */
export type HyperGraph =
    | { readonly tag: 'Empty' }
    | { readonly tag: 'Vertex'; readonly v: Vertex }
    | { readonly tag: 'Edge'; readonly vs: Vertex[] }  // n-ary hyperedge
    | { readonly tag: 'Overlay'; readonly l: HyperGraph; readonly r: HyperGraph }  // union
    | { readonly tag: 'Connect'; readonly l: HyperGraph; readonly r: HyperGraph }; // cross-product

/**
 * Smart Constructors
 */

/**
 * Empty graph
 */
export const empty: HyperGraph = { tag: 'Empty' };

/**
 * Single vertex
 */
export const vertex = (v: Vertex): HyperGraph => ({
    tag: 'Vertex',
    v,
});

/**
 * Hyperedge connecting multiple vertices
 *
 * Semantics: pairwise connections in sequence
 * edge(a,b,c) means a→b, b→c (directed path)
 */
export const edge = (...vs: Vertex[]): HyperGraph => {
    if (vs.length === 0) return empty;
    if (vs.length === 1) return vertex(vs[0]);
    return { tag: 'Edge', vs };
};

/**
 * Overlay two graphs (union)
 *
 * Properties:
 * - Associative: overlay(overlay(a,b),c) = overlay(a,overlay(b,c))
 * - Commutative: overlay(a,b) = overlay(b,a)
 * - Idempotent: overlay(a,a) = a
 * - Identity: overlay(empty,a) = a
 */
export const overlay = (l: HyperGraph, r: HyperGraph): HyperGraph => {
    // Optimize: don't create nodes for empty
    if (l.tag === 'Empty') return r;
    if (r.tag === 'Empty') return l;
    return { tag: 'Overlay', l, r };
};

/**
 * Connect two graphs (all l-vertices → all r-vertices)
 *
 * Properties:
 * - Associative: connect(connect(a,b),c) = connect(a,connect(b,c))
 * - Identity: connect(empty,a) = a, connect(a,empty) = a
 */
export const connect = (l: HyperGraph, r: HyperGraph): HyperGraph => {
    // Optimize: empty is identity
    if (l.tag === 'Empty') return r;
    if (r.tag === 'Empty') return l;
    return { tag: 'Connect', l, r };
};

/**
 * Composition Helpers
 */

/**
 * Overlay multiple vertices
 */
export const vertices = (vs: Vertex[]): HyperGraph =>
    vs.reduce<HyperGraph>((g, v) => overlay(g, vertex(v)), empty);

/**
 * Overlay multiple edges
 */
export const edges = (edgeList: Vertex[][]): HyperGraph =>
    edgeList.reduce<HyperGraph>((g, vs) => overlay(g, edge(...vs)), empty);

/**
 * Overlay multiple graphs
 */
export const overlays = (graphs: HyperGraph[]): HyperGraph =>
    graphs.reduce((g1, g2) => overlay(g1, g2), empty);

/**
 * Star graph - center vertex connected to all others
 */
export const star = (center: Vertex, vs: Vertex[]): HyperGraph =>
    connect(vertex(center), vertices(vs));

/**
 * Clique - all vertices connected to all others (complete graph)
 */
export const clique = (vs: Vertex[]): HyperGraph => {
    const verts = vertices(vs);
    return connect(verts, verts);
};

/**
 * Path - vertices connected in sequence
 */
export const path = (vs: Vertex[]): HyperGraph => {
    if (vs.length === 0) return empty;
    if (vs.length === 1) return vertex(vs[0]);

    // Build as sequence of edges: a→b, b→c, c→d
    const edgesList: Vertex[][] = [];
    for (let i = 0; i < vs.length - 1; i++) {
        edgesList.push([vs[i], vs[i + 1]]);
    }
    return edges(edgesList);
};

/**
 * Algebra type for hypergraph folds
 *
 * Each case receives already-computed results from children.
 * Returns a value of type A.
 */
export type HyperGraphAlg<A> = {
    Empty: () => A;
    Vertex: (v: Vertex) => A;
    Edge: (vs: Vertex[]) => A;
    Overlay: (l: A, r: A) => A;
    Connect: (l: A, r: A) => A;
};

/**
 * Generic fold over hypergraph
 *
 * This is the catamorphism for hypergraphs.
 * Handles all recursion - algebras just define what to compute.
 */
export const foldHG = <A>(alg: HyperGraphAlg<A>) => {
    const go = (hg: HyperGraph): A => {
        switch (hg.tag) {
            case 'Empty':
                return alg.Empty();

            case 'Vertex':
                return alg.Vertex(hg.v);

            case 'Edge':
                return alg.Edge(hg.vs);

            case 'Overlay':
                return alg.Overlay(go(hg.l), go(hg.r));

            case 'Connect':
                return alg.Connect(go(hg.l), go(hg.r));
        }
    };

    return go;
};
