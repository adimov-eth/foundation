// Re-export all LIPS interpreter functionality
import { applyFantasyLandPatches } from "./fantasy-land-lips.js";

export * from "./lips.js";
export * from "./safe_builtins.js";
export * from "./sandbox-env.js";
export { lipsToJs, jsToLips } from "./rosetta.js";

applyFantasyLandPatches();
