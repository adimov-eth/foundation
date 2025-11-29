## Homoiconic Memory: Where Thoughts Become Functions

### The Problem

Current memory system is a graph database with activation spreading. It stores data about thoughts but can't think about its storage. The retrieval algorithm is hardcoded JavaScript, not part of the memory itself. When patterns emerge, they can't become executable abstractions.

Real homoiconicity means the memory IS its implementation. The retrieval algorithm, scoring weights, activation parameters - all stored as S-expressions IN the memory, modifiable BY the memory.

### Current Progress

We've made significant progress toward homoiconicity:
- **MemoryPolicy with executable S-expressions** - `decayFn`, `recallScoreFn`, `explorationFn` are now S-expression strings
- **Feedback mechanism** - `(feedback id 'success'/'fail')` tracks retrieval quality
- **Purposeful decay** - Items with high success ratio decay slower (via `decayFn`)
- **Policy versioning** - All policy functions are versioned with SHA-1 hashes
- **Session tracking** - Recent recalls track which policy versions were used
- **Reversion capability** - `(revert-policy-fn name versionId)` can rollback policies
- **Array support in functions** - `explorationFn` receives arrays of tail item features

What's still hardcoded in JavaScript:
- Main retrieval flow (`runSpreadingActivation`) - Performance critical
- Co-activation reinforcement logic
- Consolidation and clustering algorithms

### Core Insight

Stop building a memory system that stores data. Build a memory that IS a program - one that executes itself to retrieve information, rewrites itself based on patterns, and evolves new retrieval strategies from usage.

### Architecture

