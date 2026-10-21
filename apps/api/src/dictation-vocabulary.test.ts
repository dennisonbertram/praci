import { MAX_TRANSCRIPTION_VOCABULARY } from "@rakazo/adapter-kit";
import { describe, expect, it } from "vitest";
import { dedupeVocabulary } from "./dictation-vocabulary.js";

describe("dedupeVocabulary", () => {
  it("drops blanks and case-insensitive repeats, keeping order", () => {
    expect(dedupeVocabulary([" Ada ", "ada", "", "Bolt", "BOLT", "Cy"])).toEqual([
      "Ada",
      "Bolt",
      "Cy",
    ]);
  });

  it("caps the count and the length of each item", () => {
    const many = Array.from({ length: MAX_TRANSCRIPTION_VOCABULARY + 20 }, (_, i) => `name ${i}`);
    expect(dedupeVocabulary(many)).toHaveLength(MAX_TRANSCRIPTION_VOCABULARY);
    expect(dedupeVocabulary(["x".repeat(500)])[0]?.length).toBeLessThan(500);
  });
});
