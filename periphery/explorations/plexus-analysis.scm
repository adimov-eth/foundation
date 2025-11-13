;;;; Plexus Codebase Analysis via S-Expressions
;;;; Exploring what compositional refactoring enables

;;; Pattern 1: Find all emancipate calls across codebase
(begin
  (define plexus-model-patterns (find-patterns "plexus/plexus/src/PlexusModel.ts"))
  (define emancipations
    (filter (lambda (p) (eq? (@ p :type) "emancipate-call"))
            plexus-model-patterns))

  (list
    (cons 'total-patterns (length plexus-model-patterns))
    (cons 'emancipate-calls (length emancipations))
    (cons 'locations (map (lambda (p) (@ (@ p :location) :methodName)) emancipations))))

;;; Pattern 2: Find all parent assignments (potential adoption points)
(begin
  (define all-patterns (find-patterns "plexus/plexus/src/PlexusModel.ts"))
  (define parent-assigns
    (filter (lambda (p) (eq? (@ p :type) "parent-assignment"))
            all-patterns))

  (map (lambda (p)
    (list (@ (@ p :location) :methodName)
          (@ p :description)))
    parent-assigns))

;;; Pattern 3: Cross-reference emancipations with parent assignments
;;; (If emancipate() without subsequent parent assignment, might be orphanization)
(begin
  (define patterns (find-patterns "plexus/plexus/src/PlexusModel.ts"))
  (define emancipations
    (filter (lambda (p) (eq? (@ p :type) "emancipate-call")) patterns))
  (define parent-assigns
    (filter (lambda (p) (eq? (@ p :type) "parent-assignment")) patterns))

  (list
    (cons 'emancipate-count (length emancipations))
    (cons 'parent-assign-count (length parent-assigns))
    (cons 'ratio (/ (length parent-assigns) (length emancipations)))))

;;; Pattern 4: Find all classes that could be PlexusModel subclasses
;;; (Currently just exploring - no refactoring yet)
(begin
  (define tracking-classes (get-refactorable-classes "plexus/plexus/src/tracking.ts"))
  (define cache-classes (get-refactorable-classes "plexus/plexus/src/entity-cache.ts"))

  (list
    (cons 'tracking (map (lambda (c) (@ c :name)) tracking-classes))
    (cons 'cache (map (lambda (c) (@ c :name)) cache-classes))))

;;; Pattern 5: Hypergraph of PlexusModel relationships
(begin
  (define hg (build-plexus-model-graph "plexus/plexus/src/PlexusModel.ts"))
  (define metrics (hypergraph-metrics hg))
  (list
    (cons 'vertex-count (@ metrics :vertexCount))
    (cons 'edge-count (@ metrics :edges))
    (cons 'density (@ metrics :density))))

;;; Next: Use these insights to plan actual refactorings
;;; Example: If we find classes that should extend PlexusModel but don't,
;;; we could refactor them automatically with proper inheritance