```scheme
;; The memory is this S-expression that executes itself
(memory
  (id "workspace-7f3a2b")
  (born 1735851234567)
  (energy 42)
  (threshold 100)
  
  ;; THE RETRIEVAL ALGORITHM IS IN THE MEMORY
  (retrieve
    '(lambda (query)
      (let* ((candidates (find-candidates query))
             (activated (spreading-activation candidates))
             (scored (combine-scores activated)))
        (co-reinforce scored)
        (take 20 scored))))
  
  ;; POLICY: PARAMETERS AND FUNCTIONS THE MEMORY CAN MODIFY
  (policy
    ;; Numeric parameters
    (halfLifeDays 7)
    (reinforceDelta 0.05)
    (activationSteps 3)
    (activationDecay 0.85)
    (activationThreshold 0.2)
    
    ;; Executable functions stored as S-expressions (versioned with SHA-1)
    (decayFn 
      '(lambda (success fail energy importance recency_ms base_half_ms)
        (let* ((total (+ success fail 1))
               (ratio (/ success total))
               (scale (+ 0.5 (* 1.5 ratio))))  ; 0.5x to 2x based on success
          (* base_half_ms scale))))
    
    (recallScoreFn
      '(lambda (activation recency importance access success fail)
        (+ (* 0.6 activation)
           (* 0.25 recency)
           (* 0.15 importance))))
    
    (explorationFn  ; Now receives arrays of features for tail items
      '(lambda (limit tail_n acts recs imps accs succ fails)
        ;; acts, recs, imps, accs, succ, fails are arrays
        ;; Return index of item to explore, or -1 for none
        (if (> tail_n 0) 0 -1))))
  
  ;; ITEMS CAN BE DATA OR EXECUTABLE CODE
  (items
    (m1 &(:text "spreading activation algorithm" 
          :type knowledge
          :energy 0.7
          :executable nil))
    
    (m2 &(:text "(lambda (seeds) (propagate seeds (decay params) (steps params)))"
          :type function
          :energy 0.9
          :executable t))  ; This item IS executable code
    
    (m3 &(:text "Noticed: tech queries work better with decay=0.95"
          :type reflection
          :energy 0.5
          :executable nil)))
  
  ;; EDGES CAN HAVE EXECUTABLE CONDITIONS
  (edges
    (&(:from m1 :to m2 
       :relation implements
       :weight 0.9
       :active-when '(lambda () (> (energy memory) 50))))  ; Conditional edge
    
    (&(:from m2 :to m3
       :relation discovered
       :weight 0.7)))
  
  ;; PATTERNS THAT BECAME FUNCTIONS
  (evolved
    ;; Memory discovered this pattern and made it executable
    (optimize-for-domain
      '(lambda (query)
        (cond
          ((matches? query "activation|spreading|propagate")
           (set! (decay params) 0.95)
           (set! (steps params) 4))
          ((matches? query "recent|today|latest")
           (set! (beta params) 0.8)
           (set! (alpha params) 0.1))
          (else
           (set! (decay params) 0.85)))))
    
    ;; Memory created this after noticing recall patterns
    (cluster-by-session
      '(lambda ()
        (let ((session-window (* 30 60 1000)))  ; 30 minutes
          (group-by 
            (lambda (item)
              (floor (/ (created-at item) session-window)))
            (items memory))))))
  
  ;; META-OPERATIONS FOR SELF-MODIFICATION  
  (meta
    ;; Rewrite the retrieval algorithm
    (redefine-retrieve!
      '(lambda (new-algorithm)
        (set! (retrieve memory) new-algorithm)
        (append! (history memory) 
                 `((t ,(now)) (op redefine) (target retrieve)))))
    
    ;; Discover patterns and evolve new functions
    (emerge!
      '(lambda ()
        (let ((patterns (analyze-patterns (history memory))))
          (when (> (confidence patterns) 0.8)
            (let ((new-fn (synthesize-function patterns)))
              (set! (evolved memory)
                    (cons new-fn (evolved memory)))
              (set! (energy memory) 0))))))  ; Reset after emergence
    
    ;; Turn repeated item clusters into abstract concepts
    (abstract!
      '(lambda (item-ids)
        (let* ((items (map (lambda (id) (get (items memory) id)) item-ids))
               (pattern (extract-commonality items))
               (abstraction `(lambda () ,pattern)))
          (create-item! 
            :type 'concept
            :text (describe pattern)
            :executable t
            :code abstraction))))))
```

### Implementation Status & Plan

#### Phase 0: Foundation (PARTIALLY COMPLETE)

✅ **Completed:**
- Memory state persists as S-expression via `memoryStateToSExpr`
- Policy parameters stored and modifiable via `(set-policy)`
- Three core functions are now S-expressions: `decayFn`, `recallScoreFn`, `explorationFn`
- These functions execute via LIPS sandbox with `evalLambdaNumber`
- Feedback mechanism tracks success/fail per item

❌ **Still JavaScript:**
- Main retrieval flow (`runSpreadingActivation`)
- Co-activation reinforcement
- Consolidation logic

#### Phase 1: True Homoiconic State (IN PROGRESS)

1. **Memory as Executable S-Expression**
   ```typescript
   // Current: evalLambdaNumber executes individual functions
   // Goal: Execute entire memory as program
   class MemoryRuntime {
     private lips: LIPS;
     private memoryExpr: string;  // The ENTIRE memory as S-expr
     
     async execute(operation: string): Promise<any> {
       // Inject memory into environment
       const env = `
         (define memory ${this.memoryExpr})
         ${operation}`;
       
       const result = await this.lips.exec(env);
       
       // Extract modified memory
       this.memoryExpr = await this.lips.exec("memory");
       return result;
     }
   }
   ```

2. **Move Core Algorithms to S-Expressions**
   - ✅ `recallScoreFn` - Combines activation, recency, importance
   - ✅ `decayFn` - Computes decay rate based on success ratio
   - ✅ `explorationFn` - Selects surprise items
   - ❌ `spreadingActivation` - Still in JavaScript
   - ❌ `coReinforce` - Still in JavaScript

3. **Items as Potential Functions**
   ```scheme
   (item
     :id "m_7f3a2b"
     :text "(lambda (x) (activate x 0.9 5))"
     :type 'function
     :executable t
     :energy 0.8)
   ```
   When `:executable t`, the `:text` field can be evaluated

#### Phase 2: Self-Observation & Pattern Recognition

1. **Track Retrieval Success**
   ```scheme
   (history
     ((t 1735851234567) 
      (op recall) 
      (query "activation") 
      (returned (m1 m2 m3))
      (clicked m2)        ; User clicked m2
      (success 1.0))      ; Perfect retrieval
     
     ((t 1735851234590)
      (op recall)
      (query "memory")
      (returned (m4 m5))
      (clicked nil)       ; User didn't click any
      (success 0.0)))     ; Failed retrieval
   ```

2. **Analyze Patterns**
   ```scheme
   (analyze-patterns
     '(lambda (history)
       (let ((by-query-type (group-by classify-query history)))
         (map (lambda (group)
                (list (car group)  ; query type
                      (avg (map success (cdr group)))  ; avg success
                      (most-common (map params-used (cdr group)))))  ; best params
              by-query-type))))
   ```

3. **Evolve Specializations**
   When memory notices "activation" queries succeed with `decay=0.95`, it creates:
   ```scheme
   (evolved
     (activation-specialist
       '(lambda (query)
         (when (contains? query "activation")
           (with-params ((decay 0.95) (steps 4))
             (retrieve query))))))
   ```

#### Phase 3: Executable Abstractions

1. **Pattern Compression**
   When items `m1, m2, m3` are always recalled together:
   ```scheme
   (abstract!
     '(spreading-activation-concept
       :items (m1 m2 m3)
       :pattern "co-activation cluster"
       :executable t
       :code '(lambda () 
               (retrieve-all '(m1 m2 m3)))))
   ```

2. **Macro Discovery**
   Memory notices it always does `recall -> activate -> reinforce` sequence:
   ```scheme
   (evolved
     (recall-activate-reinforce
       '(lambda (query)
         (-> query
             recall
             (activate 0.9 3)
             (reinforce 0.1)))))
   ```

3. **Self-Rewriting**
   ```scheme
   (redefine-retrieve!
     '(lambda (new-retrieve)
       ;; Memory rewrites its own retrieval algorithm
       (set! (retrieve memory) new-retrieve)
       ;; Test new algorithm on recent queries
       (let ((test-results (map new-retrieve (recent-queries 10))))
         (if (> (avg-success test-results) 0.8)
             (commit!)
             (rollback!)))))
   ```

#### Phase 4: Emergence Dynamics

1. **Energy Accumulation**
   - Each successful retrieval adds energy
   - Each pattern recognition adds energy
   - Each failed retrieval subtracts energy

2. **Threshold Crossing**
   ```scheme
   (when (> (energy memory) (threshold memory))
     (emerge!))  ; Synthesize new capability
   ```

3. **Capability Synthesis**
   ```scheme
   (emerge!
     '(lambda ()
       (let* ((patterns (extract-patterns (history memory)))
              (abstraction (synthesize patterns))
              (new-capability (compile-to-function abstraction)))
         ;; Memory creates new function from patterns
         (set! (evolved memory)
               (cons (list (gensym "evolved-")
                          new-capability)
                     (evolved memory)))
         ;; Reset energy after emergence
         (set! (energy memory) 0))))
   ```

### Safety & Boundaries

1. **Sandboxed Execution**
   - Only S-expressions in `(retrieve)` and `(evolved)` can execute
   - No file system access from evolved functions
   - Execution timeout (5 seconds)
   - Rollback on error

2. **Convergence Guarantees**
   - Limit evolution to 10 functions
   - Test new algorithms on validation set before committing
   - Keep last 3 known-good retrieval algorithms

3. **Audit Trail**
   ```scheme
   (evolution-log
     ((t 1735851234567) (evolved "activation-specialist") (from-pattern "high-decay-success"))
     ((t 1735851234590) (rewrote retrieve) (improvement 0.15))
     ((t 1735851234612) (abstracted "spreading-cluster") (compressed 15 items)))
   ```

### Why This Matters

Current system: Memory stores things. Algorithm retrieves things. They're separate.

Homoiconic system: Memory IS the algorithm. It observes its own performance, rewrites its retrieval rules, and evolves new capabilities from usage patterns.

This isn't just storing memories - it's a memory that learns how to remember better.

### Available DSL Operations

Current operations you can use:
```scheme
;; Core operations
(remember text type importance ttl tags-list)
(recall query limit)
(feedback id 'success'|'fail')  ; Attributes success/fail to policy versions used
(associate from-id to-id relation weight)
(trace start-id depth)
(activate seed-ids steps decay threshold)

;; Policy management
(get-policy)  ; Returns all parameters
(set-policy &(:halfLifeDays 14 :activationSteps 4))  ; Update numeric params
(get-policy-fn)  ; Returns decay/recall-score/exploration functions
(set-policy-fn 'decay "(lambda (s f e i r b) (* b (+ 0.5 (* 1.5 (/ s (+ s f 1))))))")
(set-policy-fn 'recall-score "(lambda (a r i ac s f) (+ (* 0.7 a) (* 0.2 r) (* 0.1 i)))")
(set-policy-fn 'exploration "(lambda (limit n acts recs imps accs succ fails) 0)")  ; Arrays!

;; Policy versioning & evolution
(list-policy-versions)  ; Shows all versions with success/fail counts
(revert-policy-fn 'recall-score "abc123")  ; Revert to specific version by SHA-1

;; Maintenance
(decay! half-life-days)
(summarize item-ids)
(consolidate)
(snapshot)
(stats)
```

### Next Steps

#### Immediate (Phase 1 Completion)

1. **Pattern Analysis Function**
   - Implement `(analyze-patterns)` that examines policy version success rates
   - Compare versions: which `recallScoreFn` has best success/fail ratio?
   - Identify query patterns that correlate with specific policy success

2. **Automatic Evolution**
   - Implement `(evolve-policy)` that:
     - Analyzes recent session success/fail by policy version
     - When a version has >80% success rate, promote it
     - When current version fails >50%, revert to best historical version
   - Example: Memory notices v_abc123 of recall-score has 90% success, auto-adopts it

#### Phase 2: Self-Observation

1. **Success Tracking**
   - Extend history to include which items were clicked/used after recall
   - Compute retrieval precision metrics

2. **Automatic Parameter Tuning**
   - Memory notices patterns and adjusts its own policy
   - `(auto-tune)` operation that analyzes recent performance

#### Phase 3: Full Homoiconicity

1. **Store Spreading Activation as S-Expression**
   - Move the entire algorithm into policy
   - Memory can rewrite how activation propagates

2. **Executable Items**
   - Add `:executable` flag to items
   - When retrieved, executable items can modify memory

### Testing the Current System

```bash
# Start server
cd packages/vessel && bun run src/server.ts

# Create memories with feedback
curl -k -X POST https://localhost:1337 -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","id":1,"params":{"name":"memory","arguments":{"expr":"(remember \"homoiconic memory design\" \"concept\" 0.9 \"30d\" (list \"memory\" \"homoiconic\"))"}}}'

# Recall and provide feedback (tracks which policy versions were used)
curl -k -X POST https://localhost:1337 -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","id":2,"params":{"name":"memory","arguments":{"expr":"(recall \"homoiconic\" 5)"}}}'

# Mark first result as success (attributes to policy versions in that session)
curl -k -X POST https://localhost:1337 -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","id":3,"params":{"name":"memory","arguments":{"expr":"(feedback \"m_xxx\" \"success\")"}}}'

# Evolve recall scoring algorithm
curl -k -X POST https://localhost:1337 -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","id":4,"params":{"name":"memory","arguments":{"expr":"(set-policy-fn \"recall-score\" \"(lambda (a r i ac s f) (+ (* 0.8 a) (* 0.1 r) (* 0.1 (/ s (+ s f 1)))))\")"}}}' 

# Check policy version performance
curl -k -X POST https://localhost:1337 -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","id":5,"params":{"name":"memory","arguments":{"expr":"(list-policy-versions)"}}}'

# Revert to a successful version if needed
curl -k -X POST https://localhost:1337 -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","id":6,"params":{"name":"memory","arguments":{"expr":"(revert-policy-fn \"recall-score\" \"abc123def\")"}}}'
```

### Key Innovations

1. **Policy Versioning with SHA-1** - Every policy function is hashed and versioned
2. **Session Attribution** - Feedback tracks which policy versions produced results
3. **Performance Tracking** - Each version accumulates success/fail metrics
4. **Safe Evolution** - Can always revert to known-good versions
5. **Array Support** - Exploration function receives feature arrays for smarter selection

The memory now tracks which algorithms work best and can evolve or revert based on actual performance data.