// check.ts — the FAITHFUL checker: Scheme source → type diagnostics positioned on the `.scm`.
//
// Drives `tsgo-wasm` (TypeScript 7 / typescript-go compiled to WASM) — the checker the
// carved-out original declared. That is not incidental: a lens that lives inside a sandboxed
// Scheme runtime needs a PORTABLE tsc (WASM, no host `typescript` install, worker/browser-
// runnable). tsgo-wasm is exactly that. An earlier reconstruction drove node's `ts.createProgram`
// — it worked and was presence-equivalent (verified 0 disagreements / 174 snippets), but it was
// a DIFFERENT artifact wearing the original's name. This drives tsgo-wasm, matching the dep.
//
// Pipeline (every step but the tsc-run is in-tree, from @here.build/arrival-chain-view):
//   scm ──emitTypes──▶ { ts, mappings, droppedForms }
//   write PRE + ts to a tempdir; spawn `tsgo-wasm --noEmit --pretty false`
//   parse `mod.ts(line,col): error TSxxxx: msg` (machine format, zero ANSI, exit 1 on errors)
//   each (line,col) ──offset──▶ TS char offset ──lift via mappings──▶ [scmStart, scmLen)
//   attribute each diagnostic to its enclosing top-level form via arrival-sweet's topFormSpans
//
// tsgo is a CLI, not a library, so vs a compiler-API driver: (1) virtual files become real temp
// files (tsgo reads the fs via its Go-WASM shim), (2) diagnostics are TEXT not objects — we
// convert the emitted-TS (line,col) to a char offset ourselves, then lift. The span lens
// (`Mapping[]`) is unchanged: a TS offset carries back to the exact `.scm` range.

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";

import { emitTypes, type Mapping } from "@here.build/arrival-chain-view/types-emit";
import { topFormSpans } from "@here.build/arrival-sweet";

import { loadAuthoredPrelude } from "./prelude.js";

// Lazily memoized so importing this module has no filesystem side-effect at load time (and no
// dependence on cross-module init order). Computed on the first diagnoseScheme call.
let preludeCache: string | undefined;
function prelude(): string {
  if (preludeCache === undefined) preludeCache = loadAuthoredPrelude();
  return preludeCache;
}

/** Options for a diagnose run. `hostMembers` is forwarded to emitTypes so those host heads
 *  lower through `__arr`; `preludeAppend` is the harvested `.d.ts` fragment that DECLARES those
 *  members (from `fullPrelude`/`harvestHostLeaves`). Pass BOTH together — `hostMembers` without
 *  the matching `preludeAppend` lowers host calls to `__arr.<name>` with no declaration, which
 *  regresses to a spurious `TS2339`. */
export interface DiagnoseOptions {
  readonly hostMembers?: Set<string>;
  readonly preludeAppend?: string;
}

/** One type diagnostic, positioned on the source `.scm`. */
export interface SchemeDiagnostic {
  readonly severity: "error" | "warning";
  /** The TS diagnostic number (e.g. 2345). tsgo (TS7) may renumber a few vs classic tsc. */
  readonly code: number;
  readonly message: string;
  /** 0-based char offset of the offending form in the `.scm` source. */
  readonly schemeStart: number;
  readonly schemeLength: number;
  /** 0-based line/col of `schemeStart` in the `.scm`. */
  readonly line: number;
  readonly col: number;
  /** Index of the enclosing top-level form (via arrival-sweet's topFormSpans), or -1. */
  readonly topForm: number;
  /** 1-based line/col in the EMITTED TS (for debugging the emit). */
  readonly tsLine: number;
  readonly tsCol: number;
  /** Whether the diagnostic lifted onto a real source span (false → surfaced at file head). */
  readonly lifted: boolean;
}

export interface DiagnoseResult {
  readonly diagnostics: SchemeDiagnostic[];
  readonly emittedTs: string;
  readonly droppedForms: number[];
}

const require_ = createRequire(import.meta.url);

/** Resolve the tsgo-wasm bin. In a normal install this is `require.resolve('tsgo-wasm')` → its
 *  package.json `bin`. TSGO_WASM_BIN overrides (used before the dep is installed / in tests). */
function resolveTsgoBin(): string {
  const env = process.env.TSGO_WASM_BIN;
  if (env) return env;
  const pkgJson = require_.resolve("tsgo-wasm/package.json");
  const dir = path.dirname(pkgJson);
  const bin = (JSON.parse(readFileSync(pkgJson, "utf8")) as { bin: string | Record<string, string> }).bin;
  const rel = typeof bin === "string" ? bin : bin["tsgo-wasm"];
  if (rel === undefined) throw new Error("tsgo-wasm package.json has no 'tsgo-wasm' bin entry");
  return path.join(dir, rel);
}

