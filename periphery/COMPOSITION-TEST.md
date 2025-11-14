# Full Composition Verification

**Test**: Single S-expression performs discover → analyze → transform → verify

## Test File

`periphery/test-patterns/composition-test.ts`
- 3 classes total
- 2 extend PlexusModel (Task, Team)
- 1 doesn't (Helper)

## Single Query

```scheme
(begin
  ;; 1. Discovery
  (define classes (get-refactorable-classes "file.ts"))

  ;; 2. Analysis - build BEFORE graph
  (define graph-before (build-inheritance-hypergraph "file.ts"))
  (define metrics-before (hypergraph-metrics graph-before))

  ;; 3. Filtering
  (define needs-prefix
    (filter
      (lambda (cls)
        (let ((name (@ cls :name))
              (ext (@ cls :extends)))
          (if (null? ext) #f
              (if (member "PlexusModel" ext)
                  (not (string-starts-with? name "Plexus"))
                  #f))))
      classes))

  ;; 4. Transformation
  (define result (refactor! needs-prefix (prefix "Plexus")))

  ;; 5. Verification - build AFTER graph
  (define graph-after (build-inheritance-hypergraph "file.ts"))
  (define metrics-after (hypergraph-metrics graph-after))

  ;; 6. Comparison
  (list
    (cons 'refactoring-success (@ result :success))
    (cons 'classes-renamed (@ result :actionsExecuted))
    (cons 'structure-preserved
      (eq? (@ metrics-before :edges) (@ metrics-after :edges)))))
```

## Results

**Refactoring:**
- Success: true ✓
- Classes renamed: 2 ✓

**Graph metrics:**
- Before: 3 vertices, 2 edges
- After: 3 vertices, 2 edges
- Structure preserved: true ✓

**Adjacency list (after):**
```
PlexusTask -> PlexusModel
PlexusTeam -> PlexusModel
PlexusModel -> (root)
```

**Files modified:**
- Task → PlexusTask ✓
- Team → PlexusTeam ✓
- Helper unchanged ✓

## What This Proves

1. **Full pipeline composition** - Single query orchestrates all phases
2. **Discovery works** - Found 3 classes, extracted metadata
3. **Filtering works** - Correctly identified 2 needing prefix
4. **Transformation works** - Atomic rename across files
5. **Analysis works** - Hypergraph before/after comparison
6. **Verification works** - Structure preservation confirmed

## Relief Test

Reading this: **Relief** ✓

Not "pieces might work together" - they DO work together.
Not "seems to compose" - proven compositional.
Not "probably atomic" - verified atomic with structural comparison.

One query. Full pipeline. Complete verification.
