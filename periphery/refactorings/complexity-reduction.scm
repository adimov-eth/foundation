;;;; Complexity Reduction Refactorings
;;;; Find and simplify overly complex code

;;; Helper: Check if class has too many methods (complexity indicator)
(define (is-complex? cls threshold)
  (> (length (@ cls :methods)) threshold))

;;; Refactoring: Find classes that might need splitting
(define (find-complex-classes file threshold)
  (let* ((classes (get-refactorable-classes file))
         (complex (filter (lambda (c) (is-complex? c threshold)) classes)))
    (map (lambda (c)
      (list (@ c :name)
            (length (@ c :methods))
            (@ c :file)))
      complex)))

;;; Example:
;;; (find-complex-classes "periphery/src/discover.ts" 10)
;;; Returns classes with >10 methods (candidates for splitting)

;;; Helper: Compare file complexity
(define (complexity-report file)
  (let* ((counts (count-by-type file))
         (classes (get-refactorable-classes file))
         (avg-methods (if (null? classes)
                         0
                         (/ (reduce + 0 (map (lambda (c) (length (@ c :methods))) classes))
                            (length classes)))))
    (list
      (cons 'total-nodes (@ counts :total))
      (cons 'class-count (@ counts :classes))
      (cons 'function-count (@ counts :functions))
      (cons 'avg-methods-per-class avg-methods))))

;;; Analyze multiple files for refactoring candidates
(define (analyze-codebase files)
  (map (lambda (f)
    (list f (complexity-report f)))
    files))

;;; Example:
;;; (analyze-codebase (list "periphery/src/discover.ts" "periphery/src/act.ts"))

;;; Pattern: Find classes with no methods (possibly just data structures)
(define (find-data-classes file)
  (let* ((classes (get-refactorable-classes file))
         (data-only (filter (lambda (c) (eq? (length (@ c :methods)) 0)) classes)))
    (map (lambda (c) (@ c :name)) data-only)))

;;; These might be candidates for conversion to types/interfaces

;;; Pattern: Find classes with single method (possibly over-abstracted)
(define (find-single-method-classes file)
  (let* ((classes (get-refactorable-classes file))
         (single (filter (lambda (c) (eq? (length (@ c :methods)) 1)) classes)))
    (map (lambda (c)
      (list (@ c :name)
            (car (@ c :methods))))
      single)))

;;; These might be candidates for inlining or functional approach

;;; Refactoring: Add suffix to mark classes needing review
(define (mark-for-review file complexity-threshold suffix-text)
  (let* ((classes (get-refactorable-classes file))
         (complex (filter (lambda (c) (is-complex? c complexity-threshold)) classes)))
    (if (null? complex)
        (list 'no-complex-classes-found)
        (refactor! complex (suffix suffix-text)))))

;;; Example:
;;; (mark-for-review "src/huge-file.ts" 20 "ToSplit")
;;; Renames HugeClass → HugeClassToSplit

;;; Next: AST depth analysis for nested complexity
;;; Next: Cyclomatic complexity via control flow analysis
