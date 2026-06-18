---
title: Arrival MCP Resources (reconstructed)
layer: history
status: in-review
tags: [history, reconstructed, arrival-mcp, resources, mcp]
canonical-for: []
source-provenance:
  origin: docs/proposals/in-flight/arrival-resources.md
  branch: lost — not in tree nor origin/tmp-6164624 Archive
  retrieved: reconstructed 2026-06-18
  authority: derived
last-verified: 2026-06-18
verified-against: claude/vibrant-meitner-ask7xn
code-anchors:
  - arrival/arrival-mcp/src/resources/index.ts:1   # module header, design rationale pointer
  - arrival/arrival-mcp/src/resources/index.ts:9   # ArrivalResourceContents = Text | Blob
  - arrival/arrival-mcp/src/resources/index.ts:11  # ResourceProvider { list, read }
  - arrival/arrival-mcp/src/resources/index.ts:19  # ARRIVAL_RESOURCE_MIME (versioned)
  - arrival/arrival-mcp/src/index.ts:27            # barrel re-export of resources
---

> ⚠️ **RECONSTRUCTION — not the original.** The original `docs/proposals/in-flight/arrival-resources.md` is lost everywhere (see [[dangling-doc-map]]). This note is reverse-engineered from the code it governed, anchored to `file:line`. Fidelity: **high** for the contract that survives (`resources/index.ts` is small and fully commented and names the doc), but note the implementation present in this extraction is **only the interface + MIME constant** — the actual wiring to MCP `resources/list`/`resources/read` request handlers is **not in this extracted repo** (see "What is NOT recoverable"). It records what the doc *must have specified* given the implementation.

# Arrival MCP Resources (reconstructed)

The proposal defined how [[arrival-mcp]] exposes **MCP Resources**. The shipped contract is intentionally thin: the **application supplies a `ResourceProvider`; the framework wires it to the `resources/list` and `resources/read` MCP requests** (`resources/index.ts:1-4`). The whole public surface is re-exported from the package barrel (`index.ts:27`).

## The `ResourceProvider` contract

```ts
export interface ResourceProvider {
  list(context: Context, state: Record<string, any>): Promise<Resource[]>;
  read(context: Context, state: Record<string, any>, uri: string): Promise<ArrivalResourceContents[]>;
}
```
(`resources/index.ts:11-17`)

Design points the doc must have specified, each pinned by a code comment:

- **Inversion of control.** The host provides the provider; the framework owns the protocol plumbing (`resources/index.ts:1-2`). `context` is a Hono `Context` (`resources/index.ts:7`) — resources are served over the same HTTP transport as the rest of arrival-mcp — and `state` is an opaque per-call `Record<string, any>` bag.
- **`list` typically returns `[]` in v1** — clients construct URIs from **discovery-tool responses** instead, not from a resource listing (`resources/index.ts:12-13`). This couples resources to [[arrival-mcp]]'s discovery flow (`DiscoveryTool`) rather than to eager enumeration.
- **`read` rejects with a classified error** for not-found, malformed-URI, and auth-denied cases (`resources/index.ts:15`) — i.e. errors are categorized, not generic.

## Resource contents type

```ts
export type ArrivalResourceContents = TextResourceContents | BlobResourceContents;
```
(`resources/index.ts:9`) — directly the MCP SDK's text/blob union (`@modelcontextprotocol/sdk/types.js`, `resources/index.ts:6`). A `read` returns an **array** of these (one URI may resolve to multiple content parts).

## MIME type

```ts
export const ARRIVAL_RESOURCE_MIME = "application/vnd.here-build.arrival.entity+json; v=1";
```
(`resources/index.ts:19`) — a **versioned vendor MIME** for arrival "entity" resources (`+json`, explicit `v=1`). The doc evidently standardized this as the content type a `read` stamps on its `TextResourceContents`.

## What is NOT recoverable from code

- **The actual wiring.** Despite the header saying "the framework wires it to `resources/list`/`resources/read`," no handler in this extracted repo registers a `ResourceProvider` against those MCP methods — `ResourceProvider`, `ArrivalResourceContents`, and `ARRIVAL_RESOURCE_MIME` are exported but only *consumed* by the barrel re-export (`index.ts:27`); grep over `arrival-mcp/src` finds no `resources/list`/`resources/read` registration outside this comment. The wiring lives in code not extracted here.
- **The entity/URI scheme.** The MIME calls these "entity" resources and `read` takes a `uri`, but the URI grammar (how a discovery-tool response yields a readable URI) is not defined in the present code.
- The proposal's section numbering, rationale, and any auth model beyond the "auth-denied" classified-error mention.

See also [[arrival-mcp]].
