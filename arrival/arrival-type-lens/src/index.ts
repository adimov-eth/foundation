// @here.build/arrival-type-lens — the TypeScript type surface arrival Scheme is checked against.
//
// ⚠️ RECONSTRUCTION. The original arrival-type-lens was carved out of this open-source cut
// (its importer survives in pnpm-lock.yaml as a ghost; the source lives only in the parent
// repo). This package rebuilds the package's *contract* from public in-tree parts:
//   - the BITE contract pinned by arrival-chain-view's types-emit.test.ts (PRE + car.d.ts must
//     clean-check a good program AND make `(car 5)` bite),
//   - the emitter's __arr / bare-identifier lowering surface (types-emit.ts),
//   - the host-rosetta harvest surface (`env.__rosettaTypes__`, populated by defineRosetta).
// Leaves cover the common R7RS builtins; an unmodelled builtin degrades LOUDLY ("Cannot find
// name"), never silently. This is faithful to the package's SHAPE and its declared deps
// (tsgo-wasm as the portable checker) — not a byte-for-byte copy of the parent original.
//
// Three parts:
//   1. base types (prelude/types.d.ts) — the Scheme-value vocabulary.
//   2. per-builtin leaves (prelude/builtins/*.d.ts) — generic, biting signatures.
//   3. the HARVESTER — reads `env.__rosettaTypes__` (name → TS-sig string) and assembles
//      `interface ArrShape { "<name>": <sig> }` for HOST rosettas, plus the host-member set
//      to feed emitTypes. Generated from the interpreter's own colocated annotations, so it
//      cannot drift from the impl.

import { loadAuthoredPrelude } from "./prelude.js";

export { loadAuthoredPrelude } from "./prelude.js";

/** A live arrival environment's type-harvest surface (structural — we only read the map). */
export interface RosettaTypedEnv {
  readonly __rosettaTypes__?: ReadonlyMap<string, string>;
}

/** The result of harvesting a live env's host-rosetta signatures. Feed BOTH fields into a
 *  diagnose run together — `diagnoseScheme(scm, { hostMembers, preludeAppend: fragment })` — so
 *  the host heads both lower through `__arr` (hostMembers) AND have their signatures declared
 *  (fragment). `hostMembers` alone routes to `__arr` with no declaration (host calls go untyped
 *  / spurious); `fragment` alone declares members the emitter never routes to. */
export interface HarvestResult {
  /** A `.d.ts` fragment augmenting `ArrShape` with each host rosetta's colocated signature.
   *  Pass as `diagnoseScheme(scm, { preludeAppend: fragment })`. */
  readonly fragment: string;
  /** The host-member name set — pass as `diagnoseScheme(scm, { hostMembers })` so those heads
   *  lower through `__arr` too. */
  readonly hostMembers: Set<string>;
}

/** HARVEST: read a live arrival env's `__rosettaTypes__` and produce (a) a `.d.ts` fragment
 *  augmenting `ArrShape` with each host rosetta's colocated signature, and (b) the host-member
 *  name set. The signature strings are ambient-member-body fragments (e.g. `"(ip: SchemeIP):
 *  SBool"`) per the interpreter's rosetta.d.ts. */
export function harvestHostLeaves(env: RosettaTypedEnv | null | undefined): HarvestResult {
  const rt = env?.__rosettaTypes__;
  if (!rt || rt.size === 0) return { fragment: "", hostMembers: new Set() };
  const members: string[] = [];
  const names = new Set<string>();
  for (const [name, sig] of rt) {
    members.push(`  ${JSON.stringify(name)}: ${sigToArrow(sig)};`);
    names.add(name);
  }
  const fragment = `declare global {\n  interface ArrShape {\n${members.join("\n")}\n  }\n}\nexport {};\n`;
  return { fragment, hostMembers: names };
}

/** Turn a rosetta sig fragment `"(a: T): U"` into an arrow type `"(a: T) => U"`.
 *  Rosetta sigs are colon-return method-form; ArrShape members here are arrow-typed.
 *
 *  Parses via a balanced-paren scan, NOT a `\([^)]*\)` regex — a callback-typed param such as
 *  `(pred: (x: T) => U, xs: List<T>): List<T>` has an inner `)` the flat regex would stop at,
 *  silently producing a malformed group → the permissive `(...args: unknown[]) => unknown`
 *  fallback. That silent widening is exactly the degradation this lens disavows, so on an
 *  UNPARSEABLE sig we THROW (loud) rather than fall back. */
function sigToArrow(sig: string): string {
  const s = sig.trim();
  if (s[0] !== "(") throw new Error(`rosetta sig must start with a paren param list: ${sig}`);
  // Walk to the matching close of the leading param list, respecting nesting.
  let depth = 0;
  let close = -1;
  for (const [i, c] of [...s].entries()) {
    if (c === "(") depth++;
    else if (c === ")" && --depth === 0) {
      close = i;
      break;
    }
  }
  if (close === -1) throw new Error(`rosetta sig has an unbalanced param list: ${sig}`);
  const params = s.slice(0, close + 1);
  const rest = s.slice(close + 1).trimStart();
  if (rest[0] !== ":") throw new Error(`rosetta sig is missing the ': <return>' after params: ${sig}`);
  const ret = rest.slice(1).trim();
  if (ret === "") throw new Error(`rosetta sig has an empty return type: ${sig}`);
  return `${params} => ${ret}`;
}

/** The full prelude for a given env: authored builtins + harvested host leaves. Convenience over
 *  `harvestHostLeaves`; the harvested half is also usable directly as
 *  `diagnoseScheme(scm, { hostMembers, preludeAppend: fragment })`. */
export function fullPrelude(env: RosettaTypedEnv | null | undefined): { ts: string; hostMembers: Set<string> } {
  const authored = loadAuthoredPrelude();
  const { fragment, hostMembers } = harvestHostLeaves(env);
  return { ts: fragment ? `${authored}\n${fragment}` : authored, hostMembers };
}

export { diagnoseScheme, type SchemeDiagnostic, type DiagnoseResult, type DiagnoseOptions } from "./check.js";
