import { describe, expect, it } from "vitest";
import { caretAfterChange } from "./composer-caret";

describe("caretAfterChange", () => {
  it("returns the caret unchanged when the text did not change", () => {
    expect(caretAfterChange("hello", "hello", 2)).toBe(2);
  });

  it("moves past text appended at the end", () => {
    expect(caretAfterChange("hi", "hi there", 2)).toBe(8);
  });

  it("moves past text inserted in the middle", () => {
    expect(caretAfterChange("hi  there", "hi @He there", 3)).toBe(6);
  });

  it("follows a deletion back to the edit point", () => {
    expect(caretAfterChange("hi @He", "hi @H", 6)).toBe(5);
    expect(caretAfterChange("shape", "shpe", 3)).toBe(2);
  });

  it("lands after a replacement, not inside the old span", () => {
    expect(caretAfterChange("hi @He", "hi @Helper", 6)).toBe(10);
    expect(caretAfterChange("say hi", "say hello", 6)).toBe(9);
  });

  it("lands after a multi-character paste", () => {
    expect(caretAfterChange("mail ", "mail alice@example.com", 5)).toBe(22);
  });

  it("clamps to the text when the old caret is past the new end", () => {
    expect(caretAfterChange("hello there", "hello", 9)).toBe(5);
    expect(caretAfterChange("", "a", 5)).toBe(1);
  });

  it("counts a surrogate pair as the units the field reports", () => {
    const out = caretAfterChange("hi ", "hi 😀", 3);
    expect(out).toBe("hi 😀".length);
  });
});
