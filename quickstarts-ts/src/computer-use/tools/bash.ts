/**
 * Bash Tool - Persistent bash session for computer use
 */

import { spawn, ChildProcess } from "node:child_process";
import type { BetaToolUnion } from "@anthropic-ai/sdk/resources/beta/index";
import { BaseAnthropicTool, ToolResult, ToolError } from "./base.js";

const OUTPUT_DELAY = 200; // ms
const TIMEOUT = 120000; // ms
const SENTINEL = "<<exit>>";

/**
 * A session of a bash shell.
 */
class BashSession {
  private started = false;
  private timedOut = false;
  private process: ChildProcess | null = null;
  private stdoutBuffer = "";
  private stderrBuffer = "";

  async start(): Promise<void> {
    if (this.started) return;

    this.process = spawn("/bin/bash", [], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.process.stdout?.on("data", (data) => {
      this.stdoutBuffer += data.toString();
    });

    this.process.stderr?.on("data", (data) => {
      this.stderrBuffer += data.toString();
    });

    this.started = true;
  }

  stop(): void {
    if (!this.started) {
      throw new ToolError("Session has not started.");
    }
    if (this.process?.exitCode !== null) {
      return;
    }
    this.process?.kill();
  }

  async run(command: string): Promise<ToolResult> {
    if (!this.started) {
      throw new ToolError("Session has not started.");
    }
    if (this.process?.exitCode !== null) {
      return new ToolResult({
        system: "tool must be restarted",
        error: `bash has exited with returncode ${this.process?.exitCode}`,
      });
    }
    if (this.timedOut) {
      throw new ToolError(
        `timed out: bash has not returned in ${TIMEOUT}ms and must be restarted`
      );
    }

    // Clear buffers
    this.stdoutBuffer = "";
    this.stderrBuffer = "";

    // Send command with sentinel
    this.process?.stdin?.write(`${command}; echo '${SENTINEL}'\n`);

    // Wait for sentinel in output
    const startTime = Date.now();
    while (true) {
      await new Promise((resolve) => setTimeout(resolve, OUTPUT_DELAY));

      if (this.stdoutBuffer.includes(SENTINEL)) {
        // Strip sentinel
        const output = this.stdoutBuffer.slice(
          0,
          this.stdoutBuffer.indexOf(SENTINEL)
        );
        const error = this.stderrBuffer;

        return new ToolResult({
          output: output.endsWith("\n") ? output.slice(0, -1) : output,
          error: error.endsWith("\n") ? error.slice(0, -1) : error,
        });
      }

      if (Date.now() - startTime > TIMEOUT) {
        this.timedOut = true;
        throw new ToolError(
          `timed out: bash has not returned in ${TIMEOUT}ms and must be restarted`
        );
      }
    }
  }
}

/**
 * BashTool20250124 - A tool that allows the agent to run bash commands.
 * The tool parameters are defined by Anthropic and are not editable.
 */
export class BashTool20250124 extends BaseAnthropicTool {
  readonly name = "bash" as const;
  readonly apiType = "bash_20250124" as const;
  private session: BashSession | null = null;

  toParams(): BetaToolUnion {
    return {
      type: this.apiType,
      name: this.name,
    } as BetaToolUnion;
  }

  async call(params: {
    command?: string;
    restart?: boolean;
  }): Promise<ToolResult> {
    const { command, restart } = params;

    if (restart) {
      if (this.session) {
        this.session.stop();
      }
      this.session = new BashSession();
      await this.session.start();
      return new ToolResult({ system: "tool has been restarted." });
    }

    if (!this.session) {
      this.session = new BashSession();
      await this.session.start();
    }

    if (command !== undefined) {
      return this.session.run(command);
    }

    throw new ToolError("no command provided.");
  }
}

/**
 * BashTool20241022 - Same as 20250124
 */
export class BashTool20241022 extends BashTool20250124 {
  override readonly apiType = "bash_20250124" as const;
}

// Default export
export const BashTool = BashTool20250124;
