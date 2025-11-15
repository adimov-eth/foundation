/**
 * E-graphs: Equality Saturation for Semantic Pattern Detection
 *
 * Core insight: Maintain ALL equivalent expressions in single structure.
 * Operations form equivalence classes. Saturation finds all forms automatically.
 *
 * Based on: egg (Willsey et al., 2021)
 */

/** Branded type for e-class IDs - prevents mixing with regular numbers */
export type EClassId = number & { readonly __eclass: unique symbol };

/** Create e-class ID from number (internal use only) */
const eclass = (n: number): EClassId => n as EClassId;

/**
 * E-node: Operation with children (which are e-class IDs, not raw values)
 * This indirection enables sharing - same subexpression → same e-class
 */
type ENode =
  | { op: 'Var'; name: string }
  | { op: 'Const'; value: string | number }
  | { op: 'Call'; fn: EClassId; args: EClassId[] }
  | { op: 'Member'; obj: EClassId; prop: string }
  | { op: 'Binary'; kind: string; left: EClassId; right: EClassId }
  | { op: 'Array'; elements: EClassId[] }
  | { op: 'Map'; array: EClassId; fn: EClassId }
  | { op: 'Compose'; g: EClassId; f: EClassId }
  | { op: 'Splice'; array: EClassId; start: number; deleteCount: number };

/** Hash e-node for deduplication */
const hashNode = (node: ENode): string => JSON.stringify(node);

/**
 * Union-Find with path compression and union-by-rank
 * Maintains equivalence classes efficiently
 */
class UnionFind {
  private parent: Map<EClassId, EClassId> = new Map();
  private rank: Map<EClassId, number> = new Map();

  makeSet(id: EClassId): void {
    if (!this.parent.has(id)) {
      this.parent.set(id, id);
      this.rank.set(id, 0);
    }
  }

  find(id: EClassId): EClassId {
    this.makeSet(id);
    const p = this.parent.get(id)!;
    if (p !== id) {
      // Path compression
      this.parent.set(id, this.find(p));
    }
    return this.parent.get(id)!;
  }

  union(a: EClassId, b: EClassId): EClassId {
    const rootA = this.find(a);
    const rootB = this.find(b);

    if (rootA === rootB) return rootA;

    // Union by rank
    const rankA = this.rank.get(rootA) ?? 0;
    const rankB = this.rank.get(rootB) ?? 0;

    if (rankA < rankB) {
      this.parent.set(rootA, rootB);
      return rootB;
    } else if (rankA > rankB) {
      this.parent.set(rootB, rootA);
      return rootA;
    } else {
      this.parent.set(rootB, rootA);
      this.rank.set(rootA, rankA + 1);
      return rootA;
    }
  }
}

/**
 * E-graph: Equivalence graph maintaining all equivalent expressions
 *
 * Invariants:
 * - Congruence: if f(a) and f(b) exist and a ≡ b, then f(a) ≡ f(b)
 * - Canonical: each e-class has canonical representative via union-find
 */
export class EGraph {
  private classes: Map<EClassId, Set<ENode>> = new Map();
  private hashCons: Map<string, EClassId> = new Map();
  private unionFind = new UnionFind();
  private nextId = 0;

  /** Add e-node, return its e-class (deduplicated) */
  add(node: ENode): EClassId {
    // Canonicalize children first
    const canonical = this.canonicalize(node);
    const hash = hashNode(canonical);

    // Check if already exists
    const existing = this.hashCons.get(hash);
    if (existing !== undefined) {
      return this.find(existing);
    }

    // Create new e-class
    const id = eclass(this.nextId++);
    this.unionFind.makeSet(id);
    this.classes.set(id, new Set([canonical]));
    this.hashCons.set(hash, id);

    return id;
  }

  /** Canonical representative of e-class */
  find(id: EClassId): EClassId {
    return this.unionFind.find(id);
  }

