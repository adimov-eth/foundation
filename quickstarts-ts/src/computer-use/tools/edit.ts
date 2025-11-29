/**
 * Edit Tool - File editor with str_replace, view, create, insert commands
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { BetaToolUnion } from "@anthropic-ai/sdk/resources/beta/index";
import { BaseAnthropicTool, ToolResult, ToolError } from "./base.js";
import { run, maybeTruncate } from "./run.js";

type Command20250124 = "view" | "create" | "str_replace" | "insert" | "undo_edit";

const SNIPPET_LINES = 4;

interface EditParams {
  command: string;
  path: string;
  file_text?: string;
  view_range?: [number, number];
  old_str?: string;
  new_str?: string;
  insert_line?: number;
}

/**
 * EditTool20250124 - A filesystem editor tool that allows the agent to view, create, and edit files.
 * The tool parameters are defined by Anthropic and are not editable.
 */
export class EditTool20250124 extends BaseAnthropicTool {
  readonly name = "str_replace_editor" as const;
  readonly apiType = "text_editor_20250124" as const;
  private fileHistory: Map<string, string[]> = new Map();

  toParams(): BetaToolUnion {
    return { name: this.name, type: this.apiType } as unknown as BetaToolUnion;
  }

  async call(params: EditParams): Promise<ToolResult> {
    const { command, path: filePath } = params;
    const absPath = path.resolve(filePath);

    this.validatePath(command as Command20250124, absPath);

    switch (command) {
      case "view":
        return this.view(absPath, params.view_range);
      case "create":
        if (params.file_text === undefined) {
          throw new ToolError("Parameter `file_text` is required for command: create");
        }
        return this.create(absPath, params.file_text);
      case "str_replace":
        if (params.old_str === undefined) {
          throw new ToolError("Parameter `old_str` is required for command: str_replace");
        }
        return this.strReplace(absPath, params.old_str, params.new_str);
      case "insert":
        if (params.insert_line === undefined) {
          throw new ToolError("Parameter `insert_line` is required for command: insert");
        }
        if (params.new_str === undefined) {
          throw new ToolError("Parameter `new_str` is required for command: insert");
        }
        return this.insert(absPath, params.insert_line, params.new_str);
      case "undo_edit":
        return this.undoEdit(absPath);
      default:
        throw new ToolError(
          `Unrecognized command ${command}. The allowed commands for the ${this.name} tool are: view, create, str_replace, insert, undo_edit`
        );
    }
  }

  private validatePath(command: Command20250124, filePath: string): void {
    // Check if absolute path
    if (!path.isAbsolute(filePath)) {
      const suggested = path.resolve(filePath);
      throw new ToolError(
        `The path ${filePath} is not an absolute path, it should start with \`/\`. Maybe you meant ${suggested}?`
      );
    }

    const exists = fs.existsSync(filePath);
    const isDir = exists && fs.statSync(filePath).isDirectory();

    // Check if path exists (except for create)
    if (!exists && command !== "create") {
      throw new ToolError(
        `The path ${filePath} does not exist. Please provide a valid path.`
      );
    }

    // Check if path exists for create
    if (exists && command === "create") {
      throw new ToolError(
        `File already exists at: ${filePath}. Cannot overwrite files using command \`create\`.`
      );
    }

    // Check if directory
    if (isDir && command !== "view") {
      throw new ToolError(
        `The path ${filePath} is a directory and only the \`view\` command can be used on directories`
      );
    }
  }

