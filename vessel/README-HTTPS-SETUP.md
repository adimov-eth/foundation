# MCP Server HTTPS Setup for Claude Code

This document explains how to set up a local MCP server with HTTPS for Claude Code integration.

## The Challenge

Claude Code's HTTP transport requires:
- HTTPS (not HTTP) for security compliance with OAuth 2.1
- Full OAuth 2.0 flow (discovery, registration, authorization, token exchange)
- Protocol version compatibility (`2025-06-18`)
- Trusted TLS certificates

Node.js (used by Claude Code) doesn't trust self-signed certificates by default and doesn't use the macOS keychain for certificate validation.

## Solution Architecture

We created a local HTTPS MCP server (`http-local.ts`) that:
1. Uses self-signed certificates with proper TLS extensions
2. Implements mock OAuth 2.0 endpoints for protocol compliance
3. Supports the correct MCP protocol version
4. Provides S-expression evaluation tools

## Setup Instructions

### 1. Generate TLS Certificate

Create certificate configuration (`certs/openssl.cnf`):

```ini
[req]
distinguished_name = req_distinguished_name
x509_extensions = v3_req
prompt = no

[req_distinguished_name]
C = US
ST = CA
L = SF
O = MCP Dev
CN = localhost

[v3_req]
keyUsage = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = *.localhost
IP.1 = 127.0.0.1
IP.2 = ::1
```

Generate certificate:

```bash
cd packages/vessel/certs
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout key.pem -out cert.pem -config openssl.cnf
```

Trust certificate in macOS (optional, for browser access):

```bash
security add-trusted-cert -r trustRoot \
  -k ~/Library/Keychains/login.keychain-db cert.pem
```

### 2. Launch Claude Code with Certificate Override

Since Node.js doesn't use system keychain, launch Claude Code with:

```bash
NODE_TLS_REJECT_UNAUTHORIZED=0 /Applications/Claude\ Code.app/Contents/MacOS/Claude\ Code
```

This allows Node.js to accept self-signed certificates for development.

### 3. Configure Claude Code

Edit `~/.claude.json` to add the MCP server for your project:

```json
{
  "projects": {
    "/Users/adimov/AGI": {
      "mcpServers": {
        "vessel": {
          "type": "http",
          "url": "https://localhost:1337"
        }
      }
    }
  }
}
```

### 4. Start the Server

```bash
cd packages/vessel
bun run src/http-local.ts
```

You should see:
```
🚀 Local MCP server running at https://localhost:1337
- HTTPS with self-signed certificate
- No auth required (mock OAuth for protocol compliance)
- Tools: local_fs, experimental_discovery, codebase_meta
```

### 5. Connect in Claude Code

1. Run `/mcp` command in Claude Code
2. Click the authentication link that appears
3. Browser opens to `https://localhost:1337/auth?...`
4. Accept any certificate warnings
5. Browser redirects to Claude Code's callback
6. Connection established!

## How It Works

### OAuth Mock Flow

The server implements minimal OAuth 2.0 endpoints:

1. **Discovery** (`/.well-known/oauth-authorization-server`):
   - Provides metadata about authorization endpoints
   - Includes `registration_endpoint` for dynamic client registration

2. **Registration** (`/register`):
   - Accepts dynamic client registration from Claude Code
   - Returns mock client credentials

3. **Authorization** (`/auth`):
   - Redirects to Claude Code's callback URL with authorization code
   - No actual authentication required

4. **Token Exchange** (`/token`):
   - Exchanges authorization code for access token
   - Returns mock bearer token

### MCP Protocol

After OAuth completes, Claude Code connects with:
- Bearer token in Authorization header
- Protocol version `2025-06-18`
- JSON-RPC over HTTPS

The server responds to:
- `initialize` - Protocol handshake
- `tools/list` - List available S-expression tools
- `tools/call` - Execute S-expression queries

## Available Tools

### local_fs
Query local filesystem using S-expressions:
```scheme
(ls "/Users/adimov/AGI")
(read-file "/path/to/file.ts")
(find-files "**/*.ts")
```

### experimental_discovery
Component discovery and introspection:
```scheme
(get-components)
(find-by-type "button")
(analyze-structure)
```

### codebase_meta
Architecture and pattern analysis:
```scheme
(find-entities)
(trace-inheritance "BaseClass")
(architecture-summary)
```

## Troubleshooting

### "fetch failed" Error
- Ensure Claude Code was launched with `NODE_TLS_REJECT_UNAUTHORIZED=0`
- Check certificate exists in `certs/` directory
- Verify server is running on port 1337

### "SSL_KEY_USAGE_INCOMPATIBLE" Error
- Certificate must have `digitalSignature, keyEncipherment` in keyUsage
- Regenerate certificate with correct extensions

### "Protocol version mismatch"
- Server must return `protocolVersion: "2025-06-18"`
- Check `http-local.ts` initialize response

### "Server reconnection failed"
- Often indicates protocol version mismatch
- Check server logs for actual vs expected protocol version
- Restart Claude Code after configuration changes

## Security Notes

⚠️ **Development Only**: This setup uses:
- Self-signed certificates (not trusted by browsers/Node.js)
- `NODE_TLS_REJECT_UNAUTHORIZED=0` (disables certificate validation)
- Mock OAuth (no actual authentication)

For production, use:
- Real certificates from Let's Encrypt or CA
- Actual OAuth provider
- Proper authentication and authorization

## Alternative: stdio Transport

For local development, consider using stdio transport instead:
- No networking, no HTTPS, no OAuth required
- Direct process communication via stdin/stdout
- Simpler setup and more reliable

See `stdio-server.ts` for stdio implementation.