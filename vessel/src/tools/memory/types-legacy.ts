/**
 * Legacy type definitions - DO NOT USE
 *
 * This file exists only for backward compatibility.
 * All types have been migrated to types.ts with improved type safety:
 * - Branded types with smart constructors (Importance, Energy, MemoryId, Tag, Scope)
 * - Result<T,E> for railway-oriented programming
 * - Tagged union errors for pattern matching
 *
 * @deprecated Import from './types' instead
 */

export * from './types';
