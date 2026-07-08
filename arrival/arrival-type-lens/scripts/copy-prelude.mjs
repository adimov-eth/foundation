// copy-prelude.mjs — postbuild: copy the prelude `.d.ts` ASSETS into dist/.
//
// The prelude files (src/prelude/*.d.ts) are declaration TEXT the checker tsc's against at
// runtime — not compiled TypeScript. `tsc` emits nothing for a `.d.ts` input, so it would
// never reach dist/. This copies src/prelude → dist/prelude verbatim so loadAuthoredPrelude()
// (which resolves relative to the built index.js) finds them.

import { cpSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, "..", "src", "prelude");
const DST = path.join(HERE, "..", "dist", "prelude");

if (!existsSync(SRC)) {
  console.error(`[copy-prelude] source prelude dir missing: ${SRC}`);
  process.exit(1);
}
cpSync(SRC, DST, { recursive: true });
console.error(`[copy-prelude] copied prelude assets → ${path.relative(path.join(HERE, ".."), DST)}`);
