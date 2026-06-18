export {};

declare global {
  /** Minimal static-only list shape used by the type-lens bite tests. */
  type ArrList<T> = readonly T[];

  /** Ambient Arrival member surface; builtin leaves augment this interface. */
  interface ArrShape {}

  /** Virtual Arrival builtin object. Type-checked only; never executed. */
  const __arr: ArrShape;

  /** Minimal dictionary helper for emitted keyword/dict projections. */
  type Dict<T extends Record<string, unknown> = Record<string, unknown>> = T;

  /** Opaque S-expression fallback for heads the type lens cannot model directly. */
  function sexpr<T = unknown>(head: unknown, ...args: readonly unknown[]): T;
}
