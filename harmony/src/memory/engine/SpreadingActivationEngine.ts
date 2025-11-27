/**
 * Spreading Activation Engine
 *
 * Implements activation spreading across memory graph - energy flows from seed nodes
 * through weighted edges, simulating associative retrieval in semantic networks.
 *
 * Algorithm:
 * For each iteration (step):
 *   For each node i with activation A[i] > threshold:
 *     For each neighbor j connected by edge weight W[i,j]:
 *       Δ[j] += A[i] * W[i,j] * decay
 *   Update: A[j] = clamp(A[j] + Δ[j], 0, 1)
 *
 * Parameters:
 * - steps: number of propagation iterations (2-4 typical)
 * - decay: dampening factor D (0.8-0.9 prevents runaway)
 * - threshold: only nodes above F propagate (0.1-0.3 filters noise)
 *
 * @see Collins, A. M., & Loftus, E. F. (1975). A spreading-activation theory of semantic processing.
 */

import type { MemoryEdge, MemoryState } from "../types.js";

/**
 * Configuration for spreading activation propagation
 */
export interface ActivationOptions {
  /** Number of propagation iterations */
  steps: number;
  /** Decay factor D - dampens activation to prevent runaway (typical: 0.8-0.9) */
  decay: number;
  /** Threshold F - only nodes above this value propagate (typical: 0.1-0.3) */
  threshold: number;
}

/**
 * Map from memory item ID to activation level [0..1]
 */
export type ActivationMap = Record<string, number>;

/**
 * Clamp value to [0, 1] range
 */
function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/**
 * Build bidirectional adjacency list from edges
 * Each node maps to its neighbors with connection weights
 */
function buildAdjacency(
  edges: MemoryEdge[]
): Map<string, Array<{ id: string; w: number }>> {
  const adj = new Map<string, Array<{ id: string; w: number }>>();

  for (const e of edges) {
    // Ensure both nodes exist in adjacency list
    if (!adj.has(e.from)) adj.set(e.from, []);
    if (!adj.has(e.to)) adj.set(e.to, []);

    // Add bidirectional connections
    adj.get(e.from)!.push({ id: e.to, w: e.weight });
    adj.get(e.to)!.push({ id: e.from, w: e.weight });
  }

  return adj;
}

/**
 * Run spreading activation from seed nodes through memory graph
 *
 * Seeds represent initial activation (e.g., from query matching).
 * Energy spreads through edges weighted by association strength.
 * After N steps, returns activation levels for all nodes.
 *
 * @param state - Memory graph state (items + edges)
 * @param seeds - Initial activation map (query matches, context)
 * @param opts - Propagation parameters (steps, decay, threshold)
 * @returns Activation levels for all memory items
 *
 * @example
 * ```typescript
 * const seeds = { "m_123_abc": 1.0, "m_456_def": 0.8 };
 * const opts = { steps: 3, decay: 0.85, threshold: 0.2 };
 * const activation = runSpreadingActivation(state, seeds, opts);
 * // activation["m_789_ghi"] might now be 0.35 from spreading
 * ```
 */
export function runSpreadingActivation(
  state: MemoryState,
  seeds: ActivationMap,
  opts: ActivationOptions
): ActivationMap {
  const { steps, decay, threshold } = opts;
  const adj = buildAdjacency(state.edges);

  // Initialize: all nodes start at 0, then add seed activation
  const A: ActivationMap = {};
  for (const id of Object.keys(state.items)) {
    A[id] = 0;
  }
  for (const [id, val] of Object.entries(seeds)) {
    A[id] = clamp01((A[id] ?? 0) + clamp01(val));
  }

  // Propagate activation for N steps
  for (let step = 0; step < steps; step++) {
    const delta: ActivationMap = {};

    // For each active node above threshold
    for (const [i, a] of Object.entries(A)) {
      if (a <= threshold) continue;

      const neighbors = adj.get(i);
      if (!neighbors || neighbors.length === 0) continue;

      // Spread activation to neighbors
      for (const { id: j, w } of neighbors) {
        const inc = a * w * decay;
        if (inc <= 0) continue;
        delta[j] = (delta[j] ?? 0) + inc;
      }
    }

    // Apply accumulated deltas
    for (const [j, inc] of Object.entries(delta)) {
      A[j] = clamp01((A[j] ?? 0) + inc);
    }
  }

  return A;
}
