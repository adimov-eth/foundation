/**
 * Agentic sampling loop for computer use.
 *
 * Calls the Claude API and local implementation of anthropic-defined computer use tools.
 */

import Anthropic from "@anthropic-ai/sdk";
import type {
  BetaContentBlockParam,
  BetaMessageParam,
  BetaTextBlockParam,
  BetaImageBlockParam,
  BetaToolResultBlockParam,
  BetaToolUseBlockParam,
  BetaCacheControlEphemeral,
  BetaMessage,
  BetaTextBlock,
} from "@anthropic-ai/sdk/resources/beta/index";
import * as os from "node:os";
import { ToolCollection, ToolResult, TOOL_GROUPS_BY_VERSION, type ToolVersion } from "./tools/index.js";

const PROMPT_CACHING_BETA_FLAG = "prompt-caching-2024-07-31";

export type APIProvider = "anthropic" | "bedrock" | "vertex";

/**
 * System prompt optimized for the Docker environment.
 * Modify this to provide context for your specific environment.
 */
function getSystemPrompt(): string {
  const arch = os.arch();
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `<SYSTEM_CAPABILITY>
* You are utilising an Ubuntu virtual machine using ${arch} architecture with internet access.
* You can feel free to install Ubuntu applications with your bash tool. Use curl instead of wget.
* To open firefox, please just click on the firefox icon. Note, firefox-esr is what is installed on your system.
* Using bash tool you can start GUI applications, but you need to set export DISPLAY=:1 and use a subshell. For example "(DISPLAY=:1 xterm &)". GUI apps run with bash tool will appear within your desktop environment, but they may take some time to appear. Take a screenshot to confirm it did.
* When using your bash tool with commands that are expected to output very large quantities of text, redirect into a tmp file and use str_replace_based_edit_tool or \`grep -n -B <lines before> -A <lines after> <query> <filename>\` to confirm output.
* When viewing a page it can be helpful to zoom out so that you can see everything on the page. Either that, or make sure you scroll down to see everything before deciding something isn't available.
* When using your computer function calls, they take a while to run and send back to you. Where possible/feasible, try to chain multiple of these calls all into one function calls request.
* The current date is ${today}.
</SYSTEM_CAPABILITY>

<IMPORTANT>
* When using Firefox, if a startup wizard appears, IGNORE IT. Do not even click "skip this step". Instead, click on the address bar where it says "Search or enter address", and enter the appropriate search term or URL there.
* If the item you are looking at is a pdf, if after taking a single screenshot of the pdf it seems that you want to read the entire document instead of trying to continue to read the pdf from your screenshots + navigation, determine the URL, use curl to download the pdf, install and use pdftotext to convert it to a text file, and then read that text file directly with your str_replace_based_edit_tool.
</IMPORTANT>`;
}

export interface SamplingLoopCallbacks {
  /** Called for each content block in the response */
  outputCallback?: (block: BetaContentBlockParam) => void;
  /** Called for each tool result */
  toolOutputCallback?: (result: ToolResult, toolUseId: string) => void;
  /** Called for API request/response */
  apiResponseCallback?: (
    request: unknown,
    response: unknown,
    error: Error | null
  ) => void;
}

export interface SamplingLoopOptions {
  model: string;
  provider: APIProvider;
  systemPromptSuffix?: string;
  messages: BetaMessageParam[];
  apiKey: string;
  onlyNMostRecentImages?: number;
  maxTokens?: number;
  toolVersion: ToolVersion;
  thinkingBudget?: number;
  tokenEfficientToolsBeta?: boolean;
  callbacks?: SamplingLoopCallbacks;
}

/**
 * Agentic sampling loop for the assistant/tool interaction of computer use.
 */
