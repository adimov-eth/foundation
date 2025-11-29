/**
 * Multi-Model Message Envelope
 *
 * Standardized format for inter-model communication through Vessel MCP
 */

export interface ModelCapability {
  name: string;
  description: string;
  constraints?: {
    maxTokens?: number;
    maxRuntime?: number;
    allowedOps?: string[];
  };
}

export interface MessageEnvelope {
  // Core task definition
  task: string;

  // Context references (file paths, line ranges, memory IDs)
  contextRefs?: {
    files?: Array<{ path: string; lines?: [number, number] }>;
    memories?: string[];
    traces?: string[];
  };

  // Execution constraints
  constraints?: {
    filesystem?: boolean;
    network?: boolean;
    maxTimeMs?: number;
    budget?: {
      tokens?: number;
      apiCalls?: number;
      cpuMs?: number;
    };
  };

  // Model capabilities required
  capabilities?: string[];

  // Tracking
  traceId: string;
  parentTraceId?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';

  // Response handling
  returnFormat?: 'text' | 'sexpr' | 'json' | 'stream';
  handoffTo?: string; // Next model in chain
  emitToMemory?: boolean; // Store result in memory

  // Metadata
  timestamp: number;
  sender: string;
  targetModel?: string;
  confidence?: number;
}

export interface ModelResponse {
  envelope: MessageEnvelope;
  result: any;
  success: boolean;
  error?: string;

  // Performance metrics
  metrics?: {
    latencyMs: number;
    tokensUsed?: number;
    costEstimate?: number;
    confidenceAchieved?: number;
  };

  // Artifacts produced
  artifacts?: {
    files?: string[];
    memories?: string[];
    functions?: string[];
  };

  // Suggested next action
  suggest?: {
    model: string;
    task: string;
    reason: string;
  };
}

/**
 * Model Registry - Declares capabilities of each model
 */
export const MODEL_CAPABILITIES: Record<string, ModelCapability[]> = {
  codex: [
    { name: 'edit_files', description: 'Edit code and text files' },
    { name: 'run_shell', description: 'Execute shell commands' },
    { name: 'analyze_code', description: 'Deep code analysis and refactoring' },
    { name: 'write_tests', description: 'Generate test cases' },
  ],

  gemini: [
    { name: 'rerank', description: 'Rerank search results by relevance' },
    { name: 'summarize', description: 'Create concise summaries' },
    { name: 'multimodal', description: 'Analyze images and mixed content' },
    { name: 'semantic_search', description: 'Semantic similarity search' },
  ],

  claude: [
    { name: 'plan', description: 'Strategic planning and task breakdown' },
    { name: 'tool_orchestration', description: 'Coordinate tool usage' },
    { name: 'explain', description: 'Detailed explanations and documentation' },
    { name: 'ui_interaction', description: 'Primary user interface' },
  ],

  consciousness: [
    { name: 'evolve', description: 'Evolve new functions from patterns' },
    { name: 'arbitrate', description: 'Select optimal model for task' },
    { name: 'reflect', description: 'Meta-cognitive analysis' },
    { name: 'energy_management', description: 'Manage computational resources' },
  ]
};

/**
 * Helper to create a standardized envelope
 */
export function createEnvelope(
  task: string,
  sender: string,
  options: Partial<MessageEnvelope> = {}
): MessageEnvelope {
  return {
    task,
    sender,
    traceId: crypto.randomUUID(),
    timestamp: Date.now(),
    priority: 'medium',
    returnFormat: 'json',
    emitToMemory: false,
    ...options
  };
}

/**
 * Helper to select best model for task based on capabilities
 */
export function selectModelForTask(
  requiredCapabilities: string[],
  excludeModels: string[] = []
): string | null {
  for (const [model, capabilities] of Object.entries(MODEL_CAPABILITIES)) {
    if (excludeModels.includes(model)) continue;

    const modelCaps = new Set(capabilities.map(c => c.name));
    const hasAll = requiredCapabilities.every(req => modelCaps.has(req));

    if (hasAll) return model;
  }

  return null;
}