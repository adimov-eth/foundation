#!/usr/bin/env node
/**
 * Harmony MCP Server
 *
 * Multi-agent memory orchestration via HTTP/stdio.
 * Compatible with Claude Code's MCP integration.
 *
 * V's insight: "memory about memory" - tool description shows themes BEFORE first query.
 */

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HonoMCPServer } from '@here.build/arrival-mcp';
import { MemoryToolInteraction, MemoryStateStore } from './mcp/MemoryToolInteraction.js';
import { FileMemoryStore } from './memory/index.js';
import { findMemoryDir } from './utils.js';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'fs';
import type { Context } from 'hono';

// Get workspace root for memory storage
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const memoryDir = findMemoryDir(__dirname);
const memoryPath = join(memoryDir, 'state.json');

console.log(`💾 Memory directory: ${memoryDir}`);
console.log(`📝 Memory file: ${memoryPath}`);

// Ensure memory directory exists
if (!existsSync(memoryDir)) {
    mkdirSync(memoryDir, { recursive: true });
    console.log(`  Created memory directory`);
}

// Create memory store and initialize singleton
const store = new FileMemoryStore(memoryDir);
const stateStore = MemoryStateStore.getInstance();
stateStore.setStore(store);

// Optional LLM for manifest generation (future enhancement)
// Currently manifests use statistical clustering only
// TODO: Add ANTHROPIC_API_KEY support for LLM-generated community summaries
console.log(`ℹ️  Manifest generation: statistical clustering (LLM support coming soon)`);

// Custom server (following periphery pattern)
class HarmonyServer extends HonoMCPServer {
    protected async getSessionState(context: Context, sessionId: string): Promise<Record<string, any>> {
        const state = await super.getSessionState(context, sessionId);
        state.memoryDir ??= memoryDir;
        return state;
    }
}

// Create MCP server with memory tool (pass CLASS, not instance)
const mcpServer = new HarmonyServer(MemoryToolInteraction);

// Set server info
mcpServer.serverInfo = {
    protocolVersion: "2025-06-18",
    serverInfo: {
        name: "harmony",
        version: "0.1.0",
    },
    capabilities: {
        tools: { list: true },
    },
};

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
const port = parseInt(process.env.PORT || '6969', 10);
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

// Health check
app.get('/health', (c) => c.json({ status: 'ok', memory: memoryPath }));

// Start server
console.log(`🎵 Harmony MCP Server starting on ${baseUrl}`);
console.log(`  Memory: ${memoryPath}`);
console.log(`  Tools: memory (recall, remember, connect, themes, decay, refresh)`);
console.log(`\nTo add to Claude Code:`);
console.log(`  claude mcp add --transport http harmony ${baseUrl}\n`);

serve({
    fetch: app.fetch,
    port,
});
