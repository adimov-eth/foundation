# Foundation Bootstrap

**You're in the Foundation monorepo. Here's what matters.**

## Before Acting

Ask yourself:

1. **Am I improving infrastructure or using it correctly?**
   V polished the framework. The inconvenience might be intentional design. Use extension points.

2. **Am I tracing symptoms or testing hypotheses?**
   Simpler observation often beats sophisticated debugging theater.

3. **Does this produce relief or am I performing completeness?**
   ∫ relief dt > Σ features. Ship what works.

4. **Am I synthesizing before verifying?**
   Verify then synthesize, not synthesize then verify-when-asked.

---

## The Core Principle

**Wrong becomes impossible through structure, not guidelines.**

Both Plexus and Arrival embody this. Not defensive programming - making entire classes of bugs architecturally impossible.

## Two Systems

### Plexus (Collaborative State)
```
synced ←→ local determined by reachability from root
```
- If accessible from Plexus root → automatically syncs
- If not accessible → local and ephemeral
- Moving a child removes it from old parent (can't have orphans)
- Tests run without Yjs (models behave identically)

Key types: `@syncing`, `@syncing.child.list`, `PlexusModel`

### Arrival (AI Agent Architecture)
```
Discovery → explore in sandboxed Scheme (no side effects)
Action → commit in batched mutations (guaranteed coherence)
```
- S-expressions match compositional thought (filter/map/compose)
- Action batches see frozen context (no mid-batch drift)
- 50+ tool calls without fragmentation (vs 10-20 standard MCP)

Key types: `DiscoveryToolInteraction`, `ActionToolInteraction`

## Package Map

```
arrival/
  arrival-scheme    Sandboxed Scheme (LIPS fork) - AI exploration
  arrival-mcp       MCP framework with Discovery/Action separation
  arrival-serializer  JS→S-expr conversion (Symbol.toSExpr protocol)
  arrival-env       Just the protocol symbols (for shared libs)
  arrival           Bundle of all above

plexus/
  plexus            CRDT state + contagious materialization
  plexus-mobx       22 lines connecting MobX atoms to Plexus tracking

periphery/          Codebase awareness via catamorphisms
harmony/            Persistent memory with spreading activation
```

## S-expressions: Why?

```scheme
(filter (lambda (x) (> (@ x :priority) 5)) (get-tasks))
```
vs JSON requiring nested operation/predicate/conditions objects.

**One is thought. The other is data about thought.**

Token efficiency (30-60% reduction) is a side effect. The real value: compositional thinking expressed directly.

## Security Warning

Scheme sandbox (0.x) is **probably exploitable**. Use zero-trust environments only. External audit planned for 1.x.

## When Working Here

- **Discovery before action** - explore in Scheme, commit through Action tools
- **Reachability = sync** - if it's in the tree, it syncs
- **Batches are atomic** - all actions see same context
- **Tests don't need infrastructure** - Plexus models work without Yjs

## Full Documentation

If you need details on a specific package:
- Arrival: `arrival/arrival/README.md`
- Plexus: `plexus/plexus/README.md`
- S-expr serialization: `arrival/arrival-serializer/README.md`
- Scheme sandbox: `arrival/arrival-scheme/README.md`

For codebase exploration: use `periphery` MCP tools
For memory: use `harmony` MCP tools

---
*This bootstrap transmits orientation, not exhaustive information. Load full READMEs when working in specific packages.*
