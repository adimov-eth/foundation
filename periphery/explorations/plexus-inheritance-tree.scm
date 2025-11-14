;;; Plexus Inheritance Tree Analysis
;;;
;;; Build complete inheritance hierarchy for all PlexusModel subclasses
;;; across the entire Plexus codebase.

(begin
  ;; 1. Find all TypeScript files in plexus
  (define plexus-files (list-files "plexus/plexus/src/**/*.ts"))

  ;; 2. Extract all classes from all files
  (define all-classes
    (apply append
      (map (lambda (file)
             (let ((metadata (extract-metadata file)))
               (let ((classes (@ metadata :classes)))
                 (map (lambda (c)
                        (list
                          (cons 'name (@ c :name))
                          (cons 'extends (@ c :extends))
                          (cons 'file file)))
                      classes))))
           plexus-files)))

  ;; 3. Build inheritance hypergraph from all files
  (define inheritance-graphs
    (map (lambda (file) (build-inheritance-hypergraph file))
         plexus-files))

  ;; 4. Combine all inheritance graphs
  (define combined-graph
    (if (null? inheritance-graphs)
        (build-inheritance-hypergraph "plexus/plexus/src/PlexusModel.ts")
        (let loop ((graphs (cdr inheritance-graphs))
                   (result (car inheritance-graphs)))
          (if (null? graphs)
              result
              (loop (cdr graphs)
                    (overlay-graphs result (car graphs)))))))

  ;; 5. Get metrics
  (define metrics (hypergraph-metrics combined-graph))

  ;; 6. Generate DOT visualization
  (define dot (hypergraph-to-dot combined-graph))

  ;; Return summary
  (list
    (cons 'total-files (length plexus-files))
    (cons 'total-classes (length all-classes))
    (cons 'inheritance-metrics metrics)
    (cons 'visualization-available true)))
