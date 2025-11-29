import { DiscoveryToolInteraction } from "@/mcp-server/framework/DiscoveryToolInteraction";
import * as z from "zod";
import { randomUUID, createHash } from "node:crypto";
import type { MemoryItem, MemoryItemType, MemoryState } from "@/mcp-server/tools/memory/types";
import { DEFAULT_POLICY, HISTORY_CAP, PolicyName, SESSIONS_CAP } from "@/mcp-server/tools/memory/types";
import type { MemoryStore } from "@/mcp-server/tools/memory/store/MemoryStore";
import { FileMemoryStore } from "@/mcp-server/tools/memory/store/FileMemoryStore";
import { SQLiteMemoryStore } from "@/mcp-server/tools/memory/store/SQLiteMemoryStore";
// import { FalkorDBMemoryStore } from "@/mcp-server/tools/memory/store/FalkorDBMemoryStore"; // Moved to backlog/
import { GraphitiWithManifest } from "@/mcp-server/tools/memory/GraphitiWithManifest";
import { memoryStateToSExpr } from "@/mcp-server/tools/memory/serialization/MemorySExpr";
import { runSpreadingActivation, type ActivationMap } from "@/mcp-server/tools/memory/engine/SpreadingActivationEngine";
import { exec, sandboxedEnv } from "@singl/arrival";
import { SExprManifestAdapter } from "./SExprManifestAdapter";
import { patternValidator } from "./validation/PatternValidator";

// Manifest cache shared across instances (module-level)
type ManifestCache = { basic: string; enriched?: string; generatedAt: number } | null;
let manifestCache: ManifestCache = null;
const MANIFEST_CACHE_TTL_MS = 30_000; // 30s

// Optional, host-injected LLM provider for enrichment (disabled by default)
type LLMProvider = { batchSummarize(prompts: string[]): Promise<string[]> };
let llmProvider: LLMProvider | null = null;
export function setMemoryLLMProvider(provider: LLMProvider) { llmProvider = provider; }

// Memory backend: Use FalkorDB if configured, Neo4j if available, otherwise file
let graphitiMemory: GraphitiWithManifest | null = null;
let memoryStore: MemoryStore | null = null;
let memory: MemoryState | null = null;

// Get the appropriate memory store based on configuration
async function getMemoryStore(): Promise<MemoryStore> {
  if (memoryStore) return memoryStore;

  // Check for FalkorDB configuration first (preferred)
  // NOTE: FalkorDB integration moved to backlog/ due to version mismatch
  // if (process.env.MEMORY_BACKEND === 'falkordb') {
  //   try {
  //     memoryStore = new FalkorDBMemoryStore();
  //     console.log("[Memory] Using FalkorDB backend on port 6379");
  //     return memoryStore;
  //   } catch (error) {
  //     console.error("[Memory] Failed to initialize FalkorDB:", error);
  //   }
  // }

  // Use SQLite if configured (supports FTS5 search)
  console.log(`[Memory] MEMORY_BACKEND env: ${process.env.MEMORY_BACKEND}`);
  if (process.env.MEMORY_BACKEND === 'sqlite') {
    try {
      memoryStore = new SQLiteMemoryStore();
      console.log("[Memory] Using SQLite backend with FTS5 search");
      return memoryStore;
    } catch (error) {
      console.error("[Memory] Failed to initialize SQLite:", error);
    }
  }

  // Fallback to file store
  memoryStore = new FileMemoryStore();
  console.log("[Memory] Using file-based memory store");
  return memoryStore;
}

// Initialize Graphiti if Neo4j is configured (legacy support)
async function getGraphitiMemory(): Promise<GraphitiWithManifest | null> {
  if (graphitiMemory) return graphitiMemory;

  // Check if Neo4j is configured
  if (process.env.NEO4J_URI) {
    try {
      graphitiMemory = new GraphitiWithManifest();
      await graphitiMemory.initialize();
      console.log("[Memory] Initialized Neo4j-backed GraphitiWithManifest");
      return graphitiMemory;
    } catch (error) {
      console.error("[Memory] Failed to initialize Neo4j:", error);
      console.log("[Memory] Falling back to FileMemoryStore");
    }
  }
  return null;
}

async function getMemory(): Promise<MemoryState> {
  // Try to use Graphiti first
  const graphiti = await getGraphitiMemory();
  if (graphiti) {
    // Graphiti manages its own state internally
    // Return a placeholder state for compatibility
    return {
      id: "workspace",
      born: Date.now(),
      energy: 0,
      threshold: 100,
      items: {},
      edges: [],
      history: [],
      policy: { ...DEFAULT_POLICY },
      policyVersions: [],
      recentSessions: [],
    };
  }
  
  // Fallback to configured memory store
  if (memory) return memory;
  const store = await getMemoryStore();
  const loaded = await store.load();
  if (loaded) {
    memory = loaded;
    return memory;
  }
  const now = Date.now();
  memory = {
    id: "workspace",
    born: now,
    energy: 0,
    threshold: 100,
    items: {},
    edges: [],
    history: [],
    policy: { ...DEFAULT_POLICY },
    policyVersions: [],
    recentSessions: [],
  };
  await persist();
  return memory;
}

