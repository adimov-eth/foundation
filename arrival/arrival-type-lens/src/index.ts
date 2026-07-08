// @here.build/arrival-type-lens — the TypeScript type surface arrival Scheme is checked against.
//
// ⚠️ RECONSTRUCTION. The original arrival-type-lens was carved out of this open-source cut
// (its importer survives in pnpm-lock.yaml as a ghost; the source lives only in the parent
// repo). This package rebuilds the package's *contract* from public in-tree parts:
//   - the BITE contract pinned by arrival-chain-view's types-emit.test.ts (PRE + car.d.ts must
//     clean-check a good program AND make `(car 5)` bite),
//   - the emitter's __arr / bare-identifier lowering surface (types-emit.ts).
// Leaves cover the common R7RS builtins; an unmodelled builtin degrades LOUDLY ("Cannot find
// name"), never silently. This is faithful to the package's SHAPE and its declared deps
// (tsgo-wasm as the portable checker) — not a byte-for-byte copy of the parent original.
//
// Two parts:
//   1. base types (prelude/types.d.ts) — the Scheme-value vocabulary.
//   2. per-builtin leaves (prelude/builtins/*.d.ts) — generic, biting signatures.
//
// HOST FUNCTIONS (rosettas). A consumer that has host-function signatures — from a live env's
// `__rosettaTypes__`, a manifest, wherever — types them by passing `diagnoseScheme(scm, {
// hostMembers, preludeAppend })`: `hostMembers` routes those heads through `__arr` (the emitter's
// real capability, types-emit.ts:311), `preludeAppend` supplies a `.d.ts` fragment declaring their
// signatures. This package deliberately does NOT ship the env-reader that HARVESTS those sigs off
// `__rosettaTypes__`: the one in-tree consumer (arrival-ts-lsp) checks pasted SOURCE with no env in
// hand, so a harvester had zero callers. Sourcing the signatures is the consumer's job; typing them
// is ours. (History: the harvester + its `sigToArrow` parser shipped in PR #14, were verified
// against the interpreter's real sigs in #15, then retracted here as correct-but-unconsumed.)

export { loadAuthoredPrelude } from "./prelude.js";

export { diagnoseScheme, type SchemeDiagnostic, type DiagnoseResult, type DiagnoseOptions } from "./check.js";
