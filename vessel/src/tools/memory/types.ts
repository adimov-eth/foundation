/**
 * Memory types with v8-style type safety
 * Branded types, Result monad, tagged unions
 */

// ============================================================================
// Branded Types with Smart Constructors
// ============================================================================

export type Brand<T, B> = T & { readonly __brand: B };

export type Importance = Brand<number, 'Importance'>; // 0..1
export type Energy = Brand<number, 'Energy'>; // 0..1
export type MemoryId = Brand<string, 'MemoryId'>; // m_<timestamp>_<hash>
export type Scope = Brand<string, 'Scope'>; // agent-name or ""
export type Tag = Brand<string, 'Tag'>; // non-empty tag

// Smart constructors with validation
export const Importance = (n: number): Result<Importance, MemoryError> => {
  if (n < 0 || n > 1 || !Number.isFinite(n)) {
    return Err(ValidationError('importance', `Must be 0..1, got ${n}`));
  }
  return Ok(n as Importance);
};

export const Energy = (n: number): Result<Energy, MemoryError> => {
  if (n < 0 || n > 1 || !Number.isFinite(n)) {
    return Err(ValidationError('energy', `Must be 0..1, got ${n}`));
  }
  return Ok(n as Energy);
};

export const MemoryId = (s: string): Result<MemoryId, MemoryError> => {
  // Format: m_<timestamp>_<hash8>
  if (!/^m_[0-9]+_[a-f0-9]{8}$/.test(s)) {
    return Err(ValidationError('id', `Invalid format: ${s}`));
  }
  return Ok(s as MemoryId);
};

export const Scope = (s: string): Result<Scope, MemoryError> => {
  // Empty string or valid agent name
  if (s !== "" && !/^[a-z0-9-]+$/.test(s)) {
    return Err(ValidationError('scope', `Invalid scope: ${s}`));
  }
  return Ok(s as Scope);
};

export const Tag = (s: string): Result<Tag, MemoryError> => {
  if (s.trim().length === 0) {
    return Err(ValidationError('tag', 'Tag cannot be empty'));
  }
  return Ok(s.trim() as Tag);
};

// Unsafe constructors for migration (no validation)
export const UnsafeImportance = (n: number): Importance => n as Importance;
export const UnsafeEnergy = (n: number): Energy => n as Energy;
export const UnsafeMemoryId = (s: string): MemoryId => s as MemoryId;
export const UnsafeScope = (s: string): Scope => s as Scope;
export const UnsafeTag = (s: string): Tag => s as Tag;

// ============================================================================
// Result Type for Railway-Oriented Programming
// ============================================================================

export type Ok<T> = { readonly ok: true; readonly value: T };
export type Err<E> = { readonly ok: false; readonly error: E };
export type Result<T, E = MemoryError> = Ok<T> | Err<E>;

export const Ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const Err = <E>(error: E): Err<E> => ({ ok: false, error });

// Functor operations
export const map = <A, B, E>(
  result: Result<A, E>,
  f: (a: A) => B
): Result<B, E> => result.ok ? Ok(f(result.value)) : result;

// Monad operations
export const flatMap = <A, B, E>(
  result: Result<A, E>,
  f: (a: A) => Result<B, E>
): Result<B, E> => result.ok ? f(result.value) : result;

// Utilities
export const isOk = <T, E>(result: Result<T, E>): result is Ok<T> => result.ok;
export const isErr = <T, E>(result: Result<T, E>): result is Err<E> => !result.ok;

export const sequence = <T, E>(results: Result<T, E>[]): Result<T[], E> => {
  const values: T[] = [];
  for (const result of results) {
    if (!result.ok) return result;
    values.push(result.value);
  }
  return Ok(values);
};

// Unwrap with default
export const getOrElse = <T, E>(result: Result<T, E>, defaultValue: T): T =>
  result.ok ? result.value : defaultValue;

// ============================================================================
// Tagged Union for Errors
// ============================================================================

export type MemoryError =
  | { tag: 'ValidationError'; field: string; reason: string }
  | { tag: 'NotFoundError'; id: MemoryId; type: string }
  | { tag: 'DuplicateError'; id: MemoryId }
  | { tag: 'StorageError'; operation: string; cause: Error }
  | { tag: 'ActivationError'; reason: string }
  | { tag: 'SerializationError'; data: unknown; cause: Error };

// Error constructors
export const ValidationError = (field: string, reason: string): MemoryError => ({
  tag: 'ValidationError', field, reason
});

export const NotFoundError = (id: MemoryId, type: string): MemoryError => ({
  tag: 'NotFoundError', id, type
});

export const DuplicateError = (id: MemoryId): MemoryError => ({
  tag: 'DuplicateError', id
});

export const StorageError = (operation: string, cause: Error): MemoryError => ({
  tag: 'StorageError', operation, cause
});

export const ActivationError = (reason: string): MemoryError => ({
  tag: 'ActivationError', reason
});

export const SerializationError = (data: unknown, cause: Error): MemoryError => ({
  tag: 'SerializationError', data, cause
});

// Pattern matching for errors
export const matchError = <R>(
  error: MemoryError,
  handlers: { [K in MemoryError['tag']]: (e: Extract<MemoryError, { tag: K }>) => R }
): R => handlers[error.tag](error as any);

// ============================================================================
// Memory Item with Branded Types
// ============================================================================

