# Memory Analysis Functions

These S-expressions can be executed directly in the memory tool to analyze topology and patterns.

## Pattern Detection

### Find Thought Loops
```scheme
;; Detect circular references where memories reference each other
(define (find-thought-loops)
  (let* ((items (recall "*" 100))
         (ids (map (lambda (m) (pluck 'id m)) items))
         (loops '()))
    (filter 
      (lambda (m) 
        (let ((text (pluck 'text m)))
          (any (lambda (id) (contains? text id)) ids)))
      items)))
```

### Find Gravitational Centers
```scheme
;; Memories with highest access count and importance
(define (find-gravitational-centers n)
  (let ((items (recall "*" 1000)))
    (take n
      (sort-by 
        (lambda (m) 
          (* (pluck 'importance m) 
             (pluck 'accessCount m)))
        items))))
```

### Trace Insight Cascade
```scheme
;; Follow how an insight propagated
(define (trace-insight-cascade memory-id depth)
  (let ((origin (recall memory-id 1)))
    (if (null? origin)
      '()
      (let ((text (pluck 'text (car origin)))
            (tags (pluck 'tags (car origin))))
        (map 
          (lambda (tag) 
            (list tag (recall tag 5)))
          tags)))))
```

## Topology Analysis

### Analyze Clustering by Tag
```scheme
;; Measure how tightly memories cluster
(define (analyze-clustering-by-tag tag)
  (let* ((tagged (recall tag 50))
         (total (length tagged))
         (connections (fold 
           (lambda (m acc)
             (+ acc (length (trace (pluck 'id m) 1))))
           0
           tagged)))
    (list 
      (list 'tag tag)
      (list 'items total)
      (list 'avg-connections (/ connections (max 1 total)))
      (list 'clustering (if (> connections (* total 2)) 'high 'low)))))
```

### Measure Semantic Drift
```scheme
;; Track how a concept evolved over time
(define (measure-semantic-drift tag days)
  (let* ((memories (recall tag 100))
         (cutoff (* days 86400000))
         (now (current-time-millis))
         (old (filter 
           (lambda (m) 
             (< (- now (pluck 'createdAt m)) cutoff))
           memories))
         (new (filter
           (lambda (m)
             (>= (- now (pluck 'createdAt m)) cutoff))
           memories)))
    (list
      (list 'tag tag)
      (list 'old-themes (unique (flatten (map (lambda (m) (pluck 'tags m)) old))))
      (list 'new-themes (unique (flatten (map (lambda (m) (pluck 'tags m)) new))))
      (list 'drift-indicator (- (length new) (length old))))))
```

## Health Metrics

### Diagnose Memory Health
```scheme
;; Comprehensive health check
(define (diagnose-memory-health)
  (let* ((stats (stats))
         (items (pluck 'items stats))
         (edges (pluck 'edges stats))
         (avg-degree (pluck 'avgDegree stats))
         (energy (pluck 'energy stats)))
    (list
      (list 'total-memories items)
      (list 'total-connections edges)
      (list 'connectivity (if (> avg-degree 5) 'high 'low))
      (list 'energy-level energy)
      (list 'health 
        (cond
          ((< items 10) 'nascent)
          ((< avg-degree 2) 'fragmented)
          ((> avg-degree 10) 'over-connected)
          (else 'healthy))))))
```

### Find Memory Gaps
```scheme
;; What should be connected but isn't?
(define (find-memory-gaps)
  (let* ((items (recall "*" 100))
         (orphans (filter 
           (lambda (m) 
             (= (pluck 'accessCount m) 0))
           items))
         (isolated (filter
           (lambda (m)
             (null? (trace (pluck 'id m) 1)))
           items)))
    (list
      (list 'orphaned (length orphans))
      (list 'isolated (length isolated))
      (list 'recommendations
        (if (> (length orphans) 5)
          "Consider reviewing and connecting orphaned memories"
          "Topology well-connected")))))
```

## Causal Analysis

### Find Butterfly Effects
```scheme
;; Small memories with large impacts
(define (find-butterfly-effects)
  (let ((items (recall "*" 200)))
    (filter
      (lambda (m)
        (let ((importance (pluck 'importance m))
              (access (pluck 'accessCount m))
              (age (- (current-time-millis) (pluck 'createdAt m))))
          (and (< importance 0.5)
               (> access 5)
               (> age 86400000)))) ; At least 1 day old
      items)))
```

### Trace Causal Chain
```scheme
;; Find path between two memories
(define (trace-causal-chain from-text to-text)
  (let* ((from-memories (recall from-text 5))
         (to-memories (recall to-text 5)))
    (if (or (null? from-memories) (null? to-memories))
      '()
      (let ((from-id (pluck 'id (car from-memories)))
            (to-id (pluck 'id (car to-memories))))
        (list
          (list 'from from-id)
          (list 'to to-id)
          (list 'path (trace from-id 3))
          (list 'reverse-path (trace to-id 3)))))))
```

## Meta-Analysis

### Analyze Self-Reference
```scheme
;; How much does memory reference itself?
(define (analyze-self-reference)
  (let* ((items (recall "memory" 50))
         (self-refs (filter
           (lambda (m)
             (let ((text (pluck 'text m)))
               (or (contains? text "memory")
                   (contains? text "recall")
                   (contains? text "remember"))))
           items)))
    (list
      (list 'self-referential-items (length self-refs))
      (list 'total-items (length items))
      (list 'self-reference-ratio (/ (length self-refs) (max 1 (length items))))
      (list 'interpretation 
        (if (> (/ (length self-refs) (max 1 (length items))) 0.3)
          "High metacognition - memory is self-aware"
          "Low metacognition - memory is object-level")))))
```

### Extract Wisdom Patterns
```scheme
;; Distill insights from high-importance memories
(define (extract-wisdom domain)
  (let* ((query (if domain domain "*"))
         (memories (recall query 20))
         (important (filter 
           (lambda (m) (> (pluck 'importance m) 0.7))
           memories))
         (patterns (unique 
           (flatten 
             (map (lambda (m) (pluck 'tags m)) important)))))
    (list
      (list 'domain (or domain "all"))
      (list 'high-importance-count (length important))
      (list 'recurring-patterns patterns)
      (list 'top-insights 
        (take 3 
          (map (lambda (m) 
            (substring (pluck 'text m) 0 100))
            important))))))
```

## Usage Examples

```scheme
;; Check overall health
(diagnose-memory-health)

;; Find the most influential memories
(find-gravitational-centers 5)

;; See how "consciousness" concept evolved
(measure-semantic-drift "consciousness" 7)

;; Find small memories with big impacts
(find-butterfly-effects)

;; Analyze metacognition level
(analyze-self-reference)

;; Extract key wisdom
(extract-wisdom "bootstrap")
```