import type { CallToolRequest, CallToolResult, ListToolsResult } from "@modelcontextprotocol/sdk/types.js";
import type { Context } from "hono";
import invariant from "tiny-invariant";
import type { Constructor } from "type-fest";

import type { ToolInteraction } from "@/mcp-server/framework/ToolInteraction";

// Inlined from @core/shared - it was literally one function
function asArray<T>(x: T | T[]): T[] {
  return Array.isArray(x) ? x : [x];
}

export class MCPServer {
  public readonly tools: Constructor<ToolInteraction<any>>[];

  constructor(...tools: Constructor<ToolInteraction<any>>[]) {
    this.tools = tools;
  }

  async callTool(context: Context, request: CallToolRequest["params"]): Promise<CallToolResult> {
    const ToolInteraction = this.tools.find((Tool) => {
      // Check static toolName property if it exists, otherwise fall back to class name
      return (Tool as any).toolName === request.name || Tool.name === request.name;
    });
    invariant(ToolInteraction !== undefined, "unknown tool");
    const toolInteraction = new ToolInteraction(context);
    const callToolResult = await toolInteraction.executeTool(request.arguments);

    return {
      content: await Promise.all(
        asArray(callToolResult).map(async (result): Promise<CallToolResult["content"][number]> => {
          switch (true) {
            case typeof result === "string":
              return {
                type: "text",
                text: result,
              };
            case result instanceof Blob && result.type.startsWith("image/"):
            case result instanceof Blob && result.type.startsWith("audio/"): {
              let binary = "";
              const bytes = new Uint8Array(await result.arrayBuffer());
              const length_ = bytes.byteLength;
              for (let index = 0; index < length_; index++) {
                binary += String.fromCodePoint(bytes[index]);
              }
              return {
                type: result.type.split("/")[0] as "image" | "audio",
                data: btoa(binary),
                mimeType: result.type,
              };
            }
            default:
              return {
                type: "text",
                text: JSON.stringify(result),
              };
          }
        }),
      ),
    };
  }

  async getToolDefinitions(context: Context): Promise<ListToolsResult["tools"]> {
    const definitions: ListToolsResult["tools"] = [];

    for (const ToolClass of this.tools) {
      try {
        // Instantiate each tool to get its definition
        const tool = new ToolClass(context);
        const definition = await tool.getToolDescription();
        definitions.push(definition);
      } catch (error) {
        console.warn(`[MCPServer] Failed to get definition for tool ${ToolClass.name}:`, error);
        // Continue with other tools - don't fail the entire tool list
      }
    }

    return definitions;
  }
}
