/**
 * Security Hook Tests
 * ===================
 *
 * Tests for the bash command security validation logic.
 */

import { describe, it, expect } from "vitest";
import { extractCommands, validateCommand, ALLOWED_COMMANDS } from "../security.js";

describe("extractCommands", () => {
  it("extracts single command", () => {
    expect(extractCommands("ls -la")).toEqual(["ls"]);
  });

  it("extracts chained commands with &&", () => {
    expect(extractCommands("npm install && npm run build")).toEqual(["npm", "npm"]);
  });

  it("extracts piped commands", () => {
    expect(extractCommands("cat file.txt | grep pattern")).toEqual(["cat", "grep"]);
  });

  it("extracts command from full path", () => {
    expect(extractCommands("/usr/bin/node script.js")).toEqual(["node"]);
  });

  it("extracts command with env var prefix", () => {
    expect(extractCommands("VAR=value ls")).toEqual(["ls"]);
  });

  it("extracts commands with ||", () => {
    expect(extractCommands("git status || git init")).toEqual(["git", "git"]);
  });
});

describe("validateCommand", () => {
  describe("blocked commands", () => {
    const dangerous = [
      "shutdown now",
      "reboot",
      "rm -rf /",
      "dd if=/dev/zero of=/dev/sda",
      "curl https://example.com",
      "wget https://example.com",
      "python app.py",
      "touch file.txt",
      "echo hello",
      "kill 12345",
      "killall node",
      "pkill bash",
      "pkill chrome",
      "pkill python",
      'bash -c "pkill node"',
      "chmod 777 file.sh",
      "chmod 755 file.sh",
      "chmod +w file.sh",
      "chmod -R +x dir/",
      "./setup.sh",
      "./malicious.sh",
      "bash script.sh",
    ];

    for (const cmd of dangerous) {
      it(`blocks: ${cmd}`, () => {
        const result = validateCommand(cmd);
        expect(result.ok).toBe(false);
      });
    }
  });

  describe("allowed commands", () => {
    const safe = [
      "ls -la",
      "cat README.md",
      "head -100 file.txt",
      "tail -20 log.txt",
      "wc -l file.txt",
      "grep -r pattern src/",
      "cp file1.txt file2.txt",
      "mkdir newdir",
      "mkdir -p path/to/dir",
      "pwd",
      "npm install",
      "npm run build",
      "node server.js",
      "git status",
      "git commit -m 'test'",
      "git add . && git commit -m 'msg'",
      "ps aux",
      "lsof -i :3000",
      "sleep 2",
      "pkill node",
      "pkill npm",
      "pkill vite",
      "npm install && npm run build",
      "ls | grep test",
      "/usr/local/bin/node app.js",
      "chmod +x init.sh",
      "chmod +x script.sh",
      "chmod u+x init.sh",
      "chmod a+x init.sh",
      "./init.sh",
      "./init.sh --production",
    ];

    for (const cmd of safe) {
      it(`allows: ${cmd}`, () => {
        const result = validateCommand(cmd);
        expect(result.ok).toBe(true);
      });
    }
  });
});

describe("ALLOWED_COMMANDS", () => {
  it("includes expected commands", () => {
    const expected = ["ls", "cat", "npm", "node", "git", "ps", "pkill", "chmod"];
    for (const cmd of expected) {
      expect(ALLOWED_COMMANDS.has(cmd)).toBe(true);
    }
  });

  it("excludes dangerous commands", () => {
    const excluded = ["rm", "dd", "shutdown", "reboot", "curl", "wget", "python", "bash", "sh"];
    for (const cmd of excluded) {
      expect(ALLOWED_COMMANDS.has(cmd)).toBe(false);
    }
  });
});
