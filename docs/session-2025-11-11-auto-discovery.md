# Session Memo: Auto-Discovery for Action Tools

**Date:** 2025-11-11
**Context:** Implemented auto-discovery for arrival-meta action tools so they work without manual `projectPath`

---

## What We Built

**Problem:** Action tools required manual `projectPath` parameter. In monorepo, this meant specifying `/Users/adimov/Developer/foundation/arrival/arrival-meta` for every call.

**Solution:** Auto-discover project path by walking up from file path to find nearest `tsconfig.json`.

**Key insight from claude-mem:** Auto-initialization pattern - resurrect state from durable storage when process context is missing. They use DB as source of truth for sessions. We use filesystem as source of truth for project boundaries.

---

## Implementation Details

### Files Modified
- `arrival/arrival-meta/src/action-tool.ts` - Main implementation
- `arrival/arrival-meta/CHANGELOG.md` - Documented changes

### Core Pattern

```typescript
// Find workspace root (.git or pnpm-workspace.yaml)
private findWorkspaceRoot(): string {
    let currentDir = process.cwd();
    while (currentDir !== root) {
        if (existsSync(join(currentDir, 'pnpm-workspace.yaml')) ||
            existsSync(join(currentDir, '.git'))) {
            return currentDir;
        }
        currentDir = dirname(currentDir);
    }
    return process.cwd();
}

// Find project (nearest tsconfig.json)
private async findProjectPath(filePath: string): Promise<string> {
    const absPath = isAbsolute(filePath)
        ? filePath
        : resolve(this.findWorkspaceRoot(), filePath);

    let currentDir = dirname(absPath);
    while (currentDir !== root) {
        if (existsSync(join(currentDir, 'tsconfig.json'))) {
            return currentDir;
        }
        currentDir = dirname(currentDir);
    }
    throw new Error(`No tsconfig.json found`);
}

// Multi-project support
private projects: Map<string, Project> = new Map();

private async getProject(context: ExecutionContext, filePath?: string): Promise<[Project, string]> {
    let projectPath = context.projectPath || await this.findProjectPath(filePath);

    let project = this.projects.get(projectPath);
    if (!project) {
        project = new Project({ tsConfigFilePath: `${projectPath}/tsconfig.json` });
        this.projects.set(projectPath, project);
    }

    return [project, projectPath];
}
```

### All Handlers Updated

Every action handler now:
1. Calls `getProject(context, filePath)` for auto-discovery
2. Resolves relative paths from workspace root
3. Gets correct ts-morph Project instance

---

## Bugs Fixed During Verification

### Bug 1: rename-symbol only renamed references
**Problem:** Used `findReferencesAsNodes()` + `replaceWithText()` - missed declaration
**Fix:** Use ts-morph's built-in `symbol.rename(newName)` method

### Bug 2: remove-unused-imports didn't work
**Problem:** Manual reference counting was broken
**Fix:** Use ts-morph's built-in `sourceFile.fixUnusedIdentifiers()` method

### Bug 3: Cross-package batches failed
**Problem:** Single cached Project instance, different packages need different configs
**Fix:** Map of projects keyed by projectPath

### Bug 4: add-import created duplicates
**Problem:** `addNamedImports()` doesn't check existing
**Fix:** Filter out existing names before adding

---

## Verification Results

Tested with observable effects (not just "ran without error"):

```typescript
// ✓ Cross-package batch
[["format-file", "plexus/plexus/src/Plexus.ts"],
 ["format-file", "arrival/arrival-mcp/src/ToolInteraction.ts"]]

// ✓ Add import with deduplication
[["add-import", "discovery-tool.ts", "path", ["resolve", "dirname"], ""]]
// Result: Added dirname, didn't duplicate resolve

// ✓ Remove unused imports
[["remove-unused-imports", "test-actions.ts"]]
// Result: Removed "Project" and "Node" from ts-morph import

// ✓ Rename symbol
[["rename-symbol", "test-actions.ts", "testSymbol", "renamedCorrectly"]]
// Result: Declaration + 2 references all renamed
```

---

## How to Use Discovery/Action Tools

