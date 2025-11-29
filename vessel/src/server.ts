import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { MCPServer } from "./framework/MCPServer";
import { getToolsForEnvironment } from "./tools/registry";

// Cloudflare Worker environment bindings
type Environment = {
  WORKOS_CLIENT_ID?: string;
  DEV_MODE?: string;
  // Add other bindings as needed (KV, D1, R2, etc)
};

type Variables = {
  mcpAuth: {
    type: string;
    subject: string;
    scopes: string[];
    extra: {
      userId: string;
      email: string;
      firstName: string;
      lastName: string;
      organizationId?: string;
      role?: string;
      permissions?: string[];
    };
  };
};

// Import S-expression model definitions
// import "./framework/sexpr/model";

// Cache MCP servers per environment configuration
const mcpServers = new Map<string, MCPServer>();

// Get or create MCP server for the given environment
function getMCPServer(env: Environment): MCPServer {
  const isDev = env?.DEV_MODE === "true";
  const isNode = typeof process !== 'undefined' && !!process.versions?.node;
  const cacheKey = `${isDev}-${isNode}`;
  
  console.log(`[MCP Server] Environment: isDev=${isDev}, isNode=${isNode}, cacheKey=${cacheKey}`);
  console.log(`[MCP Server] process.versions:`, typeof process !== 'undefined' ? process.versions : 'undefined');
  
  let server = mcpServers.get(cacheKey);
  if (!server) {
    const tools = getToolsForEnvironment({
      includeFunctional: true,
      includeExperimental: isDev,
      includeNodeOnly: isNode, // Only include fs-based tools in Node.js
    });
    console.log(`[MCP Server] Loading ${tools.length} tools`);
    server = new MCPServer(...tools);
    mcpServers.set(cacheKey, server);
  }
  
  return server;
}
// Create Hono app
const app = new Hono<{ Bindings: Environment; Variables: Variables }>();
const CLIENT_ID = "client_01K1G1SA6SKHK2HF36V993D45G";
const JWKS = createRemoteJWKSet(new URL(`https://api.workos.com/sso/jwks/${CLIENT_ID}`));

const WWW_AUTHENTICATE_HEADER = [
  'Bearer error="unauthorized"',
  'error_description="Authorization needed"',
  `resource_metadata="https://mcp-dev.here.build/.well-known/oauth-protected-resource"`,
].join(", ");
const handler = async (c: Context<{ Bindings: Environment; Variables: Variables }>) => {
  const debug = c.env.DEV_MODE === "true";
  if (debug) {
    console.log("[MCP Server] MCP endpoint hit");
    console.log("[MCP Server] Auth info:", c.get("mcpAuth"));
  }

  try {
    // Handle GET requests (SSE)
    if (c.req.method === "GET") {
      if (debug) console.log("[MCP Server] Handling authenticated GET request");
      const acceptHeader = c.req.header("accept");

      // Check if client wants SSE
      if (acceptHeader?.includes("text/event-stream")) {
        if (debug) console.log("[MCP Server] Client requesting SSE - forcing JSON mode for now");

        // For now, return error to force JSON-RPC mode
        // This helps us debug OAuth flow without SSE complexity
        return c.json(
          {
            error: "SSE not supported, please use JSON-RPC mode",
            hint: "Remove 'text/event-stream' from Accept header",
          },
          501,
        );
      }

      // Return basic server info for other GET requests
      return c.json({
        mcp: "1.0",
        name: "dappsnap-mcp",
        version: "0.0.1",
        capabilities: {
          tools: {
            list: true,
          },
        },
      });
    }

    // Handle POST requests with JSON-RPC body
    const request = await c.req.json();
    if (debug) console.log("[MCP Server] Processing request:", request);

    switch (request.method) {
      case "initialize": {
        return c.json({
          jsonrpc: "2.0",
          id: request.id,
          result: {
            protocolVersion: "0.1.0",
            serverInfo: {
              name: "dappsnap-mcp",
              version: "0.0.1",
            },
            capabilities: {
              tools: {
                list: true,
              },
              // Add these as we implement them
              // resources: {
              //   list: true,
              // },
              // prompts: {
              //   list: true,
              // },
              // logging: {},
            },
          },
        });
      }

      // Tool methods
      case "tools/list":
        return c.json({
          jsonrpc: "2.0",
          id: request.id,
          result: {
            tools: await getMCPServer(c.env).getToolDefinitions(c),
          },
        });

      case "tools/call":
        try {
          return c.json({
            jsonrpc: "2.0",
            id: request.id,
            result: await getMCPServer(c.env).callTool(c, request.params),
          });
        } catch (error) {
          console.error("[MCP Server] Tool execution error:", error);
          return c.json({
            jsonrpc: "2.0",
            id: request.id,
            error: {
              code: -32_603,
              message: "Tool execution failed",
              data: error instanceof Error ? error.message : error,
            },
          });
        }

      // Resource methods (not implemented yet)
      case "resources/list":
      case "resources/read":
        return c.json({
          jsonrpc: "2.0",
          id: request.id,
          error: {
            code: -32_601,
            message: "Resources not implemented yet",
          },
        });

      // Prompt methods (not implemented yet)
      case "prompts/list":
      case "prompts/get":
        return c.json({
          jsonrpc: "2.0",
          id: request.id,
          error: {
            code: -32_601,
            message: "Prompts not implemented yet",
          },
        });

      // Logging methods
      case "logging/setLevel":
        // For now, just acknowledge the request
        const { level } = request.params;
        if (debug) console.log(`[MCP Server] Logging level set to: ${level}`);
        return c.json({
          jsonrpc: "2.0",
          id: request.id,
          result: {},
        });

      // Completion method (not implemented)
      case "completion/complete":
        return c.json({
          jsonrpc: "2.0",
          id: request.id,
          error: {
            code: -32_601,
            message: "Completion not implemented",
          },
        });

      // Sampling method (not implemented)
      case "sampling/createMessage":
        return c.json({
          jsonrpc: "2.0",
          id: request.id,
          error: {
            code: -32_601,
            message: "Sampling not implemented",
          },
        });

      // Ping method (keepalive)
      case "ping":
        return c.json({
          jsonrpc: "2.0",
          id: request.id,
          result: {},
        });

      // Default: method not found
      default:
        return c.json({
          jsonrpc: "2.0",
          id: request.id,
          error: {
            code: -32_601,
            message: `Method not found: ${request.method}`,
          },
        });
    }
  } catch (error) {
    console.error("[MCP Server] Error processing MCP request:", error);
    return c.json({
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32_603,
        message: "Internal error",
        data: error instanceof Error ? error.message : String(error),
      },
    });
  }
};

