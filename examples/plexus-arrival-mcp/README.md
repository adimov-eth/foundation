# Plexus + Arrival MCP Server

**Collaborative task management for AI agents using Plexus state management and Arrival's MCP framework**

This example demonstrates how to build an MCP (Model Context Protocol) server that combines:

- **Plexus**: Collaborative state management with Yjs CRDTs for conflict-free multi-agent collaboration
- **Arrival**: MCP framework with sandboxed Scheme for safe exploration and batched actions

## Architecture

### State Management (Plexus)

The server maintains a collaborative workspace where multiple AI agents can work simultaneously:

```typescript
@syncing
class Task extends PlexusModel {
  @syncing accessor title!: string;
  @syncing accessor status!: 'todo' | 'in-progress' | 'done';
  @syncing accessor priority!: number;
  // ... more fields
}

@syncing
class Project extends PlexusModel {
  @syncing accessor name!: string;
  @syncing.child.list accessor tasks!: Task[];
}
```

**Key benefits:**
- Changes from any agent automatically sync to all others via Yjs CRDTs
- Conflict-free collaboration - multiple agents can modify different parts simultaneously
- Structural safety - invalid states are architecturally impossible

### AI Agent Interface (Arrival)

Three MCP tools provide structured interaction:

#### 1. `tasks-discovery` - Explore with Scheme

Discovery tool for exploring workspace state using sandboxed Scheme expressions:

```scheme
; Get all high-priority tasks
(filter (lambda (task) (>= (@ task :priority) 7))
  (all-tasks))

; Find incomplete tasks in a project
(filter (lambda (task) (not (= (@ task :status) "done")))
  (project-tasks "Example Project"))

; Get workspace statistics
(workspace-stats)
```

**Available functions:**
- `(all-projects)` - List all projects
- `(get-project name)` - Get project by name
- `(all-tasks)` - List all tasks across projects
- `(project-tasks name)` - Tasks in a specific project
- `(tasks-by-status status)` - Filter by status
- `(high-priority-tasks)` - Priority >= 7
- `(tasks-by-tag tag)` - Filter by tag
- `(workspace-stats)` - Overall statistics
- `(project-stats name)` - Project statistics

#### 2. `tasks-action` - Modify Tasks

Action tool for modifying tasks within a project. All actions in a batch share the same project context:

```json
{
  "projectName": "Example Project",
  "actions": [
    ["create-task", "Implement feature X", "Add new functionality", 8, ["backend"]],
    ["update-task-status", "task-uuid-123", "in-progress"],
    ["add-task-tag", "task-uuid-123", "urgent"]
  ]
}
```

**Available actions:**
- `create-task` - Create new task
- `update-task-status` - Change task status
- `update-task-priority` - Change priority
- `update-task` - Update title/description
- `add-task-tag` / `remove-task-tag` - Manage tags
- `delete-task` - Remove task

#### 3. `projects-action` - Manage Projects

Action tool for project-level operations:

```json
{
  "actions": [
    ["create-project", "New Project", "Project description"],
    ["update-project", "Old Name", "New Name", "Updated description"],
    ["delete-project", "Project Name", true]
  ]
}
```

## Installation

```bash
cd examples/plexus-arrival-mcp
pnpm install
```

## Running the Server

### Development Mode

```bash
pnpm dev
```

Server starts on `http://localhost:3000`

### Production Build

```bash
pnpm build
pnpm start
```

## API Endpoints

- `GET /` - Server info and statistics
- `GET /health` - Health check
- `GET /mcp` - MCP SSE endpoint
- `POST /mcp` - MCP JSON-RPC endpoint
- `DELETE /mcp` - Delete MCP session

## Usage Examples

### Using with Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "plexus-tasks": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

### Example Workflow

1. **Explore the workspace:**

```scheme
; In tasks-discovery tool
(workspace-stats)
```

2. **Find tasks to work on:**

```scheme
; Get high-priority incomplete tasks
(filter (lambda (task) (not (= (@ task :status) "done")))
  (high-priority-tasks))
```

3. **Create a new project and tasks:**

```json
// Using projects-action
{
  "actions": [
    ["create-project", "AI Features", "Implement AI-powered features"]
  ]
}
```

```json
// Using tasks-action
{
  "projectName": "AI Features",
  "actions": [
    ["create-task", "Research LLM APIs", "Evaluate different providers", 8, ["research"]],
    ["create-task", "Implement chat interface", "Build user-facing chat UI", 9, ["frontend"]]
  ]
}
```

