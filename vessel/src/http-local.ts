#!/usr/bin/env bun

/**
 * Local HTTPS MCP server (Bun) with filesystem discovery.
 * Uses self-signed certificate for local development.
 */

// Load environment variables from .env.local if it exists
import { config } from "dotenv";
import { existsSync } from "fs";
import { join } from "path";

const envPath = join(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  config({ path: envPath });
  console.log("Loaded .env.local configuration");
}

import type { CallToolRequest, ListToolsResult } from "@modelcontextprotocol/sdk/types.js";
import { MCPServer } from "./framework/MCPServer";
import { CrossToolActivation } from "./framework/CrossToolActivation";
import { readFileSync } from "fs";

import { MemoryToolInteraction } from "@/mcp-server/tools/memory/MemoryToolInteraction";

// Minimal context adapter (Hono-like) to satisfy ToolInteraction constructor
function createContext() {
  return {
    env: { DEV_MODE: "true" },
    get: (_key: string) => undefined,
    req: { json: async () => ({}), header: () => undefined },
    json: (data: any) => ({ data, json: true }),
  } as any;
}

const wrapper = new MCPServer(
  MemoryToolInteraction
);

// Pattern-based cross-tool activation
const activation = new CrossToolActivation(wrapper);

const PORT = Number(process.env.PORT ?? 1337);

const server = Bun.serve({
  port: PORT,
  idleTimeout: 255, // 255 seconds (max) for theme generation via claude CLI
  tls: {
    key: readFileSync("./certs/key.pem"),
    cert: readFileSync("./certs/cert.pem"),
  },
  async fetch(req) {
    const url = new URL(req.url);
    
    // Log all requests for debugging
    console.log(`[${new Date().toISOString()}] ${req.method} ${url.pathname}`, {
      headers: Object.fromEntries(req.headers.entries()),
    });
    
    // CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    // Token authentication (skip for GET requests showing server info)
    if (req.method === "POST") {
      const expectedToken = process.env.VESSEL_TOKEN || "dev-local-token";
      const authHeader = req.headers.get("Authorization");
      const token = authHeader?.replace("Bearer ", "");

      if (token !== expectedToken) {
        return Response.json(
          { error: "Unauthorized" },
          {
            status: 401,
            headers: { "Access-Control-Allow-Origin": "*" }
          }
        );
      }
    }

    // Basic info
    if (req.method === "GET") {
      return Response.json({
        mcp: "1.0",
        name: "agi-mcp-local",
        version: "0.1.0",
        capabilities: { tools: { list: true } },
      }, { headers: { "Access-Control-Allow-Origin": "*" } });
    }

    if (req.method === "POST") {
      const request = (await req.json()) as any;
      console.log("POST request body:", JSON.stringify(request, null, 2));
      const ctx = createContext();

      switch (request.method) {
        case "initialize":
          return Response.json({
            jsonrpc: "2.0",
            id: request.id,
            result: {
              protocolVersion: "2025-06-18",
              serverInfo: { name: "agi-mcp-local", version: "0.1.0" },
              capabilities: { tools: { list: true } },
            },
          }, { headers: { "Access-Control-Allow-Origin": "*" } });

        case "tools/list": {
          const tools: ListToolsResult["tools"] = await wrapper.getToolDefinitions(ctx);
          return Response.json({ jsonrpc: "2.0", id: request.id, result: { tools } }, { headers: { "Access-Control-Allow-Origin": "*" } });
        }

        case "tools/call": {
          try {
            const params = request.params as CallToolRequest["params"];
            const result = await wrapper.callTool(ctx, params);

            // Pattern-based cross-tool activation
            await activation.processActivation(ctx, params.name, result);

            return Response.json({ jsonrpc: "2.0", id: request.id, result }, { headers: { "Access-Control-Allow-Origin": "*" } });
          } catch (error: any) {
            return Response.json({
              jsonrpc: "2.0",
              id: request.id,
              error: { code: -32603, message: error?.message ?? String(error) },
            }, { headers: { "Access-Control-Allow-Origin": "*" } });
          }
        }

        case "ping":
          return Response.json({ jsonrpc: "2.0", id: request.id, result: {} }, { headers: { "Access-Control-Allow-Origin": "*" } });

        default:
          return Response.json({
            jsonrpc: "2.0",
            id: request.id,
            error: { code: -32601, message: `Method not found: ${request.method}` },
          }, { headers: { "Access-Control-Allow-Origin": "*" } });
      }
    }

    return new Response("Method not allowed", { status: 405 });
  },
});

console.log(`🚀 Local MCP server running at https://localhost:${server.port}
- HTTPS with self-signed certificate
- Token auth: ${process.env.VESSEL_TOKEN ? "configured" : "dev-local-token (default)"}
- Tools: memory
- Try POST / with methods initialize, tools/list, tools/call`);