const auth = async (c: Context<{ Bindings: Environment; Variables: Variables }>, next: () => Promise<void>) => {
  // Skip auth in development if DEV_MODE is set
  if (c.env.DEV_MODE === "true") {
    c.set("mcpAuth", {
      type: "dev",
      subject: "dev-user",
      scopes: ["profile", "email"],
      extra: {
        userId: "dev-user-id",
        email: "dev@example.com",
        firstName: "Dev",
        lastName: "User",
        organizationId: "dev-org",
        role: "developer",
        permissions: ["*"],
      },
    });
    return next();
  }
  
  const token = c.req.header("Authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) {
    c.header("WWW-Authenticate", WWW_AUTHENTICATE_HEADER);
    return c.json({ error: "No token provided." }, 401);
  }

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://api.workos.com/user_management/${c.env.WORKOS_CLIENT_ID}`,
    });

    // Populate auth context for handlers
    c.set("mcpAuth", {
      type: "oauth2",
      subject: payload.sub as string,
      scopes: ["profile", "email"],
      extra: {
        userId: payload.sub as string,
        email: payload.email as string,
        firstName: payload.given_name as string,
        lastName: payload.family_name as string,
        organizationId: payload.org_id as string | undefined,
        role: payload.role as string | undefined,
        permissions: payload.permissions as string[] | undefined,
      },
    });

    await next();
  } catch (error) {
    console.log(error);
    c.header("WWW-Authenticate", WWW_AUTHENTICATE_HEADER);
    return c.json({ error: "Invalid bearer token." }, 401);
  }
};

// Add logger
app
  .use(logger())
  .use(
    cors({
      origin: ["https://claude.ai", "capacitor://localhost", "*"],
      exposeHeaders: ["WWW-Authenticate"],
      allowHeaders: ["Authorization", "Content-Type"],
      allowMethods: ["GET", "POST", "OPTIONS"],
    }),
  )
  .get("/.well-known/oauth-protected-resource", (c) => {
    return c.json({
      resource: `https://mcp-dev.here.build`,
      authorization_servers: ["https://alive-movie-37-staging.authkit.app"],
      bearer_methods_supported: ["header"],
    });
  })
  .get("/.well-known/oauth-authorization-server", async (_c) => {
    return fetch("https://alive-movie-37-staging.authkit.app/.well-known/oauth-authorization-server");
  })
  .get("/", auth, handler)
  .post("/", auth, handler);

export default app;
