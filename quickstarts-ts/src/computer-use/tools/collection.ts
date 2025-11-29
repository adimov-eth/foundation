/**
 * Collection classes for managing multiple tools.
 */

import type { BetaToolUnion } from "@anthropic-ai/sdk/resources/beta/index";
import { BaseAnthropicTool, ToolResult, ToolError } from "./base.js";

/**
 * A collection of anthropic-defined tools.
 */
export class ToolCollection {
  readonly tools: BaseAnthropicTool[];
  private toolMap: Map<string, BaseAnthropicTool>;

  constructor(...tools: BaseAnthropicTool[]) {
    this.tools = tools;
    this.toolMap = new Map(tools.map((tool) => [tool.name, tool]));
  }

  toParams(): BetaToolUnion[] {
    return this.tools.map((tool) => tool.toParams());
  }

  async run(name: string, toolInput: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.toolMap.get(name);
    if (!tool) {
      return new ToolResult({ error: `Tool ${name} is invalid` });
    }
    try {
      return await tool.call(toolInput);
    } catch (e) {
      if (e instanceof ToolError) {
        return new ToolResult({ error: e.message });
      }
      throw e;
    }
  }
}
