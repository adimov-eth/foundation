/**
 * Think tool for internal reasoning.
 */

import { Tool } from "./base.js";

export class ThinkTool extends Tool {
  constructor() {
    super(
      "think",
      "Use the tool to think about something. It will not obtain new information or change the database, but just append the thought to the log. Use it when complex reasoning or some cache memory is needed.",
      {
        type: "object",
        properties: {
          thought: {
            type: "string",
            description: "A thought to think about.",
          },
        },
        required: ["thought"],
      }
    );
  }

  async execute(_params: Record<string, unknown>): Promise<string> {
    return "Thinking complete!";
  }
}