  /** Merge two e-classes (declare equivalent) */
  merge(a: EClassId, b: EClassId): boolean {
    const rootA = this.find(a);
    const rootB = this.find(b);

    if (rootA === rootB) return false;

    // Union the classes
    const newRoot = this.unionFind.union(rootA, rootB);
    const oldRoot = newRoot === rootA ? rootB : rootA;

    // Merge e-node sets
    const newNodes = this.classes.get(newRoot)!;
    const oldNodes = this.classes.get(oldRoot)!;

    for (const node of oldNodes) {
      newNodes.add(node);
    }

    this.classes.delete(oldRoot);

    return true;
  }

  /** Get all e-nodes in an e-class */
  getNodes(id: EClassId): Set<ENode> {
    const canonical = this.find(id);
    return this.classes.get(canonical) ?? new Set();
  }

  /** Canonicalize e-node (replace children with canonical IDs) */
  private canonicalize(node: ENode): ENode {
    switch (node.op) {
      case 'Var':
      case 'Const':
      case 'Splice':
        return node;
      case 'Call':
        return { ...node, fn: this.find(node.fn), args: node.args.map(a => this.find(a)) };
      case 'Member':
        return { ...node, obj: this.find(node.obj) };
      case 'Binary':
        return { ...node, left: this.find(node.left), right: this.find(node.right) };
      case 'Array':
        return { ...node, elements: node.elements.map(e => this.find(e)) };
      case 'Map':
        return { ...node, array: this.find(node.array), fn: this.find(node.fn) };
      case 'Compose':
        return { ...node, g: this.find(node.g), f: this.find(node.f) };
    }
  }

  /** Rebuild to maintain congruence after merges */
  rebuild(): void {
    const worklist: EClassId[] = Array.from(this.classes.keys());

    while (worklist.length > 0) {
      const id = worklist.pop()!;
      const nodes = this.getNodes(id);

      // Check each node for congruence with existing nodes
      for (const node of nodes) {
        const canonical = this.canonicalize(node);
        const hash = hashNode(canonical);

        // Check if this hash exists in another e-class
        const existing = this.hashCons.get(hash);
        if (existing !== undefined) {
          const existingCanonical = this.find(existing);
          const currentCanonical = this.find(id);

          if (existingCanonical !== currentCanonical) {
            // Congruent nodes in different classes - merge them
            const merged = this.merge(currentCanonical, existingCanonical);
            if (merged) {
              // Re-add merged class to worklist
              worklist.push(this.find(currentCanonical));
            }
          }
        } else {
          // Update hashCons with canonicalized node
          this.hashCons.set(hash, id);
        }
      }
    }
  }
}

/**
 * Pattern: Expression with variables for matching
 */
export type Pattern =
  | { tag: 'PVar'; id: string }
  | { tag: 'POp'; op: ENode['op']; data?: Record<string, any>; children: Pattern[] };

/**
 * Rewrite rule: lhs → rhs
 */
export type Rule = {
  name: string;
  lhs: Pattern;
  rhs: Pattern;
};

/** Substitution: variable bindings */
type Subst = Map<string, EClassId>;

/**
 * Match pattern against e-class, return all substitutions
 */
export function match(egraph: EGraph, pattern: Pattern, eclass: EClassId): Subst[] {
  if (pattern.tag === 'PVar') {
    return [new Map([[pattern.id, eclass]])];
  }

  const results: Subst[] = [];

  // Try matching against each e-node in the class
  for (const node of egraph.getNodes(eclass)) {
    const { op: patOp, data, children } = pattern;

    // Check if operation matches
    if (node.op !== patOp) continue;

    // Check if data matches (if specified)
    if (data) {
      if (data.prop && 'prop' in node && node.prop !== data.prop) continue;
      if (data.kind && 'kind' in node && node.kind !== data.kind) continue;
      if (data.name && 'name' in node && node.name !== data.name) continue;
      if (data.value && 'value' in node && node.value !== data.value) continue;
    }

    // Extract children from node
    const nodeChildren = getChildren(node);
    if (nodeChildren.length !== children.length) continue;

    // Match children
    const childMatches = matchChildren(egraph, children, nodeChildren);
    results.push(...childMatches);
  }

  return results;
}

