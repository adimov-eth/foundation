/**
 * Utility to run shell commands asynchronously with a timeout.
 */

import { spawn } from "node:child_process";

const TRUNCATED_MESSAGE =
  "<response clipped><NOTE>To save on context only part of this file has been shown to you. You should retry this tool after you have searched inside the file with `grep -n` in order to find the line numbers of what you are looking for.</NOTE>";
const MAX_RESPONSE_LEN = 16000;

/**
 * Truncate content and append a notice if content exceeds the specified length.
 */
export function maybeTruncate(
  content: string,
  truncateAfter: number | null = MAX_RESPONSE_LEN
): string {
  if (!truncateAfter || content.length <= truncateAfter) {
    return content;
  }
  return content.slice(0, truncateAfter) + TRUNCATED_MESSAGE;
}

/**
 * Run a shell command asynchronously with a timeout.
 * Returns [returnCode, stdout, stderr]
 */
export async function run(
  cmd: string,
  timeout: number | null = 120000, // milliseconds
  truncateAfter: number | null = MAX_RESPONSE_LEN
): Promise<[number, string, string]> {
  return new Promise((resolve, reject) => {
    const process = spawn("sh", ["-c", cmd], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let killed = false;

    process.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    process.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    const timeoutId = timeout
      ? setTimeout(() => {
          killed = true;
          process.kill();
          reject(new Error(`Command '${cmd}' timed out after ${timeout}ms`));
        }, timeout)
      : null;

    process.on("close", (code) => {
      if (timeoutId) clearTimeout(timeoutId);
      if (!killed) {
        resolve([
          code ?? 0,
          maybeTruncate(stdout, truncateAfter),
          maybeTruncate(stderr, truncateAfter),
        ]);
      }
    });

    process.on("error", (err) => {
      if (timeoutId) clearTimeout(timeoutId);
      if (!killed) {
        reject(err);
      }
    });
  });
}
