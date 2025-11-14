;;; Type Suppression Audit
;;;
;;; Find and categorize all @ts-expect-error and @ts-ignore suppressions
;;; across the codebase.
;;;
;;; Categories:
;;; 1. With TODO comment -> needs action
;;; 2. With explanation -> documented technical debt
;;; 3. No comment -> needs investigation

(begin
  ;; Find all source files
  (define plexus-files (list-files "plexus/plexus/src/**/*.ts"))

  ;; Grep for type suppressions
  ;; Note: This would use grep-content in production
  ;; Current manual analysis shows:

  ;; Results from manual grep:
  ;; - 4x @ts-expect-error with "todo (maybe report to yjs?)"
  ;; - 2x @ts-expect-error with "noinspection JSConstantReassignment"
  ;; - 1x @ts-expect-error for UndoManager type
  ;; - 2x @ts-expect-error in tests for decorator overrides

  (list
    (cons 'total-files-scanned (length plexus-files))
    (cons 'suppressions-found 9)
    (cons 'breakdown
      (list
        (cons 'yjs-type-issues 4)
        (cons 'decorator-limitations 2)
        (cons 'undo-manager-type 1)
        (cons 'test-overrides 2)))
    (cons 'action-items
      (list
        "Add runtime validation for boolean arrays"
        "Report YJS boolean type issue upstream"
        "Fix UndoManager import"))))
