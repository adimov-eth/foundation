/**
 * Connection handling for MCP servers.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import type { Tool as MCPToolDef } from "@modelcontextprotocol/sdk/types.js";

import { MCPTool } from "../tools/mcp-tool.js";

interface MCPServerConfig {
  type?: "stdio" | "sse";
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
}

export class MCPConnection {
  private client: Client | null = null;
  private transport: StdioClientTransport | SSEClientTransport | null = null;

  async connect(): Promise<void> {
    throw new Error("Subclass must implement connect()");
  }

  async close(): Promise<void> {
    if (this.transport) {
      await this.transport.close();
    }
    this.client = null;
    this.transport = null;
  }

  async listTools(): Promise<MCPToolDef[]> {
    if (!this.client) throw new Error("Not connected");
    const response = await this.client.listTools();
    return response.tools;
  }

  async callTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    if (!this.client) throw new Error("Not connected");
    return this.client.callTool({ name: toolName, arguments: args });
  }

  protected setClient(client: Client): void {
    this.client = client;
  }

  protected setTransport(transport: StdioClientTransport | SSEClientTransport): void {
    this.transport = transport;
  }
}

export class MCPConnectionStdio extends MCPConnection {
  private command: string;
  private args: string[];
  private env?: Record<string, string>;

  constructor(command: string, args: string[] = [], env?: Record<string, string>) {
    super();
    this.command = command;
    this.args = args;
    this.env = env;
  }

  async connect(): Promise<void> {
    const transport = new StdioClientTransport({
      command: this.command,
      args: this.args,
      env: this.env,
    });

    const client = new Client({ name: "agents-client", version: "1.0.0" }, { capabilities: {} });
    await client.connect(transport);

    this.setTransport(transport);
    this.setClient(client);
  }
}

export class MCPConnectionSSE extends MCPConnection {
  private url: string;
  private headers: Record<string, string>;

  constructor(url: string, headers: Record<string, string> = {}) {
    super();
    this.url = url;
    this.headers = headers;
  }

  async connect(): Promise<void> {
    const transport = new SSEClientTransport(new URL(this.url));

    const client = new Client({ name: "agents-client", version: "1.0.0" }, { capabilities: {} });
    await client.connect(transport);

    this.setTransport(transport);
    this.setClient(client);
  }
}

export function createMCPConnection(config: MCPServerConfig): MCPConnection {
  const connType = (config.type ?? "stdio").toLowerCase();

  if (connType === "stdio") {
    if (!config.command) {
      throw new Error("Command is required for STDIO connections");
    }
    return new MCPConnectionStdio(config.command, config.args, config.env);
  }

  if (connType === "sse") {
    if (!config.url) {
      throw new Error("URL is required for SSE connections");
    }
    return new MCPConnectionSSE(config.url, config.headers);
  }

  throw new Error(`Unsupported connection type: ${connType}`);
}

export async function setupMCPConnections(
  mcpServers: MCPServerConfig[] | undefined
): Promise<{ tools: MCPTool[]; connections: MCPConnection[] }> {
  if (!mcpServers || mcpServers.length === 0) {
    return { tools: [], connections: [] };
  }

  const mcpTools: MCPTool[] = [];
  const connections: MCPConnection[] = [];

  for (const config of mcpServers) {
    try {
      const connection = createMCPConnection(config);
      await connection.connect();
      connections.push(connection);

      const toolDefinitions = await connection.listTools();

      for (const toolInfo of toolDefinitions) {
        mcpTools.push(
          new MCPTool({
            name: toolInfo.name,
            description: toolInfo.description ?? `MCP tool: ${toolInfo.name}`,
            inputSchema: toolInfo.inputSchema as Record<string, unknown>,
            connection,
          })
        );
      }
    } catch (e) {
      console.error(`Error setting up MCP server ${JSON.stringify(config)}: ${e}`);
    }
  }

  console.log(`Loaded ${mcpTools.length} MCP tools from ${mcpServers.length} servers.`);
  return { tools: mcpTools, connections };
}
