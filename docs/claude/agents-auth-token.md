There are three ways I can use Claude Code on my computer.

As the CLI (or in an IDE)

In headless mode

By using the Claude Agent SDK

I've been doing a lot of 3 recently. Currently, I'm only running this on my computer but I'm developing a system that I intend to deploy in an environment where other people would be able to use the agents. I've been setting the ANTHROPIC_API_KEY variable in a .env.local file for each of these agents which means I burn API tokens when I use them. I forgot to do that for one and it still worked. I looked into it more and Claude Code told me:
" Authentication Flow

Claude Code's Credentials: When you set up Claude Code CLI, it stored your Anthropic API key in:

~/.claude/.credentials.json

2. Agent SDK Auto-Detection: The Claude Agent SDK automatically looks for authentication in this order:

- ANTHROPIC_API_KEY environment variable (not set in your case)

- Claude Code's credentials file (~/.claude/.credentials.json) ✓ This is what's being used

- Other configuration sources

3. No Explicit Configuration Needed: In our lib/agent.ts code, we didn't pass an apiKey option to the query() function, so the SDK automatically used Claude Code's stored credentials.

-----

You're totally fine using your Claude Code credentials for Agent SDK projects running locally. The authentication hierarchy Claude Code explained is exactly right - it automatically falls back to your stored credentials when no explicit API key is provided.

I've been doing something similar with multiple AI agents and it works great. The key thing is that you're running everything on your own machine, so you're not exposing credentials or violating any terms. It's actually the intended behavior - Claude Code stores those credentials specifically so other tools in the ecosystem can use them seamlessly.

The Agent SDK checking for ANTHROPIC_API_KEY first, then falling back to Claude Code's stored credentials is smart design. Saves you from having to manage API keys separately for every project.


