/**
 * Agent Session Logic
 * ===================
 *
 * Core agent interaction functions for running autonomous coding sessions.
 */

import { type Options, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import * as fs from "node:fs/promises";
import * as path from "node:path";

import { createAgentOptions, startQuery } from "./client.js";
import { printSessionHeader, printProgressSummary } from "./progress.js";
import { getInitializerPrompt, getCodingPrompt, copySpecToProject } from "./prompts.js";

// Configuration
const AUTO_CONTINUE_DELAY_SECONDS = 3;

type SessionStatus = "continue" | "error";

/**
 * Run a single agent session using Claude Agent SDK.
 */
async function runAgentSession(
  prompt: string,
  options: Options,
  projectDir: string
): Promise<[SessionStatus, string]> {
  console.log("Sending prompt to Claude Agent SDK...\n");

  try {
    const result = startQuery(prompt, options);

    let responseText = "";

    for await (const msg of result) {
      await handleMessage(msg, (text) => {
        responseText += text;
      });
    }

    console.log("\n" + "-".repeat(70) + "\n");
    return ["continue", responseText];
  } catch (e) {
    console.error(`Error during agent session: ${e}`);
    return ["error", String(e)];
  }
}

/**
 * Handle incoming messages from the agent.
 */
async function handleMessage(
  msg: SDKMessage,
  onText: (text: string) => void
): Promise<void> {
  switch (msg.type) {
    case "assistant": {
      // Handle assistant messages (text and tool use)
      if (msg.message?.content) {
        for (const block of msg.message.content) {
          if (block.type === "text") {
            onText(block.text);
            process.stdout.write(block.text);
          } else if (block.type === "tool_use") {
            console.log(`\n[Tool: ${block.name}]`);
            const inputStr = JSON.stringify(block.input);
            if (inputStr.length > 200) {
              console.log(`   Input: ${inputStr.slice(0, 200)}...`);
            } else {
              console.log(`   Input: ${inputStr}`);
            }
          }
        }
      }
      break;
    }

    case "user": {
      // Handle user messages (tool results)
      const content = msg.message?.content;
      if (content && Array.isArray(content)) {
        for (const block of content) {
          if (typeof block === "object" && "type" in block && block.type === "tool_result") {
            const resultContent = String((block as { content?: unknown }).content || "");
            const isError = (block as { is_error?: boolean }).is_error;

            // Check if command was blocked by security hook
            if (resultContent.toLowerCase().includes("blocked")) {
              console.log(`   [BLOCKED] ${resultContent}`);
            } else if (isError) {
              // Show errors (truncated)
              const errorStr = resultContent.slice(0, 500);
              console.log(`   [Error] ${errorStr}`);
            } else {
              // Tool succeeded - just show brief confirmation
              console.log("   [Done]");
            }
          }
        }
      }
      break;
    }

    case "result": {
      // Final result with cost info
      if (msg.total_cost_usd !== undefined) {
        console.log(`\n[Session cost: $${msg.total_cost_usd.toFixed(4)}]`);
      }
      break;
    }
  }
}

/**
 * Sleep for a given number of seconds.
 */
function sleep(seconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

export interface AgentConfig {
  projectDir: string;
  model: string;
  maxIterations?: number;
}

/**
 * Run the autonomous agent loop.
 */
export async function runAutonomousAgent(config: AgentConfig): Promise<void> {
  const { projectDir, model, maxIterations } = config;

  console.log("\n" + "=".repeat(70));
  console.log("  AUTONOMOUS CODING AGENT DEMO");
  console.log("=".repeat(70));
  console.log(`\nProject directory: ${projectDir}`);
  console.log(`Model: ${model}`);
  if (maxIterations) {
    console.log(`Max iterations: ${maxIterations}`);
  } else {
    console.log("Max iterations: Unlimited (will run until completion)");
  }
  console.log();

  // Create project directory
  await fs.mkdir(projectDir, { recursive: true });

  // Check if this is a fresh start or continuation
  const testsFile = path.join(projectDir, "feature_list.json");
  let isFirstRun: boolean;
  try {
    await fs.access(testsFile);
    isFirstRun = false;
  } catch {
    isFirstRun = true;
  }

  if (isFirstRun) {
    console.log("Fresh start - will use initializer agent");
    console.log();
    console.log("=".repeat(70));
    console.log("  NOTE: First session takes 10-20+ minutes!");
    console.log("  The agent is generating 200 detailed test cases.");
    console.log("  This may appear to hang - it's working. Watch for [Tool: ...] output.");
    console.log("=".repeat(70));
    console.log();
    // Copy the app spec into the project directory for the agent to read
    await copySpecToProject(projectDir);
  } else {
    console.log("Continuing existing project");
    await printProgressSummary(projectDir);
  }

  // Create agent options
  const options = await createAgentOptions({ projectDir, model });

  // Main loop
  let iteration = 0;

  while (true) {
    iteration++;

    // Check max iterations
    if (maxIterations && iteration > maxIterations) {
      console.log(`\nReached max iterations (${maxIterations})`);
      console.log("To continue, run the script again without --max-iterations");
      break;
    }

    // Print session header
    printSessionHeader(iteration, isFirstRun);

    // Choose prompt based on session type
    let prompt: string;
    if (isFirstRun) {
      prompt = await getInitializerPrompt();
      isFirstRun = false; // Only use initializer once
    } else {
      prompt = await getCodingPrompt();
    }

    // Run session
    const [status] = await runAgentSession(prompt, options, projectDir);

    // Handle status
    if (status === "continue") {
      console.log(`\nAgent will auto-continue in ${AUTO_CONTINUE_DELAY_SECONDS}s...`);
      await printProgressSummary(projectDir);
      await sleep(AUTO_CONTINUE_DELAY_SECONDS);
    } else if (status === "error") {
      console.log("\nSession encountered an error");
      console.log("Will retry with a fresh session...");
      await sleep(AUTO_CONTINUE_DELAY_SECONDS);
    }

    // Small delay between sessions
    if (!maxIterations || iteration < maxIterations) {
      console.log("\nPreparing next session...\n");
      await sleep(1);
    }
  }

  // Final summary
  console.log("\n" + "=".repeat(70));
  console.log("  SESSION COMPLETE");
  console.log("=".repeat(70));
  console.log(`\nProject directory: ${projectDir}`);
  await printProgressSummary(projectDir);

  // Print instructions for running the generated application
  console.log("\n" + "-".repeat(70));
  console.log("  TO RUN THE GENERATED APPLICATION:");
  console.log("-".repeat(70));
  console.log(`\n  cd ${path.resolve(projectDir)}`);
  console.log("  ./init.sh           # Run the setup script");
  console.log("  # Or manually:");
  console.log("  npm install && npm run dev");
  console.log("\n  Then open http://localhost:3000 (or check init.sh for the URL)");
  console.log("-".repeat(70));

  console.log("\nDone!");
}
