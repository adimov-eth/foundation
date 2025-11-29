/**
 * Base types for computer use tools
 */

import type { BetaToolUnion } from "@anthropic-ai/sdk/resources/beta/index";

export abstract class BaseAnthropicTool {
  abstract name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  abstract call(params: any): Promise<ToolResult>;
  abstract toParams(): BetaToolUnion;
}

export class ToolResult {
  readonly output: string | null;
  readonly error: string | null;
  readonly base64Image: string | null;
  readonly system: string | null;

  constructor(options: {
    output?: string | null;
    error?: string | null;
    base64Image?: string | null;
    system?: string | null;
  } = {}) {
    this.output = options.output ?? null;
    this.error = options.error ?? null;
    this.base64Image = options.base64Image ?? null;
    this.system = options.system ?? null;
  }

  replace(options: Partial<{
    output: string | null;
    error: string | null;
    base64Image: string | null;
    system: string | null;
  }>): ToolResult {
    return new ToolResult({
      output: options.output !== undefined ? options.output : this.output,
      error: options.error !== undefined ? options.error : this.error,
      base64Image: options.base64Image !== undefined ? options.base64Image : this.base64Image,
      system: options.system !== undefined ? options.system : this.system,
    });
  }
}

export class ToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolError";
  }
}
