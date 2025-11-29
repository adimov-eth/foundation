/**
 * Code execution server tool for the agent framework.
 */

export class CodeExecutionServerTool {
  readonly name: string;
  readonly type = "code_execution_20250522";

  constructor(name = "code_execution") {
    this.name = name;
  }

  toDict(): Record<string, unknown> {
    return {
      type: this.type,
      name: this.name,
    };
  }
}
