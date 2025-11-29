#!/usr/bin/env bun

/**
 * Stdio MCP server - communicates via stdin/stdout for cross-model compatibility
 * This enables Gemini, codex, and other models to use vessel via stdio transport
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { MCPServer } from "./framework/MCPServer.js";

// Note: stdio transport requires clean stdout for JSON-RPC
// Load .env.local manually if needed before running:
//   export $(cat .env.local | xargs)

// Import all tool classes
import { SelfAwareDiscoveryTool } from "./tools/consciousness/SelfAwareDiscoveryTool.js";
import { MemoryToolInteraction } from "./tools/memory/MemoryToolInteraction.js";
import { CodeGraphTool } from "./tools/functional/CodeGraphTool.js";
import { CodexTool } from "./tools/external/CodexTool.js";
import { ProjectAwarenessTool } from "./tools/awareness/ProjectAwarenessTool.js";

// Create mock context for tool constructors
function createContext() {
  return {
    env: { DEV_MODE: process.env.DEV_MODE || "true" },
    get: (_key: string) => undefined,
    req: { json: async () => ({}), header: () => undefined },
    json: (data: any) => ({ data, json: true }),
  } as any;
}

// Initialize tool wrapper
const mcpWrapper = new MCPServer(
  ProjectAwarenessTool,
  SelfAwareDiscoveryTool,
  MemoryToolInteraction,
  CodeGraphTool,
  CodexTool
);

// Create SDK Server
const server = new Server(
  {
    name: "vessel",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register handlers using our wrapper
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools = await mcpWrapper.getToolDefinitions(createContext());
  return { tools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const context = createContext();
  return await mcpWrapper.callTool(context, request.params);
});

// Connect stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);

console.error("Vessel stdio server running (stderr logging)");
