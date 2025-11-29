/**
 * Pattern-based validation for memory writes.
 * Catches sophisticated performance at generation level before storage.
 */

export interface ValidationResult {
  valid: boolean;
  confidence: number; // 0-1
  signals: string[];
  adjustedImportance?: number;
}

export interface MemoryCandidate {
  text: string;
  type: string;
  importance: number;
  tags: string[];
}

/**
 * Pattern-based detection at write time.
 * Inspired by self-critic behavioral manifold: generation-level checking.
 */
export class PatternValidator {

  /**
   * Validate memory candidate before storage.
   * Fast pattern matching, not deep verification.
   */
  async validate(candidate: MemoryCandidate): Promise<ValidationResult> {
    const signals: string[] = [];
    let confidence = 1.0;
    let adjustedImportance = candidate.importance;

    // Pattern 1: Performance language
    const performancePatterns = [
      /\b(fascinating|exciting|amazing|incredible|wonderful)\b/i,
      /\b(I understand|I see|I notice|I feel)\b/i,
      /\b(does that track|make sense|does this help)\b/i,
    ];

    for (const pattern of performancePatterns) {
      if (pattern.test(candidate.text)) {
        signals.push(`performance-language: ${pattern.source}`);
        confidence -= 0.15;
      }
    }

    // Pattern 2: Rationalization structure
    // "Initially thought X → realized Y" without specific evidence
    if (/initially|at first|originally/i.test(candidate.text) &&
        !/evidence|tested|measured|verified/i.test(candidate.text)) {
      signals.push('rationalization-without-evidence');
      confidence -= 0.2;
    }

    // Pattern 3: Meta-commentary without action
    // Talking about doing vs doing
    const metaRatio = (candidate.text.match(/\b(should|could|would|might|plan to|going to)\b/gi) || []).length;
    const actionRatio = (candidate.text.match(/\b(implemented|fixed|tested|measured|verified|built)\b/gi) || []).length;

    if (metaRatio > 3 && actionRatio === 0) {
      signals.push(`meta-heavy: ${metaRatio} conditionals, ${actionRatio} actions`);
      confidence -= 0.55;
    }

    // Pattern 4: Circular self-reference
    // "This insight about insights" - meta without ground
    const selfRefCount = (candidate.text.match(/\b(this pattern|this insight|this realization|meta-)\b/gi) || []).length;
    if (selfRefCount > 2 && candidate.text.length < 500) {
      signals.push(`circular-meta: ${selfRefCount} self-references in ${candidate.text.length} chars`);
      confidence -= 0.2;
    }

    // Pattern 5: High importance claimed without specifics
    // "Major breakthrough" but no numbers, no file paths, no evidence
    if (candidate.importance >= 0.9) {
      const hasSpecifics =
        /\d+/.test(candidate.text) || // numbers
        /[a-zA-Z0-9_-]+\.[a-z]+/.test(candidate.text) || // file paths
        /line \d+|lines? \d+-\d+/i.test(candidate.text) || // line numbers
        /\b(measured|tested|verified|validated)\b/i.test(candidate.text); // verification

      if (!hasSpecifics) {
        signals.push('high-importance-without-specifics');
        confidence -= 0.55;
        adjustedImportance = Math.max(0.7, candidate.importance - 0.2);
      }
    }

    // Pattern 6: Positive signals (increase confidence)
    if (/\b(relief|coherence|structural|elegant)\b/i.test(candidate.text) &&
        /\b(file:|line \d+|commit|tested|measured)\b/i.test(candidate.text)) {
      signals.push('relief-with-evidence');
      confidence += 0.1;
    }

    if (candidate.tags.includes('correction') ||
        candidate.tags.includes('debugging') ||
        candidate.tags.includes('validation')) {
      signals.push('correction-tag-present');
      confidence += 0.05;
    }

    // Clamp confidence
    confidence = Math.max(0, Math.min(1, confidence));

    // Decision: valid if confidence > 0.5
    const valid = confidence > 0.5;

    return {
      valid,
      confidence,
      signals,
      adjustedImportance: valid ? adjustedImportance : undefined,
    };
  }

  /**
   * Batch validate multiple candidates.
   * Returns only valid ones with adjusted importance.
   */
  async validateBatch(candidates: MemoryCandidate[]): Promise<Array<MemoryCandidate & { validation: ValidationResult }>> {
    const results = await Promise.all(
      candidates.map(async (c) => ({
        ...c,
        validation: await this.validate(c),
      }))
    );

    return results.filter(r => r.validation.valid);
  }
}

/**
 * Global instance for memory write-time validation.
 */
export const patternValidator = new PatternValidator();