function matchChildren(egraph: EGraph, patterns: Pattern[], eclasses: EClassId[]): Subst[] {
  if (patterns.length === 0) {
    return [new Map()];
  }

  const [p, ...ps] = patterns;
  const [e, ...es] = eclasses;

  const results: Subst[] = [];

  for (const subst1 of match(egraph, p, e)) {
    for (const subst2 of matchChildren(egraph, ps, es)) {
      // Merge substitutions (check consistency)
      const consistent = Array.from(subst1).every(([k, v]) =>
        !subst2.has(k) || egraph.find(subst2.get(k)!) === egraph.find(v)
      );

      if (consistent) {
        const merged = new Map([...subst1, ...subst2]);
        results.push(merged);
      }
    }
  }

  return results;
}

/** Extract children e-classes from e-node */
function getChildren(node: ENode): EClassId[] {
  switch (node.op) {
    case 'Var':
    case 'Const':
    case 'Splice':
      return [];
    case 'Call':
      return [node.fn, ...node.args];
    case 'Member':
      return [node.obj];
    case 'Binary':
      return [node.left, node.right];
    case 'Array':
      return node.elements;
    case 'Map':
      return [node.array, node.fn];
    case 'Compose':
      return [node.g, node.f];
  }
}

/**
 * Apply substitution to pattern, return e-class
 */
export function applySubst(egraph: EGraph, pattern: Pattern, subst: Subst): EClassId {
  if (pattern.tag === 'PVar') {
    const bound = subst.get(pattern.id);
    if (bound === undefined) {
      throw new Error(`Unbound variable: ${pattern.id}`);
    }
    return bound;
  }

  const { op, data, children } = pattern;
  const childIds = children.map(c => applySubst(egraph, c, subst));

  // Reconstruct e-node with new children
  const newNode = setChildren(op, data ?? {}, childIds);
  return egraph.add(newNode);
}

/** Set children in e-node (inverse of getChildren) */
function setChildren(op: ENode['op'], data: Record<string, any>, children: EClassId[]): ENode {
  switch (op) {
    case 'Var':
      return { op: 'Var', name: data?.name ?? 'unknown' };
    case 'Const':
      return { op: 'Const', value: data?.value ?? 0 };
    case 'Splice':
      return { op: 'Splice', array: children[0], start: data?.start ?? 0, deleteCount: data?.deleteCount ?? 0 };
    case 'Call':
      return { op: 'Call', fn: children[0], args: children.slice(1) };
    case 'Member':
      return { op: 'Member', obj: children[0], prop: data?.prop ?? 'unknown' };
    case 'Binary':
      return { op: 'Binary', kind: data?.kind ?? '+', left: children[0], right: children[1] };
    case 'Array':
      return { op: 'Array', elements: children };
    case 'Map':
      return { op: 'Map', array: children[0], fn: children[1] };
    case 'Compose':
      return { op: 'Compose', g: children[0], f: children[1] };
  }
}

/**
 * Saturate: Apply rules until fixpoint with cost-guided search
 *
 * Based on egg (Willsey et al., 2021) equality saturation algorithm:
 * 1. Track best cost for each e-class
 * 2. Apply rules, but prune rewrites that don't improve cost
 * 3. Limit nodes per e-class to prevent explosion
 * 4. Stop when no cost improvements found
 *
 * This prevents unbounded growth while still finding useful patterns.
 */
