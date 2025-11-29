#!/usr/bin/env node
/**
 * Autonomous Coding Agent Demo
 * ============================
 *
 * Command-line interface to run the autonomous coding agent demo.
 *
 * Usage:
 *   npx tsx src/autonomous-coding/demo.ts [options]
 *
 * Options:
 *   --project-dir <path>    Project directory (default: ./demo_project)
 *   --model <name>          Claude model to use (default: claude-sonnet-4-20250514)
 *   --max-iterations <n>    Maximum iterations (default: unlimited)
 */

import { runAutonomousAgent, type AgentConfig } from "./agent.js";

function parseArgs(): AgentConfig {
  const args = process.argv.slice(2);
  const config: AgentConfig = {
    projectDir: "./demo_project",
    model: "claude-sonnet-4-20250514",
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case "--project-dir":
        if (nextArg) {
          config.projectDir = nextArg;
          i++;
        }
        break;
      case "--model":
        if (nextArg) {
          config.model = nextArg;
          i++;
        }
        break;
      case "--max-iterations":
        if (nextArg) {
          config.maxIterations = parseInt(nextArg, 10);
          i++;
        }
        break;
      case "--help":
      case "-h":
        console.log(`
Autonomous Coding Agent Demo

Usage:
  npx tsx src/autonomous-coding/demo.ts [options]

Options:
  --project-dir <path>    Project directory (default: ./demo_project)
  --model <name>          Claude model to use (default: claude-sonnet-4-20250514)
  --max-iterations <n>    Maximum iterations (default: unlimited)
  --help, -h              Show this help message

Environment:
  ANTHROPIC_API_KEY       Required. Your Anthropic API key.
        `);
        process.exit(0);
    }
  }

  return config;
}

async function main() {
  const config = parseArgs();

  try {
    await runAutonomousAgent(config);
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
}

main();