// Live temp dirs, cleaned on process-exit signals. The per-call `finally` handles the normal +
// throw paths; this backstop covers the ONE case `finally` cannot: the process being SIGTERM/
// SIGINT-killed mid-spawnSync (verified leak: a killed run left the dir with a full mod.ts).
const LIVE_DIRS = new Set<string>();
let signalsHooked = false;

/** Remove every still-live temp dir (best-effort). Called from the process-exit handlers. */
function sweepLiveDirs(): void {
  for (const d of LIVE_DIRS) {
    try {
      rmSync(d, { recursive: true, force: true });
    } catch {
      /* best-effort */
    }
  }
  LIVE_DIRS.clear();
}

function hookSignalCleanup(): void {
  if (signalsHooked) return;
  signalsHooked = true;
  process.once("exit", sweepLiveDirs);
  for (const sig of ["SIGTERM", "SIGINT", "SIGHUP"] as const) {
    process.once(sig, () => {
      sweepLiveDirs();
      process.kill(process.pid, sig);
    });
  }
}

/** A minimal env for the tsgo-wasm subprocess. The Go-WASM runtime sums the command line AND the
 *  environment against one fixed buffer, and throws "total length of command line and environment
 *  variables exceeds limit" if the inherited env is large (e.g. under vitest, CI, or a rich shell).
 *  So we pass only what the WASM loader actually needs, never `process.env` wholesale. */
function minimalEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const k of ["PATH", "HOME", "TMPDIR", "SystemRoot", "TEMP", "TMP"]) {
    const v = process.env[k];
    if (v !== undefined) env[k] = v;
  }
  return env;
}

/** Run tsgo-wasm over pre.d.ts + mod.ts in a tempdir, return combined stdout+stderr (machine fmt). */
function runTsgo(preText: string, modText: string): string {
  const bin = resolveTsgoBin();
  hookSignalCleanup();
  const dir = mkdtempSync(path.join(tmpdir(), "tsgo-lens-"));
  LIVE_DIRS.add(dir);
  try {
    writeFileSync(path.join(dir, "pre.d.ts"), preText);
    writeFileSync(path.join(dir, "mod.ts"), modText);
    // --pretty false: classic `file(l,c): error TSxxxx: msg`, zero ANSI, exit 1 on errors / 0 clean.
    const res = spawnSync(
      process.execPath,
      [bin, "--noEmit", "--pretty", "false", "--strict", "false", "--skipLibCheck", "pre.d.ts", "mod.ts"],
      { cwd: dir, encoding: "utf8", maxBuffer: 32 * 1024 * 1024, env: minimalEnv() },
    );
    if (res.error) throw res.error;
    const out = (res.stdout ?? "") + (res.stderr ?? "");
    // Distinguish a real type-check from a CHECKER FAILURE. tsgo's contract: exit 0 = clean, exit
    // 1 = diagnostics (each a `TSxxxx` line). ANYTHING ELSE — a non-zero/other exit or a kill
    // signal — with no parseable `TSxxxx` means the checker produced NO verdict, so an empty diag
    // set is a false all-clear, not "clean". Surface it loudly. This is the general form of the
    // env-limit war story (tsgo printed `Error: total length…` to stderr, empty stdout, 0 diags):
    // the invariant is "no TSxxxx AND the process exited unhappy", which also catches a Go
    // `panic:`, an OOM/SIGKILL (status=null, signal set, empty output), and future format drift —
    // not just the one `Error:`-prefixed string. "0 errors from a tool that didn't run" ≠ 0 errors.
    const sawDiag = /\bTS\d+:/.test(out);
    const exitedUnhappy = res.status !== 0 || res.signal !== null;
    if (!sawDiag && exitedUnhappy) {
      const errLine = out
        .split("\n")
        .find((l) => /^(?:Error|panic|fatal error):/.test(l))
        ?.trim();
      const detail =
        errLine ?? `exit status=${String(res.status)} signal=${String(res.signal)}; output: ${out.slice(0, 300)}`;
      throw new Error(`tsgo-wasm failed to run (${detail})`);
    }
    return out;
  } finally {
    rmSync(dir, { recursive: true, force: true });
    LIVE_DIRS.delete(dir);
  }
}

