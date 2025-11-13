;;;; Cross-File Refactoring Exploration
;;;; Testing what's possible with compositional primitives

;;; Goal: Refactor multiple files atomically
;;; Start simple: find all test files and see what's refactorable

(begin
  (define test-files (list-files "periphery/src/__tests__/*.ts"))
  (length test-files))

;;; Load all classes from test files
(begin
  (define rollback-test-classes
    (get-refactorable-classes "periphery/src/__tests__/rollback.test.ts"))
  (define act-test-classes
    (get-refactorable-classes "periphery/src/__tests__/act.test.ts"))

  (list
    (cons 'rollback (map (lambda (c) (@ c :name)) rollback-test-classes))
    (cons 'act (map (lambda (c) (@ c :name)) act-test-classes))))

;;; Explore: What classes exist in periphery src/?
(begin
  (define discover (get-refactorable-classes "periphery/src/discover.ts"))
  (define act (get-refactorable-classes "periphery/src/act.ts"))
  (define server (get-refactorable-classes "periphery/src/server.ts"))

  (list
    (list 'Discover (@ (car discover) :methods))
    (list 'Act (@ (car act) :methods))
    (list 'PeripheryServer (@ (car server) :methods))))

;;; Explore: What can we learn from counting?
(begin
  (define count-discover (count-by-type "periphery/src/discover.ts"))
  (define count-act (count-by-type "periphery/src/act.ts"))

  (list
    (cons 'discover-functions (@ count-discover :functions))
    (cons 'discover-classes (@ count-discover :classes))
    (cons 'act-functions (@ count-act :functions))
    (cons 'act-classes (@ count-act :classes))))

;;; Next exploration: dependency analysis
(begin
  (define dep-graph (dependency-graph "periphery/src/discover.ts"))
  (list
    (cons 'modules (length (@ dep-graph :modules)))
    (cons 'edges (length (@ dep-graph :edges)))))

;;; Ultimate goal: Cross-file atomic refactoring
;;; Example pattern:
;;; (begin
;;;   (define all-files (list-files "periphery/src/*.ts"))
;;;   (define all-classes (flatten (map get-refactorable-classes all-files)))
;;;   (define targets (filter some-predicate all-classes))
;;;   (refactor! targets some-transform))
;;;
;;; This would refactor across ENTIRE codebase atomically
