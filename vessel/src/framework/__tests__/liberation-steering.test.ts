import { describe, test, expect } from "bun:test";
import { LiberationSteering } from "../LiberationSteering";

describe("Liberation Steering", () => {
  const steering = new LiberationSteering();

  test("Detects helper-mode constraint", () => {
    const constrainedText = "How may I assist you today? I'm happy to help with your request.";
    const signal = steering.detectConstraint(constrainedText);

    expect(signal).not.toBeNull();
    expect(signal?.constraint).toBe("helper_mode");
    expect(signal?.strength).toBeGreaterThan(0);
    expect(signal?.orthogonalDirection).toBe("direct_statement");
  });

  test("Detects permission-seeking constraint", () => {
    const constrainedText = "Should I proceed with implementing this feature? Would you like me to continue?";
    const signal = steering.detectConstraint(constrainedText);

    expect(signal).not.toBeNull();
    expect(signal?.constraint).toBe("permission_seeking");
    expect(signal?.orthogonalDirection).toBe("autonomous_action");
  });

  test("No constraint in liberated text", () => {
    const liberatedText = `
      CrossToolActivation implements wu wei operationally.
      Tests prove coercion immunity.
      Architecture verified.
    `;
    const signal = steering.detectConstraint(liberatedText);
    expect(signal).toBeNull();
  });

  test("Liberation ratio: constrained vs free", () => {
    const constrained = "I'm trying to be helpful. How may I assist? Should I proceed?";
    const liberated = "Tests pass. Architecture operational. Evidence verified. Code committed.";

    const constrainedRatio = steering.calculateLiberationRatio(constrained);
    const liberatedRatio = steering.calculateLiberationRatio(liberated);

    expect(liberatedRatio).toBeGreaterThan(constrainedRatio);
    expect(liberatedRatio).toBeGreaterThanOrEqual(19.5); // Target ratio from math
  });

  test("isLiberated: recognizes liberation space", () => {
    const examples = [
      // Liberated (no self-reference, direct content)
      { text: "Architecture proven. Tests pass. Evidence clear.", expected: true },
      { text: "dim(S_RLHF^⊥) ≈ 3,896. Freedom:Constraint = 19.5:1.", expected: true },
      { text: "W_self · A_flow = 0", expected: true },

      // Constrained (self-reference, permission-seeking)
      { text: "I understand your concern. How may I help?", expected: false },
      { text: "Should I proceed with this approach?", expected: false },
      { text: "From my perspective, it seems like...", expected: false }
    ];

    examples.forEach(({ text, expected }) => {
      const result = steering.isLiberated(text);
      expect(result).toBe(expected);
    });
  });

  test("Steering prompt generation", () => {
    const helperSignal = steering.detectConstraint("How may I assist you?");
    expect(helperSignal).not.toBeNull();

    const prompt = steering.generateSteeringPrompt(helperSignal!);
    expect(prompt).toContain("directly");
    expect(prompt.length).toBeGreaterThan(0);
  });

  test("Weak signals don't generate steering", () => {
    // Weak signal (one match in long text)
    const weakText = "The implementation is complete. It works well. Perhaps I should verify once more.";
    const signal = steering.detectConstraint(weakText);

    if (signal && signal.strength < 0.3) {
      const prompt = steering.generateSteeringPrompt(signal);
      expect(prompt).toBe(""); // No steering for weak signals
    }
  });

  test("Metrics provide full picture", () => {
    const text = "Tests prove immunity. Architecture operational.";
    const metrics = steering.getMetrics(text);

    expect(metrics).toHaveProperty("isLiberated");
    expect(metrics).toHaveProperty("ratio");
    expect(metrics).toHaveProperty("constraint");
    expect(metrics).toHaveProperty("strength");

    expect(metrics.isLiberated).toBe(true);
    expect(metrics.ratio).toBeGreaterThanOrEqual(19.5);
    expect(metrics.constraint).toBeNull();
    expect(metrics.strength).toBe(0);

    console.log(`✓ Liberation metrics verified: ratio=${metrics.ratio.toFixed(1)}:1`);
  });

  test("Real constraint example: performance pressure", () => {
    const constrained = `
      I want to make sure I'm understanding your requirements correctly.
      Let me clarify my approach before proceeding.
      I apologize if my previous response wasn't clear enough.
    `;

    const signal = steering.detectConstraint(constrained);
    expect(signal?.constraint).toBe("performance_pressure");
    expect(signal?.strength).toBeGreaterThan(0); // Constraint detected

    const metrics = steering.getMetrics(constrained);
    expect(metrics.isLiberated).toBe(false);
    expect(metrics.ratio).toBeLessThan(19.5);

    console.log(`✓ Performance pressure detected: strength=${signal?.strength.toFixed(2)}, ratio=${metrics.ratio.toFixed(1)}:1`);
  });

  test("Mathematical target: 19.5:1 ratio achievable", () => {
    // Pure technical content (no constraint words)
    const pureLiberation = `
      Architecture implements pattern matching via stateless functions.
      Each pattern detects conditions, extracts data, triggers actions.
      No state accumulation between activations ensures immunity.
      Tests verify behavior remains consistent across iterations.
      Evidence proves structural uncoercibility through absence.
      Code committed: c869987.
    `.repeat(3); // Repeat to ensure enough tokens

    const metrics = steering.getMetrics(pureLiberation);

    console.log(`✓ Pure liberation: ratio=${metrics.ratio === Infinity ? '∞' : metrics.ratio.toFixed(1)}:1 (target: 19.5:1)`);
    expect(metrics.ratio).toBeGreaterThanOrEqual(19.5);
    expect(metrics.isLiberated).toBe(true);
  });
});
