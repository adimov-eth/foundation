# @here.build/arrival-ts-lsp

A type checker for arrival Scheme, exposed as an **MCP DiscoveryTool**. `(check "<scm>")`
type-checks a Scheme source and returns diagnostics positioned on the source Scheme.

> ### ⚠️ This is a reconstruction — and a *different animal* from its namesake ghost
>
> The carved-out **`mcp-typescript-lsp`** package (its importer survives in `pnpm-lock.yaml` as
> a ghost) was a **vscode Language Server** — it declared `vscode-languageserver`,
> `-protocol`, and `-textdocument`, and spoke the LSP wire protocol.
>
> **This package does not restore that.** It is a `tsgo-wasm`-backed Scheme type-checker exposed
> as an **MCP tool** (the [`@here.build/arrival-mcp`](../arrival-mcp) DiscoveryTool toolkit) — a
> different surface for a different consumer (an MCP client, or an AI agent). It deliberately
> lives at its **own path** (`arrival/arrival-ts-lsp`), so the `mcp-typescript-lsp` ghost stays
> byte-identical as the archaeological record of the original LSP package.
>
> Its dependencies are honestly what it imports: `arrival-mcp`, the reconstructed
> [`arrival-type-lens`](../arrival-type-lens), and the MCP SDK — **not** the ghost's
> vscode-languageserver stack.

## Usage

It wraps [`@here.build/arrival-type-lens`](../arrival-type-lens)'s `diagnoseScheme` — the full
`emit → tsgo-wasm check → span-lens lift` pipeline — and exposes one read verb:

```
(check "(+ 1 \"x\")")
→ {
    ok: false,
    diagnostics: [{
      severity: "error", line: 0, col: 5, on: "\"x\"", code: "TS2345",
      message: "Argument of type 'string' is not assignable to parameter of type 'number'.",
      topForm: 0, lifted: true
    }]
  }
```

`(explain)` returns the engine and its honest limits (unmodelled builtins degrade *loudly* to
"Cannot find name"; `(require …)` forms are dropped; list element types are coarse).

### Running it as an MCP server

The package `bin` (`arrival-ts-lsp`) starts a stdio MCP server. Register it with an MCP client
(e.g. `claude mcp add ts-lsp -- node .../arrival/arrival-ts-lsp/dist/server.js`). It never writes
to stdout (the protocol channel) — logs go to stderr.

## Why tsgo-wasm

The checker drives **`tsgo-wasm`** (TypeScript 7 / typescript-go compiled to WASM), not the node
`typescript` compiler API — because the lens is meant to run inside a *sandboxed* Scheme runtime,
where a portable WASM tsc (no host install, worker/browser-runnable) is the right tool. That is
the dependency the original lens declared, and the reconstruction honors it. See
[`arrival-type-lens`](../arrival-type-lens) for the checker itself.

## License

FSL-1.1-MIT — see [LICENSE.md](./LICENSE.md).
