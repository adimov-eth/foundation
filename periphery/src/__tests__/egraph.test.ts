/**
 * E-graph Tests
 */

import { describe, it, expect } from 'vitest';
import { EGraph, saturate, extract, astSize, match, type Pattern } from '../egraph.js';
import { mapFusion, mapFlat, standardRules, spliceRemove } from '../algebras/egraph-rules.js';

describe('E-graph Core', () => {
  it('adds nodes and maintains identity', () => {
    const eg = new EGraph();

    const x = eg.add({ op: 'Var', name: 'x' });
    const y = eg.add({ op: 'Var', name: 'y' });
    const x2 = eg.add({ op: 'Var', name: 'x' });

    // Same var → same e-class (hash consing)
    expect(eg.find(x)).toBe(eg.find(x2));
    expect(eg.find(x)).not.toBe(eg.find(y));
  });

  it('merges e-classes', () => {
    const eg = new EGraph();

    const x = eg.add({ op: 'Var', name: 'x' });
    const y = eg.add({ op: 'Var', name: 'y' });

    eg.merge(x, y);

    // After merge, same canonical representative
    expect(eg.find(x)).toBe(eg.find(y));
  });

  it('maintains congruence after merge', () => {
    const eg = new EGraph();

    const x = eg.add({ op: 'Var', name: 'x' });
    const y = eg.add({ op: 'Var', name: 'y' });
    const fx = eg.add({ op: 'Call', fn: eg.add({ op: 'Var', name: 'f' }), args: [x] });
    const fy = eg.add({ op: 'Call', fn: eg.add({ op: 'Var', name: 'f' }), args: [y] });

    eg.merge(x, y);
    eg.rebuild();

    // Congruence: f(x) ≡ f(y) when x ≡ y
    expect(eg.find(fx)).toBe(eg.find(fy));
  });

  it('extracts best representative by cost', () => {
    const eg = new EGraph();

    const x = eg.add({ op: 'Var', name: 'x' });
    const longExpr = eg.add({
      op: 'Binary',
      kind: '+',
      left: x,
      right: eg.add({
        op: 'Binary',
        kind: '*',
        left: eg.add({ op: 'Const', value: 2 }),
        right: eg.add({ op: 'Const', value: 3 }),
      }),
    });

    const simpleExpr = eg.add({
      op: 'Binary',
      kind: '+',
      left: x,
      right: eg.add({ op: 'Const', value: 6 }),
    });

    eg.merge(longExpr, simpleExpr);

    const best = extract(eg, longExpr, astSize);

    // Should extract simpler form
    expect(best.op).toBe('Binary');
  });
});

describe('Pattern Matching', () => {
  it('matches simple patterns', () => {
    const eg = new EGraph();

    const arr = eg.add({ op: 'Var', name: 'arr' });
    const f = eg.add({ op: 'Var', name: 'f' });
    const mapped = eg.add({ op: 'Map', array: arr, fn: f });

    const pattern: Pattern = {
      tag: 'POp',
      op: 'Map',
      children: [
        { tag: 'PVar', id: 'a' },
        { tag: 'PVar', id: 'fn' },
      ],
    };

    const matches = match(eg, pattern, mapped);

    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].get('a')).toBe(arr);
    expect(matches[0].get('fn')).toBe(f);
  });
});

