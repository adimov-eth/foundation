/**
 * Base tool definitions for the agent framework.
 */

export interface ToolSchema {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export abstract class Tool {
  constructor(
    public readonly name: string,
    public readonly description: string,
    public readonly inputSchema: Record<string, unknown>
  ) {}

  /**
   * Convert tool to Claude API format.
   */
  toDict(): ToolSchema {
    return {
      name: this.name,
      description: this.description,
      input_schema: this.inputSchema,
    };
  }

  /**
   * Execute the tool with provided parameters.
   */
  abstract execute(params: Record<string, unknown>): Promise<string>;
}
