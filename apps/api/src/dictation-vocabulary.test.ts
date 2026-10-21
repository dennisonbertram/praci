import {
  MAX_TRANSCRIPTION_VOCABULARY,
  MAX_TRANSCRIPTION_VOCABULARY_ITEM_CHARS,
} from "@rakazo/adapter-kit";
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

  it("treats titles that share their first characters up to the cap as one", () => {
    const head = "y".repeat(MAX_TRANSCRIPTION_VOCABULARY_ITEM_CHARS);
    expect(dedupeVocabulary([`${head} one`, `${head} two`])).toEqual([head]);
  });
});
