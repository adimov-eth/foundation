Gemini CLI is awesome! But only when you make Claude Code use it as its bitch.

Resources And Tips

> explain @apps/chat/ to me, use gemini.
L listed directory apps/chat/

• I'll analyze the chat app structure for you using Gemini's large context window.

Bash(gemini -p "@apps/chat/ Provide a comprehensive analysis of this Next.js chat application. Explain the architecture, key components, routing structure, authentic[)
L Running...

Bash command

gemini -p "@apps/chat/ Provide a comprehensive analysis of this Next.js chat application. Explain the architecture, key components, routing structure, authentication flow, AI integration, MCP (Model Context Protocol) implementation, and any notable features or patterns used. Include details about the tech stack, state management, and how different parts of the application interact with each other."
Analyze chat app structure with Gemini

Do you want to proceed?
> 1. Yes
   2. Yes, and don't ask again for gemini commands in /Projects/mobile-app-app/main
   3. No, and tell Claude what to do differently (esc)

Not sure how you feel about it but Gemini CLI feels like garbage at the moment compared to Claude Code. It's slow, it doesn't listen to instructions or use tools as well as Claude.

But it has that huge context window we all love.

So I just added instructions to CLAUDE.md to have Claude use the Gemini CLI in non-interactive mode (passing the -p param with a prompt to just get a response back from the CLI) when it needs to gather information about a large part of the codebase.

That way you get the best of both worlds, Claude doesn't waste context and Gemini doesn't waste your time.

Add this (or a modified version) to your CLAUDE.md and tell Claude to use gemini manually or it will do it on its own as needed.