4. **Update task progress:**

```json
{
  "projectName": "AI Features",
  "actions": [
    ["update-task-status", "task-uuid", "in-progress"],
    ["add-task-tag", "task-uuid", "active"]
  ]
}
```

### Collaborative Scenarios

**Multiple agents working together:**

Agent 1 (Research):
```scheme
; Explore what needs research
(filter (lambda (task) (member? "research" (@ task :tags)))
  (tasks-by-status "todo"))
```

Agent 2 (Development):
```json
{
  "projectName": "AI Features",
  "actions": [
    ["create-task", "Implement API client", null, 7, ["backend", "development"]],
    ["update-task-status", "research-task-uuid", "done"]
  ]
}
```

Both agents see changes immediately thanks to Plexus's Yjs synchronization.

## Key Concepts

### Discovery vs Action Separation

**Discovery tools** (read-only):
- Execute in sandboxed Scheme environment
- Cannot modify state
- Safe for exploration and analysis
- Use functional programming patterns

**Action tools** (write):
- Batched operations with shared context
- All actions in a batch validated before execution
- Context guarantees prevent drift
- Atomic transactions via Plexus

### Context Constraints

Action tools enforce context consistency:

```json
// ✓ Valid - all actions use projectName
{
  "projectName": "Example",
  "actions": [
    ["create-task", ...],
    ["update-task-status", ...]
  ]
}

// ✗ Invalid - actions on different projects
// (would require separate tool calls)
```

This prevents AI agents from context drift during long action sequences.

### Collaborative State

Plexus handles concurrency automatically:

- **Agent A** creates a task → **Agent B** sees it immediately
- **Agent A** updates priority → **Agent B**'s view updates
- Both agents can work on different tasks simultaneously
- Yjs CRDTs ensure conflict-free merging

## Architecture Benefits

### Token Efficiency

S-expression serialization (via Arrival) reduces token usage by 30-60% compared to JSON:

```scheme
(filter (lambda (t) (> (@ t :priority) 7)) (all-tasks))
```

vs equivalent JSON:

```json
{
  "operation": "filter",
  "predicate": {
    "type": "comparison",
    "operator": "greater_than",
    "left": {"type": "property", "name": "priority"},
    "right": 7
  },
  "collection": {"type": "function", "name": "all_tasks"}
}
```

### Extended Sessions

Arrival's Discovery/Action separation prevents subprocess fragmentation, enabling:
- 50+ coherent tool calls vs 10-20 with standard MCP
- Better context retention across operations
- Reduced hallucination and drift

### Structural Safety

Plexus makes invalid states impossible:
- Can't orphan synced entities
- Can't create parent-child cycles
- Can't represent invalid types
- Contagious materialization - everything reachable syncs

## Development

### Adding New Tools

1. Create a new tool class extending `DiscoveryToolInteraction` or `ActionToolInteraction`
2. Register functions/actions in the constructor
3. Add to `HonoMCPServer` in `server.ts`

Example:

```typescript
export class AnalyticsTool extends DiscoveryToolInteraction<{}> {
  static readonly name = 'analytics';
  readonly description = 'Analyze workspace metrics';

  protected registerFunctions(): void {
    this.registerFunction(
      'completion-rate',
      'Calculate project completion rate',
      [z.string()],
      (projectName: string) => {
        const project = this.root.findProject(projectName);
        if (!project) return null;

        const total = project.tasks.length;
        const done = project.tasks.filter(t => t.status === 'done').length;
        return total > 0 ? done / total : 0;
      }
    );
  }
}
```

### Adding Persistence

Replace in-memory Yjs with a provider:

```typescript
import { WebsocketProvider } from 'y-websocket';

const doc = new Y.Doc();
const provider = new WebsocketProvider(
  'ws://localhost:1234',
  'workspace-room',
  doc
);

await provider.whenSynced;
const workspace = new WorkspacePlexus(doc);
```

Now state persists across server restarts and syncs between server instances.

## Testing

```bash
# Type check
pnpm typecheck

# Build
pnpm build
```

## Learn More

- [Arrival Documentation](../../arrival/arrival/README.md) - MCP framework and Scheme sandbox
- [Plexus Documentation](../../plexus/plexus/README.md) - Collaborative state management
- [Model Context Protocol](https://modelcontextprotocol.io/) - MCP specification

## License

Same as parent repository - Future MIT (effective January 1, 2027).
