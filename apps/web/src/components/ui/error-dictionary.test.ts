import { describe, expect, it } from "vitest";

import {
  ERROR_DICTIONARY,
  ERROR_DICTIONARY_KEYS,
  errorKeyFromStatus,
  formatErrorCorrelationId,
  resolveErrorDictionaryEntry
} from "@/components/ui/error-dictionary";

describe("error-dictionary", () => {
  it("covers all dictionary keys with Russian copy and CTA", () => {
    for (const key of ERROR_DICTIONARY_KEYS) {
      const entry = resolveErrorDictionaryEntry(key);
      expect(entry.title.length).toBeGreaterThan(2);
      expect(entry.description.length).toBeGreaterThan(10);
      expect(entry.ctaLabel.length).toBeGreaterThan(2);
      expect(ERROR_DICTIONARY[key]).toBe(entry);
    }
  });

  it("formats correlation id for support", () => {
    expect(formatErrorCorrelationId("abc-123")).toBe("ID обращения: abc-123");
    expect(formatErrorCorrelationId("  ")).toBe("");
  });

  it("maps HTTP status to dictionary key", () => {
    expect(errorKeyFromStatus(404)).toBe("404");
    expect(errorKeyFromStatus(599)).toBe("500");
    expect(errorKeyFromStatus(503)).toBe("503");
  });
});