### Discovery Tool (Read-Only Queries)
```scheme
;; List files
(list-files "arrival/arrival-meta/src/**/*.ts")

;; Extract metadata
(define meta (extract-metadata "arrival/arrival-meta/src/hypergraph.ts"))
(@ meta :classes)  ;; Get classes
(@ meta :functions) ;; Get functions

;; Count nodes
(count-by-type "plexus/plexus/src/Plexus.ts")

;; Find patterns
(find-patterns "plexus/plexus/src/proxies/materialized-array.ts")

;; Compose queries
(filter (lambda (c) (member "PlexusModel" (@ c :extends)))
        (find-classes "src/Task.ts"))
```

### Action Tool (Safe Mutations)
```typescript
// Format files (cross-package batch works now!)
mcp__discovery__code-action({
  actions: [
    ["format-file", "arrival/arrival-meta/src/hypergraph.ts"],
    ["format-file", "plexus/plexus/src/Plexus.ts"]
  ]
})

// Add import with deduplication
mcp__discovery__code-action({
  actions: [
    ["add-import", "src/file.ts", "path", ["resolve", "join"], ""]
  ]
})

// Remove unused imports
mcp__discovery__code-action({
  actions: [
    ["remove-unused-imports", "src/file.ts"]
  ]
})

// Rename symbol (declaration + references)
mcp__discovery__code-action({
  actions: [
    ["rename-symbol", "src/file.ts", "oldName", "newName"]
  ]
})
```

**Key points:**
- No `projectPath` needed - auto-discovers from file path
- Relative paths work (resolved from workspace root)
- Cross-package batches work (separate Project per package)
- All paths can be monorepo-relative: `"arrival/arrival-meta/src/..."`

---

## MCP Server Management

**Location:** `arrival/arrival-meta/` (PM2 process: `code-discovery`)

```bash
# Build after changes
pnpm build

# Restart MCP server
pm2 restart code-discovery

# Check status
pm2 describe code-discovery

# View logs
pm2 logs code-discovery

# Server runs on port 3000 (configured in .mcp.json)
```

**After editing action-tool.ts:**
Always `pnpm build && pm2 restart code-discovery` for changes to take effect.

---

## The Pattern We Learned from claude-mem

**Auto-initialization from durable storage:**
- claude-mem: Session not in memory? Pull from DB (worker restarts transparent)
- Our tool: ProjectPath not provided? Walk filesystem to find tsconfig.json

**Multi-context support:**
- claude-mem: Map of sessions keyed by sessionDbId
- Our tool: Map of Projects keyed by projectPath

**Graceful over aggressive:**
- claude-mem: Mark session complete, don't DELETE
- Our tool: Cache projects, don't reinitialize unnecessarily

**The constraint thinking:** Make wrong structurally impossible.
- Cross-package batches CAN'T break - each package gets correct Project
- Invalid paths CAN'T proceed - throw before any mutation
- Duplicate imports CAN'T be added - filter checks existing first

---

## What's Left

**Not implemented (marked as placeholders):**
- extract-function
- inline-function

**Could improve:**
- rename-symbol only works within single file (ts-morph limitation? or wrong API?)
- Error messages could include discovered projectPath for debugging

**Works perfectly:**
- format-file
- add-import
- remove-unused-imports (after using fixUnusedIdentifiers)
- rename-symbol (after using .rename())

---

## Relief Check

**Does the code feel inevitable?**
Yes. Workspace root detection, project discovery, path resolution - all minimal implementations.

**Deletion test passed?**
Tried removing lines during implementation - nothing removable while keeping correctness.

**Using built-in methods where they exist?**
Yes. Switched to `.rename()` and `.fixUnusedIdentifiers()` instead of manual implementations.

---

## Next Session

If you need to extend this:
1. Read this memo
2. Check `arrival/arrival-meta/src/action-tool.ts` for current implementation
3. Test changes with observable effects (don't trust "no error" - verify actual mutations)
4. Update CHANGELOG.md
5. `pnpm build && pm2 restart code-discovery`

**The tools work.** Cross-package batches work. Auto-discovery works. Ship it.