  private async view(
    filePath: string,
    viewRange?: [number, number]
  ): Promise<ToolResult> {
    const isDir = fs.existsSync(filePath) && fs.statSync(filePath).isDirectory();

    if (isDir) {
      if (viewRange) {
        throw new ToolError(
          "The `view_range` parameter is not allowed when `path` points to a directory."
        );
      }
      const [, stdout, stderr] = await run(
        `find ${filePath} -maxdepth 2 -not -path '*/\\.*'`
      );
      const output = stderr
        ? stdout
        : `Here's the files and directories up to 2 levels deep in ${filePath}, excluding hidden items:\n${stdout}\n`;
      return new ToolResult({ output, error: stderr || null });
    }

    let fileContent = this.readFile(filePath);
    let initLine = 1;

    if (viewRange) {
      if (viewRange.length !== 2 || !viewRange.every((i) => Number.isInteger(i))) {
        throw new ToolError(
          "Invalid `view_range`. It should be a list of two integers."
        );
      }

      const fileLines = fileContent.split("\n");
      const nLinesFile = fileLines.length;
      const [init, final] = viewRange;

      if (init < 1 || init > nLinesFile) {
        throw new ToolError(
          `Invalid \`view_range\`: ${viewRange}. Its first element \`${init}\` should be within the range of lines of the file: [1, ${nLinesFile}]`
        );
      }
      if (final > nLinesFile) {
        throw new ToolError(
          `Invalid \`view_range\`: ${viewRange}. Its second element \`${final}\` should be smaller than the number of lines in the file: \`${nLinesFile}\``
        );
      }
      if (final !== -1 && final < init) {
        throw new ToolError(
          `Invalid \`view_range\`: ${viewRange}. Its second element \`${final}\` should be larger or equal than its first \`${init}\``
        );
      }

      initLine = init;
      if (final === -1) {
        fileContent = fileLines.slice(init - 1).join("\n");
      } else {
        fileContent = fileLines.slice(init - 1, final).join("\n");
      }
    }

    return new ToolResult({
      output: this.makeOutput(fileContent, filePath, initLine),
    });
  }

  private create(filePath: string, fileText: string): ToolResult {
    this.writeFile(filePath, fileText);
    const history = this.fileHistory.get(filePath) || [];
    history.push(fileText);
    this.fileHistory.set(filePath, history);
    return new ToolResult({ output: `File created successfully at: ${filePath}` });
  }

  private strReplace(
    filePath: string,
    oldStr: string,
    newStr?: string
  ): ToolResult {
    let fileContent = this.readFile(filePath).replace(/\t/g, "    ");
    oldStr = oldStr.replace(/\t/g, "    ");
    const newStrExpanded = (newStr ?? "").replace(/\t/g, "    ");

    const occurrences = fileContent.split(oldStr).length - 1;

    if (occurrences === 0) {
      throw new ToolError(
        `No replacement was performed, old_str \`${oldStr}\` did not appear verbatim in ${filePath}.`
      );
    }
    if (occurrences > 1) {
      const fileLines = fileContent.split("\n");
      const lines = fileLines
        .map((line, idx) => (line.includes(oldStr) ? idx + 1 : null))
        .filter((x): x is number => x !== null);
      throw new ToolError(
        `No replacement was performed. Multiple occurrences of old_str \`${oldStr}\` in lines ${lines}. Please ensure it is unique`
      );
    }

    const newFileContent = fileContent.replace(oldStr, newStrExpanded);
    this.writeFile(filePath, newFileContent);

    // Save to history
    const history = this.fileHistory.get(filePath) || [];
    history.push(fileContent);
    this.fileHistory.set(filePath, history);

    // Create snippet
    const replacementLine = fileContent.split(oldStr)[0].split("\n").length - 1;
    const startLine = Math.max(0, replacementLine - SNIPPET_LINES);
    const endLine = replacementLine + SNIPPET_LINES + newStrExpanded.split("\n").length;
    const snippet = newFileContent.split("\n").slice(startLine, endLine + 1).join("\n");

    let successMsg = `The file ${filePath} has been edited. `;
    successMsg += this.makeOutput(snippet, `a snippet of ${filePath}`, startLine + 1);
    successMsg +=
      "Review the changes and make sure they are as expected. Edit the file again if necessary.";

    return new ToolResult({ output: successMsg });
  }

