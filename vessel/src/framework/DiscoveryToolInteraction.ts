import { Environment, execSerialized, sandboxedEnv } from "@singl/arrival";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import dedent from "dedent";
import invariant from "tiny-invariant";
import type { NonEmptyTuple } from "type-fest";
import * as z from "zod";

import { ToolInteraction } from "@/mcp-server/framework/ToolInteraction";

export interface DiscoveryQuery {
  expr: string;
}

interface RegisteredFunction {
  description: string;
  params: [] | NonEmptyTuple<z.ZodType>;
  handler: (...args: any[]) => any;
}

export abstract class DiscoveryToolInteraction<TT extends Record<string, any>> extends ToolInteraction<
  {
    expr: string;
  } & TT
> {
  private readonly MAX_EXECUTION_TIME = 5000; // 5 seconds
  readonly contextSchema: Record<string, z.ZodType> = {};
  private readonly functions = new Map<string, RegisteredFunction>();

  async getToolSchema(this: DiscoveryToolInteraction<TT>): Promise<Tool["inputSchema"]> {
    // Best-effort dynamic preview: register functions with a minimal context
    // so we can list them in the schema description for HTTP clients.
    try {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const cleanup = await this.registerFunctions({} as Omit<TT, "expr">);
      await cleanup?.();
    } catch {
      // Ignore preview errors; tools can still execute in-context later
    }

    return {
      type: "object",
      properties: {
        expr: {
          type: "string",
          description: dedent`
            S-expressions to evaluate in sandboxed Scheme environment.
            Batching is supported, so there can be multiple root function calls - each result will be returned.
            LIPS/Scheme environment and Ramda/Ramda-applicative implementing Fantasy-land specification are available.

            Use Fantasy Land combinators for compositional queries:
            - (fmap fn structure) - map over Functors
            - (chain structure fn) - flatMap for Monads
            - (filter predicate list) - filter with predicates
            - (compose f g) - function composition

            Domain-specific functions available in sandbox:
            ${this.getAvailableFunctions().join("\n")}
          `,
        },
        ...Object.fromEntries(
          Object.entries(this.contextSchema).map(([key, value]) => {
            const schema = z.toJSONSchema(value);
            return [
              key,
              {
                ...schema,
                // eslint-disable-next-line sonarjs/no-nested-template-literals
                description: `Context property${schema.description ? `. ${schema.description}` : ""}`,
              },
            ];
          }),
        ),
      },
      required: ["expr"],
    };
  }

  async executeTool({ expr, ...rest }: DiscoveryQuery & TT): Promise<string | string[]> {
    const timeoutRef = { current: false };
    const env = await this.createEnvironment(rest, timeoutRef);
    setTimeout(() => {
      timeoutRef.current = true;
    }, this.MAX_EXECUTION_TIME);

    // Use the new separate expressions executor that properly handles multiple expressions
    return execSerialized(expr, { env });
  }

  protected abstract registerFunctions(context: Omit<TT, "expr">): Promise<() => Promise<void>>;

  protected registerFunction<T extends [] | NonEmptyTuple<z.ZodType>>(
    name: string,
    description: string,
    params: T,
    handler: (...args: T extends [] ? [] : z.infer<z.ZodTuple<T, null>>) => any,
  ) {
    this.functions.set(name, { description, params, handler });
  }

  // Note: Manual conversion methods removed - now handled by arrival's Rosetta Environment

  protected getAvailableFunctions(): string[] {
    return [...this.functions.entries()].map(([name, { description, params }]) => {
      // Generate signature from Zod schema
      const signature = params
        .map((item: any) => {
          // Defensive check: ensure item is a valid zod schema
          if (!item || typeof item !== 'object' || typeof item.safeParse !== 'function') {
            console.warn('[DiscoveryTool] Invalid param schema in function:', name);
            return 'value';
          }

          let postfix = "";
          // eslint-disable-next-line unicorn/no-useless-undefined
          if (item.safeParse(undefined).success) {
            postfix += "?";
          }
          if (item.description) {
            postfix += ` (${item.description})`;
          }
          // Basic type checks
          if (item instanceof z.ZodString) return `string${postfix}`;
          if (item instanceof z.ZodNumber) return `number${postfix}`;
          if (item instanceof z.ZodBoolean) return `boolean${postfix}`;
          if (item instanceof z.ZodArray) return `list${postfix}`;

          // Enum shows possible values
          if (item instanceof z.ZodEnum) {
            return item.options.map((v) => `"${v}"`).join("|");
          }

          // For z.any() or complex types, use generic names
          if (item instanceof z.ZodAny) {
            // Could check for description or default to generic
            return `any`; // Most z.any() in our code are components
          }

          return `value${postfix}`;
        })
        .join(" ");

      // eslint-disable-next-line sonarjs/no-nested-template-literals
      return `(${name}${signature ? ` ${signature}` : ""}) - ${description}`;
    });
  }

  private async createEnvironment(context: Omit<TT, "expr">, timeoutRef: { current: boolean }): Promise<any> {
    const env = new (Environment as any)({}, sandboxedEnv, "Sandbox");

    // Add missing length function for LIPS list compatibility
    env.set("length", (collection: any) => {
      // LIPS lists have their own length calculation
      if (collection && typeof collection === 'object' && 'car' in collection) {
        // Count LIPS list elements manually
        let count = 0;
        let current = collection;
        while (current && current.constructor && current.constructor.name !== 'Nil') {
          count++;
          current = current.cdr;
        }
        return count;
      }
      // JS arrays and other collections
      return Array.isArray(collection) ? collection.length : 0;
    });

    await this.registerFunctions(context);

    // Provide contextual help after functions are registered
    this.registerFunction(
      "help",
      "List available functions and signatures for this context",
      [],
      () => this.getAvailableFunctions(),
    );

    // Register functions using arrival's Rosetta Environment for seamless LIPS ↔ JS interop
    for (const [name, { handler, params }] of this.functions.entries()) {
      env.defineRosetta(name, {
        fn: async (...args: any[]) => {
          invariant(!timeoutRef.current, "Timeout");
          try {
            return params.length > 0
              ? handler(...z.tuple(params as [z.ZodType, ...z.ZodType[]]).parse(args))
              : handler();
          } catch (error) {
            throw new Error(`${name}: ${error instanceof Error ? error.message : String(error)}`);
          }
        },
      });
    }

    return env;
  }
}
