/**
 * Computer Use Module
 *
 * Agentic sampling loop for computer use with Anthropic's tools.
 * Requires X11 for ComputerTool. BashTool/EditTool work anywhere.
 */

export {
  samplingLoop,
  type SamplingLoopOptions,
  type SamplingLoopCallbacks,
} from "./loop.js";

export {
  TOOL_GROUPS_BY_VERSION,
  type ToolVersion,
} from "./tools/index.js";

// For custom tool implementations
export { ToolResult, ToolError } from "./tools/base.js";
