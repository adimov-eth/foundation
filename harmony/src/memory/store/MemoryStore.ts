import type { MemoryState } from "../types.js";

export interface MemoryStore {
  load(): Promise<MemoryState | null>;
  save(state: MemoryState): Promise<void>;
}
