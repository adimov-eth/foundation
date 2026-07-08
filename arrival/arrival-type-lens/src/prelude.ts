// prelude.ts — loads the authored prelude `.d.ts` ASSETS (base types + per-builtin leaves).
//
// This lives in its own module (not index.ts) so the checker (check.ts) can import it WITHOUT
// creating an index↔check cycle: index.ts re-exports diagnoseScheme from check.ts, so if check.ts
// imported loadAuthoredPrelude from index.ts, check.ts's module-top call would hit index.ts's
// consts before they initialize (TDZ). Both index.ts and check.ts import from HERE instead.

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// The prelude `.d.ts` files are shipped ASSETS (declaration text we tsc against), read at
// runtime. They sit under src/prelude and are copied into dist/prelude at build (copy-prelude.mjs);
// resolve relative to THIS module either way.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PRELUDE_DIR = path.join(HERE, "prelude");
const BUILTINS_DIR = path.join(PRELUDE_DIR, "builtins");

/** The authored prelude: base types + every builtin leaf (the `.d.ts` you tsc against for CORE
 *  builtins, which have no runtime `type`). Concatenated into one virtual file — leaves augment
 *  the shared `interface ArrShape` via declaration merging. */
export function loadAuthoredPrelude(): string {
  const base = readFileSync(path.join(PRELUDE_DIR, "types.d.ts"), "utf8");
  // Deterministic order so the concatenated prelude (and thus the ArrShape merge) is stable.
  const files = readdirSync(BUILTINS_DIR)
    .filter((f) => f.endsWith(".d.ts") && !f.startsWith("_"))
    .toSorted((a, b) => a.localeCompare(b));
  const leaves = files.map((f) => readFileSync(path.join(BUILTINS_DIR, f), "utf8"));
  return [base, ...leaves].join("\n");
}
