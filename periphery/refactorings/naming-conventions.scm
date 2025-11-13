;;;; Naming Convention Refactorings
;;;; Reusable patterns for enforcing consistent naming

;;; Helper: Check if name follows convention
(define (needs-plexus-prefix? cls)
  (let ((name (@ cls :name))
        (ext (@ cls :extends)))
    (if (null? ext)
        #f
        (if (member "PlexusModel" ext)
            (not (string-starts-with? name "Plexus"))
            #f))))

;;; Refactoring: Add Plexus prefix to all PlexusModel subclasses
(define (normalize-plexus-names file)
  (let* ((classes (get-refactorable-classes file))
         (targets (filter needs-plexus-prefix? classes)))
    (if (null? targets)
        (list 'no-changes-needed)
        (refactor! targets (prefix "Plexus")))))

;;; Example usage:
;;; (normalize-plexus-names "src/models.ts")

;;; Helper: Check if class name is too generic
(define (is-generic-name? name)
  (member name (list "Model" "Base" "Helper" "Util" "Manager" "Service")))

;;; Refactoring: Add descriptive prefix to generic names
(define (fix-generic-names file prefix-name)
  (let* ((classes (get-refactorable-classes file))
         (generic (filter (lambda (c) (is-generic-name? (@ c :name))) classes)))
    (if (null? generic)
        (list 'no-generic-names-found)
        (refactor! generic (prefix prefix-name)))))

;;; Example:
;;; (fix-generic-names "src/utils.ts" "Config")
;;; Would rename "Manager" → "ConfigManager"

;;; Helper: Check if name has suffix
(define (needs-suffix? cls suffix)
  (not (string-ends-with? (@ cls :name) suffix)))

;;; Refactoring: Ensure all test classes end with "Test"
(define (normalize-test-names file)
  (let* ((classes (get-refactorable-classes file))
         (needs-suffix (filter (lambda (c) (needs-suffix? c "Test")) classes)))
    (if (null? needs-suffix)
        (list 'all-names-correct)
        (refactor! needs-suffix (suffix "Test")))))

;;; Refactoring: Ensure interfaces start with "I"
(define (normalize-interface-names file)
  (let* ((classes (get-refactorable-classes file))
         ;; Would need interface detection - for now just check extends
         (interfaces (filter (lambda (c) (null? (@ c :extends))) classes))
         (needs-prefix (filter (lambda (c)
                                 (not (string-starts-with? (@ c :name) "I")))
                              interfaces)))
    (if (null? needs-prefix)
        (list 'all-interfaces-correct)
        (refactor! needs-prefix (prefix "I")))))

;;; Composition: Fix all naming issues in a file
(define (fix-all-names file)
  (list
    (normalize-plexus-names file)
    (normalize-test-names file)))

;;; Next: Pattern matching for more complex naming conventions
;;; Example: CamelCase validation, acronym handling, etc.
