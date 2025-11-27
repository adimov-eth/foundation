import { promises as fs } from "node:fs";
import * as path from "node:path";
import type { MemoryState } from "../types.js";
import type { MemoryStore } from "./MemoryStore.js";

/**
 * File-backed memory store.
 * Simple JSON persistence for development and single-instance use.
 */
export class FileMemoryStore implements MemoryStore {
  private readonly dir: string;
  private readonly jsonPath: string;

  constructor(baseDir?: string) {
    const defaultBase = process.env.HARMONY_STATE_DIR ||
      path.join(process.env.HOME || "/tmp", ".harmony", "memory");

    this.dir = baseDir || defaultBase;
    this.jsonPath = path.join(this.dir, "state.json");
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

  async save(state: MemoryState): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
    await fs.writeFile(this.jsonPath, JSON.stringify(state, null, 2), "utf8");
  }
}
