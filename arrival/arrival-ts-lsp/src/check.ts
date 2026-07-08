// check.ts — the pure `check` verb, separated from the server transport so it is testable.
//
// Wraps @here.build/arrival-type-lens's diagnoseScheme and shapes each diagnostic into the flat
// record an MCP client / the REPL renders. No transport, no side effects on import.

import { diagnoseScheme } from "@here.build/arrival-type-lens";

/** One diagnostic as the REPL / MCP client renders it — positioned on the SOURCE Scheme. */
export interface RenderedDiagnostic {
  severity: "error" | "warning";
  line: number;
  col: number;
  /** The offending sub-form, sliced from the source. */
  on: string;
  code: string;
  message: string;
  /** Which top-level form (index) it lands in, or -1. */
  topForm: number;
  /** false ⇒ the diagnostic couldn't be positioned on the .scm (rare). */
  lifted: boolean;
}

export interface CheckResult {
  ok?: boolean;
  diagnostics?: RenderedDiagnostic[];
  droppedForms?: number[];
  error?: string;
}

/** Diagnose a Scheme source → a plain list of positioned diagnostics. */
export function check(scm: unknown): CheckResult {
  if (typeof scm !== "string" || scm.length === 0) {
    return { error: "check expects a non-empty Scheme source string" };
  }
  let r;
  try {
    r = diagnoseScheme(scm);
  } catch (error) {
    return { error: `type-check failed: ${(error as Error).message}` };
  }
  return {
    ok: r.diagnostics.length === 0,
    diagnostics: r.diagnostics.map((d) => ({
      severity: d.severity,
      line: d.line,
      col: d.col,
      on: scm.slice(d.schemeStart, d.schemeStart + d.schemeLength),
      code: `TS${d.code}`,
      message: d.message,
      topForm: d.topForm,
      lifted: d.lifted,
    })),
    droppedForms: r.droppedForms,
  };
}
