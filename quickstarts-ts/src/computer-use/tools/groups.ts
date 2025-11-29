/**
 * Tool groups for different API versions.
 */

import { BaseAnthropicTool } from "./base.js";
import { BashTool20241022, BashTool20250124 } from "./bash.js";
import {
  ComputerTool20241022,
  ComputerTool20250124,
  ComputerTool20251124,
} from "./computer.js";
import { EditTool20241022, EditTool20250124, EditTool20250728 } from "./edit.js";

export type ToolVersion =
  | "computer_use_20250124"
  | "computer_use_20241022"
  | "computer_use_20250429"
  | "computer_use_20251124";

export type BetaFlag =
  | "computer-use-2024-10-22"
  | "computer-use-2025-01-24"
  | "computer-use-2025-04-29"
  | "computer-use-2025-11-24";

export interface ToolGroup {
  version: ToolVersion;
  tools: Array<new () => BaseAnthropicTool>;
  betaFlag: BetaFlag | null;
}

export const TOOL_GROUPS: ToolGroup[] = [
  {
    version: "computer_use_20241022",
    tools: [ComputerTool20241022, EditTool20241022, BashTool20241022],
    betaFlag: "computer-use-2024-10-22",
  },
  {
    version: "computer_use_20250124",
    tools: [ComputerTool20250124, EditTool20250728, BashTool20250124],
    betaFlag: "computer-use-2025-01-24",
  },
  {
    version: "computer_use_20250429",
    tools: [ComputerTool20250124, EditTool20250728, BashTool20250124],
    betaFlag: "computer-use-2025-01-24",
  },
  {
    version: "computer_use_20251124",
    tools: [ComputerTool20251124, EditTool20250728, BashTool20250124],
    betaFlag: "computer-use-2025-11-24",
  },
];

export const TOOL_GROUPS_BY_VERSION: Record<ToolVersion, ToolGroup> =
  Object.fromEntries(
    TOOL_GROUPS.map((group) => [group.version, group])
  ) as Record<ToolVersion, ToolGroup>;
