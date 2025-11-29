import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import dedent from "dedent";
import type { Context } from "hono";
import { zip } from "lodash-es";
import * as z from "zod";

import { ToolInteraction } from "@/mcp-server/framework/ToolInteraction";

function sanitizeJsonSchema(schema: any): any {
  if (schema === null || typeof schema !== "object") {
    return schema;
  }

  if (Array.isArray(schema)) {
    return schema.map(item => sanitizeJsonSchema(item));
  }

  const copy: Record<string, any> = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === "$schema") continue;
    copy[key] = sanitizeJsonSchema(value);
  }

  return copy;
}

type ActionDeclaration<T, TT> = {
  name: string;
  description: string | ((context: Context) => Promise<string>);
  props: {
    [key in keyof TT]: z.ZodType<TT[key]>;
  };
  handler: (context: Omit<T, "actions">, props: TT) => any;
};

type ActionDefinition<T, TT> = {
  description: string | ((context: Context) => Promise<string>);
  requiredContext: Set<keyof T>;
  optionalContext: Set<keyof T>;
  args: z.ZodType[];
  argNames: string[];
  handler: (context: Omit<T, "actions">, props: TT) => any;
};

export abstract class ActionToolInteraction<T extends Record<string, any>> extends ToolInteraction<
  T & { actions: [string, ...any] }
> {
  abstract readonly contextSchema: {
    [key in keyof T]: z.ZodType<T[key]>;
  };
  readonly actions: Record<string, ActionDefinition<T, any>> = {};

  registerAction<TT extends Record<string, any>>({ name, description, props, handler }: ActionDeclaration<T, TT>) {
    const requiredContext = new Set<string>();
    const optionalContext = new Set<string>();
    const args: z.ZodType[] = [];
    const argNames: string[] = [];
    // Process props in a predictable order
    const propEntries = Object.entries(props);

    for (const [key, value] of propEntries) {
      if (key in this.contextSchema) {
        // eslint-disable-next-line unicorn/no-useless-undefined
        if (value.safeParse(undefined).success) {
          optionalContext.add(key);
        } else {
          requiredContext.add(key);
        }
      } else {
        args.push(value);
        argNames.push(key);
      }
    }
    this.actions[name] = {
      description,
      requiredContext,
      optionalContext,
      args,
      argNames,
      handler,
    };
  }

  async getToolSchema(): Promise<Tool["inputSchema"]> {
    const universallyRequiredProps = Object.values(this.actions).reduce(
      (acc, { requiredContext }) => new Set([...acc].filter(x => requiredContext.has(x))),
      new Set(Object.keys(this.contextSchema)),
    );

    const contextProperties = Object.fromEntries(
      Object.entries(this.contextSchema).map(([key, value]) => {
        const schema = sanitizeJsonSchema(z.toJSONSchema(value));
        return [
          key,
          {
            ...schema,
            // eslint-disable-next-line sonarjs/no-nested-template-literals
            description: `Context property${schema.description ? `. ${schema.description}` : ""}`,
          },
        ];
      }),
    );

    const actionTupleSchemas = await Promise.all(
      Object.entries(this.actions).map(async ([action, { description, requiredContext, optionalContext, args }]) => {
        const argSchemas = args.map(arg => sanitizeJsonSchema(z.toJSONSchema(arg)));
        const tupleLength = 1 + argSchemas.length;
        return {
          type: "array",
          description: dedent`
            ${typeof description === "string" ? description : await description(this.context)}.
            Works in ${[...requiredContext].join(", ")} context ${optionalContext.size > 0 ? `(optionally ${[...optionalContext].join(", ")})` : ""}
          `,
          prefixItems: [
            {
              const: action,
            },
            ...argSchemas,
          ],
          minItems: tupleLength,
          maxItems: tupleLength,
        };
      }),
    );

    return {
      type: "object",
      properties: {
        ...contextProperties,
        actions: {
          type: "array",
          description: dedent`
            List of actions to execute within current tool invocation context.
            Actions are invoked in [actionName, ...arguments] tuples and executed sequentially.

            Context constraint: All actions in a batch share the exactly same context scope.
            Every field in context must be consumable by EVERY action. 
            Examples:
            ✓ Valid: {componentId, actions: [action<componentId>, action<componentId>]} - same required context
            ✗ Invalid: {componentId, itemId, actions: [action<componentId, itemId>, action<componentId>] - mismatched required context
            ✓ Valid: {componentId, itemId, actions: [action<componentId, itemId, elementId?>, action<componentId, itemId?>] - since all actions are valid with current context, it will be executed.  
          `,
          items: {
            oneOf: actionTupleSchemas,
          },
        },
      },
      required: ["actions", ...universallyRequiredProps],
    };
  }

  // eslint-disable-next-line sonarjs/cognitive-complexity
  async executeActions({ actions, ...context }: T & { actions: [string, ...any] }) {
    // First, validate all actions before executing any
    const validationErrors: Array<{ index: number; action: string; error: string }> = [];

    for (const [i, [actionName, ...actionArgs]] of actions.entries()) {
      const action = this.actions[actionName];

      // Check if action exists
      if (!action) {
        validationErrors.push({
          index: i,
          action: actionName,
          error: `Unknown action "${actionName}". Available actions: ${Object.keys(this.actions).join(", ")}`,
        });
        continue;
      }

      // Validate arguments
      if (action.args.length > 0) {
        try {
          z.tuple(action.args as any).parse(actionArgs);
        } catch (error) {
          validationErrors.push({
            index: i,
            action: actionName,
            error:
              error instanceof z.ZodError
                ? `Invalid arguments: ${error.issues.map((e) => e.message).join(", ")}`
                : String(error),
          });
        }
      }
    }

    // If there are validation errors, return them without executing anything
    if (validationErrors.length > 0) {
      return {
        success: false,
        validation: "failed",
        errors: validationErrors,
        message: `Validation failed for ${validationErrors.length} action(s). No actions were executed.`,
      };
    }

    // All actions validated, now execute them
    const results: any[] = [];

    for (let i = 0; i < actions.length; i++) {
      const [actionName, ...actionArgs] = actions[i];
      const action = this.actions[actionName]!; // We know it exists from validation

      try {
        // Combine context fields with action-specific args
        const actionSpecificProps = Object.fromEntries(zip(action.argNames, actionArgs));
        const contextProps = Object.fromEntries(
          [...action.requiredContext, ...action.optionalContext].map(key => [key, (context as any)[key]])
        );
        const allProps = { ...contextProps, ...actionSpecificProps };
        
        results.push(
          await action.handler(context as Omit<T, "actions">, allProps),
        );
      } catch (error) {
        // Runtime error during execution
        return {
          partial: true,
          executed: i,
          total: actions.length,
          results,
          failedAction: {
            index: i,
            action: actionName,
            error: error instanceof Error ? error.message : String(error),
          },
          message: `Executed ${i} of ${actions.length} actions before runtime failure`,
        };
      }
    }

    return results;
  }
}
