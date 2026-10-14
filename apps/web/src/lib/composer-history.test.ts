import { describe, expect, it } from "vitest";
import { stepComposerHistory } from "./composer-history";

describe("stepComposerHistory", () => {
  it("walks from the draft to the oldest message and back", () => {
    expect(stepComposerHistory(2, null, "older")).toBe(0);
    expect(stepComposerHistory(2, 0, "older")).toBe(1);
    expect(stepComposerHistory(2, 1, "older")).toBeUndefined();
    expect(stepComposerHistory(2, 1, "newer")).toBe(0);
    expect(stepComposerHistory(2, 0, "newer")).toBeNull();
    expect(stepComposerHistory(2, null, "newer")).toBeUndefined();
    expect(stepComposerHistory(0, null, "older")).toBeUndefined();
  });
});
