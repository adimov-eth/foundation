 Plexus: Implementation Reality Report

       Based on thorough examination of the TypeScript source code (12,940 lines), here's what Plexus actually does at the implementation level:

       ---
       1. Core Abstractions

       PlexusModel (abstract base class)

       What it is: A wrapper around Yjs-backed state that provides:
       - Singleton pattern per document per entity (via WeakRef caching in documentEntityCaches)
       - Dual initialization modes:
         - Ephemeral: new Model({field: value}) - local only, no sync
         - Materialized: new Model([entityId, doc]) - bound to Y.Doc, synced
       - Automatic UUID generation via nanoid (stored in _uuid)
       - Accessor-based field definitions with decorator-powered getters/setters

       Key fields:
       _yjsModel: Y.Map<Storageable> | null    // null = ephemeral
       _doc: Y.Doc | null                       // null = ephemeral
       _schema: GenericRecordSchema              // field type metadata
       _initializationState: Record<...>         // constructor args buffer

       PlexusDoc (Yjs document structure)

       The Y.Doc is partitioned into two key structures:
       Y.Doc
       ├── models (Y.Map)
       │   ├── "root" → Y.Map<...>
       │   │   ├── __type__: "RootClassName"
       │   │   ├── __parent__: [parentUuid, fieldName, metadata?]
       │   │   └── [field names]: val | Y.Array | Y.Map | reference tuple
       │   ├── [entityId] → Y.Map<...>
       │   └── ...more entities
       └── __metadata__ (Y.Map)
           ├── documentId: string (for cross-doc references)
           └── version: string (for dependency versioning)

       MaterializedArray/MaterializedMap/MaterializedRecord

       What they are: JavaScript Proxy objects that:
       - Wrap Y.Array/Y.Map to provide mutable collection syntax
       - Track parent-child relationships for child-owned collections
       - Convert between PlexusModel instances (JS) and reference tuples (Yjs storage)
       - Intercept all mutations to emit tracking signals

       Key mechanism: When you access model.children (child-list field):
       // In decorator get():
       return backingStructures[this._schema[context.name]].get(this);
       // → returns Proxy wrapping Y.Array

       The proxy intercepts:
       - push(item) → converts to reference, syncs to Y.Array, updates parent tracking
       - splice() → handles emancipation before orphanization (DOM-style)
       - Index assignment arr[0] = x → removes old at that index, adds new

       ---
       2. State Synchronization (Yjs + Reference Tuples)

       Synchronization Strategy: Not CRDT Values, References

       Plexus doesn't sync the actual PlexusModel instances. Instead:

       1. Ephemeral models are converted to reference tuples when touching Yjs:
       type ReferenceTuple = [entityId: string] | [entityId: string, dependencyId: string]

       2. Example: Adding a User to a Team:
       // JS side (what you write)
       team.users.push(new User({name: "Alice"}))

       // What happens:
       // 1. User instance created (ephemeral, no _yjsModel yet)
       // 2. Decorator setter calls maybeReference(user, doc)
       // 3. User touches [referenceSymbol](doc) → materializes in Y.Doc
       //    (creates Y.Map entry in models.get(uuid))
       // 4. Y.Array.push([uuid]) → synced to other clients
       // 5. Other clients deref([uuid]) → spawns new User instance (singleton)

       Under the Hood: The referenceSymbol Protocol

       // In PlexusModel.ts:
       [referenceSymbol](doc: Y.Doc): ReferenceTuple {
         if (this._yjsModel?.doc === doc) {
           return [this.uuid]  // Already materialized
         }

         // Materialize on first reference:
         return maybeTransacting(doc, () => {
           const yprojectObjectInstances = doc.getMap<Y.Map<Storageable>>(
             YJS_GLOBALS.models
           );
           let yprojectObjectInstanceFields = yprojectObjectInstances.get(this.uuid);

           if (!yprojectObjectInstanceFields) {
             yprojectObjectInstanceFields = new Y.Map<Storageable>();
             yprojectObjectInstances.set(this.uuid, yprojectObjectInstanceFields);

             // Store type for deserialization
             yprojectObjectInstanceFields.set(YJS_GLOBALS.modelMetadataType, this.#type);

             // Seed all fields into Y.Map
             for (const [schemaKey, type] of Object.entries(this._schema)) {
               switch (type) {
                 case "val":
                   yprojectObjectInstanceFields.set(
                     schemaKey,
                     maybeReference(this[schemaKey], doc)
                   );
                   break;
                 case "list":
                   yprojectObjectInstanceFields.set(
                     schemaKey,
                     Y.Array.from(this[schemaKey].map(boundMaybeReference))
                   );
                   break;
                 // ...rest of types
               }
             }
           }
           this._yjsModel = yprojectObjectInstanceFields;
           return [this.uuid];
         });
       }

       Deserialization: deref()

       const deref = (doc: Y.Doc, pointer: AllowedYValue): AllowedYJSValue => {
         // Primitives pass through
         if (typeof pointer !== "object") return pointer;

         // pointer is [entityId] or [entityId, dependencyId]
         if (pointer[1]) {
           // Cross-doc reference - fetch dependency doc
           const depDoc = getDependencyDoc(doc, pointer[1]);
           return deref(depDoc, [pointer[0]]);  // Recurse in dependency
         }

         // Local entity - check cache first (singleton pattern)
         const cached = documentEntityCaches.get(doc).get(pointer[0])?.deref();
         if (cached) return cached;

         // Spawn new instance
         const Constructor = entityClasses.get(type);
         return new Constructor([pointer[0], doc]);  // Materialized init
       };

       Why references? Yjs itself doesn't handle object references well. Plexus uses references to:
       - Keep models out of Yjs (Yjs only knows primitives, arrays, maps)
       - Implement singleton pattern (same entity = same object in JS)
       - Support cross-document references via tuple-based addressing

       ---
       3. Contagious Materialization

       What it means in code:

       When you add an ephemeral model to a synced parent, it automatically materializes:

       // Before: ephemeral
       const user = new User({name: "Alice"})  // _yjsModel = null

       // After: accessing from synced parent
       team.users.push(user)
       // → user[referenceSymbol](doc) called
       // → creates Y.Map entry
       // → user._yjsModel now set

       The "contagion": Materialization spreads upward through the tree:

       // Pseudo-code flow:
       function setChild(context, object, value) {
         if (!value._yjsModel && newParent._doc) {
           value[referenceSymbol](newParent._doc)  // ← Contagion happens here
         }
       }

       Architectural insight: The only way to materialize is through:
       1. Explicit [referenceSymbol](doc) call (happens during mutations)
       2. Deserialization deref() when reading from Yjs

       So: If you can't reach it from root, it never materializes. If you can reach it, it automatically will.

       This is enforced by the proxy interceptors checking this._doc at mutation time.

       ---
       4. Parent-Child Tracking (Preventing Orphans)

       The Problem

       DOM-style ownership: a child can only have one parent in one field. Moving a child from parent A's children[0] to parent B's children must:
       1. Remove from A's array
       2. Update internal parent pointer
       3. Sync both changes atomically

       The Solution: 4 Symbols

       export const requestEmancipationSymbol      // Remove from old parent
       export const informAdoptionSymbol           // Inform of new parent (you're already removed)
       export const requestAdoptionSymbol          // Remove + inform (combined)
       export const requestOrphanizationSymbol     // Full orphaning (no adoption)
       export const informOrphanizationSymbol      // Inform of orphaning (you're already removed)

       Example: Splice on child-list

       // arr = [a, b, c]; arr.splice(1, 1, x)  // Replace b with x
       function splice(this: any, start: number, deleteCount: number, ...items: any[]) {
         const toRemove = backingArray.splice(start, deleteCount);

         if (isChildField) {
           // First, emancipate old items
           for (const item of toRemove) {
             item[requestOrphanizationSymbol]?.();  // Remove from old location
           }
         }

         // Then add new items
         for (const item of items) {
           item[requestAdoptionSymbol]?.(owner, key);  // Remove from old parent + adopt
         }

         // Sync to Y.Array
         yjsArray.delete(start, deleteCount);
         yjsArray.insert(start, items.map(boundMaybeReference));
       }

       In Y.Js metadata:
       // Child's Y.Map stores:
       __parent__: [parentUuid, "children"] | [parentUuid, "child"] | null

       // Enables:
       // 1. Finding orphaned entities (parent field missing or mismatched)
       // 2. Validating tree integrity
       // 3. Garbage collection (entities with no parent are candidates)

       ---
       5. Cross-Agent/Cross-Process Synchronization

       Yjs Provider Layer (Not Plexus)

       Plexus doesn't implement networking. Instead, it hooks into Yjs:

       import * as Y from 'yjs';
       import { YWebSocketProvider } from 'y-websocket';

       const doc = new Y.Doc();
       const provider = new YWebSocketProvider(
         'ws://localhost:1234',
         'room-name',
         doc
       );
       await provider.whenSynced;

       const plexus = new ProjectPlexus(doc);
       const root = await plexus.rootPromise;

       What Yjs provides:
       - WebSocket sync (or plugin any provider)
       - CRDT merge on update conflicts
       - State vector tracking (efficient delta sync)

       What Plexus adds:
       - Model-level semantics on top of Yjs
       - Singleton caching (all clients see same object for same ID)
       - Parent tracking enforcement

       Example: Two Agents Editing Simultaneously

       // Agent 1
       root.users.push(new User({name: "Alice"}))

       // Agent 2 (receives update via provider)
       // → Yjs merges the Y.Array delta
       // → Observable fires on user._yjsModel
       // → trackModification() → notifies MobX
       // → React rerenders with new user

       // Both agents have:
       root.users[0].uuid === "same-nanoid"  // Singleton!
       root.users[0] === root.users[0]       // Same JS object

       ---
       6. Public API for Creating/Reading/Updating

       Create: Two Paths

       Ephemeral (local only):
       const user = new User({name: "Alice"})
       const team = new Team({users: [user]})

       Synced (add to Plexus root):
       const root = await plexus.rootPromise;
       root.teams.push(team);  // Contagion materializes both team and user

       Read

       From root:
       const root = await plexus.rootPromise;
       const team = root.teams[0];

       By UUID (requires root loaded):
       const user = plexus.loadEntity<User>(uuid);
       if (user) { /* ... */ }

       Predicates via getters:
       get activeUsers(): User[] {
         return this.users.filter(u => u.isActive);
       }

       Update

       Direct field mutation:
       root.teams[0].name = "New Name";
       // → Decorator setter called
       // → maybeTransacting wraps Y.Map.set()
       // → trackModification() batches notification
       // → MobX observers fire (if using plexus-mobx)

       Structural mutation:
       root.teams[0].users.push(newUser);
       // → Proxy trap for push
       // → newUser materializes
       // → Y.Array.push([newUserUuid])
       // → observers notified

       Transactions:
       plexus.transact(() => {
         root.name = "New";
         root.users.push(user1);
         root.users.push(user2);
         // All batched into single Yjs transaction
         // Notifications fired once after transaction
       });

       Delete

       Single entity:
       root.users.splice(0, 1);  // Remove at index 0
       // → Emancipates user
       // → Y.Array.delete(0, 1)

       With garbage collection:
       // Entities with no parent are GC candidates
       // (Currently: no automatic cleanup - manual deletion only)

       ---
       7. Limitations (What CAN'T It Do)

       Hard Limits

       1. No Undefined Values
         - undefined is illegal (Yjs incompatible)
         - Use null instead
         - This breaks patterns like obj.field ??= defaultValue
       2. No Circular Object References (in non-child fields)
       // ILLEGAL:
       class A extends PlexusModel {
         @syncing accessor b!: B;
       }
       class B extends PlexusModel {
         @syncing accessor a!: A;
       }

       new A({b: new B({a: ...})})  // Cycles must use parent-child tracking
       3. Single Parent Only (child-owned fields)
         - Child can appear in only ONE child-list/child-map/child-set per parent
         - Moving a child removes from old parent (by design)
         - No multi-parent ownership
       4. No Lazy Loading
         - deref() spawns entire object tree
         - No pagination, filtering, or virtual scrolling built-in
       5. No Computed Fields
         - Getters are fine (they're functions)
         - But fields decorated with @syncing must be explicit properties

       Soft Limits (Possible but Expensive)

       1. Garbage Collection
         - No automatic cleanup of unreachable entities
         - Manual deletion only
         - Orphaned entities linger in Y.Doc
       2. Performance at Scale
         - Each reference dereference = constructing new proxies (if not cached)
         - Large arrays: forEach > cached iteration
         - Yjs write overhead (CRDT operations) per field mutation
       3. Sync Latency
         - Provider-dependent (WebSocket, IndexedDB, etc.)
         - No optimistic updates built-in
         - No conflict resolution (first-write-wins CRDT semantics)
       4. Type Safety at Runtime
         - Decorators are compile-time only
         - Runtime checks: tiny-invariant (minimal)
         - No schema validation on write
       5. No Support For
         - Slate/Prism rich text editors (mentioned in README)
         - Nested Plexus instances (single doc per root)
         - Dynamic schema (can't add fields after class definition)

       ---
       8. State Consistency Guarantees

       What's Guaranteed

       1. Singleton Pattern
         - plexus.loadEntity(uuid) always returns same JS object (per doc)
         - Comparison by reference is safe: user1 === user2 iff same UUID
       2. Parent Tracking Invariant
         - If child has parent pointer, parent has child in referenced field
         - (Enforced at sync time; transient violations during mutations)
       3. Transactional Atomicity (Yjs-level)
         - Multiple mutations in plexus.transact() = single Yjs update
         - Other clients see all-or-nothing
       4. Notification Ordering
         - Change notifications batched per transaction
         - Fired AFTER transaction completes
         - Prevents intermediate state observation

       What's NOT Guaranteed

       1. Merge Semantics on Conflict
         - Yjs CRDT wins on conflict
         - Last-write-wins per field
         - No application-level conflict resolution
       2. Entity Existence
         - plexus.loadEntity(uuid) can return stale object if entity deleted
         - No mandatory alive-check
       3. Tree Integrity Over Network
         - Transient parent mismatches during sync
         - (Resolves within one Yjs update)

       ---
       9. Integration Architecture

       MobX Integration (plexus-mobx)

       import { enableMobXIntegration } from "@here.build/plexus-mobx";

       enableMobXIntegration();
       // Hooks: trackingHook.access = (entity, field) => observable tracking
       //        trackingHook.modification = (entity, field) => reaction trigger

       Maps Plexus field-level tracking to MobX observables.

       Tracking System (Custom)

       // Low-level
       trackAccess(entity, field)       // Record field read
       trackModification(entity, field) // Notify listeners

       // High-level (React)
       createTrackedFunction(notifyChanges, fn) => wrappedFn
       // Executes fn(), records field accesses, notifies on changes

       ---
       10. Code Map

       | File                          | Purpose                              | LOC   |
       |-------------------------------|--------------------------------------|-------|
       | PlexusModel.ts                | Core model base + materialization    | ~517  |
       | Plexus.ts                     | Document orchestration, root loading | ~416  |
       | decorators.ts                 | Field decorator + proxy builders     | ~457  |
       | proxies/materialized-array.ts | Array proxy + parent tracking        | ~400+ |
       | proxies/materialized-map.ts   | Record/Map proxy + parent tracking   | ~250+ |
       | proxies/materialized-set.ts   | Set proxy + parent tracking          | ~150+ |
       | tracking.ts                   | Field-level change notification      | ~160  |
       | deref.ts                      | Reference deserialization            | ~49   |
       | clone.ts                      | Deep model cloning                   | ~140  |
       | SubPlexus.ts                  | Dependency management                | ~187  |
       | entity-cache.ts               | Singleton pattern enforcement        | ~21   |
       | plexus-registry.ts            | Registry for docs + dependencies     | ~27   |

       Total: ~12,940 lines

       ---
       Summary: What Plexus Actually Is

       Plexus is:
       1. A state tree wrapper around Yjs that enforces model schema via decorators
       2. A singleton cache that ensures reference equality (a === a)
       3. A parent-child enforcer that prevents orphaned entities (DOM-like ownership)
       4. A reference system (not CRDT) that converts objects to tuples for Yjs storage
       5. A notification bridge between field mutations and reactivity frameworks (MobX)
       6. A multi-document coordinator supporting cross-doc references via dependency IDs

       What makes it different from Redux/Zustand/MobX:
       - Automatic sync to other processes via Yjs
       - Type-safe schema enforcement via TypeScript decorators
       - Granular (field-level) change tracking
       - Structural guarantees (orphans impossible)
       - Tests run without infrastructure (no provider needed locally)

       Core trade-off: Simplicity in exchange for constraint (single parent, no undefined, all-in tree-shaped state).