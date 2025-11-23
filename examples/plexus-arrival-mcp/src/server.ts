/**
 * MCP Server combining Arrival and Plexus
 *
 * This server demonstrates how AI agents can collaborate on shared state:
 * - Plexus manages collaborative state with Yjs CRDTs
 * - Arrival provides MCP framework with Discovery/Action separation
 * - Multiple AI sessions can work on the same workspace simultaneously
 */

import { Hono } from 'hono';
import { HonoMCPServer } from '@here.build/arrival-mcp';
import * as Y from 'yjs';
import { WorkspacePlexus, WorkspaceRoot, Project, Task } from './models';
import { TasksDiscoveryTool } from './tools/TasksDiscovery';
import { TasksActionTool } from './tools/TasksAction';
import { ProjectsActionTool } from './tools/ProjectsAction';

// Initialize Yjs document
const doc = new Y.Doc();

// Initialize Plexus workspace
const workspace = new WorkspacePlexus(doc);

// Wait for root to be ready
let root: WorkspaceRoot;

async function initializeWorkspace() {
  root = await workspace.rootPromise;

  // Seed with example data if workspace is empty
  if (root.projects.length === 0) {
    console.log('Initializing workspace with example data...');

    workspace.transact(() => {
      // Create example project
      const exampleProject = new Project({
        name: 'Example Project',
        description: 'A sample project to demonstrate the MCP server',
        createdAt: new Date().toISOString(),
        tasks: [],
      });

      // Create some example tasks
      exampleProject.tasks.push(
        new Task({
          title: 'Setup development environment',
          description: 'Install dependencies and configure tools',
          status: 'done',
          priority: 8,
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          completedAt: new Date().toISOString(),
          tags: ['setup', 'development'],
        }),
        new Task({
          title: 'Implement authentication',
          description: 'Add user authentication with JWT',
          status: 'in-progress',
          priority: 9,
          createdAt: new Date(Date.now() - 43200000).toISOString(),
          completedAt: null,
          tags: ['security', 'backend'],
        }),
        new Task({
          title: 'Write documentation',
          description: 'Document API endpoints and usage examples',
          status: 'todo',
          priority: 5,
          createdAt: new Date().toISOString(),
          completedAt: null,
          tags: ['documentation'],
        })
      );

      root.projects.push(exampleProject);
    });

    console.log('Workspace initialized with example project and 3 tasks');
  }

  console.log(`Workspace ready with ${root.projects.length} project(s)`);
}

// Create MCP server with all tools
const mcpServer = new HonoMCPServer(
  TasksDiscoveryTool,
  TasksActionTool,
  ProjectsActionTool
);

// Create Hono app
const app = new Hono();

// Middleware to inject workspace into context
app.use('*', async (c, next) => {
  c.set('workspace', workspace);
  c.set('root', root);
  await next();
});

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    workspace: {
      projects: root.projects.length,
      tasks: root.allTasks.length,
    },
  });
});

// MCP endpoints
app.get('/mcp', mcpServer.get);
app.post('/mcp', mcpServer.post);
app.delete('/mcp', mcpServer.delete);

// Root endpoint with info
app.get('/', (c) => {
  return c.json({
    name: 'Plexus + Arrival MCP Server',
    description: 'Collaborative task management with AI agents',
    version: '0.1.0',
    endpoints: {
      health: '/health',
      mcp: '/mcp',
    },
    workspace: {
      projects: root.projects.length,
      tasks: root.allTasks.length,
    },
    tools: [
      'tasks-discovery - Explore tasks with Scheme',
      'tasks-action - Modify tasks in a project',
      'projects-action - Manage projects',
    ],
  });
});

// Initialize and start server
const PORT = process.env.PORT || 3000;

initializeWorkspace().then(() => {
  console.log(`Starting MCP server on port ${PORT}...`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);

  // For production, you would use a proper server like:
  // serve(app, { port: PORT });

  // For development with Node.js built-in server:
  if (import.meta.url === `file://${process.argv[1]}`) {
    const { serve } = await import('@hono/node-server');
    serve({ fetch: app.fetch, port: Number(PORT) });
  }
});

export default app;
export { workspace, root };
