import { promises as fs } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import type { MemoryState } from "@/mcp-server/tools/memory/types";
import type { MemoryStore } from "@/mcp-server/tools/memory/store/MemoryStore";

/**
 * File-backed memory store for development.
 * - Writes canonical S-expression snapshot and a JSON mirror for fast load.
 */
export class FileMemoryStore implements MemoryStore {
  private readonly dir: string;
  private readonly snapshotPath: string;
  private readonly jsonPath: string;

  constructor(baseDir?: string) {
    // Compute a stable default base directory independent of CWD.
    // Prefer explicit env var, else anchor relative to this file's location.
    const moduleDir = path.dirname(fileURLToPath(import.meta.url));
    const anchored = path.resolve(moduleDir, "../../../../.state/memory");
    const defaultBase = process.env.MEMORY_STATE_DIR || anchored;

    this.dir = baseDir || defaultBase;
    this.snapshotPath = path.join(this.dir, "graph.sexpr");
    this.jsonPath = path.join(this.dir, "graph.json");
  }

  async load(): Promise<MemoryState | null> {
    try {
      await fs.mkdir(this.dir, { recursive: true });
      const json = await fs.readFile(this.jsonPath, "utf8");
      return JSON.parse(json) as MemoryState;
    } catch {
      return null;
    }
  }

  async save(state: MemoryState, snapshotSExpr: string): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
    await fs.writeFile(this.snapshotPath, snapshotSExpr, "utf8");
    await fs.writeFile(this.jsonPath, JSON.stringify(state, null, 2), "utf8");
  }
}
