/**
 * Simple E-graph Tests (without saturation)
 */

import { describe, it, expect } from 'vitest';
import { EGraph, extract, astSize } from '../egraph.js';

describe('E-graph Basic Operations', () => {
  it('creates e-classes and maintains identity', () => {
    const eg = new EGraph();

    const x = eg.add({ op: 'Var', name: 'x' });
    const y = eg.add({ op: 'Var', name: 'y' });
    const x2 = eg.add({ op: 'Var', name: 'x' });

    // Hash consing: same var → same e-class
    expect(eg.find(x)).toBe(eg.find(x2));
    expect(eg.find(x)).not.toBe(eg.find(y));
  });

  it('merges e-classes correctly', () => {
    const eg = new EGraph();

    const x = eg.add({ op: 'Var', name: 'x' });
    const y = eg.add({ op: 'Var', name: 'y' });

    const merged = eg.merge(x, y);
    expect(merged).toBe(true);

    // After merge, find returns same canonical representative
    expect(eg.find(x)).toBe(eg.find(y));
  });

  it('extracts best representative by cost', () => {
    const eg = new EGraph();

    const x = eg.add({ op: 'Var', name: 'x' });
    const six = eg.add({ op: 'Const', value: 6 });

    const simpleExpr = eg.add({
      op: 'Binary',
      kind: '+',
      left: x,
      right: six,
    });

    const best = extract(eg, simpleExpr, astSize);

    expect(best.op).toBe('Binary');
  });

  it('builds method call chains', () => {
    const eg = new EGraph();

    // arr.map(f)
    const arr = eg.add({ op: 'Var', name: 'arr' });
    const f = eg.add({ op: 'Var', name: 'f' });
    const mapped = eg.add({ op: 'Map', array: arr, fn: f });

    const nodes = eg.getNodes(eg.find(mapped));
    expect(nodes.size).toBe(1);

    const node = Array.from(nodes)[0];
    expect(node.op).toBe('Map');
  });

  it('detects member access patterns', () => {
    const eg = new EGraph();

    // arr.splice
    const arr = eg.add({ op: 'Var', name: 'arr' });
    const splice = eg.add({ op: 'Member', obj: arr, prop: 'splice' });

    const nodes = eg.getNodes(eg.find(splice));
    const node = Array.from(nodes)[0];

    expect(node.op).toBe('Member');
    if (node.op === 'Member') {
      expect(node.prop).toBe('splice');
    }
  });
});
