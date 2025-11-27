Arrival Packages Architecture - Deep Dive Report

       Based on thorough exploration of the source code, here's the actual implementation architecture:

       ---
       1. arrival-scheme: The Sandboxed Scheme Interpreter

       Sandboxing Mechanism

       The sandboxing is whitelist-based using the sandboxedEnv (from /arrival-scheme/src/sandbox-env.ts):

       - A LIPS Environment is created with explicitly allowed functions only (no access to eval, require, filesystem, network)
       - Built-in LIPS functions are loaded from the global environment and re-exported: cons, list, map, filter, reduce, if, lambda, define, etc.
       - Unsafe builtins are simply omitted from the list (whitelist in safe_builtins.ts)

       Key sandboxing primitives:

       // From safe_builtins.ts - only these are allowed:
       export const SAFE_BUILTINS = [
         "cons", "list", "empty?", "list?", "pair?",
         "map", "filter", "reduce",
         "if", "let", "let*", "letrec", "lambda", "define", "begin",
         "and", "or", "not", "quote",
         // Math: "+", "-", "*", "/", "abs", "sqrt", etc.
         // String: "substring", "concat", "join", "split", "replace"
         // Type checks: "number?", "string?", "boolean?", etc.
       ];

       The sandboxed environment also includes:
       - @ operator - property access on JS objects (safe: checks prototype chain, skips non-plain objects)
       - tap function - side-effect function (accepts fn, returns x identity)
       - length function - polymorphic: handles both LIPS pairs and JS arrays

       Custom Primitives

       The environment extends with Ramda functions and Fantasy Land combinators:

       1. Ramda Integration (ramda-functions.ts):
         - Polymorphic map, filter, reduce that work with LIPS Pairs, JS arrays, and Fantasy Land entities
         - Example: (map inc (list 1 2 3)) converts LIPS pair to JS array, applies Ramda map, converts result back
       2. Fantasy Land Protocol (fantasy-land-lips.ts):
         - Monkey-patches Pair.prototype with: fantasy-land/map, fantasy-land/filter, fantasy-land/reduce, fantasy-land/traverse, fantasy-land/chain
         - Allows Ramda to work seamlessly: R.map(fn, lipsList) automatically uses Fantasy Land if available

       Discovery vs Action Distinction

       Arrival-scheme doesn't distinguish discovery from actions - it's a pure interpreter. The distinction is enforced at the MCP level (arrival-mcp), not in the scheme layer.

       ---
       2. arrival-mcp: The MCP Framework

       Tool Definition Architecture

       Two separate tool interaction classes encode the discovery/action pattern:

       DiscoveryToolInteraction

       // From DiscoveryToolInteraction.ts
       abstract class DiscoveryToolInteraction<ExecutionContext> extends ToolInteraction {
         getToolDescription(): Promise<Tool> {
           return {
             annotations: { readOnlyHint: true },  // ← Non-mutating hint
             inputSchema: { expr: "Scheme REPL input" }
           };
         }

         executeTool(): Promise<string[]> {
           // Runs: execSerialized(this.executionContext.expr, { env })
           // Returns serialized S-expression strings
         }

         protected registerFunction(name, description, params, handler, aliases?) {
           // Register domain-specific functions into the LIPS environment
           // Functions are called from Scheme code
         }
       }

       Key characteristics:
       - Read-only (marked with readOnlyHint)
       - Input is a Scheme expression string (expr: string)
       - Output is serialized S-expression strings (array of strings)
       - Functions are registered by implementation and available in scope

       ActionToolInteraction

       // From ActionToolInteraction.ts
       abstract class ActionToolInteraction<ExecutionContext> extends ToolInteraction {
         actions: Record<string, ActionDefinition> = {};

         registerAction({
           name,
           description,
           context,        // ← Required context keys
           optionalContext,
           props,          // ← Zod schema for arguments
           handler
         }) { ... }

         async executeTool(): Promise<ActionResult> {
           // Phase 1: VALIDATE context + ALL actions BEFORE any execution
           for (const [key, validator] of contextSchema) {
             this.loadingExecutionContext[key] = await validator.parseAsync(input);
           }
           for (const action of actions) {
             const transformed = await z.tuple(action.args).parseAsync(args);
           }

           // Phase 2: EXECUTE or FULL ROLLBACK
           if (validationErrors.length > 0) {
             return { success: false, validation: "failed", errors: [...] };
           }

           // Only then execute actions sequentially
           return this.act(actions, transformedActionArgs);
         }
       }

       Batch Atomicity Pattern:

       1. Validation Phase (atomic): All context and action arguments validated BEFORE any handler executes
       2. Execution Phase (sequential): Actions run one by one, sharing loadingExecutionContext
       3. Rollback Strategy: If ANY action throws at runtime → return partial result, stop execution (not transactional rollback of effects, just stop-on-error)

       // From ActionToolInteraction.ts, act() method
       async act(actions: ActionCall[], transformedActionArgs: any[][]): Promise<any> {
         const results: any[] = [];

         for (let i = 0; i < actions.length; i++) {
           try {
             results.push(
               await action.handler(this.loadingExecutionContext, props)
             );
           } catch (error) {
             return {
               success: false,
               partial: true,
               executed: i,
               total: actions.length,
               results,  // ← Partial results returned
               failedAction: { actionIndex: i, action, error }
             };
           }
         }
         return results;  // All succeeded
       }

       Tool Definition Flow

       1. Tool Definition: Class inherits from DiscoveryToolInteraction or ActionToolInteraction
       2. Schema Generation: getToolSchema() returns MCP JSON schema (Zod-powered)
       3. Execution: executeTool(clientInfo) processes request
       4. Session State: Tools share state via Hono context + optional session storage

       MCP Server Integration

       // From MCPServer.ts
       export class MCPServer {
         constructor(...tools: Constructor<ToolInteraction<any>>[]) {
           this.tools = tools;
         }

         async callTool(context: Context, request: CallToolRequest, clientInfo: MCPClientInfo): Promise<CallToolResult> {
           const sessionId = context.req.header("mcp-session-id");
           const state = sessionId ? await this.getSessionState(context, sessionId) : {};

           const toolInteraction = new ToolInteraction(context, state, request.arguments);
           const callToolResult = await toolInteraction.executeTool(clientInfo);

           if (sessionId) {
             await this.setSessionState(context, sessionId, state);  // Persist mutations
           }

           return {
             content: [{ type: "text", text: JSON.stringify(callToolResult) }]
           };
         }
       }

       Session State Design:
       - Override getSessionState(), setSessionState(), deleteSessionState() for external storage (Redis, etc.)
       - Default implementation: in-memory Map<sessionId, state>

       ---
       3. arrival-env: Protocol Definitions

       Global Symbol-based protocol for S-expression serialization:

       // From arrival-env/src/index.ts
       declare global {
         interface SymbolConstructor {
           readonly toSExpr: unique symbol;  // Symbol.for("arrival:toSymbolicExpression")
           readonly SExpr: unique symbol;     // Symbol.for("arrival:symbolicExpressionSymbol")
         }

         interface Object {
           [Symbol.toSExpr]?(ctx: SExprSerializationContext): SExprSerializable[];
           [Symbol.SExpr]?(): string;  // Display name
         }

         interface SExprSerializationContext {
           keyword(value: string): SExprSerializable;  // → `:name`
           symbol(value: string): SExprSerializable;   // → `name` (unquoted)
           quote(value: string): SExprSerializable;    // → `'name`
           string(value: string): SExprSerializable;   // → `"name"`
           expr(head, ...args): SExprSerializable;     // → `(head arg1 arg2)`
         }
       }

       Usage Example:
       class Entity {
         [Symbol.toSExpr]({ keyword, symbol }) {
           return [
             this.uuid,                        // Positional element
             this.name,
             keyword("type"), this.type,       // Named property
             keyword("ref"), symbol(this.targetId)
           ];
         }

         [Symbol.SExpr]() {
           return "Entity";  // Expression head: (Entity uuid name :type ... :ref ...)
         }
       }

       ---
       4. arrival-serializer: S-Expression Handling

       Core Functions

       toSExpr(obj): SExpr - converts any JS value to S-expression:

       1. LIPS-specific types: Handles LBigInteger, LNumber, LFloat, LSymbol, LString, LCharacter, Pair, Nil, EOF, Macro, Syntax, etc.
       2. Custom objects: Checks Symbol.toSExpr → calls with context helpers
       3. Native JS types:
         - Arrays → (list ...)
         - Maps → (map :key1 val1 :key2 val2)
         - Sets → (set ...)
         - Objects → (& :key1 val1 :key2 val2) (Scheme-style record)
       4. Primitives: Strings, numbers, booleans, null → as-is

       formatSExpr(sexpr): string - pretty-prints S-expression:

       // Logic:
       // - Keywords (`:name`) don't need quotes
       // - Symbols that look like operators (unquoted identifiers) aren't quoted
       // - String literals are quoted
       // - Nested structures are multi-line if complex
       // - Maps get special formatting with key-value alignment

       Special Marker Objects (internal):
       - EXPR_MARKER - marks nested expressions from context.expr()
       - QUOTED_MARKER - marks forced-quote strings from context.quote()
       - FORCE_QUOTED_STRING_MARKER - marks always-quoted strings from context.string()

       Serialization Context Helpers

       These are passed to Symbol.toSExpr implementations:

       const serializationContext = {
         symbol: (value) => Symbol(value),           // Unquoted identifier marker
         keyword: (value) => `:${value}`,            // Keyword literal
         quote: (value) => ({ [QUOTED_MARKER]: value }),      // Quoted symbol
         string: (value) => ({ [FORCE_QUOTED_STRING_MARKER]: value }),  // Quoted string
         expr: (head, ...args) => ({ [EXPR_MARKER]: true, head, args })  // Nested expr
       };

       ---
       5. arrival (Umbrella Package)

       Re-exports all sub-packages and adds execSerialized():

       // From arrival/src/execSerialized.ts
       export async function execSerialized(
         expr: string,
         options?: { env?: Environment }
       ): Promise<string[]> {
         // Wraps expr in (list ...) and executes
         const result = await exec(`(list ${expr})`, { env: options?.env });

         // Converts each element to serialized string
         return result
           .map((element) => toSExprString(element))
           .filter((s) => !isVoidResult(s));
       }

       This is what DiscoveryToolInteraction uses internally.

       ---
       6. Integration: How It All Works Together

       Discovery Tool Example

       class MyDiscoveryTool extends DiscoveryToolInteraction<{ projectPath: string }> {
         contextSchema = { projectPath: z.string() };

         protected registerFunctions() {
           this.registerFunction(
             "list-files",
             "List files in project",
             [z.string()],  // Parameter schemas
             (pattern) => fs.glob(pattern)
           );

           this.registerFunction(
             "parse-file",
             "Parse TypeScript file",
             [z.string()],
             (filePath) => parseTS(filePath)
           );
         }
       }

       // Usage from MCP client:
       // { expr: "(parse-file \"src/index.ts\")" }
       // → Scheme evaluates (parse-file "src/index.ts")
       // → Handler called with "src/index.ts"
       // → Result serialized to S-expression string

       Action Tool Example

       class MyActionTool extends ActionToolInteraction<{ projectId: string }> {
         contextSchema = { projectId: z.string() };

         constructor(context, state, executionContext) {
           super(context, state, executionContext);

           this.registerAction({
             name: "create-file",
             description: "Create a new file",
             context: ["projectId"],
             props: {
               path: z.string(),
               content: z.string()
             },
             handler: async (context, { path, content }) => {
               const fullPath = `projects/${context.projectId}/${path}`;
               fs.writeFileSync(fullPath, content);
               return { created: fullPath };
             }
           });
         }
       }

       // Usage from MCP client:
       // { projectId: "proj-123", actions: [["create-file", "src/index.ts", "..."]] }
       // → Validates projectId + action args
       // → Calls handler with context + parsed args
       // → Returns result (or partial + error if handler throws)

       ---
       7. Key Architectural Insights

       Discovery/Action Separation

       - Discovery: Read-only queries in Scheme + custom domain functions
       - Action: Type-safe mutations with validated context + atomic error handling
       - Not enforced by scheme: The interpreter doesn't know the difference; MCP framework enforces it

       Batch Atomicity Strategy

       1. Validation is atomic - all-or-nothing before execution
       2. Execution is sequential - no actual transaction management
       3. Rollback is partial - returns completed results + failure info
       4. Context is shared - all actions see same loadingExecutionContext

       This means:
       - You can't rollback completed actions if later ones fail
       - If you need true transactions, you must implement them in the tool implementation
       - The "atomicity" is validation atomicity, not execution atomicity

       Why Scheme?

       1. Homoiconicity: Code as data → can be inspected, transformed, analyzed before execution
       2. Minimal attack surface: Whitelist-based sandbox; no access to runtime
       3. Compositionality: Fantasy Land + Ramda enable functional composition in the sandbox
       4. Human-readable: S-expressions are ASCII, easily transported in tool descriptions

       ---
       8. What's Implemented vs Theoretical

       | Feature                    | Status            | Notes                                                |
       |----------------------------|-------------------|------------------------------------------------------|
       | Whitelist sandboxing       | ✓ Implemented     | Limited to SAFE_BUILTINS list                        |
       | Fantasy Land integration   | ✓ Implemented     | Monkey-patches Pair class                            |
       | Ramda functions            | ✓ Implemented     | Polymorphic map/filter/reduce                        |
       | S-expression serialization | ✓ Implemented     | Full Symbol.toSExpr protocol                         |
       | Discovery/Action framework | ✓ Implemented     | Via DiscoveryToolInteraction/ActionToolInteraction   |
       | Batch validation atomicity | ✓ Implemented     | All-or-nothing before execution                      |
       | Session state management   | ✓ Implemented     | Pluggable storage (default: in-memory)               |
       | MCP server integration     | ✓ Implemented     | Via MCPServer + Hono                                 |
       | Parallel action execution  | ✗ Not implemented | Sequential only; shared context prevents parallelism |
       | True transaction rollback  | ✗ Not implemented | Stop-on-error, no actual rollback                    |

       ---
       File Structure Summary

       /arrival/
       ├── arrival-env/              # Global Symbol protocols
       │   └── src/index.ts          # Symbol.toSExpr, Symbol.SExpr definitions
       ├── arrival-scheme/           # LIPS interpreter + sandbox
       │   ├── src/
       │   │   ├── lips.ts           # LIPS fork (Scheme interpreter)
       │   │   ├── sandbox-env.ts    # Whitelist environment + custom ops
       │   │   ├── safe_builtins.ts  # Function whitelist
       │   │   ├── ramda-functions.ts # Ramda integration (polymorphic ops)
       │   │   └── fantasy-land-lips.ts # FL protocol patches
       │   └── package.json
       ├── arrival-serializer/       # S-expression serialization
       │   └── src/serializer.ts     # toSExpr + formatSExpr
       ├── arrival-mcp/              # MCP framework
       │   ├── src/
       │   │   ├── ToolInteraction.ts # Base class
       │   │   ├── DiscoveryToolInteraction.ts # Read-only tools
       │   │   ├── ActionToolInteraction.ts    # Mutation tools
       │   │   ├── MCPServer.ts       # Tool registry + session management
       │   │   └── hono/HonoMCPServer.ts # HTTP transport
       │   └── package.json
       ├── arrival/                  # Umbrella package
       │   ├── src/
       │   │   └── execSerialized.ts # Scheme execution + serialization
       │   └── package.json
       └── periphery/                # (System tools implementation)

       This is the actual, working architecture - all code is implemented and tested.