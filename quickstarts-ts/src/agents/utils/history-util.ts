/**
 * Message history with token tracking and prompt caching.
 */

import type Anthropic from "@anthropic-ai/sdk";

interface ContentBlock {
  type: string;
  text?: string;
  cache_control?: { type: string };
  [key: string]: unknown;
}

interface Message {
  role: "user" | "assistant";
  content: ContentBlock[];
}

interface Usage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

export class MessageHistory {
  private model: string;
  private system: string;
  private contextWindowTokens: number;
  private messages: Message[] = [];
  private totalTokens = 0;
  private enableCaching: boolean;
  private messageTokens: [number, number][] = [];
  private client: Anthropic;

  constructor(config: {
    model: string;
    system: string;
    contextWindowTokens: number;
    client: Anthropic;
    enableCaching?: boolean;
  }) {
    this.model = config.model;
    this.system = config.system;
    this.contextWindowTokens = config.contextWindowTokens;
    this.client = config.client;
    this.enableCaching = config.enableCaching ?? true;

    // Estimate system prompt tokens (rough approximation)
    this.totalTokens = Math.ceil(this.system.length / 4);
  }

  async addMessage(
    role: "user" | "assistant",
    content: string | ContentBlock[],
    usage?: Usage | null
  ): Promise<void> {
    const contentBlocks: ContentBlock[] =
      typeof content === "string" ? [{ type: "text", text: content }] : content;

    this.messages.push({ role, content: contentBlocks });

    if (role === "assistant" && usage) {
      const totalInput =
        usage.input_tokens +
        (usage.cache_read_input_tokens ?? 0) +
        (usage.cache_creation_input_tokens ?? 0);
      const outputTokens = usage.output_tokens;

      const currentTurnInput = totalInput - this.totalTokens;
      this.messageTokens.push([currentTurnInput, outputTokens]);
      this.totalTokens += currentTurnInput + outputTokens;
    }
  }

  truncate(): void {
    if (this.totalTokens <= this.contextWindowTokens) return;

    const TRUNCATION_NOTICE_TOKENS = 25;
    const TRUNCATION_MESSAGE: Message = {
      role: "user",
      content: [{ type: "text", text: "[Earlier history has been truncated.]" }],
    };

    const removeMessagePair = () => {
      this.messages.shift();
      this.messages.shift();

      if (this.messageTokens.length > 0) {
        const [inputTokens, outputTokens] = this.messageTokens.shift()!;
        this.totalTokens -= inputTokens + outputTokens;
      }
    };

    while (
      this.messageTokens.length > 0 &&
      this.messages.length >= 2 &&
      this.totalTokens > this.contextWindowTokens
    ) {
      removeMessagePair();

      if (this.messages.length > 0 && this.messageTokens.length > 0) {
        const [originalInputTokens, originalOutputTokens] = this.messageTokens[0];
        this.messages[0] = TRUNCATION_MESSAGE;
        this.messageTokens[0] = [TRUNCATION_NOTICE_TOKENS, originalOutputTokens];
        this.totalTokens += TRUNCATION_NOTICE_TOKENS - originalInputTokens;
      }
    }
  }

  formatForApi(): Message[] {
    const result = this.messages.map((m) => ({
      role: m.role,
      content: [...m.content],
    }));

    if (this.enableCaching && result.length > 0) {
      const lastMessage = result[result.length - 1];
      lastMessage.content = lastMessage.content.map((block) => ({
        ...block,
        cache_control: { type: "ephemeral" },
      }));
    }

    return result;
  }
}
