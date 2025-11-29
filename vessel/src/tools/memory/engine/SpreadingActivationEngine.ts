import type { MemoryEdge, MemoryState } from "@/mcp-server/tools/memory/types";

export interface ActivationOptions {
  steps: number; // propagation steps (iterations)
  decay: number; // D in (A[j] += A[i] * W[i,j] * D)
  threshold: number; // F - only nodes above this propagate
}

export type ActivationMap = Record<string, number>;

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function buildAdjacency(edges: MemoryEdge[]): Map<string, Array<{ id: string; w: number }>> {
  const adj = new Map<string, Array<{ id: string; w: number }>>();
  for (const e of edges) {
    if (!adj.has(e.from)) adj.set(e.from, []);
    if (!adj.has(e.to)) adj.set(e.to, []);
    // Bidirectional propagation by default
    adj.get(e.from)!.push({ id: e.to, w: e.weight });
    adj.get(e.to)!.push({ id: e.from, w: e.weight });
  }
  return adj;
}

/**
 * Run spreading activation over the memory graph.
 * seeds: map of item id -> initial activation in [0,1]
 */
export function runSpreadingActivation(
  state: MemoryState,
  seeds: ActivationMap,
  opts: ActivationOptions,
): ActivationMap {
  const { steps, decay, threshold } = opts;
  const adj = buildAdjacency(state.edges);
  const A: ActivationMap = {};
  // Initialize activations
  for (const id of Object.keys(state.items)) A[id] = 0;
  for (const [id, val] of Object.entries(seeds)) A[id] = clamp01((A[id] ?? 0) + clamp01(val));

  for (let step = 0; step < steps; step++) {
    const delta: ActivationMap = {};
    for (const [i, a] of Object.entries(A)) {
      if (a <= threshold) continue;
      const neighbors = adj.get(i);
      if (!neighbors || neighbors.length === 0) continue;
      for (const { id: j, w } of neighbors) {
        const inc = a * w * decay;
        if (inc <= 0) continue;
        delta[j] = (delta[j] ?? 0) + inc;
      }
    }
    // Apply deltas and cap
    for (const [j, inc] of Object.entries(delta)) {
      A[j] = clamp01((A[j] ?? 0) + inc);
    }
  }

  return A;
}