describe('Rewrite Rules', () => {
  it('applies map fusion rule', () => {
    const eg = new EGraph();

    // Build: arr.map(f).map(g)
    const arr = eg.add({ op: 'Var', name: 'arr' });
    const f = eg.add({ op: 'Var', name: 'f' });
    const g = eg.add({ op: 'Var', name: 'g' });

    const mapped1 = eg.add({ op: 'Map', array: arr, fn: f });
    const mapped2 = eg.add({ op: 'Map', array: mapped1, fn: g });

    // Saturate with map fusion
    const iters = saturate(eg, [mapFusion], 10);

    expect(iters).toBeGreaterThan(0);

    // Check that fused form exists in same e-class
    const nodes = eg.getNodes(eg.find(mapped2));
    const hasCompose = Array.from(nodes).some(
      n => n.op === 'Map' && Array.from(eg.getNodes(n.fn)).some(fn => fn.op === 'Compose')
    );

    expect(hasCompose).toBe(true);
  });

  it('detects map().flat() → flatMap equivalence', () => {
    const eg = new EGraph();

    const arr = eg.add({ op: 'Var', name: 'arr' });
    const f = eg.add({ op: 'Var', name: 'f' });
    const mapped = eg.add({ op: 'Map', array: arr, fn: f });
    const flat = eg.add({ op: 'Member', obj: mapped, prop: 'flat' });
    const flattened = eg.add({ op: 'Call', fn: flat, args: [] });

    saturate(eg, [mapFlat], 10);

    // Should find flatMap in same e-class
    const nodes = eg.getNodes(eg.find(flattened));
    const hasFlatMap = Array.from(nodes).some(
      n => n.op === 'Call' &&
           Array.from(eg.getNodes(n.fn)).some(
             fn => fn.op === 'Member' && fn.prop === 'flatMap'
           )
    );

    expect(hasFlatMap).toBe(true);
  });

  it('saturates with multiple rules', () => {
    const eg = new EGraph();

    // Complex expression with multiple optimization opportunities
    const arr = eg.add({ op: 'Var', name: 'arr' });
    const f = eg.add({ op: 'Var', name: 'f' });
    const g = eg.add({ op: 'Var', name: 'g' });

    const mapped1 = eg.add({ op: 'Map', array: arr, fn: f });
    const mapped2 = eg.add({ op: 'Map', array: mapped1, fn: g });

    const iters = saturate(eg, standardRules, 20);

    expect(iters).toBeGreaterThan(0);

    // After saturation, should have multiple equivalent forms
    const nodes = eg.getNodes(eg.find(mapped2));
    expect(nodes.size).toBeGreaterThan(1);
  });
});

describe('Operational Patterns', () => {
  it('detects remove-before-insert pattern', () => {
    const eg = new EGraph();

    // arr.indexOf(item)
    const arr = eg.add({ op: 'Var', name: 'arr' });
    const item = eg.add({ op: 'Var', name: 'item' });
    const indexOf = eg.add({ op: 'Member', obj: arr, prop: 'indexOf' });
    const index = eg.add({ op: 'Call', fn: indexOf, args: [item] });

    // arr.splice(index, 1)
    const splice = eg.add({ op: 'Member', obj: arr, prop: 'splice' });
    const one = eg.add({ op: 'Const', value: 1 });
    const spliceCall = eg.add({ op: 'Call', fn: splice, args: [index, one] });

    saturate(eg, [spliceRemove], 10);

    // Should recognize as semantic remove operation
    const nodes = eg.getNodes(eg.find(spliceCall));
    const hasRemove = Array.from(nodes).some(
      n => n.op === 'Call' &&
           Array.from(eg.getNodes(n.fn)).some(
             fn => fn.op === 'Member' && fn.prop === 'remove'
           )
    );

    expect(hasRemove).toBe(true);
  });
});

describe('Extraction', () => {
  it('extracts minimal AST by size', () => {
    const eg = new EGraph();

    // Create equivalent expressions with different sizes
    const x = eg.add({ op: 'Var', name: 'x' });

    // Complex: x + (2 * 3)
    const complex = eg.add({
      op: 'Binary',
      kind: '+',
      left: x,
      right: eg.add({
        op: 'Binary',
        kind: '*',
        left: eg.add({ op: 'Const', value: 2 }),
        right: eg.add({ op: 'Const', value: 3 }),
      }),
    });

    // Simple: x + 6
    const simple = eg.add({
      op: 'Binary',
      kind: '+',
      left: x,
      right: eg.add({ op: 'Const', value: 6 }),
    });

    eg.merge(complex, simple);

    const extracted = extract(eg, complex, astSize);

    // Should extract simpler form (fewer nodes)
    expect(extracted.op).toBe('Binary');
    if (extracted.op === 'Binary') {
      const rightNode = Array.from(eg.getNodes(extracted.right))[0];
      expect(rightNode.op).toBe('Const');
      if (rightNode.op === 'Const') {
        expect(rightNode.value).toBe(6);
      }
    }
  });
});
