import { DiscoveryToolInteraction } from "@/mcp-server/framework/DiscoveryToolInteraction";
import * as z from "zod";

export class ProjectDiscoveryToolInteraction extends DiscoveryToolInteraction<{
  projectId?: string;
}> {
  static readonly toolName = "project_discovery";
  readonly description = "Query project-specific data and resources";

  readonly contextSchema = {
    projectId: z.string().optional().describe("Project identifier to scope queries"),
  };

  protected async registerFunctions(context: { projectId?: string }): Promise<() => Promise<void>> {
    this.registerFunction(
      "get-project",
      "Get project details",
      [z.string().describe("Project ID")],
      (id: string) => ({
        id: id || context.projectId,
        name: `Project ${id || context.projectId}`,
        created: new Date().toISOString(),
      })
    );

    this.registerFunction(
      "list-files",
      "List project files",
      [],
      () => ["index.ts", "package.json", "README.md"]
    );

    return async () => {};
  }
}