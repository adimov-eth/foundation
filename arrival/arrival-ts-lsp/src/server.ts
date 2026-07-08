// @here.build/arrival-ts-lsp · server — a type-checker for arrival Scheme, as an MCP server.
//
// ⚠️ RECONSTRUCTION — and a DELIBERATELY DIFFERENT ANIMAL from its namesake ghost.
// The carved-out `mcp-typescript-lsp` package (its importer survives as a ghost in
// pnpm-lock.yaml) was a *vscode Language Server* — it declared `vscode-languageserver{,-protocol,
// -textdocument}` and spoke the LSP wire protocol. This package does NOT restore that. It is a
// tsgo-wasm-backed Scheme type-checker exposed as an **MCP DiscoveryTool** (the toolkit the
// arrival-peer uses), a different surface for a different consumer (an MCP client / an AI agent).
// The `mcp-typescript-lsp` ghost is preserved unchanged as the record of the real LSP package;
// this lives at its own path (`arrival/arrival-ts-lsp`) precisely so it doesn't overwrite it.
//
// What it wraps is the reconstructed `@here.build/arrival-type-lens` (emit → tsgo-wasm check →
// span-lens lift). One read verb: (check "<scheme source>") → type diagnostics positioned on the
// SOURCE Scheme. NEVER write to stdout — that is the MCP protocol channel; log to stderr only.

import { McpEnvCapability, DiscoveryTool, registerTools } from "@here.build/arrival-mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { check } from "./check.js";

// The `\"` inside the example are escaped quotes in the Scheme source; kept in a raw string so
// the description reads literally as a user would type it.
const CHECK_EXAMPLE = String.raw`e.g. (check "(+ 1 \"x\")") flags "x" as a string where a number is expected.`;

const capability = new McpEnvCapability("ts-lsp", {
  symbols: {
    check: {
      fn: (scm: unknown) => check(scm),
      description:
        "(scm) → type-check a Scheme source and return diagnostics positioned on the SOURCE. " +
        "Each diagnostic: {severity line col on code message topForm}. " +
        CHECK_EXAMPLE,
    },
    explain: {
      fn: () => ({
        what: "A tsgo-wasm-backed type checker for arrival Scheme, exposed as an MCP tool. Emits virtual TS (never run), type-checks it with the portable TypeScript-7 compiler, lifts each diagnostic back to the .scm position via the span lens.",
        engine:
          "@here.build/arrival-type-lens: arrival-chain-view emitTypes + span-lens (in-tree) + tsgo-wasm (portable WASM tsc)",
        reconstruction:
          "This does NOT restore the carved-out `mcp-typescript-lsp` (a vscode Language Server). It is a distinct MCP-flavored reconstruction over the reconstructed arrival-type-lens; the LSP ghost is preserved as the record of the original.",
        limits:
          "unmodelled builtins → 'Cannot find name' (a loud, correct 'not typed yet' signal); list element types are coarse; (require …) forms are skipped (dropped).",
      }),
      description: "() → what this server is, its engine, and its honest limits.",
    },
  },
});

const discover = new DiscoveryTool("discover", capability, {
  description:
    'Type-check arrival Scheme via a tsgo-wasm-backed lens. (check "<scm>") returns diagnostics ' +
    "positioned on the source; (explain) describes the engine + limits. Compose with map/filter " +
    "over a batch of sources in one call.",
  budgetMs: 8000,
});

const mcp = new McpServer({ name: "ts-lsp", version: "0.1.0" }, { capabilities: { tools: {} } });
registerTools(mcp, [discover], () => ({ session: { id: "local", state: {} } }));
await mcp.connect(new StdioServerTransport());
console.error('[ts-lsp] up — (check "<scheme>") for positioned type diagnostics (tsgo-wasm)');