  private insert(filePath: string, insertLine: number, newStr: string): ToolResult {
    let fileText = this.readFile(filePath).replace(/\t/g, "    ");
    newStr = newStr.replace(/\t/g, "    ");

    const fileTextLines = fileText.split("\n");
    const nLinesFile = fileTextLines.length;

    if (insertLine < 0 || insertLine > nLinesFile) {
      throw new ToolError(
        `Invalid \`insert_line\` parameter: ${insertLine}. It should be within the range of lines of the file: [0, ${nLinesFile}]`
      );
    }

    const newStrLines = newStr.split("\n");
    const newFileTextLines = [
      ...fileTextLines.slice(0, insertLine),
      ...newStrLines,
      ...fileTextLines.slice(insertLine),
    ];
    const snippetLines = [
      ...fileTextLines.slice(Math.max(0, insertLine - SNIPPET_LINES), insertLine),
      ...newStrLines,
      ...fileTextLines.slice(insertLine, insertLine + SNIPPET_LINES),
    ];

    const newFileText = newFileTextLines.join("\n");
    const snippet = snippetLines.join("\n");

    this.writeFile(filePath, newFileText);

    // Save to history
    const history = this.fileHistory.get(filePath) || [];
    history.push(fileText);
    this.fileHistory.set(filePath, history);

    let successMsg = `The file ${filePath} has been edited. `;
    successMsg += this.makeOutput(
      snippet,
      "a snippet of the edited file",
      Math.max(1, insertLine - SNIPPET_LINES + 1)
    );
    successMsg +=
      "Review the changes and make sure they are as expected (correct indentation, no duplicate lines, etc). Edit the file again if necessary.";

    return new ToolResult({ output: successMsg });
  }

  private undoEdit(filePath: string): ToolResult {
    const history = this.fileHistory.get(filePath);
    if (!history || history.length === 0) {
      throw new ToolError(`No edit history found for ${filePath}.`);
    }

    const oldText = history.pop()!;
    this.writeFile(filePath, oldText);

    return new ToolResult({
      output: `Last edit to ${filePath} undone successfully. ${this.makeOutput(oldText, filePath)}`,
    });
  }

  private readFile(filePath: string): string {
    try {
      return fs.readFileSync(filePath, "utf-8");
    } catch (e) {
      throw new ToolError(`Ran into ${e} while trying to read ${filePath}`);
    }
  }

  private writeFile(filePath: string, content: string): void {
    try {
      // Ensure directory exists
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, content, "utf-8");
    } catch (e) {
      throw new ToolError(`Ran into ${e} while trying to write to ${filePath}`);
    }
  }

  private makeOutput(
    fileContent: string,
    fileDescriptor: string,
    initLine = 1,
    expandTabs = true
  ): string {
    let content = maybeTruncate(fileContent);
    if (expandTabs) {
      content = content.replace(/\t/g, "    ");
    }
    const numbered = content
      .split("\n")
      .map((line, i) => `${String(i + initLine).padStart(6)}\t${line}`)
      .join("\n");

    return `Here's the result of running \`cat -n\` on ${fileDescriptor}:\n${numbered}\n`;
  }
}

/**
 * EditTool20250728 - Same as 20250124 but without undo_edit
 */
export class EditTool20250728 extends BaseAnthropicTool {
  readonly name = "str_replace_based_edit_tool";
  readonly apiType = "text_editor_20250728";
  private delegate = new EditTool20250124();

  toParams(): BetaToolUnion {
    return { name: this.name, type: this.apiType } as unknown as BetaToolUnion;
  }

  async call(params: EditParams): Promise<ToolResult> {
    if (params.command === "undo_edit") {
      throw new ToolError(
        `Unrecognized command undo_edit. The allowed commands for the ${this.name} tool are: view, create, str_replace, insert`
      );
    }
    return this.delegate.call(params);
  }
}

/**
 * EditTool20241022 - Uses text_editor_20250429 API type
 */
export class EditTool20241022 extends BaseAnthropicTool {
  readonly name = "str_replace_editor";
  readonly apiType = "text_editor_20250429";
  private delegate = new EditTool20250124();

  toParams(): BetaToolUnion {
    return { name: this.name, type: this.apiType } as unknown as BetaToolUnion;
  }

  async call(params: EditParams): Promise<ToolResult> {
    return this.delegate.call(params);
  }
}

// Default export
export const EditTool = EditTool20250124;
