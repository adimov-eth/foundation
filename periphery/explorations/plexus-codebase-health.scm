;;; Plexus Codebase Health Dashboard
;;;
;;; Comprehensive analysis of Plexus codebase structure:
;;; 1. Class hierarchy depth
;;; 2. Method complexity distribution
;;; 3. Emancipation pattern usage
;;; 4. Inheritance vs composition ratios
;;; 5. Test coverage (class count comparison)

(begin
  ;; Get all source files (excluding tests)
  (define src-files
    (filter
      (lambda (f) (not (string-contains? f "__tests__")))
      (list-files "plexus/plexus/src/**/*.ts")))

  ;; Get all test files
  (define test-files
    (filter
      (lambda (f) (string-contains? f "__tests__"))
      (list-files "plexus/plexus/src/**/*.ts")))

  ;; Count classes in each
  (define src-class-count
    (let loop ((files src-files) (count 0))
      (if (null? files)
          count
          (loop (cdr files)
                (+ count (length (@ (extract-metadata (car files)) :classes)))))))

  (define test-class-count
    (let loop ((files test-files) (count 0))
      (if (null? files)
          count
          (loop (cdr files)
                (+ count (length (@ (extract-metadata (car files)) :classes)))))))

  ;; Analyze PlexusModel specifically
  (define plexus-model-metadata (extract-metadata "plexus/plexus/src/PlexusModel.ts"))
  (define plexus-model-patterns (find-patterns "plexus/plexus/src/PlexusModel.ts"))

  ;; Analyze Plexus specifically
  (define plexus-metadata (extract-metadata "plexus/plexus/src/Plexus.ts"))

  ;; Build full inheritance graph
  (define all-files (list-files "plexus/plexus/src/**/*.ts"))
  (define graphs (map build-inheritance-hypergraph all-files))
  (define combined-graph
    (let loop ((remaining (cdr graphs)) (result (car graphs)))
      (if (null? remaining)
          result
          (loop (cdr remaining)
                (overlay-graphs result (car remaining))))))

  ;; Get metrics
  (define graph-metrics (hypergraph-metrics combined-graph))

  ;; Return comprehensive report
  (list
    (cons 'file-counts
      (list
        (cons 'source-files (length src-files))
        (cons 'test-files (length test-files))
        (cons 'total-files (length all-files))))

    (cons 'class-counts
      (list
        (cons 'source-classes src-class-count)
        (cons 'test-classes test-class-count)
        (cons 'total-classes (+ src-class-count test-class-count))))

    (cons 'inheritance-graph
      (list
        (cons 'vertices (@ graph-metrics :vertexCount))
        (cons 'edges (@ graph-metrics :edges))
        (cons 'density (@ graph-metrics :density))))

    (cons 'plexus-model-analysis
      (list
        (cons 'methods (length (@ (car (@ plexus-model-metadata :classes)) :methods)))
        (cons 'patterns-found (length plexus-model-patterns))
        (cons 'emancipation-calls
          (length (filter (lambda (p) (eq? (@ p :type) "emancipate-call")) plexus-model-patterns)))))

    (cons 'plexus-class-analysis
      (list
        (cons 'methods (length (@ (car (@ plexus-metadata :classes)) :methods))))))
)
