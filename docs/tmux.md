# Claude Code's tmux integration: built-in features and community tools

Claude Code does not have an official "tmux skill" provided by Anthropic. Instead, it offers **native background shell functionality** built into the CLI, while the developer community has created an extensive ecosystem of tmux-based tools for session persistence, multi-agent orchestration, and terminal automation. Understanding both the built-in capabilities and community solutions is essential for leveraging tmux effectively with Claude Code.

## Native background shell capabilities power long-running tasks

Claude Code includes built-in tools for managing background processes without requiring external tmux configuration. The core functionality centers on the `Bash` tool with a `run_in_background: true` parameter, which creates detached shell processes that persist while you continue working.

**Built-in tools for background execution:**

| Tool | Purpose |
|------|---------|
| `Bash` (with `run_in_background: true`) | Execute commands in background shells |
| `BashOutput` | Retrieve output from background shells |
| `KillBash` | Terminate background processes |
| `/bashes` | Interactive TUI to list and manage all background shells |

The keyboard shortcut **Ctrl+B** moves a regular Bash command to the background. For users running Claude Code inside tmux (where Ctrl+B is the default prefix), you must press **Ctrl+B twice** to trigger this functionality.

Background tasks automatically persist across Claude Code sessions. Starting a development server with `npm run dev` in the background, exiting Claude Code, and resuming with `claude --continue` will show the server still running with its output accessible via `BashOutput`.

## Running Claude Code inside tmux enables session persistence

The most common tmux integration pattern involves running Claude Code within a tmux session for persistence across terminal closures, SSH disconnections, and laptop sleep cycles. This approach preserves both conversation context and running processes.

**Essential tmux commands for Claude Code workflows:**

```bash
# Create and manage sessions
tmux new-session -d -s claude-work        # Create detached session
tmux attach-session -t claude-work        # Attach to session
Ctrl+a d                                  # Detach (using Ctrl+a prefix)
tmux attach -t claude-work                # Reattach hours/days later

# Programmatic control for automation
tmux send-keys -t claude-work "your prompt" Enter
tmux capture-pane -t claude-work -p > output.txt
```

