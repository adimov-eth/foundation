/**
 * Security - Bash command validation
 */

import * as path from "node:path";

export const ALLOWED_COMMANDS = new Set([
  "ls", "cat", "head", "tail", "wc", "grep",  // inspection
  "cp", "mkdir", "chmod",                      // file ops
  "pwd",                                       // directory
  "npm", "node",                               // node.js
  "git",                                       // version control
  "ps", "lsof", "sleep", "pkill",              // process
  "init.sh",                                   // script
]);

const NEEDS_VALIDATION = new Set(["pkill", "chmod", "init.sh"]);

function shellSplit(cmd: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let inSingle = false, inDouble = false, escape = false;

  for (const c of cmd) {
    if (escape) { current += c; escape = false; continue; }
    if (c === "\\") { escape = true; continue; }
    if (c === "'" && !inDouble) { inSingle = !inSingle; continue; }
    if (c === '"' && !inSingle) { inDouble = !inDouble; continue; }
    if (/\s/.test(c) && !inSingle && !inDouble) {
      if (current) { tokens.push(current); current = ""; }
      continue;
    }
    current += c;
  }
  if (current) tokens.push(current);
  if (inSingle || inDouble) throw new Error("Unclosed quote");
  return tokens;
}

export function extractCommands(cmd: string): string[] {
  const commands: string[] = [];
  for (const segment of cmd.split(/(?<!["'])\s*;\s*(?!["'])/)) {
    if (!segment.trim()) continue;
    let tokens: string[];
    try { tokens = shellSplit(segment); } catch { return []; }

    let expectCmd = true;
    for (const t of tokens) {
      if (["|", "||", "&&", "&"].includes(t)) { expectCmd = true; continue; }
      if (t.startsWith("-") || (t.includes("=") && !t.startsWith("="))) continue;
      if (expectCmd) { commands.push(path.basename(t)); expectCmd = false; }
    }
  }
  return commands;
}

export function validateCommand(cmd: string): { ok: true } | { ok: false; reason: string } {
  const commands = extractCommands(cmd);

  if (commands.length === 0 && cmd.trim()) {
    return { ok: false, reason: `Cannot parse command: "${cmd}"` };
  }

  for (const c of commands) {
    if (!ALLOWED_COMMANDS.has(c)) {
      return { ok: false, reason: `'${c}' not allowed` };
    }

    if (NEEDS_VALIDATION.has(c)) {
      try {
        const tokens = shellSplit(cmd);
        if (c === "pkill") {
          const target = tokens.filter(t => !t.startsWith("-")).slice(1).pop();
          if (!target || !["node", "npm", "npx", "vite", "next"].includes(target.split(" ")[0])) {
            return { ok: false, reason: "pkill: only dev processes allowed" };
          }
        }
        if (c === "chmod") {
          const mode = tokens[1];
          if (!mode || !/^[ugoa]*\+x$/.test(mode)) {
            return { ok: false, reason: "chmod: only +x allowed" };
          }
        }
        if (c === "init.sh" && !tokens[0].endsWith("/init.sh") && tokens[0] !== "./init.sh") {
          return { ok: false, reason: "init.sh: must use ./init.sh" };
        }
      } catch {
        return { ok: false, reason: `Cannot validate ${c}` };
      }
    }
  }

  return { ok: true };
}