export function saturate(
  egraph: EGraph,
  rules: Rule[],
  maxIter = 100,
  costFn: (node: ENode) => number = astSize,
  opts: { nodeLimitPerClass?: number; costThreshold?: number } = {}
): number {
  const { nodeLimitPerClass = 20, costThreshold = 1000 } = opts;

  // Track best cost per e-class
  const classCosts = new Map<EClassId, number>();

  // Track nodes being computed (cycle detection)
  const computing = new Set<EClassId>();

  // Compute costs with cycle detection
  const computeCost = (id: EClassId): number => {
    const canonical = egraph.find(id);

    // Check cache
    const cached = classCosts.get(canonical);
    if (cached !== undefined) return cached;

    // Detect cycles - if we're already computing this class, return high cost
    if (computing.has(canonical)) {
      return 1000; // Cycle cost penalty
    }

    computing.add(canonical);

    const nodes = egraph.getNodes(canonical);
    let minCost = Infinity;

    for (const node of nodes) {
      const children = getChildren(node);
      const childCosts = children.reduce((sum, c) => sum + computeCost(c), 0);
      const totalCost = costFn(node) + childCosts;
      minCost = Math.min(minCost, totalCost);
    }

    if (minCost === Infinity) minCost = 0;

    computing.delete(canonical);
    classCosts.set(canonical, minCost);
    return minCost;
  };

  let iter = 0;
  let improvedCost = true;

  while (iter < maxIter && improvedCost) {
    iter++;
    let changed = false;
    improvedCost = false;

    // Snapshot e-classes at START of iteration
    const eclasses = Array.from(egraph['classes'].keys());

    // Compute costs before iteration
    for (const eclass of eclasses) {
      computeCost(eclass);
    }

    for (const rule of rules) {
      for (const eclass of eclasses) {
        const matches = match(egraph, rule.lhs, eclass);

        for (const subst of matches) {
          // Apply rhs with substitution
          const rhsClass = applySubst(egraph, rule.rhs, subst);
          const rhsCanonical = egraph.find(rhsClass);

          // Check node limit
          const rhsNodes = egraph.getNodes(rhsCanonical);
          if (rhsNodes.size > nodeLimitPerClass) {
            continue; // Prune: too many alternatives
          }

          // Check cost threshold
          const rhsCost = computeCost(rhsCanonical);
          if (rhsCost > costThreshold) {
            continue; // Prune: too expensive
          }

          // Merge lhs and rhs classes
          const lhsCanonical = egraph.find(eclass);
          const merged = egraph.merge(lhsCanonical, rhsCanonical);

          if (merged) {
            changed = true;

            // Check if cost improved
            const newCanonical = egraph.find(lhsCanonical);
            const oldCost = classCosts.get(lhsCanonical) ?? Infinity;
            classCosts.delete(newCanonical); // Invalidate cache
            const newCost = computeCost(newCanonical);

            if (newCost < oldCost) {
              improvedCost = true;
            }
          }
        }
      }
    }

    // Rebuild to maintain congruence after all merges
    if (changed) {
      egraph.rebuild();

      // Invalidate all cost caches after rebuild (congruence may have changed costs)
      classCosts.clear();
    }
  }

  return iter;
}

/**
 * Extract best representative by cost function
 */
export function extract(egraph: EGraph, root: EClassId, cost: (node: ENode) => number): ENode {
  const memo = new Map<EClassId, { node: ENode; cost: number }>();

  const go = (id: EClassId): { node: ENode; cost: number } => {
    const canonical = egraph.find(id);

    const cached = memo.get(canonical);
    if (cached) return cached;

    const nodes = egraph.getNodes(canonical);
    let best: { node: ENode; cost: number } | null = null;

    for (const node of nodes) {
      // Recursively extract children
      const children = getChildren(node);
      const childResults = children.map(go);
      const childCost = childResults.reduce((sum, r) => sum + r.cost, 0);
      const totalCost = cost(node) + childCost;

      if (best === null || totalCost < best.cost) {
        // Reconstruct node with extracted children
        const extractedChildren = childResults.map(r => {
          // Add extracted child nodes to get their IDs
          return egraph.add(r.node);
        });

        // Extract node data
        const data: Record<string, any> = {};
        if ('prop' in node) data.prop = node.prop;
        if ('kind' in node) data.kind = node.kind;
        if ('name' in node) data.name = node.name;
        if ('value' in node) data.value = node.value;
        if ('start' in node) data.start = node.start;
        if ('deleteCount' in node) data.deleteCount = node.deleteCount;

        const extractedNode = setChildren(node.op, data, extractedChildren);
        best = { node: extractedNode, cost: totalCost };
      }
    }

    if (!best) throw new Error('Empty e-class');

    memo.set(canonical, best);
    return best;
  };

  return go(root).node;
}

/** Cost functions */
export const astSize = (node: ENode): number => 1;
export const astDepth = (node: ENode): number =>
  node.op === 'Var' || node.op === 'Const' ? 1 : 2;
