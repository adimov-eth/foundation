/**
 * Prompt Loading Utilities
 * ========================
 *
 * Functions for loading prompt templates from the prompts directory.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROMPTS_DIR = path.join(__dirname, "prompts");

/**
 * Load a prompt template from the prompts directory.
 */
export async function loadPrompt(name: string): Promise<string> {
  const promptPath = path.join(PROMPTS_DIR, `${name}.md`);
  return fs.readFile(promptPath, "utf-8");
}

/**
 * Load the initializer prompt.
 */
export function getInitializerPrompt(): Promise<string> {
  return loadPrompt("initializer_prompt");
}

/**
 * Load the coding agent prompt.
 */
export function getCodingPrompt(): Promise<string> {
  return loadPrompt("coding_prompt");
}

/**
 * Check if a file exists at a given path.
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.stat(filePath);
    return true;
  } catch (error) {
    if (error && (error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

/**
 * Copy the app spec file into the project directory for the agent to read.
 */
export async function copySpecToProject(projectDir: string): Promise<void> {
  const specSource = path.join(PROMPTS_DIR, "app_spec.txt");
  const specDest = path.join(projectDir, "app_spec.txt");

  if (!(await fileExists(specDest))) {
    await fs.copyFile(specSource, specDest);
    console.log("Copied app_spec.txt to project directory");
  }
}
