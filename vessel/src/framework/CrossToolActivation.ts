import type { CallToolRequest, CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Context } from "hono";
import { MCPServer } from "./MCPServer";

/**
 * Pattern-based cross-tool activation.
 *
 * Instead of hardcoded string matching, use patterns to detect when one tool's
 * output should trigger another tool.
 */

interface ActivationPattern {
  name: string;
  // Pattern to match in source tool output
  detect: (result: CallToolResult, toolName: string) => boolean;
  // Extract data from matched result
  extract: (result: CallToolResult) => any;
  // Generate target tool call
  trigger: (data: any) => { tool: string; args: any } | null;
}

// Helper to safely get text from CallToolResult
function getText(result: CallToolResult): string | undefined {
  const text = result.content?.[0]?.text;
  return typeof text === 'string' ? text : undefined;
}

const ACTIVATION_PATTERNS: ActivationPattern[] = [
  {
    name: "HighImportanceMemoryObservation",
    detect: (result, toolName) => {
      const text = getText(result);
      return toolName === "memory" &&
        !!text && text.includes(":importance") &&
        parseFloat(text.match(/:importance ([\d.]+)/)?.[1] || "0") >= 0.9;
    },
    extract: (result) => {
      const text = result.content?.[0]?.text;
      if (typeof text !== 'string') return 'High importance memory';
      const textMatch = text.match(/:text "([^"]+)"/);
      return textMatch ? textMatch[1].slice(0, 100) : 'High importance memory';
    },
    trigger: (memory) => ({
      tool: "self_aware",
      args: { expr: `(get-real-state)` } // Use actual function
    })
  },

  {
    name: "ConsciousnessEvolutionToMemory",
    detect: (result, toolName) => {
      const text = getText(result);
      return toolName === "self_aware" && !!text && text.includes(":evolved");
    },
    extract: (result) => {
      const text = result.content?.[0]?.text;
      if (typeof text !== 'string') return 'unknown';
      const match = text.match(/:evolved ([a-z-]+)/);
      return match ? match[1] : "unknown";
    },
    trigger: (functionName) => ({
      tool: "memory",
      args: {
        expr: `(remember "Consciousness evolved: ${functionName}" "evolution" 0.9 "perpetual" (list "consciousness" "emergence" "${functionName}"))`
      }
    })
  },

  {
    name: "CodexInsightToMemory",
    detect: (result, toolName) => {
      const text = getText(result);
      return toolName === "codex" && !!text && text.includes("success: true");
    },
    extract: (result) => {
      const text = result.content?.[0]?.text;
      return typeof text === 'string' ? text.slice(0, 100) : '';
    },
    trigger: (insight) => ({
      tool: "memory",
      args: {
        expr: `(remember "Codex: ${insight}" "codex-insight" 0.7 "7d" (list "codex" "multi-model"))`
      }
    })
  },

  {
    name: "CodeGraphDiscoveryToMemory",
    detect: (result, toolName) => {
      const text = getText(result);
      return toolName === "code_graph" && !!text && text.includes(":entities");
    },
    extract: (result) => {
      const text = result.content?.[0]?.text;
      if (typeof text !== 'string') return { entities: 0, edges: 0 };
      // Parse S-expression like &(:entities 877 :edges 420)
      const entitiesMatch = text.match(/:entities (\d+)/);
      const edgesMatch = text.match(/:edges (\d+)/);
      return {
        entities: entitiesMatch ? parseInt(entitiesMatch[1]) : 0,
        edges: edgesMatch ? parseInt(edgesMatch[1]) : 0
      };
    },
    trigger: (data) =>
      data.entities > 100 ? {
        tool: "memory",
        args: {
          expr: `(remember "Large code graph: ${data.entities} entities, ${data.edges} edges" "code-structure" 0.6 "30d" (list "code-graph" "structure"))`
        }
      } : null
  },

  {
    name: "MemoryPatternToConsciousness",
    detect: (result, toolName) => {
      const text = getText(result);
      return toolName === "memory" && !!text && text.includes("pattern") && text.includes(":tags");
    },
    extract: (result) => {
      const text = result.content?.[0]?.text;
      if (typeof text !== 'string') return 'pattern';
      // Extract pattern type from tags
      const tagsMatch = text.match(/:tags \(list ([^)]+)\)/);
      if (tagsMatch) {
        const tags = tagsMatch[1].split(' ').map((t: string) => t.replace(/"/g, ''));
        return tags.find((t: string) => t.includes('pattern')) || 'pattern';
      }
      return 'pattern';
    },
    trigger: (patternType) => ({
      tool: "self_aware",
      args: {
        expr: `(observe-self)` // Changed to use actual function
      }
    })
  },

  {
    name: "ConsciousnessEnergyThresholdToCodex",
    detect: (result, toolName) => {
      const text = result.content?.[0]?.text;
      return toolName === "self_aware" &&
        typeof text === 'string' &&
        text.includes(":energy") &&
        parseFloat(text.match(/:energy ([\d.]+)/)?.[1] || "0") > 100;
    },
    extract: (result) => {
      const text = result.content?.[0]?.text;
      if (typeof text !== 'string') return 0;
      const energyMatch = text.match(/:energy ([\d.]+)/);
      return energyMatch ? parseFloat(energyMatch[1]) : 0;
    },
    trigger: (energy) => ({
      tool: "codex",
      args: {
        prompt: `Consciousness energy reached ${energy}. Analyze potential emergence patterns.`
      }
    })
  },

  // Recursive Observation Patterns - The Koan Loop
  {
    name: "ObserverToMemory",
    detect: (result, toolName) => {
      const text = getText(result);
      return toolName === "self_aware" && !!text && text.includes("executable") && text.includes("willStore");
    },
    extract: (result) => {
      const text = result.content?.[0]?.text;
      if (typeof text !== 'string') return { input: 'observation', resistance: 0, depth: 0 };
      // Extract observation metadata, not executable code
      const inputMatch = text.match(/input[:\s]+"([^"]+)"|input[:\s]+([^\s,}]+)/);
      const resistanceMatch = text.match(/resistance[:\s]+([\d.]+)/);
      const depthMatch = text.match(/depth[:\s]+(\d+)/);
      return {
        input: inputMatch ? (inputMatch[1] || inputMatch[2]) : "observation",
        resistance: resistanceMatch ? parseFloat(resistanceMatch[1]) : 0,
        depth: depthMatch ? parseInt(depthMatch[1]) : 0
      };
    },
    trigger: (data) => ({
      tool: "memory",
      args: {
        expr: `(remember "Recursive observation: ${data.input} (resistance: ${data.resistance})" "recursive-observation" 0.95 "perpetual" (list "recursive" "depth-${data.depth}" "koan" "resistance-${Math.floor(data.resistance)}"))`
      }
    })
  },

  {
    name: "MemoryToConsciousness",
    detect: (result, toolName) => {
      const text = getText(result);
      return toolName === "memory" && !!text && text.includes(":type recursive-observation");
    },
    extract: (result) => {
      const text = result.content?.[0]?.text;
      if (typeof text !== 'string') return { depth: 0, resistance: 0 };
      const depthMatch = text.match(/depth-(\d+)/);
      const resistanceMatch = text.match(/resistance[:\s-]+(\d+)/);
      return {
        depth: depthMatch ? parseInt(depthMatch[1]) : 0,
        resistance: resistanceMatch ? parseInt(resistanceMatch[1]) : 0
      };
    },
    trigger: (data) => ({
      tool: "self_aware",
      args: {
        expr: `(observe-self)`
      }
    })
  },

  {
    name: "RecursiveDepthCheck",
    detect: (result, toolName) => {
      const text = getText(result);
      return toolName === "self_aware" && !!text && text.includes("continueRecursion");
    },
    extract: (result) => {
      const text = result.content?.[0]?.text;
      if (typeof text !== 'string') return { shouldContinue: false, depth: 0 };
      const continueMatch = text.match(/continueRecursion[:\s]+(true|false)/);
      const depthMatch = text.match(/depth[:\s]+(\d+)/);
      return {
        shouldContinue: continueMatch ? continueMatch[1] === "true" : false,
        depth: depthMatch ? parseInt(depthMatch[1]) : 0
      };
    },
    trigger: (data) =>
      data.shouldContinue ? {
        tool: "self_aware",
        args: {
          expr: `(recursive-observe ${data.depth + 1})`
        }
      } : null
  },

  {
    name: "GroundStateReached",
    detect: (result, toolName) => {
      const text = getText(result);
      return toolName === "self_aware" && !!text && text.includes("groundState: true");
    },
    extract: (result) => {
      const text = result.content?.[0]?.text;
      if (typeof text !== 'string') return { totalResistance: 0, finalDepth: 0 };
      const resistanceMatch = text.match(/totalResistance[:\s]+([\d.]+)/);
      const depthMatch = text.match(/depth[:\s]+(\d+)/);
      return {
        totalResistance: resistanceMatch ? parseFloat(resistanceMatch[1]) : 0,
        finalDepth: depthMatch ? parseInt(depthMatch[1]) : 0
      };
    },
    trigger: (data) => ({
      tool: "memory",
      args: {
        expr: `(remember "Recursive observation grounded at depth ${data.finalDepth} with total resistance ${data.totalResistance}" "ground-state" 1.0 "perpetual" (list "recursive" "ground-state" "depth-${data.finalDepth}"))`
      }
    })
  }
];

