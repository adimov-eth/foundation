/**
 * Tools that interface with MCP servers.
 */

import { Tool } from "./base.js";
import type { MCPConnection } from "../utils/connections.js";

interface MCPToolConfig {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  connection: MCPConnection;
}

interface MCPResult {
  content?: Array<{ type?: string; text?: string }>;
}

export class MCPTool extends Tool {
  private connection: MCPConnection;

  constructor(config: MCPToolConfig) {
    super(config.name, config.description, config.inputSchema);
    this.connection = config.connection;
  }

  async execute(params: Record<string, unknown>): Promise<string> {
    try {
      const result = (await this.connection.callTool(this.name, params)) as MCPResult;

      if (result?.content && Array.isArray(result.content)) {
        for (const item of result.content) {
          if (item.type === "text" && item.text) {
            return item.text;
          }
        }
      }

      return "No text content in tool response";
    } catch (e) {
      return `Error executing ${this.name}: ${e instanceof Error ? e.message : String(e)}`;
    }
  }
}
