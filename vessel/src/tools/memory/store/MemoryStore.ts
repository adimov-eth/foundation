import type { MemoryState } from "@/mcp-server/tools/memory/types";

export interface MemoryStore {
  load(): Promise<MemoryState | null>;
  save(state: MemoryState, snapshotSExpr: string): Promise<void>;
}

