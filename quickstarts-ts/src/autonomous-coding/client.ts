/**
 * Client - Claude Agent SDK configuration
 */

import { query, type Options, type Query, type HookCallback, type PreToolUseHookInput } from "@anthropic-ai/claude-agent-sdk";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { validateCommand } from "./security.js";

const PUPPETEER_TOOLS = [
  "mcp__puppeteer__puppeteer_navigate",
  "mcp__puppeteer__puppeteer_screenshot",
  "mcp__puppeteer__puppeteer_click",
  "mcp__puppeteer__puppeteer_fill",
  "mcp__puppeteer__puppeteer_select",
  "mcp__puppeteer__puppeteer_hover",
  "mcp__puppeteer__puppeteer_evaluate",
] as const;

const BUILTIN_TOOLS = ["Read", "Write", "Edit", "Glob", "Grep", "Bash"] as const;

export interface ClientConfig {
  projectDir: string;
  model: string;
}

const bashSecurityHook: HookCallback = async (input) => {
  const { tool_name, tool_input } = input as PreToolUseHookInput;
  if (tool_name !== "Bash") return { continue: true };

  const command = (tool_input as { command?: string })?.command;
  if (!command) return { continue: true };

  const result = validateCommand(command);
  return result.ok ? { continue: true } : { continue: false, reason: result.reason };
};

async function writeSettings(projectDir: string): Promise<void> {
  await fs.mkdir(projectDir, { recursive: true });
  const settings = {
    sandbox: { enabled: true, autoAllowBashIfSandboxed: true },
    permissions: {
      defaultMode: "acceptEdits",
      allow: ["Read(./**)", "Write(./**)", "Edit(./**)", "Glob(./**)", "Grep(./**)", "Bash(*)", ...PUPPETEER_TOOLS],
    },
  };
  await fs.writeFile(path.join(projectDir, ".claude_settings.json"), JSON.stringify(settings, null, 2));
}

export async function createAgentOptions(config: ClientConfig): Promise<Options> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not set");
  }

  await writeSettings(config.projectDir);

  return {
    model: config.model,
    systemPrompt: "You are an expert full-stack developer building a production-quality web application.",
    allowedTools: [...BUILTIN_TOOLS, ...PUPPETEER_TOOLS],
    mcpServers: { puppeteer: { command: "npx", args: ["puppeteer-mcp-server"] } },
    hooks: { PreToolUse: [{ matcher: "Bash", hooks: [bashSecurityHook] }] },
    maxTurns: 1000,
    cwd: path.resolve(config.projectDir),
    settingSources: ["local"],
    permissionMode: "acceptEdits",
  };
}

export function startQuery(prompt: string, options: Options): Query {
  return query({ prompt, options });
}

export { BUILTIN_TOOLS, PUPPETEER_TOOLS };
