# What Actually Works

Forget the fancy documentation. Here's what you can actually do:

## Core Operations

### 1. Find Gravitational Centers
```scheme
;; Start from any memory and see what it pulls
(activate (list "memory_id") 3 0.8 0.1)
;; args: seed_ids, steps, decay, threshold
```

### 2. See Current Topology
```scheme
(stats)
;; Shows items, edges, average degree, top tags, energy
```

### 3. Query and Reinforce
```scheme
;; Find memories about something
(recall "consciousness" 10)

;; Make important ones stronger
(feedback "memory_id" "success")

;; Make noise fade
(feedback "memory_id" "fail")
```

### 4. Let It Evolve
```scheme
;; Apply natural decay (7-day half-life)
(decay! 7)

;; Consolidate clusters into summaries
(consolidate)
```

## Real Analysis Examples

### Find the strongest memory cluster
```scheme
;; Pick a high-importance memory from (recall "*" 100)
;; Then activate from it to see its cluster
(activate (list "m_mf2lmo4c_bc191c83") 3 0.8 0.1)
```

### Trace concept evolution
```scheme
;; See how a concept changed over time
(recall "consciousness" 50)
;; Look at createdAt timestamps to see evolution
```

### Find orphaned thoughts
```scheme
(recall "*" 200)
;; Look for accessCount: 0 - those are disconnected
```

### Strengthen a pathway
```scheme
;; Create association between two memories
(associate "from_id" "to_id" "relates-to" 0.8)
```

## The Real Insight

The spreading activation IS the analysis. You don't need complex functions - just:
1. Pick a starting point
2. Activate from it
3. See what gets pulled in
4. That's your actual conceptual topology

The memories with highest activation in the spread are the gravitational centers. The ones that appear in multiple spreads are the bridges. The ones never activated are the orphans.

## Custom Recall Scoring

The only real analysis customization is the recall algorithm:

```scheme
(set-policy-fn "recall-score" 
  "(lambda (activation recency importance access success fail)
    ;; Your custom scoring logic here
    (+ (* 0.5 activation)   ; How connected
       (* 0.3 importance)   ; How significant  
       (* 0.2 (/ success (+ success fail 1)))))") ; How useful
```

This changes how memories are ranked when recalled. That's the actual control point for shaping retrieval.