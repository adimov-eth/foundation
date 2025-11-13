;;;; Real-World Refactoring: Clean Up Test Files
;;;; Let's use our tools to improve actual code

;;; Discovery: What test files exist?
(begin
  (define test-files (list-files "periphery/src/__tests__/*.ts"))
  test-files)

;;; Exploration: What's in the hypergraph tests?
(begin
  (define hypergraph-classes
    (get-refactorable-classes "periphery/src/__tests__/hypergraph.test.ts"))
  (map (lambda (c) (@ c :name)) hypergraph-classes))

;;; Count AST nodes in test files (complexity metric)
(begin
  (define rollback-count (count-nodes "periphery/src/__tests__/rollback.test.ts"))
  (define act-count (count-nodes "periphery/src/__tests__/act.test.ts"))
  (define hypergraph-count (count-nodes "periphery/src/__tests__/hypergraph.test.ts"))

  (list
    (list 'rollback rollback-count)
    (list 'act act-count)
    (list 'hypergraph hypergraph-count)))

;;; Pattern analysis: Are there patterns in test code we should refactor?
(begin
  (define patterns (find-patterns "periphery/src/__tests__/act.test.ts"))
  (length patterns))

;;; Practical refactoring target: Find all classes without proper naming
;;; Example: Classes named "Test" or "Demo" that should be descriptive
(begin
  (define all-test-classes
    (get-refactorable-classes "periphery/src/__tests__/act.test.ts"))

  ;; Check if any classes need renaming
  (map (lambda (c)
    (list (@ c :name)
          (@ c :file)))
    all-test-classes))

;;; ACTUAL REFACTORING TARGET: Clean up demo files
;;; We have multiple demo-*.ts files - let's ensure they follow conventions

(begin
  (define demo-files (list-files "periphery/demo-*.ts"))
  (length demo-files))

;;; Check one demo file for refactoring opportunities
(begin
  (define demo-classes
    (get-refactorable-classes "periphery/demo-compositional-api.ts"))
  (map (lambda (c) (@ c :name)) demo-classes))

;;; REAL ACTION: Let's refactor test utility classes
;;; If we find any test utilities that could be better named

;;; Next: Actually execute a refactoring on real code
;;; Example: If we have utility classes with generic names,
;;; rename them to be more descriptive

;;; First, let's see what's actually there
(begin
  (define integration-classes
    (get-refactorable-classes "periphery/src/__tests__/hypergraph-integration.test.ts"))
  (map (lambda (c)
    (list (@ c :name) (@ c :extends)))
    integration-classes))