export async function samplingLoop(
  options: SamplingLoopOptions
): Promise<BetaMessageParam[]> {
  const {
    model,
    provider,
    systemPromptSuffix = "",
    messages,
    apiKey,
    onlyNMostRecentImages,
    maxTokens = 4096,
    toolVersion,
    thinkingBudget,
    tokenEfficientToolsBeta = false,
    callbacks = {},
  } = options;

  const { outputCallback, toolOutputCallback, apiResponseCallback } = callbacks;

  const toolGroup = TOOL_GROUPS_BY_VERSION[toolVersion];
  const toolCollection = new ToolCollection(
    ...toolGroup.tools.map((ToolCls) => new ToolCls())
  );

  const system: BetaTextBlockParam & { cache_control?: BetaCacheControlEphemeral } = {
    type: "text",
    text: `${getSystemPrompt()}${systemPromptSuffix ? " " + systemPromptSuffix : ""}`,
  };

  while (true) {
    let enablePromptCaching = false;
    const betas: string[] = toolGroup.betaFlag ? [toolGroup.betaFlag] : [];

    if (tokenEfficientToolsBeta) {
      betas.push("token-efficient-tools-2025-02-19");
    }

    let imageTruncationThreshold = onlyNMostRecentImages || 0;
    let currentOnlyNMostRecentImages = onlyNMostRecentImages;

    // Only anthropic provider is currently supported in TS
    // vertex/bedrock would require @anthropic-ai/vertex-sdk / @anthropic-ai/bedrock-sdk
    const client = new Anthropic({
      apiKey,
      maxRetries: provider === "anthropic" ? 4 : 0,
    });
    enablePromptCaching = provider === "anthropic";

    if (enablePromptCaching) {
      betas.push(PROMPT_CACHING_BETA_FLAG);
      injectPromptCaching(messages);
      // Because cached reads are 10% of the price, we don't break the cache by truncating images
      currentOnlyNMostRecentImages = 0;
      system.cache_control = { type: "ephemeral" };
    }

    if (currentOnlyNMostRecentImages) {
      maybeFilterToNMostRecentImages(
        messages,
        currentOnlyNMostRecentImages,
        imageTruncationThreshold
      );
    }

    const extraBody: Record<string, unknown> = {};
    if (thinkingBudget) {
      extraBody.thinking = { type: "enabled", budget_tokens: thinkingBudget };
    }

    // Call the API
    try {
      const response = await client.beta.messages.create({
        max_tokens: maxTokens,
        messages,
        model,
        system: [system as BetaTextBlockParam],
        tools: toolCollection.toParams(),
        betas,
        ...extraBody,
      });

      apiResponseCallback?.(null, response, null);

      const responseParams = responseToParams(response);
      messages.push({
        role: "assistant",
        content: responseParams,
      });

      const toolResultContent: BetaToolResultBlockParam[] = [];

      for (const contentBlock of responseParams) {
        outputCallback?.(contentBlock);

        if (
          typeof contentBlock === "object" &&
          contentBlock !== null &&
          "type" in contentBlock &&
          contentBlock.type === "tool_use"
        ) {
          const toolUseBlock = contentBlock as BetaToolUseBlockParam;
          const result = await toolCollection.run(
            toolUseBlock.name,
            (toolUseBlock.input as Record<string, unknown>) || {}
          );

          toolResultContent.push(makeApiToolResult(result, toolUseBlock.id));
          toolOutputCallback?.(result, toolUseBlock.id);
        }
      }

      if (toolResultContent.length === 0) {
        return messages;
      }

      messages.push({ content: toolResultContent, role: "user" });
    } catch (e) {
      apiResponseCallback?.(null, null, e as Error);
      return messages;
    }
  }
}

/**
 * Filter to keep only the N most recent images to reduce context.
 */
