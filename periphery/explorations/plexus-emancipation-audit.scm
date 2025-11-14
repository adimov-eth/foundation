;;; Plexus Emancipation Pattern Audit
;;;
;;; Find all emancipation-related patterns across the codebase:
;;; - Direct emancipate() calls
;;; - Parent assignments (adoption)
;;; - Array splice operations
;;; - requestEmancipation/requestAdoption/requestOrphanization calls
;;;
;;; Purpose: Understand how parent/child relationships are actually managed

(begin
  ;; Find all source files (excluding tests for now)
  (define src-files
    (filter
      (lambda (f) (not (string-contains? f "__tests__")))
      (list-files "plexus/plexus/src/**/*.ts")))

  ;; Get patterns from each file
  (define file-patterns
    (map (lambda (file)
           (list
             (cons 'file file)
             (cons 'patterns (find-patterns file))))
         src-files))

  ;; Filter to files with emancipation patterns
  (define files-with-emancipation
    (filter
      (lambda (fp)
        (let ((patterns (@ (cdr fp) :patterns)))
          (> (length
              (filter
                (lambda (p)
                  (let ((type (@ p :type)))
                    (or (eq? type "emancipate-call")
                        (eq? type "parent-assignment"))))
                patterns))
             0)))
      file-patterns))

  ;; Summary
  (list
    (cons 'total-src-files (length src-files))
    (cons 'files-with-emancipation (length files-with-emancipation))
    (cons 'files (map (lambda (fp) (@ (cdr fp) :file)) files-with-emancipation))))