**Recommended tmux configuration** optimized for Claude Code includes larger scrollback buffers (Claude's verbose output benefits from **10,000+ lines**), true color support, and a changed prefix key to avoid conflicts:

```bash
# ~/.tmux.conf for Claude Code
set -g default-terminal "xterm-256color"
set-option -ga terminal-overrides ",xterm-256color:Tc"
unbind C-b
set-option -g prefix C-a                  # Avoids Ctrl+B conflict
set -g mouse on
set -g history-limit 10000                # Large buffer for verbose output
setw -q -g utf8 on

# Recommended plugins for session restore
set -g @plugin 'tmux-plugins/tmux-resurrect'
set -g @plugin 'tmux-plugins/tmux-continuum'
set -g @continuum-restore 'on'
```

## Community tools extend tmux integration significantly

The developer community has built sophisticated tooling around tmux and Claude Code, enabling capabilities far beyond the native functionality.

### tmux-cli: "Playwright for terminals"

The **claude-code-tools** package by Prasad Chalasani provides `tmux-cli`, enabling Claude Code to control interactive CLI applications running in separate tmux panes—launching programs, sending input, capturing output, and managing sessions.

```bash
uv tool install claude-code-tools
```

Add this configuration to `~/.claude/CLAUDE.md`:

```markdown
# tmux-cli Command
`tmux-cli` is a bash command that enables Claude Code to control CLI applications
running in separate tmux panes. Run `tmux-cli --help` for detailed usage.

Example uses:
- Interact with scripts waiting for user input
- Launch another Claude Code instance for analysis/debugging
- Run Python with pdb for step-through debugging
- Launch web apps and test with browser automation
```

### Claude Squad for multi-agent management

**Claude Squad** (github.com/smtg-ai/claude-squad) is the most mature solution for running multiple Claude Code agents simultaneously. It manages each agent in isolated tmux sessions with git worktrees for codebase separation.

```bash
brew install claude-squad
cs                        # Launch TUI interface
```

### Session management tools

Several tools simplify Claude Code session management:

- **claunch** (`github.com/0xkaz/claunch`): Project-based session management with `claunch --tmux` for persistent sessions
- **cld-tmux** (`github.com/TerminalGravity/cld-tmux`): Simple CLI for starting named sessions per project
- **claude-code-manager** (`github.com/eyalev/claude-code-manager`): Rust CLI with smart completion detection using Claude Code's hook system

## Multi-agent orchestration enables parallel development

Advanced workflows leverage tmux for hierarchical agent systems. The **Tmux Orchestrator** pattern establishes a three-tier hierarchy:

```
     ┌─────────────┐
     │ Orchestrator│ ← User interaction
     └──────┬──────┘
            │
  ┌─────────┴─────────┐
  │ Project Manager(s)│ ← Assign tasks, enforce specs
  └─────────┬─────────┘
            │
  ┌─────────┴─────────┐
  │ Engineer Agent(s) │ ← Write code, implement features
  └───────────────────┘
```

The **tmux-claude-mcp-server** (github.com/michael-abdo/tmux-claude-mcp-server) provides an MCP server implementation with role-based access control. Specialists have no MCP tool access, while managers coordinate work across multiple specialist agents.

**Spawn configuration example:**

```json
{
  "name": "spawn",
  "arguments": {
    "role": "specialist",
    "workDir": "/jobs/auth_system",
    "context": "# Specialist: User Model\n\nImplement the User model...",
    "parentId": "mgr_1_1"
  }
}
```

For simpler parallel execution, the **Claude Code Agent Farm** (github.com/Dicklesworthstone/claude_code_agent_farm) runs **20-50 Claude Code agents** in parallel with a real-time monitoring dashboard.

## Practical workflows developers actually use

**Multi-pane development** is the most common pattern. Developers split their terminal with Claude Code in the main pane, test runners and log monitors in adjacent panes, and system resources (htop) visible for monitoring.

**Remote and mobile access** combines tmux with SSH and Tailscale for accessing Claude Code sessions from anywhere. Users report productive workflows from mobile devices, accessing servers running persistent Claude Code sessions.

**Overnight batch processing** leverages session persistence for long-running tasks. Starting complex refactoring or large-scale code generation before leaving work allows checking results the next morning with full context preserved.

**Automated prompt workflows** use tmux's programmatic control for repetitive tasks:

```bash
# Send prompts programmatically
tmux send-keys -t claude-work "Review the latest changes" Enter

# Detect usage limits automatically
tmux capture-pane -t claude-work -p > output.txt
if grep -q "usage limit" output.txt; then
    notify-send "Claude Code usage limit reached"
fi
```

## Configuration patterns for automation

### Hook-based completion detection

The `~/.claude/settings.json` file supports hooks that trigger on Claude Code events. This enables notification systems and automation:

```json
{
  "hooks": {
    "Stop": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "/bin/bash -c 'mkdir -p /tmp/claude-code-manager && echo \"$(date -Iseconds)\" > \"/tmp/claude-code-manager/$(tmux display-message -p \"#{session_name}\").done\"'"
      }]
    }]
  }
}
```

### Auto-background configuration

Configure patterns for automatic background execution:

```json
{
  "autoBackground": {
    "enabled": true,
    "patterns": [
      "npm run dev", "yarn start",
      "docker-compose up", "*--watch*", "tail -f *"
    ],
    "excludePatterns": ["npm test", "npm run build"]
  }
}
```

## Known issues and workarounds

**Scrollback buffer performance degradation** is the most significant issue (GitHub Issue #4851 with 56+ upvotes). After several thousand lines of output, Claude Code exhibits erratic scrolling and high CPU usage. The workaround is frequently restarting sessions via `/quit` rather than letting them accumulate excessive history.

**The `/terminal-setup` command doesn't work from inside tmux** (Issue #6072). Run `/terminal-setup` from outside tmux first; subsequent tmux sessions will inherit the configuration.

**IDE detection fails inside tmux** for tools like Cursor. The `/ide` command cannot detect the IDE when Claude Code runs within a tmux session, requiring manual configuration.

## Conclusion

Claude Code's tmux integration operates at two levels: built-in background shell functionality that works immediately, and community-developed tools that unlock sophisticated multi-agent orchestration. The native `Bash` tool with `run_in_background: true`, combined with `/bashes` management, handles most long-running process needs. For session persistence, running Claude Code inside tmux with an optimized configuration provides reliable workflows that survive disconnections.

The community ecosystem—particularly **claude-code-tools** for terminal automation and **Claude Squad** for multi-agent management—dramatically extends what's possible. Developers seeking parallel agent execution should explore these tools rather than building custom solutions. The key insight from power users: tmux provides session management and window control, while Claude Code's native background features handle process persistence—combining both yields the most robust workflows.