#!/usr/bin/env node
/**
 * Calculator MCP Server
 *
 * Simple calculator tool for basic math operations.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  {
    name: "Calculator",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "calculator",
        description: "Performs basic calculations with two numbers.",
        inputSchema: {
          type: "object",
          properties: {
            number1: {
              type: "number",
              description: "First number in the calculation",
            },
            number2: {
              type: "number",
              description: "Second number in the calculation",
            },
            operator: {
              type: "string",
              description:
                "Operation symbol to perform (+, -, *, /, ^, sqrt). Note: Only these exact symbols are supported, not words",
            },
          },
          required: ["number1", "number2", "operator"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== "calculator") {
    return {
      content: [{ type: "text", text: `Unknown tool: ${request.params.name}` }],
      isError: true,
    };
  }

  const { number1, number2, operator } = request.params.arguments as {
    number1: number;
    number2: number;
    operator: string;
  };

  try {
    let result: number;

    switch (operator) {
      case "+":
        result = number1 + number2;
        break;
      case "-":
        result = number1 - number2;
        break;
      case "*":
        result = number1 * number2;
        break;
      case "/":
        if (number2 === 0) {
          return {
            content: [{ type: "text", text: "Error: Division by zero" }],
            isError: true,
          };
        }
        result = number1 / number2;
        break;
      case "^":
        result = Math.pow(number1, number2);
        break;
      case "sqrt":
        if (number1 < 0) {
          return {
            content: [
              {
                type: "text",
                text: "Error: Cannot take square root of negative number",
              },
            ],
            isError: true,
          };
        }
        result = Math.sqrt(number1);
        break;
      default:
        return {
          content: [
            { type: "text", text: `Error: Unsupported operator '${operator}'` },
          ],
          isError: true,
        };
    }

    // Format result - show as integer if it is one
    const formattedResult = Number.isInteger(result) ? result : result;

    return {
      content: [{ type: "text", text: `Result: ${formattedResult}` }],
    };
  } catch (e) {
    return {
      content: [{ type: "text", text: `Error: ${String(e)}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
