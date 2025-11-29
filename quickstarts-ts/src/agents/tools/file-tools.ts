/**
 * File operation tools for reading and writing files.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { glob } from "glob";

import { Tool } from "./base.js";

export class FileReadTool extends Tool {
  constructor() {
    super(
      "file_read",
      `Read files or list directory contents.

Operations:
- read: Read the contents of a file
- list: List files in a directory`,
      {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: ["read", "list"],
            description: "File operation to perform",
          },
          path: {
            type: "string",
            description: "File path for read or directory path",
          },
          max_lines: {
            type: "integer",
            description: "Maximum lines to read (0 means no limit)",
          },
          pattern: {
            type: "string",
            description: "File pattern to match",
          },
        },
        required: ["operation", "path"],
      }
    );
  }

  async execute(params: Record<string, unknown>): Promise<string> {
    const operation = params.operation as string;
    const filePath = params.path as string;
    const maxLines = (params.max_lines as number) ?? 0;
    const pattern = (params.pattern as string) ?? "*";

    if (operation === "read") {
      return this.readFile(filePath, maxLines);
    }
    if (operation === "list") {
      return this.listFiles(filePath, pattern);
    }
    return `Error: Unsupported operation '${operation}'`;
  }

  private async readFile(filePath: string, maxLines: number): Promise<string> {
    try {
      const stat = await fs.stat(filePath).catch(() => null);
      if (!stat) return `Error: File not found at ${filePath}`;
      if (!stat.isFile()) return `Error: ${filePath} is not a file`;

      const content = await fs.readFile(filePath, "utf-8");

      if (maxLines > 0) {
        const lines = content.split("\n").slice(0, maxLines);
        return lines.join("\n");
      }

      return content;
    } catch (e) {
      return `Error reading ${filePath}: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  private async listFiles(directory: string, pattern: string): Promise<string> {
    try {
      const stat = await fs.stat(directory).catch(() => null);
      if (!stat) return `Error: Directory not found at ${directory}`;
      if (!stat.isDirectory()) return `Error: ${directory} is not a directory`;

      const searchPattern = path.join(directory, pattern);
      const files = await glob(searchPattern);

      if (files.length === 0) {
        return `No files found matching ${directory}/${pattern}`;
      }

      const fileList: string[] = [];
      for (const file of files.sort()) {
        const fileStat = await fs.stat(file);
        const relPath = path.relative(directory, file);
        if (fileStat.isDirectory()) {
          fileList.push(`📁 ${relPath}/`);
        } else {
          fileList.push(`📄 ${relPath}`);
        }
      }

      return fileList.join("\n");
    } catch (e) {
      return `Error listing files in ${directory}: ${e instanceof Error ? e.message : String(e)}`;
    }
  }
}

export class FileWriteTool extends Tool {
  constructor() {
    super(
      "file_write",
      `Write or edit files.

Operations:
- write: Create or completely replace a file
- edit: Make targeted changes to parts of a file`,
      {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: ["write", "edit"],
            description: "File operation to perform",
          },
          path: {
            type: "string",
            description: "File path to write to or edit",
          },
          content: {
            type: "string",
            description: "Content to write",
          },
          old_text: {
            type: "string",
            description: "Text to replace (for edit operation)",
          },
          new_text: {
            type: "string",
            description: "Replacement text (for edit operation)",
          },
        },
        required: ["operation", "path"],
      }
    );
  }

  async execute(params: Record<string, unknown>): Promise<string> {
    const operation = params.operation as string;
    const filePath = params.path as string;
    const content = (params.content as string) ?? "";
    const oldText = (params.old_text as string) ?? "";
    const newText = (params.new_text as string) ?? "";

    if (operation === "write") {
      if (!content) return "Error: content parameter is required";
      return this.writeFile(filePath, content);
    }
    if (operation === "edit") {
      if (!oldText || !newText) {
        return "Error: both old_text and new_text parameters are required for edit operation";
      }
      return this.editFile(filePath, oldText, newText);
    }
    return `Error: Unsupported operation '${operation}'`;
  }

  private async writeFile(filePath: string, content: string): Promise<string> {
    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content, "utf-8");
      return `Successfully wrote ${content.length} characters to ${filePath}`;
    } catch (e) {
      return `Error writing to ${filePath}: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  private async editFile(filePath: string, oldText: string, newText: string): Promise<string> {
    try {
      const stat = await fs.stat(filePath).catch(() => null);
      if (!stat) return `Error: File not found at ${filePath}`;
      if (!stat.isFile()) return `Error: ${filePath} is not a file`;

      const content = await fs.readFile(filePath, "utf-8");

      if (!content.includes(oldText)) {
        return `Error: The specified text was not found in ${filePath}`;
      }

      const count = content.split(oldText).length - 1;
      const newContent = content.replaceAll(oldText, newText);
      await fs.writeFile(filePath, newContent, "utf-8");

      if (count > 1) {
        return `Warning: Found ${count} occurrences. All were replaced in ${filePath}`;
      }
      return `Successfully edited ${filePath}`;
    } catch (e) {
      return `Error editing ${filePath}: ${e instanceof Error ? e.message : String(e)}`;
    }
  }
}
