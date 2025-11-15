/**
 * Minimal saturation test to debug performance issue
 */

import { describe, it, expect } from 'vitest';
import { EGraph, saturate, type Pattern } from '../egraph.js';

describe('Minimal Saturation', () => {
  it('single rule, single application', () => {
    const eg = new EGraph();

    // Build: arr.map(f).map(g)
    const arr = eg.add({ op: 'Var', name: 'arr' });
    const f = eg.add({ op: 'Var', name: 'f' });
    const g = eg.add({ op: 'Var', name: 'g' });

    const mapped1 = eg.add({ op: 'Map', array: arr, fn: f });
    const mapped2 = eg.add({ op: 'Map', array: mapped1, fn: g });

    console.log('Initial state:');
    console.log('  arr:', arr, 'f:', f, 'g:', g);
    console.log('  mapped1:', mapped1);
    console.log('  mapped2:', mapped2);
    console.log('  Classes:', eg['classes'].size);

    // Map fusion rule: arr.map(f).map(g) → arr.map(compose(g, f))
    const mapFusion = {
      name: 'map-fusion',
      lhs: {
        tag: 'POp' as const,
        op: 'Map' as const,
        children: [
          {
            tag: 'POp' as const,
            op: 'Map' as const,
            children: [
              { tag: 'PVar' as const, id: 'arr' },
              { tag: 'PVar' as const, id: 'f' },
            ],
          },
          { tag: 'PVar' as const, id: 'g' },
        ],
      },
      rhs: {
        tag: 'POp' as const,
        op: 'Map' as const,
        children: [
          { tag: 'PVar' as const, id: 'arr' },
          {
            tag: 'POp' as const,
            op: 'Compose' as const,
            children: [
              { tag: 'PVar' as const, id: 'g' },
              { tag: 'PVar' as const, id: 'f' },
            ],
          },
        ],
      },
    };

    // Run exactly 1 iteration
    const iters = saturate(eg, [mapFusion], 1);

    console.log('After saturation:');
    console.log('  Iterations:', iters);
    console.log('  Classes:', eg['classes'].size);

    const nodes = eg.getNodes(eg.find(mapped2));
    console.log('  Nodes in mapped2 class:', nodes.size);
    for (const node of nodes) {
      console.log('    -', node);
    }

    expect(iters).toBe(1);
    expect(nodes.size).toBeGreaterThan(1); // Should have both original and fused form
  });
});
