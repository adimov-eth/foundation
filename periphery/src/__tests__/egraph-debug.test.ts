/**
 * Debug saturation to find performance issue
 */

import { describe, it } from 'vitest';
import { EGraph, saturate, type Pattern } from '../egraph.js';

describe('Saturation Debug', () => {
  it.skip('tracks what happens each iteration', () => {
    const eg = new EGraph();

    // Build: arr.map(f).map(g)
    const arr = eg.add({ op: 'Var', name: 'arr' });
    const f = eg.add({ op: 'Var', name: 'f' });
    const g = eg.add({ op: 'Var', name: 'g' });

    const mapped1 = eg.add({ op: 'Map', array: arr, fn: f });
    const mapped2 = eg.add({ op: 'Map', array: mapped1, fn: g });

    console.log('\nInitial: classes =', eg['classes'].size);

    // Map fusion rule
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

    // Run 5 iterations and track growth
    for (let i = 1; i <= 5; i++) {
      const before = eg['classes'].size;
      saturate(eg, [mapFusion], 1); // One iteration at a time
      const after = eg['classes'].size;
      console.log(`Iter ${i}: ${before} → ${after} classes (${after - before} new)`);

      if (after === before) {
        console.log('Reached fixpoint!');
        break;
      }
    }
  });

  it.skip('test mapIdentity rule alone', () => {
    const eg = new EGraph();

    const arr = eg.add({ op: 'Var', name: 'arr' });
    console.log('\nInitial: classes =', eg['classes'].size);

    const mapIdentity = {
      name: 'map-identity',
      lhs: {
        tag: 'POp' as const,
        op: 'Map' as const,
        children: [
          { tag: 'PVar' as const, id: 'arr' },
          { tag: 'PVar' as const, id: 'id' },
        ],
      },
      rhs: { tag: 'PVar' as const, id: 'arr' },
    };

    for (let i = 1; i <= 5; i++) {
      const before = eg['classes'].size;
      saturate(eg, [mapIdentity], 1);
      const after = eg['classes'].size;
      console.log(`Iter ${i}: ${before} → ${after} classes (${after - before} new)`);

      if (after === before) {
        console.log('Reached fixpoint!');
        break;
      }
    }
  });

  it('test composeAssoc - bidirectional problem', () => {
    const eg = new EGraph();

    // Create: compose(h, compose(g, f))
    const h = eg.add({ op: 'Var', name: 'h' });
    const g = eg.add({ op: 'Var', name: 'g' });
    const f = eg.add({ op: 'Var', name: 'f' });
    const gf = eg.add({ op: 'Compose', g, f });
    const hgf = eg.add({ op: 'Compose', g: h, f: gf });

    console.log('\nInitial: classes =', eg['classes'].size);

    const composeAssoc = {
      name: 'compose-assoc',
      lhs: {
        tag: 'POp' as const,
        op: 'Compose' as const,
        children: [
          { tag: 'PVar' as const, id: 'h' },
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
      rhs: {
        tag: 'POp' as const,
        op: 'Compose' as const,
        children: [
          {
            tag: 'POp' as const,
            op: 'Compose' as const,
            children: [
              { tag: 'PVar' as const, id: 'h' },
              { tag: 'PVar' as const, id: 'g' },
            ],
          },
          { tag: 'PVar' as const, id: 'f' },
        ],
      },
    };

    for (let i = 1; i <= 10; i++) {
      const before = eg['classes'].size;
      saturate(eg, [composeAssoc], 1);
      const after = eg['classes'].size;
      console.log(`Iter ${i}: ${before} → ${after} classes (${after - before} new)`);

      if (after === before) {
        console.log('Reached fixpoint!');
        break;
      }

      if (i === 10) {
        console.log('WARNING: Did not reach fixpoint in 10 iterations!');
      }
    }
  });

  it('test mapFusion + composeAssoc interaction', async () => {
    const eg = new EGraph();

    // Build: arr.map(f).map(g).map(h) - deep nesting
    const arr = eg.add({ op: 'Var', name: 'arr' });
    const f = eg.add({ op: 'Var', name: 'f' });
    const g = eg.add({ op: 'Var', name: 'g' });
    const h = eg.add({ op: 'Var', name: 'h' });

    const mapped1 = eg.add({ op: 'Map', array: arr, fn: f });
    const mapped2 = eg.add({ op: 'Map', array: mapped1, fn: g });
    const mapped3 = eg.add({ op: 'Map', array: mapped2, fn: h });

    console.log('\nInitial: classes =', eg['classes'].size);

    const { mapFusion, composeAssoc } = await import('../algebras/egraph-rules.js');

    for (let i = 1; i <= 10; i++) {
      const before = eg['classes'].size;
      saturate(eg, [mapFusion, composeAssoc], 1);
      const after = eg['classes'].size;
      console.log(`Iter ${i}: ${before} → ${after} classes (${after - before} new)`);

      if (after === before) {
        console.log('Reached fixpoint!');
        break;
      }

      if (i === 10) {
        console.log('WARNING: Did not reach fixpoint in 10 iterations!');
      }
    }
  });
});
