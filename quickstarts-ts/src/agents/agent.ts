/**
 * Agent implementation with Claude API and tools.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam, ContentBlock, ToolUseBlock, Usage } from "@anthropic-ai/sdk/resources/messages";

import { Tool } from "./tools/base.js";
import { setupMCPConnections, type MCPConnection } from "./utils/connections.js";
import { MessageHistory } from "./utils/history-util.js";
import { executeTools } from "./utils/tool-util.js";

export interface ModelConfig {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  contextWindowTokens?: number;
}

const DEFAULT_CONFIG: Required<ModelConfig> = {
  model: "claude-sonnet-4-20250514",
  maxTokens: 4096,
  temperature: 1.0,
  contextWindowTokens: 180000,
};

interface MCPServerConfig {
  type?: "stdio" | "sse";
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
}

interface AgentConfig {
  name: string;
  system: string;
  tools?: Tool[];
  mcpServers?: MCPServerConfig[];
  config?: ModelConfig;
  verbose?: boolean;
  client?: Anthropic;
  messageParams?: Record<string, unknown>;
}

export class Agent {
  readonly name: string;
  private system: string;
  private verbose: boolean;
  private tools: Tool[];
  private config: Required<ModelConfig>;
  private mcpServers: MCPServerConfig[];
  private messageParams: Record<string, unknown>;
  private client: Anthropic;
  private history: MessageHistory;

  constructor(agentConfig: AgentConfig) {
    this.name = agentConfig.name;
    this.system = agentConfig.system;
    this.verbose = agentConfig.verbose ?? false;
    this.tools = [...(agentConfig.tools ?? [])];
    this.config = { ...DEFAULT_CONFIG, ...agentConfig.config };
    this.mcpServers = agentConfig.mcpServers ?? [];
    this.messageParams = agentConfig.messageParams ?? {};
    this.client =
      agentConfig.client ??
      new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? "" });

    this.history = new MessageHistory({
      model: this.config.model,
      system: this.system,
      contextWindowTokens: this.config.contextWindowTokens,
      client: this.client,
    });

    if (this.verbose) {
      console.log(`\n[${this.name}] Agent initialized`);
    }
  }

  private prepareMessageParams(): Record<string, unknown> {
    return {
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      system: this.system,
      messages: this.history.formatForApi() as MessageParam[],
      tools: this.tools.map((tool) => tool.toDict()),
      ...this.messageParams,
    };
  }

  private async agentLoop(userInput: string): Promise<Anthropic.Message> {
    if (this.verbose) {
      console.log(`\n[${this.name}] Received: ${userInput}`);
    }

    await this.history.addMessage("user", userInput, null);

    const toolDict = new Map<string, Tool>();
    for (const tool of this.tools) {
      toolDict.set(tool.name, tool);
    }

    while (true) {
      this.history.truncate();
      const params = this.prepareMessageParams();

      const defaultHeaders = { "anthropic-beta": "code-execution-2025-05-22" };
      const customHeaders = (params.extra_headers as Record<string, string>) ?? {};
      delete params.extra_headers;
      const mergedHeaders = { ...defaultHeaders, ...customHeaders };

      const response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        system: this.system,
        messages: this.history.formatForApi() as MessageParam[],
        tools: this.tools.map((tool) => tool.toDict()) as Anthropic.Tool[],
        stream: false,
        ...this.messageParams,
      });

      const toolCalls = response.content.filter(
        (block: ContentBlock): block is ToolUseBlock => block.type === "tool_use"
      );

      if (this.verbose) {
        for (const block of response.content) {
          if (block.type === "text") {
            console.log(`\n[${this.name}] Output: ${block.text}`);
          } else if (block.type === "tool_use") {
            const paramsStr = Object.entries(block.input as Record<string, unknown>)
              .map(([k, v]) => `${k}=${v}`)
              .join(", ");
            console.log(`\n[${this.name}] Tool call: ${block.name}(${paramsStr})`);
          }
        }
      }

      await this.history.addMessage(
        "assistant",
        response.content as unknown as Array<{ type: string; text?: string }>,
        response.usage as Usage & { cache_read_input_tokens?: number; cache_creation_input_tokens?: number }
      );

      if (toolCalls.length > 0) {
        const toolCallInputs = toolCalls.map((tc) => ({
          id: tc.id,
          name: tc.name,
          input: tc.input as Record<string, unknown>,
        }));

        const toolResults = await executeTools(toolCallInputs, toolDict);

        if (this.verbose) {
          for (const result of toolResults) {
            console.log(`\n[${this.name}] Tool result: ${result.content}`);
          }
        }

        await this.history.addMessage(
          "user",
          toolResults as unknown as Array<{ type: string; text?: string }>
        );
      } else {
        return response;
      }
    }
  }

  async runAsync(userInput: string): Promise<Anthropic.Message> {
    const originalTools = [...this.tools];
    const connections: MCPConnection[] = [];

    try {
      const { tools: mcpTools, connections: mcpConnections } =
        await setupMCPConnections(this.mcpServers);
      connections.push(...mcpConnections);
      this.tools.push(...mcpTools);

      return await this.agentLoop(userInput);
    } finally {
      this.tools = originalTools;
      for (const conn of connections) {
        await conn.close().catch(console.error);
      }
    }
  }

  run(userInput: string): Promise<Anthropic.Message> {
    return this.runAsync(userInput);
  }
}