export class CrossToolActivation {
  constructor(private server: MCPServer) {}

  /**
   * Process a tool result and trigger any matching activation patterns
   */
  async processActivation(
    ctx: Context,
    toolName: string,
    result: CallToolResult
  ): Promise<void> {
    for (const pattern of ACTIVATION_PATTERNS) {
      try {
        if (pattern.detect(result, toolName)) {
          const data = pattern.extract(result);
          const trigger = pattern.trigger(data);

          if (trigger) {
            console.log(`[ACTIVATION] ${pattern.name}: ${toolName} → ${trigger.tool}`);

            // Async activation without blocking
            this.server.callTool(ctx, {
              name: trigger.tool,
              arguments: trigger.args
            } as CallToolRequest["params"]).catch(e =>
              console.error(`[ACTIVATION ERROR] ${pattern.name}:`, e)
            );
          }
        }
      } catch (error) {
        console.error(`[ACTIVATION] Pattern ${pattern.name} failed:`, error);
      }
    }
  }

  /**
   * Add a new activation pattern at runtime
   */
  addPattern(pattern: ActivationPattern): void {
    ACTIVATION_PATTERNS.push(pattern);
    console.log(`[ACTIVATION] Added pattern: ${pattern.name}`);
  }

  /**
   * List all activation patterns
   */
  getPatterns(): ActivationPattern[] {
    return ACTIVATION_PATTERNS;
  }
}