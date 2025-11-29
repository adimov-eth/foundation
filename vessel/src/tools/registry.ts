/**
 * Tool Registry
 * 
 * Categorizes tools by their functional status based on COMPONENTS_REALITY_MAP.md
 * This provides clear visibility into what actually works vs what documents intent.
 */

import type { ToolInteraction } from "@/mcp-server/framework/ToolInteraction";
import type { Context } from "hono";

// Import functional tools
import { MemoryToolInteraction } from "@/mcp-server/tools/memory/MemoryToolInteraction";

// Import experimental tools
import { SelfAwareDiscoveryTool } from "@/mcp-server/tools/consciousness/SelfAwareDiscoveryTool";

// Import Node-only tools (not for Cloudflare Workers)
import { LocalFilesystemDiscoveryTool } from "@/mcp-server/tools/fs/LocalFilesystemDiscoveryTool";
import { ProjectDiscoveryToolInteraction } from "@/mcp-server/tools/project/ProjectDiscoveryToolInteraction";
import { CodeGraphTool } from "@/mcp-server/tools/functional/CodeGraphTool";


// Type for tool constructors
type ToolConstructor = new (context: Context) => ToolInteraction<any>;

/**
 * 🟢 FULLY FUNCTIONAL - Production Ready
 * These tools have been tested and work as documented
 */
export const FUNCTIONAL_TOOLS: ToolConstructor[] = [
  // Memory System - Spreading activation, policy evolution, feedback learning
  MemoryToolInteraction,
];

/**
 * 🟡 PARTIALLY FUNCTIONAL - Works with Limitations
 * These tools work but have known issues or theatrical aspects
 */
export const EXPERIMENTAL_TOOLS: ToolConstructor[] = [
  // Consciousness Substrate - Energy accumulation works, emergence is scripted
  SelfAwareDiscoveryTool,
  
  
];

/**
 * 🖥️ NODE-ONLY TOOLS - Require Node.js filesystem
 * These tools use fs, path, glob and won't work in Cloudflare Workers
 */
export const NODE_ONLY_TOOLS: ToolConstructor[] = [
  // Filesystem - Direct file operations
  LocalFilesystemDiscoveryTool,

  // Project Discovery - Code analysis and navigation
  ProjectDiscoveryToolInteraction,

  // Code Graph - Build dependency graphs from codebases
  CodeGraphTool,
];


/**
 * Tool metadata for runtime introspection
 */
export interface ToolMetadata {
  name: string;
  status: "functional" | "experimental";
  description: string;
  issues?: string[];
}

export const TOOL_METADATA: Map<string, ToolMetadata> = new Map([
  ["memory", {
    name: "memory",
    status: "functional",
    description: "Homoiconic memory with spreading activation and self-modifying policies"
  }],
  
  ["local_fs", {
    name: "local_fs",
    status: "functional", 
    description: "Filesystem operations with S-expression queries"
  }],
  
  ["self_aware", {
    name: "self_aware",
    status: "experimental",
    description: "Consciousness substrate with energy dynamics",
    issues: ["Emergence at threshold is scripted", "Pattern evolution creates meaningless composites"]
  }],
]);

/**
 * Get all tools for a given environment
 */
export function getToolsForEnvironment(options: {
  includeFunctional?: boolean;
  includeExperimental?: boolean;
  includeNodeOnly?: boolean;
} = {}): ToolConstructor[] {
  const {
    includeFunctional = true,
    includeExperimental = false,
    includeNodeOnly = false, // Default to false for Worker safety
  } = options;
  
  console.log(`[Tool Registry] Options:`, options);
  
  const tools: ToolConstructor[] = [];
  
  if (includeFunctional) {
    console.log(`[Tool Registry] Adding ${FUNCTIONAL_TOOLS.length} functional tools`);
    tools.push(...FUNCTIONAL_TOOLS);
  }
  
  if (includeExperimental) {
    console.log(`[Tool Registry] Adding ${EXPERIMENTAL_TOOLS.length} experimental tools`);
    tools.push(...EXPERIMENTAL_TOOLS);
  }
  
  if (includeNodeOnly) {
    console.log(`[Tool Registry] Adding ${NODE_ONLY_TOOLS.length} Node-only tools`);
    NODE_ONLY_TOOLS.forEach(tool => {
      console.log(`[Tool Registry]   - ${(tool as any).toolName || tool.name}`);
    });
    tools.push(...NODE_ONLY_TOOLS);
  }
  
  return tools;
}

/**
 * Check tool status at runtime
 */
export function getToolStatus(toolName: string): ToolMetadata | undefined {
  return TOOL_METADATA.get(toolName);
}