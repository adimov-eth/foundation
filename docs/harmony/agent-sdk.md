AGENT SDK: COMPLETE TECHNICAL BREAKDOWN

This is ground truth, not marketing. Everything quoted is directly from the documentation.

1. AGENT INSTANTIATION & PARAMETERS

Two primary instantiation paths:

1. query() function (one-shot, async generator):
function query({
    prompt: string | AsyncIterable<SDKUserMessage>,
    options?: Options
}): Query extends AsyncGenerator<SDKMessage, void>

2. ClaudeSDKClient class (persistent session):
class ClaudeSDKClient {
    constructor(options?: ClaudeAgentOptions)
    async connect(prompt?: string | AsyncIterable)
    async query(prompt: string | AsyncIterable, session_id?: string)
    async receive_messages(): AsyncIterator<Message>
    async receive_response(): AsyncIterator<Message>
    async interrupt(): Promise<void>
    async disconnect(): Promise<void>
}

Key distinction from Python docs:
"Choosing Between query() and ClaudeSDKClient: query() creates a new session each time. Returns an async iterator that yields messages as they arrive. Each call to query() starts fresh with no memory of previous interactions.
ClaudeSDKClient maintains a conversation session across multiple exchanges. Claude remembers previous messages in the session."

Controllable parameters in ClaudeAgentOptions/Options:
- allowedTools - Explicit list of allowed tool names
- disallowedTools - Explicit list of disallowed tools
- permissionMode - One of: 'default', 'plan', 'acceptEdits', 'bypassPermissions'
- maxTurns - Cap on conversation turns
- model - Specific Claude model (defaults to CLI default)
- systemPrompt - String, preset, or null (default is empty, NOT Claude Code preset)
- cwd - Working directory
- env - Environment variables dict
- continue_conversation / continue - Reuse previous session
- resume - Session ID to resume
- forkSession - When resuming, create new session ID instead of continuing

---
2. SYSTEM PROMPTS: COMPLETE CUSTOMIZATION

Critical breaking change (v0.1.0):

"Default behavior: The Agent SDK uses an empty system prompt by default for maximum flexibility. To use Claude Code's system prompt (tool instructions, code guidelines, etc.), specify systemPrompt: { preset: "claude_code" } in
TypeScript or system_prompt="claude_code" in Python."

Four methods exist (in order of override priority):

Method 1: CLAUDE.md (persistent, filesystem-based)
- Location: CLAUDE.md or .claude/CLAUDE.md (project-level) OR ~/.claude/CLAUDE.md (user-level)
- REQUIRES explicit loading: Must include 'project' in settingSources to load
- Used for team-shared coding standards, project conventions
- Gets automatically merged into system context when loaded