async function persist() {
  // Graphiti handles its own persistence
  const graphiti = await getGraphitiMemory();
  if (graphiti) {
    return; // Graphiti auto-persists to Neo4j
  }
  
  // Persist to configured backend
  if (!memory) return;
  const snapshot = memoryStateToSExpr(memory);
  const store = await getMemoryStore();
  await store.save(memory, snapshot);
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function toId(): string {
  // Short id with timestamp prefix for readability
  const ts = Date.now().toString(36);
  return `m_${ts}_${randomUUID().slice(0, 8)}`;
}

// Recency score with 7d half-life
const HALF_LIFE_MS = 7 * 24 * 60 * 60 * 1000;
const LN2 = Math.log(2);
function recencyScore(now: number, t: number): number {
  const dt = Math.max(0, now - t);
  return Math.exp(-LN2 * (dt / HALF_LIFE_MS));
}

// Combine activation, recency and importance
const ALPHA = 0.6; // activation weight
const BETA = 0.25; // recency weight
const GAMMA = 0.15; // importance weight
function combineScore(act: number, rec: number, imp: number): number {
  return ALPHA * act + BETA * rec + GAMMA * imp;
}

// Parse duration like "7d", "24h", "15m", "10s", "250ms"
function parseDuration(spec: string): number {
  if (!spec) return 0;
  const m = String(spec).trim().match(/^(\d+(?:\.\d+)?)(ms|s|m|h|d)$/i);
  if (!m) return 0;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  switch (unit) {
    case "ms":
      return n;
    case "s":
      return n * 1000;
    case "m":
      return n * 60_000;
    case "h":
      return n * 3_600_000;
    case "d":
      return n * 86_400_000;
    default:
      return 0;
  }
}

async function evalLambdaNumber(lambdaSrc: string, args: Array<number>): Promise<number | null> {
  // Overloaded to accept arrays: numbers or number[] in args
  const encode = (v: any): string => {
    if (Array.isArray(v)) return `(list ${v.map((x) => (Number.isFinite(x) ? String(x) : "0")).join(" ")})`;
    return Number.isFinite(v) ? String(v) : "0";
  };
  try {
    const sexprArgs = (args as any[]).map((a) => encode(a)).join(" ");
    // Evaluate the lambda and immediately apply to arguments
    const program = `((begin ${lambdaSrc}) ${sexprArgs})`;
    const result = await (exec as any)(program, { env: sandboxedEnv });
    const v = Array.isArray(result) ? result[0] : result;
    if (typeof v === "number") return v;
    if (v && typeof v === "object" && "__value__" in v) return Number((v as any).__value__);
    return null;
  } catch {
    return null;
  }
}

async function evalLambdaString(lambdaSrc: string, args: Array<number>): Promise<string | null> {
  const encode = (v: any): string => {
    if (Array.isArray(v)) return `(list ${v.map((x) => (Number.isFinite(x) ? String(x) : "0")).join(" ")})`;
    return Number.isFinite(v) ? String(v) : "0";
  };
  try {
    const sexprArgs = (args as any[]).map((a) => encode(a)).join(" ");
    const program = `((begin ${lambdaSrc}) ${sexprArgs})`;
    const result = await (exec as any)(program, { env: sandboxedEnv });
    const v = Array.isArray(result) ? result[0] : result;
    if (typeof v === "string") return v;
    if (v && typeof v === "object" && "__string__" in v) return String((v as any).__string__);
    return null;
  } catch {
    return null;
  }
}

function codeId(code?: string | null): string | undefined {
  if (!code) return undefined;
  try {
    return createHash("sha1").update(code).digest("hex").slice(0, 8);
  } catch {
    return `v_${randomUUID().slice(0, 8)}`;
  }
}

export class MemoryToolInteraction extends DiscoveryToolInteraction<{}> {
  static readonly toolName = "memory";
  private manifestAdapter = new SExprManifestAdapter();

  // Override to inject manifest into tool schema
  async getToolSchema(): Promise<any> {
    const baseSchema = await super.getToolSchema();
    const manifest = this.description; // Triggers manifest generation

    // Inject manifest at the beginning of the description
    if (baseSchema.properties?.expr?.description) {
      baseSchema.properties.expr.description = `${manifest}\n\n${baseSchema.properties.expr.description}`;
    }

    return baseSchema;
  }

  get description(): Promise<string> {
    return this.generateDescription();
  }

  private async generateDescription(): Promise<string> {
    console.log("[MemoryToolInteraction] description getter called");
    try {
      // Use Graphiti manifest if available
      if (graphitiMemory) {
        console.log("[MemoryToolInteraction] Using Graphiti manifest");
        return graphitiMemory.getToolDescription();
      }

      // Check cache
      const cached = manifestCache;
      const now = Date.now();
      if (cached && now - cached.generatedAt < MANIFEST_CACHE_TTL_MS) {
        const age = now - cached.generatedAt;
        console.log(`[MemoryToolInteraction] Using cached description (age: ${age}ms)`);
        return cached.basic;
      }

      // Initialize memory state
      const state = this.getCachedState() || await getMemory();
      if (!state) {
        console.log("[MemoryToolInteraction] State is null, returning initializing message");
        return "Memory initializing...";
      }

      const items = Object.values(state.items);

      // Handle empty memory
      if (items.length === 0) {
        return "Empty memory. Use (remember text type importance ttl tags-list) to store thoughts.";
      }

      console.log(`[MemoryToolInteraction] Generating thematic manifest (${items.length} items, ${state.edges.length} edges)`);

      const description = await this.generateThematicManifest(state, items);
      manifestCache = { basic: description, generatedAt: now };
      return description;
    } catch (err) {
      console.error("[MemoryToolInteraction] description getter error:", err);
      return "Persistent associative memory with homoiconic S-expression snapshots";
    }
  }

  private async generateThematicManifest(state: MemoryState, items: MemoryItem[]): Promise<string> {
    const { ManifestGenerator } = await import("./manifest/ManifestGenerator");
    const generator = new ManifestGenerator();

    // Convert edges to Association format
    const associations = state.edges.map(e => ({
      fromId: e.from,
      toId: e.to,
      relation: e.relation,
      weight: e.weight
    }));

    // Generate manifest with Louvain + LLM theme naming
    const manifest = await generator.generateManifest(items, associations);

    // Format as thematic description
    const thematicDescription = generator.formatDescription(manifest);

    // Progressive disclosure: Generate index of recent high-importance items
    const highImpItems = items
      .filter(i => i.importance >= 0.7)
      .sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt))
      .slice(0, 10);

    let indexTable = '';
    if (highImpItems.length > 0) {
      // Build index table
      const rows = highImpItems.map(item => {
        const shortId = item.id.length > 20 ? `${item.id.slice(0, 17)}...` : item.id;
        const preview = item.text.slice(0, 80).replace(/\n/g, ' ').trim();
        const tokens = Math.ceil(item.text.length / 4);
        const tagList = item.tags.slice(0, 3).join(', ');
        const imp = item.importance.toFixed(2);

        return `${shortId.padEnd(22)} ${item.type.padEnd(16)} ${imp.padEnd(5)} ${tagList.padEnd(30)} ${preview.padEnd(82)} ~${tokens}`;
      });

      indexTable = `
Recent High-Importance Items (≥0.7):
${'ID'.padEnd(22)} ${'Type'.padEnd(16)} ${'Imp'.padEnd(5)} ${'Tags'.padEnd(30)} ${'Preview (80 chars)'.padEnd(82)} Tokens
${'─'.repeat(22)} ${'─'.repeat(16)} ${'─'.repeat(5)} ${'─'.repeat(30)} ${'─'.repeat(82)} ${'─'.repeat(6)}
${rows.join('\n')}

💡 Progressive Disclosure:
  → This index shows WHAT exists (titles/previews) and retrieval COST (token counts)
  → Use (get-item id) to fetch full details on-demand (Layer 2)
  → Use (recall query limit) for semantic search (returns IDs + scores, not full items)
`;
    }

    // Add usage info footer
    return `${thematicDescription}

${indexTable}
Functions:
  (recall query limit [scope]) - Spreading activation (semantic similarity)
    Returns: list of &(:id :score :type :preview)
    Use (get-item id) to fetch full details

  (search query limit [scope]) - FTS5 keyword search (when MEMORY_BACKEND=sqlite)
    Returns: list of &(:id :rank :type :preview)
    Use for exact keyword/phrase matching

  (get-item id) - Fetch full memory item by ID (Layer 2)
  (remember text type importance ttl tags [scope]) - Store thought
  (associate fromId toId relation weight) - Connect items
  (feedback id outcome) - Train recall scoring
  (stats) - Full statistics with topology & communities`;
  }

  protected async registerFunctions(_context: {}): Promise<() => Promise<void>> {
    // Remember: (remember text type importance ttl tags-list) or (remember text type importance ttl tags-list scope)
    this.registerFunction(
      "remember",
      "Store a memory item: (remember text type importance ttl tags-list) or (remember ... scope)\n  scope: agent name (\"self-critic\", \"thinker\", etc.) to namespace memory",
      [z.string(), z.string(), z.number(), z.string(), z.array(z.string()), z.string().optional()],
      async (text: string, type: string, importance: number, ttl: string, tags: string[], scope?: string) => {
        // Use Graphiti if available
        const graphiti = await getGraphitiMemory();
        if (graphiti) {
          const id = await graphiti.remember(text, type, importance, ttl, tags);
          return {
            id,
            type: type as MemoryItemType,
            text,
            tags,
            importance: clamp01(importance ?? 0.5),
            energy: importance,
            ttl: ttl || "",
            createdAt: Date.now(),
            updatedAt: Date.now()
          };
        }
        
        // Fallback to file-based memory
        const state = await getMemory();

        // Pattern validation at write time
        const validation = await patternValidator.validate({
          text,
          type: type || "event",
          importance: clamp01(importance ?? 0.5),
          tags: tags ?? []
        });

        // Reject if validation fails
        if (!validation.valid) {
          console.error(`Memory validation failed (confidence ${validation.confidence.toFixed(2)}):`, validation.signals);
          throw new Error(`Pattern validation failed: ${validation.signals.join(', ')}`);
        }

        // Use adjusted importance if provided
        const finalImportance = validation.adjustedImportance ?? clamp01(importance ?? 0.5);

        const id = toId();
        const now = Date.now();
        const item: MemoryItem = {
          id,
          type: (type as MemoryItemType) || "event",
          text,
          tags: tags ?? [],
          importance: finalImportance,
          energy: 0,
          ttl: ttl || "",
          scope: scope || undefined,  // Add scope if provided
          createdAt: now,
          updatedAt: now,
        };
        state.items[id] = item;
        state.energy = clamp01(state.energy + 0.01);
        state.history.push({ t: now, op: "remember", args: { id, validation: validation.confidence } });
        if (state.history.length > HISTORY_CAP) state.history.splice(0, state.history.length - HISTORY_CAP);
        await persist();
        this.invalidateManifest();
        return item;
      },
    );

    // Policy ops: (get-policy), (set-policy &(...))
    this.registerFunction(
      "get-policy",
      "Get memory policy parameters",
      [],
      async () => {
        const state = await getMemory();
        return state.policy ?? { ...DEFAULT_POLICY };
      },
    );

    this.registerFunction(
      "set-policy",
      "Set memory policy parameters with an object (keys optional)",
      [z.record(z.string(), z.any())],
      async (patch: Record<string, any>) => {
        const state = await getMemory();
        state.policy = { ...DEFAULT_POLICY, ...(state.policy ?? {}), ...patch } as any;
        state.history.push({ t: Date.now(), op: "set-policy", args: patch });
        if (state.history.length > HISTORY_CAP) state.history.splice(0, state.history.length - HISTORY_CAP);
        await persist();
        this.invalidateManifest();
        return state.policy;
      },
    );

    // Set executable policy lambda: (set-policy-fn name code)
    this.registerFunction(
      "set-policy-fn",
      "Set an executable policy function: name in ['decay','recall-score','exploration']",
      [z.string(), z.string()],
      async (name: string, code: string) => {
        const state = await getMemory();
        const key = name.toLowerCase();
        const now = Date.now();
        // Save previous version
        const currentCode = key === "decay" ? state.policy?.decayFn : key === "recall-score" ? state.policy?.recallScoreFn : state.policy?.explorationFn;
        if (currentCode) {
          state.policyVersions = state.policyVersions ?? [];
          state.policyVersions.push({ id: codeId(currentCode)!, name: key as PolicyName, code: currentCode, createdAt: now, success: 0, fail: 0 });
          if (state.policyVersions.length > 200) state.policyVersions.splice(0, state.policyVersions.length - 200);
        }
        switch (key) {
          case "decay":
            state.policy = { ...DEFAULT_POLICY, ...(state.policy ?? {}), decayFn: code };
            break;
          case "recall-score":
            state.policy = { ...DEFAULT_POLICY, ...(state.policy ?? {}), recallScoreFn: code };
            break;
          case "exploration":
            state.policy = { ...DEFAULT_POLICY, ...(state.policy ?? {}), explorationFn: code };
            break;
          default:
            return { updated: false, reason: "unknown-policy-name" };
        }
        state.history.push({ t: now, op: "set-policy-fn", args: { name: key } });
        if (state.history.length > HISTORY_CAP) state.history.splice(0, state.history.length - HISTORY_CAP);
        await persist();
        this.invalidateManifest();
        return { updated: true, name: key };
      },
    );

    // Inspect policy functions: (get-policy-fn)
    this.registerFunction(
      "get-policy-fn",
      "Get executable policy functions (decay/recall-score/exploration)",
      [],
      async () => {
        const state = await getMemory();
        const p = state.policy ?? DEFAULT_POLICY;
        return { decay: p.decayFn ?? null, recallScore: p.recallScoreFn ?? null, recallScorers: p.recallScoreFns ?? [], exploration: p.explorationFn ?? null, policyGenerator: p.policyGeneratorFn ?? null };
      },
    );

    // Policy versions: list and revert
    this.registerFunction(
      "list-policy-versions",
      "List stored policy function versions",
      [],
      async () => {
        const state = await getMemory();
        return state.policyVersions ?? [];
      },
    );


    // Set multiple recall scorers
    this.registerFunction(
      "set-recall-scorers",
      "Set multiple recall scorer lambdas: (set-recall-scorers (list code1 code2 ...))",
      [z.array(z.string())],
      async (codes: string[]) => {
        const state = await getMemory();
        state.policy = { ...DEFAULT_POLICY, ...(state.policy ?? {}), recallScoreFns: codes };
        state.history.push({ t: Date.now(), op: "set-recall-scorers", args: { count: codes.length } });
        if (state.history.length > HISTORY_CAP) state.history.splice(0, state.history.length - HISTORY_CAP);
        await persist();
        this.invalidateManifest();
        return { count: codes.length };
      },
    );


    // Policy generator and adaptation
    this.registerFunction(
      "set-policy-fn-generator",
      "Set meta-policy generator lambda: (set-policy-fn-generator code)",
      [z.string()],
      async (code: string) => {
        const state = await getMemory();
        state.policy = { ...DEFAULT_POLICY, ...(state.policy ?? {}), policyGeneratorFn: code };
        state.history.push({ t: Date.now(), op: "set-policy-fn-generator" });
        if (state.history.length > HISTORY_CAP) state.history.splice(0, state.history.length - HISTORY_CAP);
        await persist();
        this.invalidateManifest();
        return { updated: true };
      },
    );

    this.registerFunction(
      "adapt-policy",
      "Generate and install a new recall scorer using policy generator",
      [],
      async () => {
        const state = await getMemory();
        const gen = state.policy?.policyGeneratorFn;
        if (!gen) return { updated: false, reason: "no-generator" };
        // Aggregate success/fail histograms by session hour/day
        const hoursSucc = Array(24).fill(0);
        const hoursFail = Array(24).fill(0);
        const daysSucc = Array(7).fill(0);
        const daysFail = Array(7).fill(0);
        for (const s of state.recentSessions ?? []) {
          const h = s.hour ?? new Date(s.t).getHours();
          const d = new Date(s.t).getDay();
          hoursSucc[h] += s.succ ?? 0; hoursFail[h] += s.fail ?? 0;
          daysSucc[d] += s.succ ?? 0; daysFail[d] += s.fail ?? 0;
        }
        // Tag distributions (top 20 by frequency)
        const tagCount = new Map<string, number>();
        const tagSucc = new Map<string, number>();
        const tagFail = new Map<string, number>();
        for (const it of Object.values(state.items)) {
          for (const t of it.tags) {
            tagCount.set(t, (tagCount.get(t) || 0) + 1);
            tagSucc.set(t, (tagSucc.get(t) || 0) + (it.success ?? 0));
            tagFail.set(t, (tagFail.get(t) || 0) + (it.fail ?? 0));
          }
        }
        const topTags = Array.from(tagCount.entries()).sort((a,b)=>b[1]-a[1]).slice(0,20).map(([t])=>t);
        const tagsSucc = topTags.map(t=> tagSucc.get(t) || 0);
        const tagsFail = topTags.map(t=> tagFail.get(t) || 0);
        // Query token distributions from recent sessions
        const tokSucc = new Map<string, number>();
        const tokFail = new Map<string, number>();
        function toks(q?: string){ return (q||"").toLowerCase().split(/[^a-z0-9_\-]+/g).filter(w=>w.length>=3); }
        for (const s of state.recentSessions ?? []) {
          const words = toks(s.query);
          for (const w of words) {
            tokSucc.set(w, (tokSucc.get(w)||0) + (s.succ ?? 0));
            tokFail.set(w, (tokFail.get(w)||0) + (s.fail ?? 0));
          }
        }
        const topTokens = Array.from(new Set(
          [...Array.from(tokSucc.entries()).sort((a,b)=>b[1]-a[1]).slice(0,20).map(([w])=>w),
           ...Array.from(tokFail.entries()).sort((a,b)=>b[1]-a[1]).slice(0,20).map(([w])=>w)]
        ));
        const queriesSucc = topTokens.map(w=> tokSucc.get(w)||0);
        const queriesFail = topTokens.map(w=> tokFail.get(w)||0);
        // Energy histogram (5 bins)
        const energiesSucc = Array(5).fill(0);
        const energiesFail = Array(5).fill(0);
        for (const s of state.recentSessions ?? []) {
          const bin = Math.max(0, Math.min(4, Math.floor((s.energy ?? 0) * 5)));
          energiesSucc[bin] += s.succ ?? 0;
          energiesFail[bin] += s.fail ?? 0;
        }
        // Evaluate generator -> code string
        const code = await evalLambdaString(gen, [hoursSucc as unknown as number, hoursFail as unknown as number, daysSucc as unknown as number, daysFail as unknown as number, tagsSucc as unknown as number, tagsFail as unknown as number, queriesSucc as unknown as number, queriesFail as unknown as number, energiesSucc as unknown as number, energiesFail as unknown as number]);
        if (!code) return { updated: false, reason: "generator-returned-empty" };
        // Install as additional scorer (composition)
        const scorers = (state.policy?.recallScoreFns ?? []).slice();
        scorers.push(code);
        state.policy = { ...DEFAULT_POLICY, ...(state.policy ?? {}), recallScoreFns: scorers };
        state.history.push({ t: Date.now(), op: "adapt-policy", args: { added: true } });
        if (state.history.length > HISTORY_CAP) state.history.splice(0, state.history.length - HISTORY_CAP);
        await persist();
        this.invalidateManifest();
        return { updated: true, scorers: scorers.length };
      },
    );

    // Get-item: Fetch full memory item by ID (progressive disclosure layer 2)
    this.registerFunction(
      "get-item",
      "Fetch full memory item by ID (Layer 2 - progressive disclosure)",
      [z.string()],
      async (id: string) => {
        const state = await getMemory();
        const item = state.items[id];

        if (!item) {
          return { error: `Item not found: ${id}` };
        }

        // Update access tracking
        item.lastAccessedAt = Date.now();
        item.accessCount = (item.accessCount ?? 0) + 1;
        await persist();

        return item;
      },
    );

    // Search: FTS5 keyword search (search query limit) or (search query limit scope)
    this.registerFunction(
      "search",
      "FTS5 full-text keyword search: (search query limit) or (search query limit scope)\n  Returns: list of &(:id :rank :type :preview)\n  Use for keyword/phrase search. Use recall for semantic/spreading activation.",
      [z.string(), z.number(), z.string().optional()],
      async (query: string, limit: number, scope?: string) => {
        const store = await getMemoryStore();

        // Check if store supports FTS5 search
        if (!('search' in store) || typeof (store as any).search !== 'function') {
          return { error: "Current memory store does not support FTS5 search. Use (recall) instead." };
        }

        try {
          const results = await (store as any).search(query, limit, scope);
          const state = await getMemory();

          // Map to same format as recall for consistency
          return results.map((r: { id: string; rank: number }) => {
            const item = state.items[r.id];
            if (!item) return null;

            return {
              id: r.id,
              rank: r.rank, // FTS5 rank (lower = more relevant)
              type: item.type,
              preview: item.text.slice(0, 100).replace(/\n/g, ' ').trim(),
              importance: item.importance,
              tags: item.tags.slice(0, 3)
            };
          }).filter(Boolean);
        } catch (error: any) {
          return { error: `Search failed: ${error.message}` };
        }
      },
    );

    // Recall: (recall query limit) or (recall query limit scope)
    this.registerFunction(
      "recall",
      "Recall items with spreading activation ranking: (recall query limit) or (recall query limit scope)\n  scope: agent name (\"self-critic\", \"thinker\", etc.) or empty string \"\" for all scopes",
      [z.string(), z.number(), z.string().optional()],
      async (query: string, limit: number, scope?: string) => {
        // Use Graphiti if available
        const graphiti = await getGraphitiMemory();
        if (graphiti) {
          const results = await graphiti.recall(query, limit);
          return results;
        }

        // Scope filter function
        const scopeFilter = (it: MemoryItem): boolean => {
          if (!scope || scope === "") return true;  // No scope filter - show all
          if (!it.scope) return true;  // Items without scope are global
          return it.scope === scope;   // Match specific scope
        };

        // Fallback to file-based memory
        const state = await getMemory();

        // Bootstrap context: if query is "current" and working memory exists, use those seeds
        if (query.toLowerCase() === "current") {
          const { bootstrapContext } = await import("./BootstrapContext");
          const contextItems = await bootstrapContext(state, scope);
          if (contextItems.length > 0) {
            console.log(`[recall] Bootstrap context returned ${contextItems.length} items`);
            // Progressive disclosure: Return IDs + previews for bootstrap too
            return contextItems.slice(0, limit).map(item => ({
              id: item.id,
              score: item.importance, // Use importance as score for bootstrap
              type: item.type,
              preview: item.text.slice(0, 100).replace(/\n/g, ' ').trim(),
              importance: item.importance,
              tags: item.tags.slice(0, 3)
            }));
          }
          // Fall through to normal recall if bootstrap failed
        }

        const q = query.toLowerCase();
        const now = Date.now();
        // Seed selection: substring matches + scope filter
        const matches = Object.values(state.items)
          .filter(scopeFilter)
          .filter((it) => it.text.toLowerCase().includes(q));
        // Seed activations start at 1.0 for top-k seeds
        const seeds: ActivationMap = {};
        const seedCount = Math.min(10, matches.length);
        for (let i = 0; i < seedCount; i++) seeds[matches[i].id] = 1.0;
        // Run spreading activation using policy defaults
        const p = state.policy ?? DEFAULT_POLICY;
        const activation = runSpreadingActivation(state, seeds, { steps: p.activationSteps, decay: p.activationDecay, threshold: p.activationThreshold });

        // If spreading activation found strong connections, weight them heavily
        const maxActivation = Math.max(...Object.values(activation));
        const hasStrongActivation = maxActivation > 0.1;

        // Rank all items by policy recall score function (if provided)
        // Apply scope filter to candidates as well
        const candidatePromises = Object.values(state.items)
          .filter(scopeFilter)
          .map(async (it) => {
          const last = it.lastAccessedAt ?? it.updatedAt ?? it.createdAt;
          const rec = recencyScore(now, last);
          const act = activation[it.id] ?? 0;
          // Time features
          const date = new Date(now);
          const hourNorm = date.getHours() / 23;
          const dayNorm = date.getDay() / 6;
          // Scoring: if spreading activation found strong patterns, trust them
          let score = hasStrongActivation && act > 0.05
            ? act * 10 // Heavily weight activation when it's meaningful
            : combineScore(act, rec, it.importance);
          const p = state.policy ?? DEFAULT_POLICY;
          if (p.recallScoreFns && p.recallScoreFns.length > 0) {
            const parts: number[] = [];
            for (const fn of p.recallScoreFns) {
              const s = await evalLambdaNumber(fn, [act, rec, it.importance, it.accessCount ?? 0, it.success ?? 0, it.fail ?? 0, hourNorm, dayNorm]);
              parts.push(s ?? 0);
            }
            if (p.recallCombinerFn) {
              const combined = await evalLambdaNumber(p.recallCombinerFn, [parts as unknown as number]);
              if (combined !== null) score = combined;
              else score = parts.reduce((a, b) => a + b, 0) / Math.max(1, parts.length);
            } else {
              score = parts.reduce((a, b) => a + b, 0) / Math.max(1, parts.length);
            }
          } else if (p.recallScoreFn) {
            const s = await evalLambdaNumber(p.recallScoreFn, [act, rec, it.importance, it.accessCount ?? 0, it.success ?? 0, it.fail ?? 0, hourNorm, dayNorm]);
            if (s !== null) score = s;
          }
          return { it, score };
        });
        let candidates = (await Promise.all(candidatePromises)).sort((a, b) => b.score - a.score);

        // Exploration: policy function can pick a tail index; else epsilon strategy
        const epsilon = p.explorationEpsilon ?? 0;
        let ranked = candidates.slice(0, Math.max(0, Math.min(100, limit))).map((x) => x.it);
        if (candidates.length > limit) {
          let surpriseIdx = -1;
          if ((state.policy?.explorationFn)) {
            const tail = candidates.slice(limit).map((x) => x.it);
            // Features for tail items
            const acts = tail.map((it) => activation[it.id] ?? 0);
            const recs = tail.map((it) => recencyScore(now, (it.lastAccessedAt ?? it.updatedAt ?? it.createdAt)));
            const imps = tail.map((it) => it.importance);
            const accs = tail.map((it) => it.accessCount ?? 0);
            const succ = tail.map((it) => it.success ?? 0);
            const fails = tail.map((it) => it.fail ?? 0);
            const date = new Date(now);
            const hours = tail.map(() => date.getHours() / 23);
            const days = tail.map(() => date.getDay() / 6);
            // Heuristic novelty index for default policy fallback
            const scores = tail.map((it, idx) => {
              const acc = it.accessCount ?? 0;
              const rec = recs[idx];
              const suc = succ[idx];
              const fai = fails[idx];
              const util = suc / Math.max(1, suc + fai);
              return (1 / (1 + acc)) * (0.5 + util) * (0.5 + rec);
            });
            let novelty = 0;
            for (let i = 1; i < scores.length; i++) if (scores[i] > scores[novelty]) novelty = i;
            const idx = await evalLambdaNumber(
              state.policy!.explorationFn!,
              [
                limit,
                tail.length,
                acts as unknown as number,
                recs as unknown as number,
                imps as unknown as number,
                accs as unknown as number,
                succ as unknown as number,
                fails as unknown as number,
                hours as unknown as number,
                days as unknown as number,
              ],
            );
            if (idx !== null && idx >= 0 && idx < tail.length) surpriseIdx = idx;
          }
          if (surpriseIdx < 0 && epsilon > 0 && Math.random() < epsilon) {
            // Epsilon: prefer low accessCount
            const tail = candidates.slice(limit).map((x) => x.it);
            // Blend low access, recency, and utility
            tail.sort((a, b) => {
              const sa = (1 / (1 + (a.accessCount ?? 0))) * (0.5 + (a.success ?? 0) / Math.max(1, (a.success ?? 0) + (a.fail ?? 0))) * (0.5 + recencyScore(now, (a.lastAccessedAt ?? a.updatedAt ?? a.createdAt)));
              const sb = (1 / (1 + (b.accessCount ?? 0))) * (0.5 + (b.success ?? 0) / Math.max(1, (b.success ?? 0) + (b.fail ?? 0))) * (0.5 + recencyScore(now, (b.lastAccessedAt ?? b.updatedAt ?? b.createdAt)));
              return sb - sa;
            });
            const surprise = tail[0];
            if (surprise && !ranked.find((i) => i.id === surprise.id)) {
              ranked[ranked.length - 1] = surprise;
            }
          } else if (surpriseIdx >= 0) {
            const tail = candidates.slice(limit).map((x) => x.it);
            const surprise = tail[surpriseIdx] ?? tail[0];
            if (surprise && !ranked.find((i) => i.id === surprise.id)) {
              ranked[ranked.length - 1] = surprise;
            }
          }
        }

        // Co-activation reinforcement: sparse updates with causal metrics
        const reinforceDelta = p.reinforceDelta ?? 0.05;
        const maxPairs = p.maxPairsPerRecall ?? 12;
        const topKPerNode = p.coactTopKPerNode ?? 3;

        // Build adjacency (undirected) for triadic closure check
        const adj = new Map<string, Set<string>>();
        for (const e of state.edges) {
          if (e.relation !== 'co-activated') continue;
          if (!adj.has(e.from)) adj.set(e.from, new Set());
          if (!adj.has(e.to)) adj.set(e.to, new Set());
          adj.get(e.from)!.add(e.to);
          adj.get(e.to)!.add(e.from);
        }

        // Precompute lightweight token and tag sets for ranked items
        const tokenCache = new Map<string, Set<string>>();
        const tagCache = new Map<string, Set<string>>();
        const getTokens = (text: string) => new Set(text.toLowerCase().split(/[^a-z0-9_\-]+/g).filter(w=>w.length>=3));
        for (const it of ranked) {
          tokenCache.set(it.id, getTokens(state.items[it.id]?.text || ''));
          tagCache.set(it.id, new Set(state.items[it.id]?.tags || []));
        }

        // Build candidate pairs with scores
        type Pair = { a: string; b: string; score: number; exists: boolean; weight: number; tagJac: number; tokJac: number };
        const pairs: Pair[] = [];
        const seenPerNode = new Map<string, number>();
        for (let i = 0; i < ranked.length; i++) {
          for (let j = i + 1; j < ranked.length; j++) {
            const a = ranked[i].id; const b = ranked[j].id;
            // Per-node cap
            if ((seenPerNode.get(a) || 0) >= topKPerNode && (seenPerNode.get(b) || 0) >= topKPerNode) continue;
            const existing = state.edges.find((e) => e.from === a && e.to === b && e.relation === 'co-activated');
            const w = existing?.weight ?? 0;
            const tagsA = tagCache.get(a)!; const tagsB = tagCache.get(b)!;
            const tokensA = tokenCache.get(a)!; const tokensB = tokenCache.get(b)!;
            const tagInter = [...tagsA].filter(x => tagsB.has(x)).length;
            const tagUnion = Math.max(1, tagsA.size + tagsB.size - tagInter);
            const tagJac = tagInter / tagUnion;
            const tokInter = [...tokensA].filter(x => tokensB.has(x)).length;
            const tokUnion = Math.max(1, tokensA.size + tokensB.size - tokInter);
            const tokJac = tokInter / tokUnion;
            // Triadic closure gating: only if share neighbor or some tag overlap
            const shareNeighbor = [...(adj.get(a) ?? new Set())].some(n => (adj.get(b) ?? new Set()).has(n));
            if (!shareNeighbor && tagJac === 0) continue;
            const score = w * 0.6 + tokJac * 0.3 + tagJac * 0.1;
            pairs.push({ a, b, score, exists: !!existing, weight: w, tagJac, tokJac });
            seenPerNode.set(a, (seenPerNode.get(a) || 0) + 1);
            seenPerNode.set(b, (seenPerNode.get(b) || 0) + 1);
          }
        }
        pairs.sort((x,y)=> y.score - x.score);
        const selected = pairs.slice(0, Math.max(0, maxPairs));

        let createdEdges = 0;
        let reinforcedEdges = 0;
        let beforeSum = 0;
        let afterSum = 0;
        for (const pair of selected) {
          const { a, b } = pair;
          for (const [from, to] of [[a,b],[b,a]] as const) {
            const existing = state.edges.find((e) => e.from === from && e.to === to && e.relation === 'co-activated');
            if (existing) {
              beforeSum += existing.weight;
              existing.weight = clamp01(existing.weight + reinforceDelta);
              existing.lastReinforcedAt = now;
              afterSum += existing.weight;
              reinforcedEdges++;
            } else {
              state.edges.push({ from, to, relation: 'co-activated', weight: reinforceDelta, lastReinforcedAt: now });
              beforeSum += 0;
              afterSum += reinforceDelta;
              createdEdges++;
            }
          }
        }

        // Touch access and energy; record session attribution for policy versions
        for (const it of ranked) {
          it.lastAccessedAt = now;
          it.energy = clamp01(it.energy + 0.005);
          it.accessCount = (it.accessCount ?? 0) + 1;

          // Implicit feedback: memories accessed 3+ times are useful
          // Give success credit to the session that surfaced them
          if (it.accessCount >= 3) {
            // Find the most recent session before this one that returned this item
            const priorSessions = (state.recentSessions ?? [])
              .filter(s => s.items.includes(it.id) && s.t < now)
              .sort((a, b) => b.t - a.t);

            if (priorSessions.length > 0) {
              const session = priorSessions[0];
              session.succ = (session.succ ?? 0) + 1;

              // Attribute success to the policy versions that produced this result
              if (session.policyIds) {
                for (const versionId of Object.values(session.policyIds)) {
                  if (!versionId) continue;
                  const version = (state.policyVersions ?? []).find(v => v.id === versionId);
                  if (version) version.success += 1;
                }
              }
            }

            // Mark the item itself as successful
            it.success = (it.success ?? 0) + 1;
          }
        }
        // Track which policy function versions were used this recall
        const policyIds: Partial<Record<PolicyName, string>> = {};
        policyIds["recall-score"] = codeId(state.policy?.recallScoreFn);
        policyIds["exploration"] = codeId(state.policy?.explorationFn);
        state.recentSessions = state.recentSessions ?? [];
        const hour = new Date(now).getHours();
        state.recentSessions.push({ t: now, type: "recall", items: ranked.map((i) => i.id), policyIds, query, energy: state.energy, hour });
        if (state.recentSessions.length > SESSIONS_CAP) state.recentSessions.splice(0, state.recentSessions.length - SESSIONS_CAP);
        // Derive a dominant community label for ranked items (fast pass)
        let clusterLabel: string | undefined;
        try {
          const comms = this.detectCommunities(state);
          const index = new Map<string, number>();
          for (const c of comms) for (const id of c.itemIds) index.set(id, c.id);
          const counts = new Map<number, number>();
          for (const it of ranked) {
            const cid = index.get(it.id);
            if (cid !== undefined) counts.set(cid, (counts.get(cid) || 0) + 1);
          }
          let bestCid: number | undefined;
          let bestCount = -1;
          for (const [cid, cnt] of counts.entries()) if (cnt > bestCount) { bestCid = cid; bestCount = cnt; }
          if (bestCid !== undefined) clusterLabel = comms.find(c => c.id === bestCid)?.label;
        } catch {}
        const updatedEdges = createdEdges + reinforcedEdges;
        const avgBefore = updatedEdges > 0 ? beforeSum / updatedEdges : 0;
        const avgAfter = updatedEdges > 0 ? afterSum / updatedEdges : 0;
        state.history.push({ t: now, op: "recall", args: { query, count: ranked.length, createdEdges, reinforcedEdges, avgWeightBefore: Number(avgBefore.toFixed(2)), avgWeightAfter: Number(avgAfter.toFixed(2)), cluster: clusterLabel } });
        if (state.history.length > HISTORY_CAP) state.history.splice(0, state.history.length - HISTORY_CAP);
        await persist();
        this.invalidateManifest();

        // Progressive disclosure: Return IDs + scores + previews instead of full items
        return ranked.map(item => ({
          id: item.id,
          score: candidates.find(c => c.it.id === item.id)?.score ?? 0,
          type: item.type,
          preview: item.text.slice(0, 100).replace(/\n/g, ' ').trim(),
          importance: item.importance,
          tags: item.tags.slice(0, 3)
        }));
      },
    );

    // Associate: (associate fromId toId relation weight)
    this.registerFunction(
      "associate",
      "Create or reinforce association: (associate fromId toId relation weight)",
      [z.string(), z.string(), z.string(), z.number()],
      async (from: string, to: string, relation: string, weight: number) => {
        // Use Graphiti if available
        const graphiti = await getGraphitiMemory();
        if (graphiti) {
          await graphiti.associate(from, to, relation, weight);
          return { from, to, relation };
        }
        
        // Fallback to file-based memory
        const state = await getMemory();
        const now = Date.now();
        const w = clamp01(weight);
        const existing = state.edges.find((e) => e.from === from && e.to === to && e.relation === relation);
        let created = false;
        let before = 0;
        let after = 0;
        if (existing) {
          before = existing.weight;
          existing.weight = clamp01(existing.weight + w);
          existing.lastReinforcedAt = now;
          after = existing.weight;
        } else {
          created = true;
          state.edges.push({ from, to, relation, weight: w, lastReinforcedAt: now });
          before = 0;
          after = w;
        }
        state.history.push({ t: now, op: "associate", args: { from, to, relation, created, before: Number(before.toFixed(2)), after: Number(after.toFixed(2)) } });
        if (state.history.length > HISTORY_CAP) state.history.splice(0, state.history.length - HISTORY_CAP);
        await persist();
        this.invalidateManifest();
        return { from, to, relation };
      },
    );

    // Trace: (trace startId depth)
    this.registerFunction(
      "trace",
      "Trace association chains: (trace startId depth)",
      [z.string(), z.number()],
      async (startId: string, depth: number) => {
        const state = await getMemory();
        const maxDepth = Math.max(1, Math.min(6, depth));
        const paths: string[][] = [];
        const visited = new Set<string>([startId]);

        function dfs(current: string, d: number, path: string[]) {
          if (d > maxDepth) return;
          const outgoing = state.edges.filter((e) => e.from === current);
          if (outgoing.length === 0) {
            paths.push([...path]);
            return;
          }
          for (const e of outgoing) {
            if (visited.has(e.to)) continue;
            visited.add(e.to);
            path.push(e.to);
            dfs(e.to, d + 1, path);
            path.pop();
            visited.delete(e.to);
          }
        }

        dfs(startId, 1, [startId]);
        const now = Date.now();
        state.history.push({ t: now, op: "trace", args: { startId, depth: maxDepth, paths: paths.length } });
        if (state.history.length > HISTORY_CAP) state.history.splice(0, state.history.length - HISTORY_CAP);
        await persist();
        this.invalidateManifest();
        return paths;
      },
    );

    // Stats: (stats) - includes thematic manifest with LLM-generated community names
    this.registerFunction(
      "stats",
      "Return memory stats with thematic manifest",
      [],
      async () => {
        const state = await getMemory();
        const items = Object.values(state.items);

        // Basic stats
        const degrees = Object.keys(state.items).reduce<Record<string, number>>((acc, id) => {
          acc[id] = state.edges.filter((e) => e.from === id || e.to === id).length;
          return acc;
        }, {});
        const tagsCount = new Map<string, number>();
        for (const it of items) {
          for (const tag of it.tags) tagsCount.set(tag, (tagsCount.get(tag) || 0) + 1);
        }

        const basicStats = {
          id: state.id,
          items: items.length,
          edges: state.edges.length,
          avgDegree: Object.values(degrees).reduce((a, b) => a + b, 0) / (Object.keys(degrees).length || 1),
          topTags: Array.from(tagsCount.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10),
          energy: state.energy,
          threshold: state.threshold,
          historySize: state.history.length,
          born: state.born,
        };

        // Generate thematic manifest
        if (items.length > 0) {
          const { ManifestGenerator } = await import("./manifest/ManifestGenerator");
          const generator = new ManifestGenerator();

          const associations = state.edges.map(e => ({
            fromId: e.from,
            toId: e.to,
            relation: e.relation,
            weight: e.weight
          }));

          const manifest = await generator.generateManifest(items, associations);
          const thematicDescription = generator.formatDescription(manifest);

          return {
            ...basicStats,
            manifest: thematicDescription
          };
        }

        return basicStats;
      },
    );

    // Snapshot: (snapshot)
    this.registerFunction(
      "snapshot",
      "Persist snapshot and return canonical S-expression",
      [],
      async () => {
        const state = await getMemory();
        const snapshot = memoryStateToSExpr(state);
        const store = await getMemoryStore();
        await store.save(state, snapshot);
        this.invalidateManifest();
        return snapshot;
      },
    );

    // Activate: (activate seedIds steps decay threshold)
    this.registerFunction(
      "activate",
      "Run spreading activation from seeds: (activate (list id1 id2) steps decay threshold)",
      [z.array(z.string()), z.number(), z.number(), z.number()],
      async (seedIds: string[], steps: number, decay: number, threshold: number) => {
        const state = await getMemory();
        const seeds: ActivationMap = {};
        for (const id of seedIds) if (state.items[id]) seeds[id] = 1.0;
        const activation = runSpreadingActivation(state, seeds, { steps, decay, threshold });
        // return top 20 activated nodes (id, activation)
        const top = Object.entries(activation)
          .filter(([id, a]) => a > 0 && state.items[id])
          .sort((a, b) => b[1] - a[1])
          .slice(0, 20)
          .map(([id, a]) => ({ id, activation: a, text: state.items[id].text }));
        return top;
      },
    );

    // Decay: (decay! half_life_days)
    this.registerFunction(
      "decay!",
      "Apply temporal decay to item energy and edge weights: (decay! half_life_days)",
      [z.number()],
      async (halfLifeDays: number) => {
        const state = await getMemory();
        const now = Date.now();
        const baseHalfLifeDays = halfLifeDays > 0 ? halfLifeDays : (state.policy?.halfLifeDays ?? DEFAULT_POLICY.halfLifeDays);
        const baseHalfLifeMs = Math.max(1, baseHalfLifeDays) * 86_400_000;
        // Purposeful and programmable decay: allow policy.decayFn to compute scale
        const policyDecay = state.policy?.decayFn;
        const factor = async (dt: number, it: MemoryItem) => {
          const successes = it.success ?? 0;
          const failures = it.fail ?? 0;
          const recencyMs = dt;
          let scale: number | null = null;
          if (policyDecay) {
            scale = await evalLambdaNumber(policyDecay, [successes, failures, it.energy, it.importance, recencyMs, baseHalfLifeMs]);
          }
          if (scale === null) {
            // fallback to success-ratio scale
            const total = successes + failures + 1;
            const ratio = successes / total;
            scale = 0.5 + 1.5 * ratio; // 0.5x .. 2.0x half-life
          }
          const halfLifeMs = baseHalfLifeMs * Math.max(0.1, Math.min(10, scale));
          return Math.exp(-LN2 * (dt / halfLifeMs));
        };

        // Items energy decay
        let decayedItems = 0;
        for (const it of Object.values(state.items)) {
          const t = it.lastAccessedAt ?? it.updatedAt ?? it.createdAt;
          const dt = Math.max(0, now - t);
          const f = await factor(dt, it);
          const before = it.energy;
          it.energy = clamp01(it.energy * f);
          if (it.energy !== before) decayedItems++;
        }

        // Edges weight decay; remove very weak edges
        let decayedEdges = 0;
        const edgeFloor = state.policy?.edgeWeightFloor ?? 0.01;
        state.edges = state.edges.filter((e) => {
          const dt = Math.max(0, now - e.lastReinforcedAt);
          // Use neutral utility for edges for now
          const f = Math.exp(-LN2 * (dt / baseHalfLifeMs));
          const before = e.weight;
          e.weight = clamp01(e.weight * f);
          if (e.weight !== before) decayedEdges++;
          return e.weight >= edgeFloor; // prune weak edges
        });

        // Recompute global energy as avg of item energies
        const items = Object.values(state.items);
        state.energy = clamp01(items.reduce((s, it) => s + it.energy, 0) / Math.max(1, items.length));

        const nowT = Date.now();
        state.history.push({ t: nowT, op: "decay", args: { halfLifeDays, decayedItems, decayedEdges } });
        if (state.history.length > HISTORY_CAP) state.history.splice(0, state.history.length - HISTORY_CAP);
        await persist();
        this.invalidateManifest();
        return { halfLifeDays, decayedItems, decayedEdges, energy: state.energy };
      },
    );

    // Summarize: (summarize (list id1 id2 ...)) -> reflection node
    async function createReflection(state: MemoryState, ids: string[]): Promise<MemoryItem | { created: false; reason: string }> {
      const items = ids.map((id) => state.items[id]).filter(Boolean);
      const now = Date.now();
      if (items.length === 0) return { created: false, reason: "no-valid-items" };

      // Extractive summary: keywords weighted by accessCount and recency
      const tagSet = new Set<string>();
      const wordFreq = new Map<string, number>();
      const STOP = new Set(["the","a","an","and","or","of","to","in","on","for","with","by","is","are","was","were","it","this","that","as","at","be"]);
      for (const it of items) {
        it.tags.forEach((t) => tagSet.add(t));
        const weight = (it.accessCount ?? 0) + 1 + recencyScore(now, it.lastAccessedAt ?? it.updatedAt ?? it.createdAt);
        const words = it.text.toLowerCase().split(/[^a-z0-9_\-]+/g).filter(Boolean);
        for (const w of words) {
          if (w.length < 3 || STOP.has(w)) continue;
          wordFreq.set(w, (wordFreq.get(w) || 0) + weight);
        }
      }
      const topKeywords = Array.from(wordFreq.entries()).sort((a,b)=>b[1]-a[1]).slice(0, state.policy?.summarizeTopKeywords ?? 8).map(([w])=>w);
      // Highlights: pick up to N short texts with highest access/recency
      const snippets = items
        .map(it => ({ it, score: (it.accessCount ?? 0) + recencyScore(now, it.lastAccessedAt ?? it.updatedAt ?? it.createdAt) }))
        .sort((a,b)=>b.score-a.score)
        .slice(0, state.policy?.summarizeMaxSnippets ?? 5)
        .map(x => x.it.text);
      const summaryText = `Keywords: ${topKeywords.join(", ")} | Highlights: ${snippets.join(" | ")}`;
      const id = toId();
      const reflection: MemoryItem = {
        id,
        type: "reflection",
        text: summaryText.slice(0, 400),
        tags: Array.from(tagSet).concat(["summary"]),
        importance: clamp01(items.reduce((s, it) => s + it.importance, 0) / items.length + 0.1),
        energy: clamp01(items.reduce((s, it) => s + it.energy, 0) / items.length),
        createdAt: now,
        updatedAt: now,
      };
      state.items[id] = reflection;
      for (const it of items) {
        // Edge from summary -> item and item -> summary
        for (const [from, to] of [[id, it.id], [it.id, id]] as const) {
          const existing = state.edges.find((e) => e.from === from && e.to === to && e.relation === "summarizes");
          if (existing) {
            existing.weight = clamp01(existing.weight + 0.2);
            existing.lastReinforcedAt = now;
          } else {
            state.edges.push({ from, to, relation: "summarizes", weight: 0.8, lastReinforcedAt: now });
          }
        }
      }
      state.history.push({ t: now, op: "summarize", args: { ids: items.map((i) => i.id), reflection: id } });
      if (state.history.length > HISTORY_CAP) state.history.splice(0, state.history.length - HISTORY_CAP);
      return reflection;
    }

    this.registerFunction(
      "summarize",
      "Create a reflection summarizing given items: (summarize (list ids...))",
      [z.array(z.string())],
      async (ids: string[]) => {
        const state = await getMemory();
        const result = await createReflection(state, ids);
        await persist();
        this.invalidateManifest();
        return result;
      },
    );

    // Consolidate: (consolidate)
    this.registerFunction(
      "consolidate",
      "Cluster and downsample old events; create summaries; prune TTL-expired",
      [],
      async () => {
        const state = await getMemory();
        const now = Date.now();

        // Step 1: TTL expiration for low-energy items
        let removedByTTL = 0;
        const toRemove = new Set<string>();
        for (const it of Object.values(state.items)) {
          const ttlMs = parseDuration(it.ttl || "");
          if (ttlMs > 0 && now - it.createdAt > ttlMs && it.energy < 0.05) {
            toRemove.add(it.id);
          }
        }
        removedByTTL = toRemove.size;

        // Step 2: Semantic groups via co-activation graph (above weight threshold)
        const wMin = state.policy?.clusterEdgeMinWeight ?? 0.2;
        const neighbors = new Map<string, string[]>();
        for (const e of state.edges) {
          if (e.relation !== "co-activated") continue;
          if (e.weight < wMin) continue;
          if (!neighbors.has(e.from)) neighbors.set(e.from, []);
          if (!neighbors.has(e.to)) neighbors.set(e.to, []);
          neighbors.get(e.from)!.push(e.to);
          neighbors.get(e.to)!.push(e.from);
        }
        // Find connected components among old items only
        const visited = new Set<string>();
        const groups: MemoryItem[][] = [];
        const THIRTY_DAYS = 30 * 86_400_000;
        const itemsArr = Object.values(state.items).filter((it)=> it.type === "event" && (now - it.createdAt) >= THIRTY_DAYS);
        const itemSet = new Set(itemsArr.map(i=>i.id));
        for (const it of itemsArr) {
          if (visited.has(it.id)) continue;
          // BFS
          const queue = [it.id];
          visited.add(it.id);
          const comp: string[] = [];
          while (queue.length) {
            const cur = queue.shift()!;
            comp.push(cur);
            for (const nb of neighbors.get(cur) ?? []) {
              if (!visited.has(nb) && itemSet.has(nb)) {
                visited.add(nb);
                queue.push(nb);
              }
            }
          }
          groups.push(comp.map(id=>state.items[id]).filter(Boolean));
        }

        // Step 3: For large groups, create a summary and downsample
        let createdSummaries = 0;
        let removedEvents = 0;
        const minSize = state.policy?.clusterMinSize ?? 10;
        const keepRecent = state.policy?.clusterKeepRecent ?? 5;
        for (const items of groups) {
          if (items.length <= minSize) continue;
          // Create a summary reflection
          const ids = items.map((i) => i.id);
          await createReflection(state, ids);
          createdSummaries++;
          // Keep the 5 most recent, remove the rest
          items.sort((a, b) => b.createdAt - a.createdAt);
          const victims = items.slice(keepRecent);
          for (const v of victims) toRemove.add(v.id);
        }

        // Apply removals
        if (toRemove.size > 0) {
          // Remove edges incident to removed nodes
          state.edges = state.edges.filter((e) => !toRemove.has(e.from) && !toRemove.has(e.to));
          for (const id of toRemove) delete state.items[id];
          removedEvents += toRemove.size - removedByTTL;
        }

        const nowT = Date.now();
        state.history.push({
          t: nowT,
          op: "consolidate",
          args: { removedByTTL, createdSummaries, removedEvents },
        });
        if (state.history.length > HISTORY_CAP) state.history.splice(0, state.history.length - HISTORY_CAP);
        await persist();
        this.invalidateManifest();
        return { removedByTTL, createdSummaries, removedEvents };
      },
    );

    // Feedback: (feedback id outcome) where outcome is 'success' or 'fail'
    this.registerFunction(
      "feedback",
      "Provide retrieval feedback for an item: (feedback id outcome)",
      [z.string(), z.string()],
      async (id: string, outcome: string) => {
        // Use Graphiti if available
        const graphiti = await getGraphitiMemory();
        if (graphiti) {
          const oc = outcome.toLowerCase();
          const feedbackOutcome = (oc === "success" || oc === "help-success" || oc === "growth-success") ? "success" : "fail";
          await graphiti.feedback(id, feedbackOutcome);
          // Return a compatible response
          return { updated: true, id, success: 0, fail: 0, importance: 0.5 };
        }
        
        // Fallback to file-based memory
        const state = await getMemory();
        const it = state.items[id];
        if (!it) return { updated: false, reason: "not-found" };
        const prevImportance = it.importance;
        const oc = outcome.toLowerCase();
        let succDelta = 0; let failDelta = 0;
        if (oc === "success" || oc === "help-success") {
          it.success = (it.success ?? 0) + 1;
          it.importance = clamp01(it.importance + 0.02);
          succDelta = 1;
          if (oc === "help-success") it.helpSuccess = (it.helpSuccess ?? 0) + 1;
        } else if (oc === "fail" || oc === "help-fail") {
          it.fail = (it.fail ?? 0) + 1;
          it.importance = clamp01(it.importance - 0.01);
          failDelta = 1;
          if (oc === "help-fail") it.helpFail = (it.helpFail ?? 0) + 1;
        } else if (oc === "growth-success") {
          it.growthSuccess = (it.growthSuccess ?? 0) + 1;
          succDelta = 1;
        } else if (oc === "growth-fail") {
          it.growthFail = (it.growthFail ?? 0) + 1;
          failDelta = 1;
        }
        it.updatedAt = Date.now();
        // Attribute feedback to most recent session containing this item
        const sessions = (state.recentSessions ?? []).slice().reverse();
        const session = sessions.find((s) => s.type === "recall" && s.items.includes(id));
        if (session) {
          // Update session counters
          session.succ = (session.succ ?? 0) + succDelta;
          session.fail = (session.fail ?? 0) + failDelta;
          if (oc.startsWith("help-")) {
            if (succDelta) session.helpSucc = (session.helpSucc ?? 0) + succDelta;
            if (failDelta) session.helpFail = (session.helpFail ?? 0) + failDelta;
          }
          if (oc.startsWith("growth-")) {
            if (succDelta) session.growthSucc = (session.growthSucc ?? 0) + succDelta;
            if (failDelta) session.growthFail = (session.growthFail ?? 0) + failDelta;
          }
        }
        if (session && session.policyIds) {
          state.policyVersions = state.policyVersions ?? [];
          for (const key of Object.keys(session.policyIds) as PolicyName[]) {
            const verId = session.policyIds[key];
            if (!verId) continue;
            let v = state.policyVersions.find((x) => x.id === verId && x.name === key);
            if (!v) {
              // Create a stub entry to start tracking
              const code = key === "decay" ? state.policy?.decayFn : key === "recall-score" ? state.policy?.recallScoreFn : state.policy?.explorationFn;
              state.policyVersions.push({ id: verId, name: key, code: code ?? "", createdAt: Date.now(), success: 0, fail: 0 });
              v = state.policyVersions[state.policyVersions.length - 1];
            }
            v.success += succDelta;
            v.fail += failDelta;
          }
          if ((state.policyVersions?.length ?? 0) > 200) state.policyVersions!.splice(0, state.policyVersions!.length - 200);
        }
        state.history.push({ t: Date.now(), op: "feedback", args: { id, outcome, before: Number(prevImportance.toFixed(2)), after: Number(it.importance.toFixed(2)) } });
        if (state.history.length > HISTORY_CAP) state.history.splice(0, state.history.length - HISTORY_CAP);
        await persist();
        this.invalidateManifest();
        return { updated: true, id, success: it.success ?? 0, fail: it.fail ?? 0, importance: it.importance };
      },
    );

    // Find convergent patterns: (find-convergent-patterns keyword min-scopes)
    this.registerFunction(
      "find-convergent-patterns",
      "Find patterns that appear across multiple agent scopes (cross-architecture convergence): (find-convergent-patterns keyword min-scopes)\n  Returns patterns containing keyword that appear in >= min-scopes different agent scopes.\n  Evidence of independent discovery across architectures.",
      [z.string(), z.number()],
      async (keyword: string, minScopes: number) => {
        const state = await getMemory();
        const q = keyword.toLowerCase();

        // Find all items matching keyword
        const matches = Object.values(state.items)
          .filter(it => it.text.toLowerCase().includes(q) || it.tags.some(tag => tag.toLowerCase().includes(q)));

        // Group by scope
        const byScope = new Map<string, MemoryItem[]>();
        for (const item of matches) {
          const scope = item.scope || "global";
          if (!byScope.has(scope)) byScope.set(scope, []);
          byScope.get(scope)!.push(item);
        }

        // Find patterns (keywords/concepts) that appear across multiple scopes
        type Pattern = { text: string; scopes: string[]; items: string[]; importance: number };
        const patterns = new Map<string, Pattern>();

        // Extract significant tokens from each item
        const tokenize = (text: string) =>
          text.toLowerCase()
            .split(/[^a-z0-9_\-]+/g)
            .filter(w => w.length >= 4); // Significant tokens only

        for (const [scope, items] of byScope.entries()) {
          for (const item of items) {
            const tokens = tokenize(item.text);
            for (const token of tokens) {
              if (!token.includes(q.toLowerCase())) continue; // Must relate to keyword

              if (!patterns.has(token)) {
                patterns.set(token, {
                  text: token,
                  scopes: [],
                  items: [],
                  importance: 0
                });
              }

              const p = patterns.get(token)!;
              if (!p.scopes.includes(scope)) p.scopes.push(scope);
              if (!p.items.includes(item.id)) p.items.push(item.id);
              p.importance = Math.max(p.importance, item.importance);
            }
          }
        }

        // Filter to patterns appearing in >= minScopes
        const convergent = Array.from(patterns.values())
          .filter(p => p.scopes.length >= minScopes)
          .sort((a, b) => {
            // Sort by: scope count desc, then importance desc
            if (b.scopes.length !== a.scopes.length) return b.scopes.length - a.scopes.length;
            return b.importance - a.importance;
          })
          .slice(0, 20); // Top 20

        return {
          keyword,
          minScopes,
          totalScopes: byScope.size,
          convergentPatterns: convergent.length,
          patterns: convergent.map(p => ({
            pattern: p.text,
            scopeCount: p.scopes.length,
            scopes: p.scopes,
            items: p.items.slice(0, 5), // First 5 item IDs
            maxImportance: p.importance
          }))
        };
      },
    );

    return async () => {};
  }

  // Manifest fast-path helpers
  private getCachedState(): MemoryState | null { return memory; }
  private invalidateManifest() { manifestCache = null; }

  private formatManifest(state: MemoryState): string {
    const itemsArr = Object.values(state.items);
    const n = itemsArr.length;
    const m = state.edges.length;
    const avgDegree = n > 0 ? (2 * m) / n : 0;
    const statsLine = `Memory: ${n} items, ${m} edges (${avgDegree.toFixed(1)} avg degree), energy ${state.energy.toFixed(2)}/${state.threshold}`;

    const communities = this.detectCommunities(state);
    const commLine = communities
      .slice(0, 5)
      .map((c) => `[${c.label}: ${c.size} items, ${c.topKeywords.slice(0, 3).join('/')}]`)
      .join(', ');

    const temporal = this.classifyTemporal(state);
    const temporalLine = `Active: ${temporal.active.join(', ')} | Stable: ${temporal.stable.join(', ')} | Emerging: ${temporal.emerging.join(', ')} | Decaying: ${temporal.decaying.join(', ')}`;

    const keyNodes = this.findKeyNodes(state);
    const keyLine = keyNodes
      .map((k) => `"${k.text}" (${k.importance.toFixed(2)} importance, ${k.accesses} accesses)`)
      .join(', ');

    const topo = this.computeTopology(state, communities);
    const topoLine = `Topology: ${topo.densityLabel} density (${topo.density.toFixed(2)}), ${topo.clusteringLabel} clustering (${topo.clustering.toFixed(2)}), bridge: ${topo.bridgeLabel}`;

    const recent = this.recentPatternRich(state);
    const recentLine = `Recent: ${recent}`;

    // Add actual memory content previews - mix of recent and important
    const itemsArray = Object.values(state.items);

    // Get 3 most recent
    const recentItems = itemsArray
      .sort((a, b) => b.lastAccessedAt - a.lastAccessedAt)
      .slice(0, 3);

    // Get 2 most important that aren't already in recent
    const importantItems = itemsArray
      .filter(item => !recentItems.includes(item))
      .sort((a, b) => (b.importance * b.accessCount) - (a.importance * a.accessCount))
      .slice(0, 2);

    const previewItems = [...recentItems, ...importantItems]
      .map(item => {
        const text = item.text.length > 100 ? item.text.substring(0, 97) + '...' : item.text;
        const tags = item.tags?.length ? ` [${item.tags.slice(0, 2).join(',')}]` : '';
        return `• ${text}${tags}`;
      });

    const memoryPreviewLine = previewItems.length > 0
      ? `\n━━━ Memory Context ━━━\n${previewItems.join('\n')}`
      : '';

    return [statsLine, '', `Communities: ${commLine}`, '', temporalLine, '', `Key nodes: ${keyLine}`, '', topoLine, '', recentLine, memoryPreviewLine]
      .filter(Boolean)
      .join('\n');
  }

  private detectCommunities(state: MemoryState): Array<{ id: number; size: number; itemIds: string[]; label: string; topKeywords: string[] }> {
    // Build sparse graph from co-activation edges with dynamic threshold and top-K neighbor pruning
    const minWBase = state.policy?.clusterEdgeMinWeight ?? 0.2;
    const coEdges = state.edges.filter(e => e.relation === 'co-activated' && e.from !== e.to);
    if (coEdges.length === 0) {
      const all = Object.keys(state.items);
      const { label, topKeywords } = this.labelComponent(all, state, 'all');
      return [{ id: 0, size: all.length, itemIds: all, label, topKeywords }];
    }
    const weights = coEdges.map(e => e.weight).sort((a,b)=>a-b);
    const perc = state.policy?.clusterPercentile ?? 0.6;
    const thresh = weights[Math.floor(perc * (weights.length - 1))] || 0;
    const minW = Math.max(minWBase, thresh);

    // group neighbors by node
    const byNode = new Map<string, Array<{ id: string; w: number }>>();
    for (const e of coEdges) {
      if (e.weight < minW) continue;
      if (!byNode.has(e.from)) byNode.set(e.from, []);
      if (!byNode.has(e.to)) byNode.set(e.to, []);
      byNode.get(e.from)!.push({ id: e.to, w: e.weight });
      byNode.get(e.to)!.push({ id: e.from, w: e.weight });
    }
    const topK = state.policy?.neighborTopK ?? 3;
    const adjacency = new Map<string, Set<string>>();
    for (const [id, arr] of byNode.entries()) {
      arr.sort((a,b)=>b.w-a.w);
      const keep = arr.slice(0, topK).map(x => x.id);
      adjacency.set(id, new Set(keep));
    }
    for (const id of Object.keys(state.items)) if (!adjacency.has(id)) adjacency.set(id, new Set());

    // Label propagation to find communities
    const labels = new Map<string, string>();
    for (const id of Object.keys(state.items)) labels.set(id, id);
    const order = Object.keys(state.items);
    const maxIter = 10;
    for (let iter = 0; iter < maxIter; iter++) {
      let changes = 0;
      for (const id of order) {
        const neigh = Array.from(adjacency.get(id) ?? []);
        if (neigh.length === 0) continue;
        const counts = new Map<string, number>();
        for (const nb of neigh) {
          const lab = labels.get(nb)!;
          counts.set(lab, (counts.get(lab) || 0) + 1);
        }
        let bestLab = labels.get(id)!;
        let bestCount = -1;
        for (const [lab, cnt] of counts.entries()) {
          if (cnt > bestCount || (cnt === bestCount && lab < bestLab)) { bestLab = lab; bestCount = cnt; }
        }
        if (bestLab !== labels.get(id)) { labels.set(id, bestLab); changes++; }
      }
      if (changes === 0) break;
    }

    // Group by labels and merge tiny groups
    const groups = new Map<string, string[]>();
    for (const [id, lab] of labels.entries()) {
      if (!groups.has(lab)) groups.set(lab, []);
      groups.get(lab)!.push(id);
    }
    const entries = Array.from(groups.entries()).map(([lab, ids])=>({ lab, ids }));
    entries.sort((a,b)=>b.ids.length - a.ids.length);
    const large: Array<{ lab: string; ids: string[] }> = [];
    const small: Array<{ lab: string; ids: string[] }> = [];
    for (const g of entries) (g.ids.length >= 3 ? large : small).push(g);
    for (const s of small) {
      // attach to most connected large group
      let bestIdx = -1; let bestConn = -1;
      for (let i=0;i<large.length;i++) {
        let conn = 0;
        for (const id of s.ids) for (const nb of adjacency.get(id) ?? []) if (large[i].ids.includes(nb)) conn++;
        if (conn > bestConn) { bestConn = conn; bestIdx = i; }
      }
      if (bestIdx >= 0) large[bestIdx].ids.push(...s.ids); else large.push(s);
    }

    large.sort((a,b)=>b.ids.length - a.ids.length);
    const kept = large.slice(0, 6);
    const restIds = large.slice(6).flatMap(g=>g.ids);

    const communities: Array<{ id: number; size: number; itemIds: string[]; label: string; topKeywords: string[] }> = [];
    let idx = 0;
    for (const g of kept) {
      const { label, topKeywords } = this.labelComponent(g.ids, state);
      communities.push({ id: idx++, size: g.ids.length, itemIds: g.ids, label, topKeywords });
    }
    if (restIds.length > 0) {
      const { label, topKeywords } = this.labelComponent(restIds, state, 'isolated');
      communities.push({ id: idx, size: restIds.length, itemIds: restIds, label, topKeywords });
    }
    return communities;
  }

  private labelComponent(itemIds: string[], state: MemoryState, fallback = 'isolated'): { label: string; topKeywords: string[] } {
    const STOP = new Set(['the','a','an','and','or','of','to','in','on','for','with','by','is','are','was','were','it','this','that','as','at','be']);
    const wordFreq = new Map<string, number>();
    const tagFreq = new Map<string, number>();
    const now = Date.now();
    for (const id of itemIds) {
      const it = state.items[id];
      if (!it) continue;
      for (const t of it.tags) tagFreq.set(t, (tagFreq.get(t) || 0) + 1);
      const weight = (it.accessCount ?? 0) + 1 + recencyScore(now, it.lastAccessedAt ?? it.updatedAt ?? it.createdAt) + 0.5 * it.importance;
      const words = it.text.toLowerCase().split(/[^a-z0-9_\-]+/g).filter(Boolean);
      for (const w of words) {
        if (w.length < 3 || STOP.has(w)) continue;
        wordFreq.set(w, (wordFreq.get(w) || 0) + weight);
      }
    }
    const topWords = Array.from(wordFreq.entries()).sort((a,b)=>b[1]-a[1]).slice(0, 4).map(([w])=>w);
    const topTags = Array.from(tagFreq.entries()).sort((a,b)=>b[1]-a[1]).slice(0, 2).map(([t])=>t);
    const label = topWords.length > 0 ? `${topWords.slice(0,2).join('/')}${topTags.length?` (tags: ${topTags.join('/')})`:''}` : fallback;
    return { label, topKeywords: topWords };
  }

  private classifyTemporal(state: MemoryState) {
    const now = Date.now();
    const emerging: string[] = [];
    const active: string[] = [];
    const stable: string[] = [];
    const decayingList: string[] = [];
    for (const it of Object.values(state.items)) {
      const head = (s: string) => (s.length > 40 ? s.slice(0, 40) + '…' : s);
      if (now - it.createdAt <= 60 * 60 * 1000) emerging.push(head(it.text));
      if (now - (it.lastAccessedAt ?? 0) <= 24 * 60 * 60 * 1000) active.push(head(it.text));
      if (now - (it.updatedAt) > 7 * 24 * 60 * 60 * 1000 && now - (it.lastAccessedAt ?? 0) > 7 * 24 * 60 * 60 * 1000) stable.push(head(it.text));
      if ((now - (it.lastAccessedAt ?? it.updatedAt)) > 10 * 24 * 60 * 60 * 1000 && (it.energy ?? 0) < 0.05) decayingList.push(head(it.text));
    }
    return {
      emerging: emerging.slice(0, 3),
      active: active.slice(0, 3),
      stable: stable.slice(0, 3),
      decaying: decayingList.slice(0, 3),
    } as { emerging: string[]; active: string[]; stable: string[]; decaying: string[] };
  }

  private findKeyNodes(state: MemoryState) {
    const itemsArr = Object.values(state.items);
    if (itemsArr.length === 0) return [] as Array<{ id: string; text: string; importance: number; accesses: number }>;
    const degree = new Map<string, number>();
    for (const e of state.edges) {
      degree.set(e.from, (degree.get(e.from) || 0) + 1);
      degree.set(e.to, (degree.get(e.to) || 0) + 1);
    }
    const maxImp = Math.max(...itemsArr.map((i) => i.importance));
    const maxAcc = Math.max(1, ...itemsArr.map((i) => i.accessCount ?? 0));
    const maxDeg = Math.max(1, ...itemsArr.map((i) => degree.get(i.id) ?? 0));
    const scored = itemsArr.map((it) => {
      const imp = maxImp ? it.importance / maxImp : it.importance;
      const acc = (it.accessCount ?? 0) / maxAcc;
      const deg = (degree.get(it.id) ?? 0) / maxDeg;
      const score = 0.5 * imp + 0.3 * acc + 0.2 * deg;
      return { it, score };
    }).sort((a,b)=>b.score-a.score).slice(0,5).map(({it})=>({ id: it.id, text: (it.text.length>60? it.text.slice(0,60)+'…': it.text), importance: it.importance, accesses: it.accessCount ?? 0 }));
    return scored;
  }

  private computeTopology(state: MemoryState, communities: Array<{ itemIds: string[]; id: number }>) {
    const n = Object.keys(state.items).length;
    // Compute undirected unique edges for density to avoid double-counting
    const edgeSet = new Set<string>();
    for (const e of state.edges) {
      const a = e.from < e.to ? e.from : e.to;
      const b = e.from < e.to ? e.to : e.from;
      edgeSet.add(`${a}|${b}`);
    }
    const m = edgeSet.size;
    const density = n > 1 ? m / (n * (n - 1) / 2) : 0;
    const densityLabel = density < 0.1 ? 'sparse' : density < 0.3 ? 'medium' : 'dense';

    const adjacency = new Map<string, Set<string>>();
    for (const e of state.edges) {
      if (!adjacency.has(e.from)) adjacency.set(e.from, new Set());
      if (!adjacency.has(e.to)) adjacency.set(e.to, new Set());
      adjacency.get(e.from)!.add(e.to);
      adjacency.get(e.to)!.add(e.from);
    }
    const ids = Object.keys(state.items);
    const sample = ids.slice(0, Math.min(200, ids.length));
    let sum = 0; let count = 0;
    for (const id of sample) {
      const neigh = Array.from(adjacency.get(id) ?? []);
      const k = neigh.length;
      if (k < 2) continue;
      let triangles = 0;
      for (let i = 0; i < k; i++) {
        for (let j = i + 1; j < k; j++) {
          const a = neigh[i], b = neigh[j];
          if (adjacency.get(a)?.has(b)) triangles++;
        }
      }
      const possible = k * (k - 1) / 2;
      sum += triangles / possible;
      count++;
    }
    const clustering = count > 0 ? sum / count : 0;
    const clusteringLabel = clustering < 0.2 ? 'low' : clustering < 0.6 ? 'medium' : 'high';

    const compIndex = new Map<string, number>();
    for (const c of communities) for (const id of c.itemIds) compIndex.set(id, c.id);
    let best: { from: string; to: string; w: number } | null = null;
    for (const e of state.edges) {
      const c1 = compIndex.get(e.from);
      const c2 = compIndex.get(e.to);
      if (c1 === undefined || c2 === undefined || c1 === c2) continue;
      if (!best || e.weight > best.w) best = { from: e.from, to: e.to, w: e.weight };
    }
    const bridgeLabel = best ? `${(state.items[best.from]?.text || best.from).slice(0,18)}↔${(state.items[best.to]?.text || best.to).slice(0,18)} (${best.w.toFixed(2)})` : 'n/a';
    return { density, densityLabel, clustering, clusteringLabel, bridgeLabel };
  }

  private recentPattern(state: MemoryState): string {
    const h = state.history[state.history.length - 1];
    if (!h) return 'idle';
    if (h.op === 'recall' && h.args?.query) return `recall "${h.args.query}" → ${h.args.count ?? '?'} items`;
    if (h.op === 'remember' && h.args?.id) return `remember ${h.args.id}`;
    if (h.op === 'associate' && h.args) return `associate ${h.args.from}→${h.args.to}`;
    if (h.op === 'summarize') return `summarize ${h.args?.ids?.length ?? 0} items`;
    if (h.op === 'consolidate') return `consolidate (${h.args?.removedEvents ?? 0} pruned)`;
    if (h.op === 'feedback') return `feedback ${h.args?.outcome ?? ''}`;
    return `${h.op}`;
  }

  private recentPatternRich(state: MemoryState): string {
    const h = state.history[state.history.length - 1];
    if (!h) return 'idle';
    if (h.op === 'recall' && h.args?.query) {
      const created = h.args?.createdEdges ?? 0;
      const reinforced = h.args?.reinforcedEdges ?? 0;
      const before = h.args?.avgWeightBefore;
      const after = h.args?.avgWeightAfter;
      const cluster = h.args?.cluster ? ` in ${h.args.cluster} cluster` : '';
      const weights = (typeof before === 'number' && typeof after === 'number') ? ` (${before}→${after} avg weight)` : '';
      return `recall \"${h.args.query}\" → ${h.args.count ?? '?'} items; created ${created} new connections, reinforced ${reinforced}${weights}${cluster}`;
    }
    if (h.op === 'remember' && h.args?.id) return `remember ${h.args.id}`;
    if (h.op === 'associate' && h.args) {
      const mode = h.args.created ? 'created' : 'reinforced';
      const weights = (typeof h.args.before === 'number' && typeof h.args.after === 'number') ? ` (${h.args.before}→${h.args.after})` : '';
      return `associate ${h.args.from}→${h.args.to}; ${mode} connection${weights}`;
    }
    if (h.op === 'summarize') return `summarize ${h.args?.ids?.length ?? 0} items`;
    if (h.op === 'consolidate') return `consolidate (${h.args?.removedEvents ?? 0} pruned)`;
    if (h.op === 'feedback') {
      const before = h.args?.before; const after = h.args?.after;
      const weights = (typeof before === 'number' && typeof after === 'number') ? `; importance ${before}→${after}` : '';
      const cluster = h.args?.cluster ? `; strengthened ${h.args.cluster} community` : '';
      return `feedback ${h.args?.outcome ?? ''} on ${h.args?.id ?? ''}${weights}${cluster}`;
    }
    return `${h.op}`;
  }

  // Optional enrichment (disabled unless provider + env flag are set)
  private async enrichManifestWithLLM(
    communities: Array<{ id: number; size: number; itemIds: string[]; label: string; topKeywords: string[] }>,
    state: MemoryState,
  ): Promise<void> {
    try {
      const enabled = (typeof process !== 'undefined' && (process as any)?.env?.ENABLE_LLM_ENRICHMENT === 'true');
      if (!enabled || !llmProvider) return;
      const prompts: string[] = [];
      for (const c of communities) {
        const texts = c.itemIds
          .slice(0, 5)
          .map((id) => (state.items[id]?.text || id).slice(0, 120))
          .filter(Boolean);
        if (texts.length === 0) continue;
        prompts.push(`What connects these thoughts: ${texts.join('; ')}`);
      }
      if (prompts.length === 0) return;
      const summaries = await llmProvider.batchSummarize(prompts);
      const enriched = this.formatEnrichedManifest(state, communities, summaries);
      if (manifestCache) {
        manifestCache = { ...manifestCache, enriched };
      }
    } catch {
      // ignore enrichment failures
    }
  }

  private formatEnrichedManifest(
    state: MemoryState,
    communities: Array<{ id: number; size: number; itemIds: string[]; label: string; topKeywords: string[] }>,
    summaries: string[],
  ): string {
    const itemsArr = Object.values(state.items);
    const n = itemsArr.length;
    const m = state.edges.length;
    const avgDegree = n > 0 ? (2 * m) / n : 0;
    const statsLine = `Memory: ${n} items, ${m} edges (${avgDegree.toFixed(1)} avg degree), energy ${state.energy.toFixed(2)}/${state.threshold}`;

    const commLines = communities.slice(0, summaries.length).map((c, i) => {
      const insight = (summaries[i] || '').trim().slice(0, 100);
      return `[${c.label}: ${c.size} items — ${insight || c.topKeywords.slice(0,3).join('/')}]`;
    }).join(', ');
    const communitiesLine = `Communities: ${commLines}`;

    const temporal = this.classifyTemporal(state);
    const temporalLine = `Active: ${temporal.active.join(', ')} | Stable: ${temporal.stable.join(', ')} | Emerging: ${temporal.emerging.join(', ')} | Decaying: ${temporal.decaying.join(', ')}`;

    const keyNodes = this.findKeyNodes(state);
    const keyLine = keyNodes
      .map((k) => `"${k.text}" (${k.importance.toFixed(2)} importance, ${k.accesses} accesses)`).join(', ');

    const topo = this.computeTopology(state, communities);
    const topoLine = `Topology: ${topo.densityLabel} density (${topo.density.toFixed(2)}), ${topo.clusteringLabel} clustering (${topo.clustering.toFixed(2)}), bridge: ${topo.bridgeLabel}`;

    const recent = this.recentPattern(state);
    const recentLine = `Recent: ${recent}`;

    return [statsLine, '', communitiesLine, '', temporalLine, '', `Key nodes: ${keyLine}`, '', topoLine, '', recentLine]
      .filter(Boolean)
      .join('\n');
  }
}
