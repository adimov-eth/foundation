/**
 * Agents Module - Simple agent with tools and MCP support.
 */

export { Agent, type ModelConfig } from "./agent.js";
export { Tool, type ToolSchema } from "./tools/base.js";
export { MCPTool } from "./tools/mcp-tool.js";

// Built-in tools (use if needed)
export { ThinkTool } from "./tools/think.js";
export { FileReadTool, FileWriteTool } from "./tools/file-tools.js";