Method 2: Output Styles
- Location: ~/.claude/output-styles/*.md or .claude/output-styles/*.md
- Markdown files with YAML frontmatter (name, description)
- Persistent across sessions
- Automatically loaded when settingSources includes 'user' or 'project'

Method 3: systemPrompt with append
systemPrompt: {
    type: "preset",
    preset: "claude_code",
    append: "Your additional instructions here"
}
"Add instructions to Claude Code's preset while preserving all built-in functionality."

Method 4: Custom systemPrompt (complete replacement)
systemPrompt: "You are a Python coding specialist. Follow these guidelines:..."
"You can provide a custom string as systemPrompt to replace the default entirely with your own instructions."

Critical limitation:
"Programmatic options (like agents, allowedTools) always override filesystem settings."

---
3. TOOLS: NATIVE VS CUSTOM ONLY

Built-in tools available:
- File operations: Read, Write, Edit, Glob, Grep
- Execution: Bash, BashOutput, KillBash
- Web: WebFetch, WebSearch
- Notebooks: NotebookEdit
- Task/subagent: Task
- Other: TodoWrite, ExitPlanMode, ListMcpResources, ReadMcpResource

Custom Tools via MCP:

You can provide ONLY custom tools (no native tools required). Use createSdkMcpServer():

const customServer = createSdkMcpServer({
    name: "my-custom-tools",
    tools: [
    tool("get_weather", "Get temperature", {...}, async handler)
    ]
});

Tool naming: mcp__{server_name}__{tool_name}

Critical constraint from custom tools doc:
"Custom MCP tools require streaming input mode. You must use an async generator/iterable for the prompt parameter - a simple string will not work with MCP servers."

Tool control:
- allowedTools - Whitelist specific tools
- disallowedTools - Blacklist specific tools
- Individual subagents can have their own tools restrictions

---
4. SUBAGENTS: SPAWNING & COMMUNICATION

Definition methods:

Programmatic (recommended for SDK):
const result = query({
    prompt: "Review the authentication module",
    options: {
    agents: {
        'code-reviewer': {
        description: 'Expert code review specialist...',
        prompt: 'You are a code reviewer...',
        tools: ['Read', 'Grep', 'Glob'],
        model: 'sonnet'  // or 'opus', 'haiku', 'inherit'
        }
    }
    }
});

Filesystem-based:
- Location: .claude/agents/*.md (project) or ~/.claude/agents/*.md (user)
- Format: Markdown with YAML frontmatter (name, description, tools)
- Auto-detected unless overridden by programmatic agents

Invocation:
"Claude will: Load programmatic agents from the agents parameter → Auto-detect filesystem agents → Invoke them automatically based on task matching and the agent's description → Use their specialized prompts and tool restrictions →
Maintain separate context for each subagent invocation"

Communication:
"Subagents maintain separate context from the main agent, preventing information overload and keeping interactions focused."

No explicit inter-agent communication—subagents are sandboxed per invocation and return results to the parent agent.

Tool restrictions:
Each subagent gets tools?: string[]. If omitted, inherits all parent tools. Example:
'analysis-agent': {
    tools: ['Read', 'Grep', 'Glob']  // Read-only, no execution
}

---
5. MEMORY/STATE: YOUR RESPONSIBILITY

No built-in persistence beyond session:

From Python reference:
"Session Continuity: Maintains conversation context across multiple query() calls"

But:
- Sessions are ephemeral (stored during active connection only)
- No automatic disk persistence between process restarts
- continue_conversation: true only works within same process
- resume: session_id requires you to have saved the session ID

State management is SDK responsibility:
- Track session IDs if you want to resume
- Store conversation history if needed
- Implement your own persistence layer

The SDK provides SessionMessage types but no database/storage:
type SDKResultMessage = {
    session_id: string;
    duration_ms: number;
    num_turns: number;
    usage: NonNullableUsage;
    total_cost_usd: number;
}

---
6. STREAMING VS SINGLE-MODE: CRITICAL IMPLICATIONS

Two fundamentally different modes:

Streaming Input Mode (Recommended):
async function* generateMessages() {
    yield { type: "user", message: { content: "First message" } };
    await delay(2000);
    yield { type: "user", message: { content: "Follow-up" } };
}

for await (const message of query({
    prompt: generateMessages(),
    options: { maxTurns: 10 }
})) { ... }

Benefits:
"Image Uploads, Queued Messages, Tool Integration, Hooks Support, Real-time Feedback, Context Persistence"

Full feature access:
- Image attachments
- Multiple messages queued sequentially
- Hooks (all types)
- Interruption (interrupt())
- Custom MCP tools
- Dynamic permission mode changes

Single Message Input:
for await (const message of query({
    prompt: "One-off question",
    options: { maxTurns: 1 }
})) { ... }

Critical limitation from docs:
"Single message input mode does not support:
- Direct image attachments in messages
- Dynamic message queueing
- Real-time interruption
- Hook integration
- Natural multi-turn conversations"

Also:
"Custom MCP tools require streaming input mode. You must use an async generator/iterable for the prompt parameter - a simple string will not work with MCP servers."

Performance implication:
- Streaming: Creates persistent session, holds connection
- Single: One-shot (can be stateless for Lambda/serverless)

---
7. STRUCTURED OUTPUTS: S-EXPRESSIONS NOT SUPPORTED

JSON Schema only, no S-expressions:

const schema = {
    type: 'object',
    properties: {
    company_name: { type: 'string' },
    issues: { type: 'array', items: { type: 'object' } }
    },
    required: ['company_name']
};

for await (const message of query({
    prompt: "Research and analyze",
    options: {
    outputFormat: {
        type: 'json_schema',
        schema: schema
    }
    }
})) {
    if (message.type === 'result' && message.structured_output) {
    console.log(message.structured_output)  // Valid JSON
    }
}

Supported JSON Schema features:
"All basic types: object, array, string, integer, number, boolean, null
enum, const, required, additionalProperties (must be false)
String formats: date-time, date, email, uri, uuid, etc.
$ref, $def, and definitions"

No S-expression support. The output is always valid JSON matching the schema.

Error handling:
if (msg.subtype === 'error_max_structured_output_retries') {
    // Agent couldn't produce valid output
}

---
8. PERMISSIONS MODEL: FOUR-LAYER ARCHITECTURE

From permissions doc—processing order is definitive:

"PreToolUse Hook → Deny Rules → Allow Rules → Ask Rules → Permission Mode Check → canUseTool Callback → PostToolUse Hook"

Layer 1: Permission Modes (global)
permissionMode: 'default' | 'plan' | 'acceptEdits' | 'bypassPermissions'

- default - Normal checks
- acceptEdits - Auto-approve file operations
- bypassPermissions - ALL tools auto-approved (dangerous)
- plan - Not supported in SDK (for read-only planning)

Layer 2: canUseTool Callback (dynamic)
canUseTool: async (toolName: string, input: ToolInput) => {
    return {
    behavior: 'allow' | 'deny',
    updatedInput?: ToolInput,
    message?: string
    }
}

Fires when: "Claude Code would show a permission prompt to a user"

Layer 3: Hooks (fine-grained, all events)
hooks: {
    'PreToolUse': [
    {
        matcher: 'Bash',  // Optional: specific tool
        hooks: [preToolHandler],
        timeout: 120  // seconds
    }
    ]
}

Available hook events:
"PreToolUse, PostToolUse, Notification, UserPromptSubmit, SessionStart, SessionEnd, Stop, SubagentStop, PreCompact"

Layer 4: Permission Rules (declarative, settings.json)
- Deny rules (block explicitly)
- Allow rules (permit explicitly)
- Ask rules (prompt user)

Mode Priority Example:
// Even in bypassPermissions mode:
if (denyRuleMatches) → BLOCKED
if (hook returns 'deny') → BLOCKED
if (allowRuleMatches) → ALLOWED
if (permission_mode === 'bypassPermissions') → ALLOWED
if (askRuleMatches) → Call canUseTool
else → Call canUseTool

---
9. SETTINGS & ENVIRONMENT ISOLATION

Critical breaking change (v0.1.0):

"Settings Sources No Longer Loaded by Default... To improve isolation and explicit configuration, Claude Agent SDK v0.1.0 introduces breaking changes."

Default behavior:
- settingSources defaults to [] (none)
- No CLAUDE.md files loaded
- No slash commands loaded
- No settings.json read

To load settings, explicitly specify:
settingSources: ['user', 'project', 'local']
// or
setting_sources=["project"]  # Python

Setting precedence (highest to lowest):
1. Local settings (.claude/settings.local.json)
2. Project settings (.claude/settings.json)
3. User settings (~/.claude/settings.json)
4. Programmatic options (always override)

---
10. KEY TECHNICAL CONSTRAINTS & GOTCHAS

Session lifecycle:
- query() - New session each call (no memory between calls)
- ClaudeSDKClient - Persistent session (memory across turns)
- Each session has separate transcript/context

Context management:
"Automatic compaction and context management to ensure your agent doesn't run out of context."

Message compacting happens automatically; fires PreCompact hook.

Tool execution model:
- Streaming input: Tools executed concurrently where safe
- Single message: Sequential execution
- Tool results returned as ToolResultBlock in message stream

Error types (Python):
CLINotFoundError  # Claude Code CLI not installed
CLIConnectionError  # Connection to CLI failed
ProcessError  # CLI process failure
CLIJSONDecodeError  # JSON parse failure

Import paths are critical:
// TypeScript
import { query, tool, createSdkMcpServer }
    from "@anthropic-ai/claude-agent-sdk"

# Python
from claude_agent_sdk import query, ClaudeSDKClient, ClaudeAgentOptions

Old package names don't work: @anthropic-ai/claude-code (old) → @anthropic-ai/claude-agent-sdk (new)

---
SUMMARY: What You Actually Control

1. Instantiation: One-shot query() vs persistent ClaudeSDKClient
2. System Prompt: Empty (default), preset+append, custom string, or CLAUDE.md
3. Tools: Native tools + custom MCP, whitelist/blacklist per agent
4. Subagents: Programmatic (preferred) or filesystem-based with tool restrictions
5. State: Your responsibility—sessions are ephemeral
6. Streaming: Required for full features (images, hooks, custom tools, interrupts)
7. Output: JSON Schema only (no S-expressions)
8. Permissions: Four-layer enforcement (hooks → rules → mode → callback)
9. Settings: Explicitly opt-in, not auto-loaded
10. Memory: Conversation context within session only; you manage persistence

All of this is from direct quotes from the official documentation files.