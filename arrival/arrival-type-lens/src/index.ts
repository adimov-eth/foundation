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

/** The result of harvesting a live env's host-rosetta signatures. */
export interface HarvestResult {
  /** A `.d.ts` fragment augmenting `ArrShape` with each host rosetta's colocated signature. */
  readonly fragment: string;
  /** The host-member name set — pass as `emitTypes(scm, { hostMembers })` so those heads
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
 *  The return-type group is `[^\s]`-anchored-greedy with in-code trimming (rather than a lazy
 *  `.+?\s*$`, which backtracks super-linearly against the trailing `\s*`). */
function sigToArrow(sig: string): string {
  const m = /^\s*(\([^)]*\))\s*:\s*(\S.*)$/.exec(sig);
  if (!m?.[1] || m[2] === undefined) return `(...args: unknown[]) => unknown`;
  return `${m[1]} => ${m[2].trimEnd()}`;
}

/** The full prelude for a given env: authored builtins + harvested host leaves. */
export function fullPrelude(env: RosettaTypedEnv | null | undefined): { ts: string; hostMembers: Set<string> } {
  const authored = loadAuthoredPrelude();
  const { fragment, hostMembers } = harvestHostLeaves(env);
  return { ts: fragment ? `${authored}\n${fragment}` : authored, hostMembers };
}

export { diagnoseScheme, type SchemeDiagnostic, type DiagnoseResult, type DiagnoseOptions } from "./check.js";