export type MemoryItemType =
  | "event"
  | "fact"
  | "plan"
  | "reflection"
  | "entity"
  | "principle"
  | "technique"
  | "warning"
  | "workflow"
  | "bridge";

export interface MemoryItemV2 {
  readonly id: MemoryId;
  readonly type: MemoryItemType;
  readonly text: string;
  readonly tags: readonly Tag[];
  readonly importance: Importance;
  readonly energy: Energy;
  readonly ttl?: string;
  readonly scope?: Scope;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly lastAccessedAt?: number;
  readonly accessCount?: number;
  readonly success?: number;
  readonly fail?: number;
}

export interface MemoryEdgeV2 {
  readonly from: MemoryId;
  readonly to: MemoryId;
  readonly relation: string;
  readonly weight: Energy; // Reuse Energy type (0..1)
  readonly lastReinforcedAt: number;
}

// ============================================================================
// Core Memory Types (includes legacy + new branded versions)
// ============================================================================

// Legacy MemoryItem (for backward compatibility)
export interface MemoryItem {
  id: string;
  type: MemoryItemType;
  text: string;
  tags: string[];
  importance: number; // 0..1
  energy: number; // 0..1
  ttl?: string;
  scope?: string;
  createdAt: number;
  updatedAt: number;
  lastAccessedAt?: number;
  accessCount?: number;
  success?: number;
  fail?: number;
  helpSuccess?: number;
  helpFail?: number;
  growthSuccess?: number;
  growthFail?: number;
}

export interface MemoryState {
  id: string;
  born: number;
  energy: number;
  threshold: number;
  items: Record<string, MemoryItem>;
  edges: MemoryEdge[];
  history: Array<{ t: number; op: string; args?: any }>;
  policy?: MemoryPolicy;
  policyVersions?: PolicyVersion[];
  recentSessions?: Array<{
    t: number;
    type: "recall";
    items: string[];
    policyIds?: Partial<Record<PolicyName, string>>;
    query?: string;
    energy?: number;
    hour?: number;
    succ?: number;
    fail?: number;
    helpSucc?: number;
    helpFail?: number;
    growthSucc?: number;
    growthFail?: number;
  }>;
}

export const HISTORY_CAP = 1000;
export const SESSIONS_CAP = 100;

export interface MemoryPolicy {
  halfLifeDays: number;
  reinforceDelta: number;
  activationSteps: number;
  activationDecay: number;
  activationThreshold: number;
  edgeWeightFloor: number;
  clusterEdgeMinWeight: number;
  clusterMinSize: number;
  clusterKeepRecent: number;
  explorationEpsilon: number;
  summarizeTopKeywords: number;
  summarizeMaxSnippets: number;
  // Executable S-expressions (lambdas as strings)
  decayFn?: string;           // (lambda (success fail energy importance recency_ms base_half_ms) scale)
  recallScoreFn?: string;     // (lambda (activation recency importance access success fail hour_norm day_norm) score)
  recallScoreFns?: string[];  // multiple scorers
  recallCombinerFn?: string;  // (lambda (scores_list) score)
  explorationFn?: string;     // (lambda (limit tail_n acts recs imps accs succ fails hours days) index|-1)
  policyGeneratorFn?: string; // (lambda (hours_succ hours_fail days_succ days_fail) code_string)
  // Community detection knobs
  clusterPercentile?: number; // 0..1 percentile for dynamic threshold (default 0.6)
  neighborTopK?: number;      // top-k neighbors per node (default 3)
  // Co-activation sparsification knobs
  maxPairsPerRecall?: number;   // cap total pairs updated per recall (default 12)
  coactTopKPerNode?: number;    // cap candidate pairs per item (default 3)
}

export type PolicyName = "decay" | "recall-score" | "exploration";

export interface PolicyVersion {
  id: string; // code hash id
  name: PolicyName;
  code: string;
  createdAt: number;
  success: number;
  fail: number;
  parentIds?: string[];
}

export const DEFAULT_POLICY: MemoryPolicy = {
  halfLifeDays: 7,
  reinforceDelta: 0.05,
  activationSteps: 3,
  activationDecay: 0.85,
  activationThreshold: 0.2,
  edgeWeightFloor: 0.01,
  clusterEdgeMinWeight: 0.2,
  clusterMinSize: 10,
  clusterKeepRecent: 5,
  explorationEpsilon: 0.05,
  summarizeTopKeywords: 8,
  summarizeMaxSnippets: 5,
  // Defaults preserve current behavior but allow self-modification later
  decayFn: "(lambda (success fail energy importance recency_ms base_half_ms) (let* ((total (+ success fail 1)) (ratio (/ success total)) (scale (+ 0.5 (* 1.5 ratio)))) (* base_half_ms scale)))",
  recallScoreFn: "(lambda (activation recency importance access success fail hour day) (+ (* 0.6 activation) (* 0.25 recency) (* 0.15 importance)))",
  explorationFn: "(lambda (limit tail_n acts recs imps accs succ fails hours days) (if (> tail_n 0) 0 -1))",
  clusterPercentile: 0.6,
  neighborTopK: 3,
  maxPairsPerRecall: 12,
  coactTopKPerNode: 3,
};

// Legacy MemoryEdge (for backward compatibility)
export interface MemoryEdge {
  from: string;
  to: string;
  relation: string;
  weight: number;
  lastReinforcedAt: number;
}
