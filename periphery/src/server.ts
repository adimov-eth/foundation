#!/usr/bin/env node
/**
 * Periphery MCP Server
 *
 * Exposes catamorphism-based codebase exploration via HTTP.
 * Compatible with Claude Code's HTTP transport.
 */

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HonoMCPServer } from '@here.build/arrival-mcp';
import { Discover } from './discover.js';
import { Act } from './act.js';
import { TaskAct } from './entity-act.js';
import { CodeEntityAct } from './code-entity-act.js';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import type { Context } from 'hono';
import { findWorkspaceRoot } from "./utils.js";

// Get project root by walking up to find .git or pnpm-workspace.yaml
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = findWorkspaceRoot(__dirname);

console.log(`📁 Project root: ${projectRoot}`);

// Custom server that injects projectRoot into all sessions
class PeripheryServer extends HonoMCPServer {
    protected async getSessionState(context: Context, sessionId: string): Promise<Record<string, any>> {
        const state = await super.getSessionState(context, sessionId);
        // Inject projectRoot into state if not already present
        state.projectRoot ??= projectRoot;
        return state;
    }
}

// Create MCP server with Discovery, Action, and Entity-Action tools
const mcpServer = new PeripheryServer(Discover, Act, TaskAct, CodeEntityAct);

// Create Hono app
const app = new Hono();

// CORS middleware
app.use('/*', cors({
    origin: '*',
    exposeHeaders: ['Mcp-Session-Id'],
}));

// Stub OAuth endpoints (no actual auth, always succeed)
app.post('/register', (c) => {
    const body = c.req.json();
    return c.json({
        client_id: 'mcp-client',
        client_secret: '',
        redirect_uris: (body as any)?.redirect_uris || ['http://localhost'],
    });
});

app.post('/token', (c) => {
    return c.json({
        access_token: 'mcp-token',
        token_type: 'Bearer',
    });
});

app.get('/auth', (c) => {
    const redirectUri = c.req.query('redirect_uri');
    const state = c.req.query('state');

    if (!redirectUri) {
        return c.json({ error: 'redirect_uri required' }, 400);
    }

    const code = 'mcp-auth-code';
    const redirectUrl = new URL(redirectUri);
    redirectUrl.searchParams.set('code', code);
    if (state) {
        redirectUrl.searchParams.set('state', state);
    }

    return c.redirect(redirectUrl.toString());
});

// OAuth metadata (required for Claude Custom Connectors)
const port = parseInt(process.env.PORT || '3000', 10);
const baseUrl = process.env.MCP_SERVER_URL || `http://localhost:${port}`;

app.get('/.well-known/oauth-authorization-server', (c) => {
    return c.json({
        issuer: baseUrl,
        authorization_endpoint: `${baseUrl}/auth`,
        token_endpoint: `${baseUrl}/token`,
        registration_endpoint: `${baseUrl}/register`,
        response_types_supported: ['token', 'code'],
        grant_types_supported: ['client_credentials', 'authorization_code'],
        token_endpoint_auth_methods_supported: ['none'],
        code_challenge_methods_supported: ['S256'],
    });
});

// Wire up MCP routes
app
    .get('/', mcpServer.get)
    .post('/', mcpServer.post)
    .delete('/', mcpServer.delete);

// Start server
console.log(`🔍 Periphery MCP Server starting on ${baseUrl}`);
console.log(`  Tools: discover (17 functions), act (4 actions)`);
console.log(`  Entity tools: task-act (in-memory), code-entity-act (AST-based)`);
console.log(`  V's vision: context as specification, not pointer!`);
console.log(`\nTo add to Claude Code:`);
console.log(`  claude mcp add --transport http periphery ${baseUrl}\n`);

serve({
    fetch: app.fetch,
    port,
});
