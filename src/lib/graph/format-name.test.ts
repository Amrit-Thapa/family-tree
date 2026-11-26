import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { formatDisplayName } from "./format-name";

describe("formatDisplayName", () => {
  it("returns first name only when no last name is provided", () => {
    expect(formatDisplayName("Alice")).toBe("Alice");
  });

  it("combines first and last name with a space", () => {
    expect(formatDisplayName("Alice", "Smith")).toBe("Alice Smith");
  });

  it("returns full name when combined length is exactly 30 characters", () => {
    // "A" (1) + " " (1) + "B" * 28 = 30 chars
    const lastName = "B".repeat(28);
    const result = formatDisplayName("A", lastName);
    expect(result).toBe(`A ${lastName}`);
    expect(result.length).toBe(30);
  });

  it("truncates to 29 chars + ellipsis when combined length exceeds 30", () => {
    const firstName = "Alexander";
    const lastName = "Bartholomew-Richardson-Smith";
    const result = formatDisplayName(firstName, lastName);
    expect(result.length).toBe(30);
    expect(result.endsWith("\u2026")).toBe(true);
    expect(result).toBe("Alexander Bartholomew-Richard\u2026");
  });

  it("does not truncate when combined length is under 30", () => {
    const result = formatDisplayName("John", "Doe");
    expect(result).toBe("John Doe");
    expect(result.endsWith("\u2026")).toBe(false);
  });

  it("handles empty last name as undefined", () => {
    expect(formatDisplayName("Alice", undefined)).toBe("Alice");
  });

  it("truncates first-name-only when it exceeds 30 characters", () => {
    const longFirst = "A".repeat(35);
    const result = formatDisplayName(longFirst);
    expect(result.length).toBe(30);
    expect(result).toBe("A".repeat(29) + "\u2026");
  });
});

describe("Feature: family-tree-graph, Property 2: Name Truncation Correctness", () => {
  /**
   * Validates: Requirements 1.5
   *
   * For any first name and optional last name string combination, the
   * formatDisplayName function SHALL return the full combined name when its
   * length is ≤ 30 characters, and SHALL return a string of exactly 30
   * characters ending with "…" when the combined name exceeds 30 characters.
   */

  it("output is always ≤ 30 characters", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.option(fc.string({ minLength: 1 }), { nil: undefined }),
        (firstName, lastName) => {
          const result = formatDisplayName(firstName, lastName);
          expect(result.length).toBeLessThanOrEqual(30);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("returns full name when combined length ≤ 30", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.option(fc.string({ minLength: 1 }), { nil: undefined }),
        (firstName, lastName) => {
          const fullName = lastName ? `${firstName} ${lastName}` : firstName;
          fc.pre(fullName.length <= 30);
          const result = formatDisplayName(firstName, lastName);
          expect(result).toBe(fullName);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("truncates to exactly 30 chars ending with '…' when combined length > 30", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 16 }),
        fc.string({ minLength: 16 }),
        (firstName, lastName) => {
          // Guaranteed: firstName(16+) + " " + lastName(16+) > 30
          const result = formatDisplayName(firstName, lastName);
          expect(result.length).toBe(30);
          expect(result.endsWith("\u2026")).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("ends with '…' only when input exceeds 30 characters", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.option(fc.string({ minLength: 1 }), { nil: undefined }),
        (firstName, lastName) => {
          const fullName = lastName ? `${firstName} ${lastName}` : firstName;
          const result = formatDisplayName(firstName, lastName);
          if (fullName.length <= 30) {
            expect(result.endsWith("\u2026")).toBe(false);
          } else {
            expect(result.endsWith("\u2026")).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