// tsgo machine line: `mod.ts(12,7): error TS2345: Argument of type …`. Only mod.ts is the user's program.
// The filename capture excludes `(` (a filename can't contain the `(` that opens the position) so
// the pattern is linear — no backtracking between the name and the position group.
const DIAG_RE = /^([^(]+)\((\d+),(\d+)\): (error|warning) TS(\d+): (.*)$/;

/** 1-based (line,col) in `text` → 0-based char offset. */
function lineColToOffset(text: string, line1: number, col1: number): number {
  let off = 0;
  let line = 1;
  while (line < line1) {
    const nl = text.indexOf("\n", off);
    if (nl === -1) return text.length;
    off = nl + 1;
    line++;
  }
  return off + (col1 - 1);
}

/** Lift a TS char offset back to the source `.scm` [start,len) via the span lens. Tightest covering
 *  span (smallest tsLength) wins, so a nested error lands on the innermost form, not its parent. */
function liftOffset(
  tsOffset: number,
  mappings: readonly Mapping[],
): { schemeStart: number; schemeLength: number } | null {
  let best: Mapping | null = null;
  for (const m of mappings) {
    if (tsOffset >= m.tsStart && tsOffset < m.tsStart + m.tsLength && (!best || m.tsLength < best.tsLength)) best = m;
  }
  return best ? { schemeStart: best.schemeStart, schemeLength: best.schemeLength } : null;
}

/** Char offset → {line, col} (0-based) in the given text. */
function offsetToLineCol(text: string, offset: number): { line: number; col: number } {
  let line = 0;
  let last = 0;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text[i] === "\n") {
      line++;
      last = i + 1;
    }
  }
  return { line, col: offset - last };
}

/** Index of the top-level form (per arrival-sweet's comment/string-aware scan) covering `offset`. */
function topFormOf(spans: ReadonlyArray<{ start: number; end: number }>, offset: number): number {
  for (const [i, span] of spans.entries()) {
    if (offset >= span.start && offset < span.end) return i;
  }
  return -1;
}

/**
 * Diagnose a Scheme source via tsgo-wasm. Returns type diagnostics positioned on the `.scm`,
 * each attributed to its enclosing top-level form.
 */
export function diagnoseScheme(scm: string, opts: DiagnoseOptions = {}): DiagnoseResult {
  const { ts: emittedTs, mappings, droppedForms } = emitTypes(scm, { hostMembers: opts.hostMembers });
  // Authored builtins + (optional) harvested host-rosetta declarations. The append DECLARES the
  // ArrShape members that `hostMembers` causes the emitter to route through `__arr`.
  const pre = opts.preludeAppend ? `${prelude()}\n${opts.preludeAppend}` : prelude();
  const raw = runTsgo(pre, emittedTs);
  const forms = topFormSpans(scm);

  const diagnostics: SchemeDiagnostic[] = [];
  for (const rawLine of raw.split("\n")) {
    const m = DIAG_RE.exec(rawLine.trim());
    if (!m) continue;
    // Groups 1..6 are all present when the pattern matches (every quantifier is `+`/`\d+`/`.*`).
    const [, file = "", lineS = "0", colS = "0", sev = "error", codeS = "0", message = ""] = m;
    if (path.basename(file) !== "mod.ts") continue; // only the user's program, not the prelude
    const tsLine = Number(lineS);
    const tsCol = Number(colS);
    const tsOffset = lineColToOffset(emittedTs, tsLine, tsCol);
    const lifted = liftOffset(tsOffset, mappings);
    if (lifted) {
      const { line, col } = offsetToLineCol(scm, lifted.schemeStart);
      diagnostics.push({
        severity: sev === "warning" ? "warning" : "error",
        code: Number(codeS),
        message,
        schemeStart: lifted.schemeStart,
        schemeLength: lifted.schemeLength,
        line,
        col,
        topForm: topFormOf(forms, lifted.schemeStart),
        tsLine,
        tsCol,
        lifted: true,
      });
    } else {
      // Unliftable (rare — a diagnostic on emitter-synthesized TS with no IR span). Surface at head.
      diagnostics.push({
        severity: sev === "warning" ? "warning" : "error",
        code: Number(codeS),
        message,
        schemeStart: 0,
        schemeLength: 0,
        line: 0,
        col: 0,
        topForm: -1,
        tsLine,
        tsCol,
        lifted: false,
      });
    }
  }
  const sorted = diagnostics.toSorted((a, b) => a.schemeStart - b.schemeStart);
  return { diagnostics: sorted, emittedTs, droppedForms };
}