function maybeFilterToNMostRecentImages(
  messages: BetaMessageParam[],
  imagesToKeep: number,
  minRemovalThreshold: number
): void {
  if (imagesToKeep === null || imagesToKeep === undefined) return;

  const toolResultBlocks: BetaToolResultBlockParam[] = [];
  for (const message of messages) {
    if (Array.isArray(message.content)) {
      for (const item of message.content) {
        if (
          typeof item === "object" &&
          item !== null &&
          "type" in item &&
          item.type === "tool_result"
        ) {
          toolResultBlocks.push(item as BetaToolResultBlockParam);
        }
      }
    }
  }

  let totalImages = 0;
  for (const toolResult of toolResultBlocks) {
    if (Array.isArray(toolResult.content)) {
      for (const content of toolResult.content) {
        if (
          typeof content === "object" &&
          content !== null &&
          "type" in content &&
          content.type === "image"
        ) {
          totalImages++;
        }
      }
    }
  }

  let imagesToRemove = totalImages - imagesToKeep;
  // For better cache behavior, remove in chunks
  imagesToRemove -= imagesToRemove % minRemovalThreshold;

  for (const toolResult of toolResultBlocks) {
    if (Array.isArray(toolResult.content)) {
      const newContent: Array<BetaTextBlockParam | BetaImageBlockParam> = [];
      for (const content of toolResult.content as Array<BetaTextBlockParam | BetaImageBlockParam>) {
        if (
          typeof content === "object" &&
          content !== null &&
          "type" in content &&
          content.type === "image"
        ) {
          if (imagesToRemove > 0) {
            imagesToRemove--;
            continue;
          }
        }
        newContent.push(content);
      }
      (toolResult as { content: typeof newContent }).content = newContent;
    }
  }
}

function responseToParams(response: BetaMessage): BetaContentBlockParam[] {
  const res: BetaContentBlockParam[] = [];

  for (const block of response.content) {
    if (block.type === "text") {
      const textBlock = block as BetaTextBlock;
      if (textBlock.text) {
        res.push({ type: "text", text: textBlock.text } as BetaTextBlockParam);
      } else if ((block as unknown as { type: string }).type === "thinking") {
        const thinkingBlock: Record<string, unknown> = {
          type: "thinking",
          thinking: (block as unknown as { thinking: string }).thinking,
        };
        if ("signature" in block) {
          thinkingBlock.signature = (block as unknown as { signature: string }).signature;
        }
        res.push(thinkingBlock as unknown as BetaContentBlockParam);
      }
    } else {
      // Tool use blocks need cast because SDK's union type is complex
      res.push(block as unknown as BetaToolUseBlockParam);
    }
  }

  return res;
}

/**
 * Inject prompt caching breakpoints into the 3 most recent turns.
 */
function injectPromptCaching(messages: BetaMessageParam[]): void {
  let breakpointsRemaining = 3;

  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role === "user" && Array.isArray(message.content)) {
      if (breakpointsRemaining > 0) {
        breakpointsRemaining--;
        const lastContent = message.content[message.content.length - 1];
        if (typeof lastContent === "object" && lastContent !== null) {
          (lastContent as unknown as Record<string, unknown>).cache_control = { type: "ephemeral" };
        }
      } else {
        const lastContent = message.content[message.content.length - 1];
        if (typeof lastContent === "object" && lastContent !== null && "cache_control" in lastContent) {
          delete (lastContent as unknown as Record<string, unknown>).cache_control;
        }
        break;
      }
    }
  }
}

/**
 * Convert a ToolResult to an API ToolResultBlockParam.
 */
function makeApiToolResult(
  result: ToolResult,
  toolUseId: string
): BetaToolResultBlockParam {
  let toolResultContent: Array<BetaTextBlockParam | BetaImageBlockParam> | string = [];
  let isError = false;

  if (result.error) {
    isError = true;
    toolResultContent = maybePrependSystemToolResult(result, result.error);
  } else {
    if (result.output) {
      (toolResultContent as Array<BetaTextBlockParam | BetaImageBlockParam>).push({
        type: "text",
        text: maybePrependSystemToolResult(result, result.output),
      });
    }
    if (result.base64Image) {
      (toolResultContent as Array<BetaTextBlockParam | BetaImageBlockParam>).push({
        type: "image",
        source: {
          type: "base64",
          media_type: "image/png",
          data: result.base64Image,
        },
      });
    }
  }

  return {
    type: "tool_result",
    content: toolResultContent,
    tool_use_id: toolUseId,
    is_error: isError,
  };
}

/**
 * Prepend system message to tool result text if present.
 */
function maybePrependSystemToolResult(result: ToolResult, resultText: string): string {
  if (result.system) {
    return `<system>${result.system}</system>\n${resultText}`;
  }
  return resultText;
}
