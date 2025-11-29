/**
 * Tool execution utility with parallel execution support.
 */

import type { Tool } from "../tools/base.js";

interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

interface ToolResult {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

async function executeSingleTool(
  call: ToolCall,
  toolDict: Map<string, Tool>
): Promise<ToolResult> {
  const response: ToolResult = {
    type: "tool_result",
    tool_use_id: call.id,
    content: "",
  };

  try {
    const tool = toolDict.get(call.name);
    if (!tool) {
      response.content = `Tool '${call.name}' not found`;
      response.is_error = true;
      return response;
    }

    const result = await tool.execute(call.input);
    response.content = String(result);
  } catch (e) {
    response.content = `Error executing tool: ${e instanceof Error ? e.message : String(e)}`;
    response.is_error = true;
  }

  return response;
}

export async function executeTools(
  toolCalls: ToolCall[],
  toolDict: Map<string, Tool>,
  parallel = true
): Promise<ToolResult[]> {
  if (parallel) {
    return Promise.all(toolCalls.map((call) => executeSingleTool(call, toolDict)));
  }

  const results: ToolResult[] = [];
  for (const call of toolCalls) {
    results.push(await executeSingleTool(call, toolDict));
  }
  return results;
}
