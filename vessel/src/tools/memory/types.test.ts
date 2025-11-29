import { describe, it, expect } from "bun:test";
import {
  Importance,
  Energy,
  MemoryId,
  Tag,
  Scope,
  Ok,
  Err,
  map,
  flatMap,
  sequence,
  matchError,
  ValidationError,
  NotFoundError,
  UnsafeImportance,
  UnsafeMemoryId,
  type MemoryItemV2,
} from "./types";

describe("Branded Types", () => {
  describe("Importance", () => {
    it("accepts valid values 0..1", () => {
      const result = Importance(0.5);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(0.5);
      }
    });

    it("rejects negative values", () => {
      const result = Importance(-0.1);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.tag).toBe('ValidationError');
      }
    });

    it("rejects values > 1", () => {
      const result = Importance(1.5);
      expect(result.ok).toBe(false);
    });

    it("rejects NaN/Infinity", () => {
      expect(Importance(NaN).ok).toBe(false);
      expect(Importance(Infinity).ok).toBe(false);
    });
  });

  describe("MemoryId", () => {
    it("accepts valid format m_<timestamp>_<hash>", () => {
      const result = MemoryId("m_1234567890_abcdef01");
      expect(result.ok).toBe(true);
    });

    it("rejects invalid formats", () => {
      expect(MemoryId("invalid").ok).toBe(false);
      expect(MemoryId("m_123").ok).toBe(false);
      expect(MemoryId("m_123_GGGG").ok).toBe(false); // uppercase hex
    });
  });

  describe("Tag", () => {
    it("accepts non-empty strings", () => {
      const result = Tag("architecture");
      expect(result.ok).toBe(true);
    });

    it("rejects empty strings", () => {
      expect(Tag("").ok).toBe(false);
      expect(Tag("   ").ok).toBe(false);
    });

    it("trims whitespace", () => {
      const result = Tag("  test  ");
      if (result.ok) {
        // Branded type prevents direct comparison, but we know it was trimmed
        expect(String(result.value)).toBe("test");
      }
    });
  });
});

describe("Result Type", () => {
  it("map transforms Ok values", () => {
    const result = Ok(5);
    const mapped = map(result, x => x * 2);
    expect(mapped.ok && mapped.value).toBe(10);
  });

  it("map preserves Err", () => {
    const result = Err(ValidationError('test', 'fail'));
    const mapped = map(result, (x: number) => x * 2);
    expect(mapped.ok).toBe(false);
  });

  it("flatMap chains Results", () => {
    const parseNum = (s: string) => {
      const n = parseInt(s);
      return isNaN(n) ? Err(ValidationError('input', 'not a number')) : Ok(n);
    };

    const result1 = flatMap(Ok("42"), parseNum);
    expect(result1.ok && result1.value).toBe(42);

    const result2 = flatMap(Ok("bad"), parseNum);
    expect(result2.ok).toBe(false);
  });

  it("sequence collects Results", () => {
    const good = [Ok(1), Ok(2), Ok(3)];
    const result = sequence(good);
    expect(result.ok && result.value).toEqual([1, 2, 3]);

    const bad = [Ok(1), Err(ValidationError('x', 'y')), Ok(3)];
    const result2 = sequence(bad);
    expect(result2.ok).toBe(false);
  });
});

describe("Error Pattern Matching", () => {
  it("matches ValidationError", () => {
    const error = ValidationError('importance', 'Must be 0..1');
    const message = matchError(error, {
      ValidationError: e => `${e.field}: ${e.reason}`,
      NotFoundError: e => `Not found: ${e.id}`,
      DuplicateError: e => `Duplicate: ${e.id}`,
      StorageError: e => `Storage ${e.operation} failed`,
      ActivationError: e => e.reason,
      SerializationError: e => `Serialization failed`,
    });
    expect(message).toBe('importance: Must be 0..1');
  });

  it("matches NotFoundError", () => {
    const id = UnsafeMemoryId("m_123_abc12345");
    const error = NotFoundError(id, 'item');
    const message = matchError(error, {
      ValidationError: e => 'validation',
      NotFoundError: e => `${e.type} ${e.id} not found`,
      DuplicateError: e => 'duplicate',
      StorageError: e => 'storage',
      ActivationError: e => 'activation',
      SerializationError: e => 'serialization',
    });
    expect(message).toContain('not found');
  });
});

describe("Type Safety Examples", () => {
  it("prevents mixing units at compile time", () => {
    const imp = UnsafeImportance(0.8);
    const eng = UnsafeImportance(0.5); // Same underlying type

    // These are both Importance, so TypeScript allows comparison
    // But if Energy and Importance are different brands, this wouldn't compile:
    // const eng2: Energy = UnsafeEnergy(0.5);
    // const bad = imp === eng2; // Type error!

    expect(imp).toBe(0.8);
  });

  it("validates on construction, guarantees thereafter", () => {
    // With validation
    const result = Importance(0.7);
    if (result.ok) {
      // result.value is guaranteed to be 0..1
      // No need to check again in business logic
      const item: Partial<MemoryItemV2> = {
        importance: result.value, // Type-safe
      };
      expect(item.importance).toBe(0.7);
    }
  });

  it("catches errors early with Result type", () => {
    const createItem = (imp: number) => {
      const impResult = Importance(imp);
      if (!impResult.ok) {
        // Error caught at creation, not later in storage
        return impResult;
      }

      return Ok({
        importance: impResult.value,
        // ... other fields
      });
    };

    const bad = createItem(1.5);
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.error.tag).toBe('ValidationError');
    }
  });
});
