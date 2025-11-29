/**
 * Progress Tracking Utilities
 * ===========================
 *
 * Functions for tracking and displaying progress of the autonomous coding agent.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";

interface FeatureTest {
  passes?: boolean;
  [key: string]: unknown;
}

/**
 * Count passing and total tests in feature_list.json.
 */
export async function countPassingTests(projectDir: string): Promise<[number, number]> {
  const testsFilePath = path.join(projectDir, "feature_list.json");

  try {
    await fs.access(testsFilePath);
  } catch {
    return [0, 0];
  }

  try {
    const fileContent = await fs.readFile(testsFilePath, "utf-8");
    const tests: FeatureTest[] = JSON.parse(fileContent);

    const total = tests.length;
    const passing = tests.filter((test) => test.passes === true).length;

    return [passing, total];
  } catch {
    return [0, 0];
  }
}

/**
 * Print a formatted header for the session.
 */
export function printSessionHeader(sessionNum: number, isInitializer: boolean): void {
  const sessionType = isInitializer ? "INITIALIZER" : "CODING AGENT";
  const separator = "=".repeat(70);

  console.log(`\n${separator}`);
  console.log(`  SESSION ${sessionNum}: ${sessionType}`);
  console.log(separator);
  console.log();
}

/**
 * Print a summary of current progress.
 */
export async function printProgressSummary(projectDir: string): Promise<void> {
  const [passing, total] = await countPassingTests(projectDir);

  if (total > 0) {
    const percentage = (passing / total) * 100;
    console.log(`\nProgress: ${passing}/${total} tests passing (${percentage.toFixed(1)}%)`);
  } else {
    console.log("\nProgress: feature_list.json not yet created");
  }
}
