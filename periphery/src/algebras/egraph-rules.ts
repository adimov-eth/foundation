/**
 * Rewrite Rules for TypeScript Code Patterns
 *
 * Declarative equivalences - saturation finds all forms automatically
 */

import type { Rule, Pattern } from '../egraph.js';

/** Pattern constructors for readability */
const v = (id: string): Pattern => ({ tag: 'PVar', id });

const call = (fn: Pattern, ...args: Pattern[]): Pattern => ({
  tag: 'POp',
  op: 'Call',
  children: [fn, ...args],
});

const member = (obj: Pattern, prop: string): Pattern => ({
  tag: 'POp',
  op: 'Member',
  data: { prop },
  children: [obj],
});

const map = (array: Pattern, fn: Pattern): Pattern => ({
  tag: 'POp',
  op: 'Map',
  children: [array, fn],
});

const compose = (g: Pattern, f: Pattern): Pattern => ({
  tag: 'POp',
  op: 'Compose',
  children: [g, f],
});

/**
 * Map Fusion: arr.map(f).map(g) ≡ arr.map(compose(g, f))
 */
export const mapFusion: Rule = {
  name: 'map-fusion',
  lhs: map(map(v('arr'), v('f')), v('g')),
  rhs: map(v('arr'), compose(v('g'), v('f'))),
};

/**
 * Map-FlatMap: arr.map(f).flat() ≡ arr.flatMap(f)
 */
export const mapFlat: Rule = {
  name: 'map-flat',
  lhs: call(member(map(v('arr'), v('f')), 'flat')),
  rhs: call(member(v('arr'), 'flatMap'), v('f')),
};

/**
 * Filter-Map Fusion: arr.filter(p).map(f) ≡ arr.filterMap(p, f)
 * (if filterMap exists, otherwise just equivalence)
 */
export const filterMapFusion: Rule = {
  name: 'filter-map-fusion',
  lhs: map(call(member(v('arr'), 'filter'), v('p')), v('f')),
  rhs: call(member(v('arr'), 'filterMap'), v('p'), v('f')),
};

/**
 * Splice-Remove Pattern: Detect operational transformation
 *
 * Pattern: arr.indexOf(item); arr.splice(idx, 1)
 * Semantics: Remove item from array (unique position enforcement)
 */
export const spliceRemove: Rule = {
  name: 'splice-remove',
  lhs: call(member(v('arr'), 'splice'), call(member(v('arr'), 'indexOf'), v('item')), v('const_1')),
  rhs: call(member(v('arr'), 'remove'), v('item')), // Semantic operation
};

/**
 * Map Identity: arr.map(x => x) ≡ arr
 */
export const mapIdentity: Rule = {
  name: 'map-identity',
  lhs: map(v('arr'), v('id')),
  rhs: v('arr'),
};

/**
 * Compose Associativity: compose(h, compose(g, f)) ≡ compose(compose(h, g), f)
 */
export const composeAssoc: Rule = {
  name: 'compose-assoc',
  lhs: compose(v('h'), compose(v('g'), v('f'))),
  rhs: compose(compose(v('h'), v('g')), v('f')),
};

/**
 * All standard rewrite rules
 */
export const standardRules: Rule[] = [
  mapFusion,
  mapFlat,
  filterMapFusion,
  spliceRemove,
  mapIdentity,
  composeAssoc,
];

/**
 * Plexus-specific patterns
 */

/**
 * Emancipation Pattern: Detect remove-before-insert
 *
 * arr1.splice(arr1.indexOf(item), 1); arr2.push(item)
 * ≡ arr2.push(item)  // with implicit emancipation
 */
export const emancipationPattern: Rule = {
  name: 'emancipation-pattern',
  lhs: call(
    member(v('arr2'), 'push'),
    v('item')
  ),
  rhs: call(member(v('arr2'), 'adoptChild'), v('item')), // Semantic operation
};

/**
 * Contagious Materialization: Assignment triggers removal
 *
 * parent2.child = child (where child.parent === parent1)
 * ≡ parent1.children.remove(child); parent2.child = child
 */
export const contagiousMaterialization: Rule = {
  name: 'contagious-materialization',
  lhs: v('assignment'), // Placeholder - needs AST context
  rhs: v('assignment-with-emancipation'),
};

export const plexusRules: Rule[] = [
  emancipationPattern,
  contagiousMaterialization,
];

/**
 * All rules combined
 */
export const allRules: Rule[] = [...standardRules, ...plexusRules];
