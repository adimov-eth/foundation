# Changelog

## [Unreleased]

### Added
- **Auto-discovery for action tools**: `projectPath` now optional - automatically discovers nearest `tsconfig.json` from file paths
- **Workspace-aware path resolution**: Relative paths resolved from monorepo root (detected via `.git` or `pnpm-workspace.yaml`)
- **Multi-project support**: Maintains separate ts-morph Project instances per discovered package
- **Import deduplication**: `add-import` now filters existing named imports before adding
- **Cross-platform support**: Filesystem walking now works on macOS, Linux, and Windows (no hardcoded `/`)

### Changed
- Action tools no longer require manual `projectPath` parameter
- Cross-package action batches now work correctly (e.g., format files in both `plexus` and `arrival-mcp`)
- `rename-symbol` now uses ts-morph's `.rename()` method (handles declaration + all references)
- `remove-unused-imports` now uses ts-morph's `.fixUnusedIdentifiers()` for reliable removal

### Fixed
- `rename-symbol` was only renaming references, not the declaration itself
- `remove-unused-imports` wasn't detecting unused imports correctly

### Refactored (2025-11-12)
- **Extracted `walkUpUntil` helper**: Eliminates duplication between `findWorkspaceRoot` and `findProjectPath`
- **Extracted `getSourceFile` helper**: Eliminates 6x duplication across all action handlers
- **Removed redundant comments**: Code is self-documenting after refactoring
- **Cross-platform filesystem walking**: No longer hardcodes `/` as root, works on Windows
- **Net reduction**: ~50 lines removed while maintaining all functionality

### Verified
- ✓ format-file across multiple packages (plexus + arrival-mcp)
- ✓ add-import with deduplication
- ✓ remove-unused-imports (actual removal verified)
- ✓ rename-symbol (declaration + references)
- ✓ Relative paths from monorepo root
- ✓ Absolute paths
- ✓ Error: No tsconfig found for invalid paths
- ✓ All 8 tests passing after refactoring
- ✓ Zero TypeScript errors
