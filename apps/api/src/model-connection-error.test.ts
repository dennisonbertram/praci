import { describe, expect, it } from "vitest";
import { modelConnectionErrorMessage, savedModelKey } from "./model-connection-error.js";

describe("modelConnectionErrorMessage", () => {
  it("hides the key the request sent and the saved key it reused", () => {
    const message = modelConnectionErrorMessage(
      new Error("provider said: new-typed-test-value and saved-test-value are invalid"),
      "Could not list models",
      ["new-typed-test-value", "saved-test-value"],
    );
    expect(message).not.toContain("new-typed-test-value");
    expect(message).not.toContain("saved-test-value");
    expect(message).toContain("are invalid");
  });

  it("hides credential shapes it was not told about", () => {
    expect(
      modelConnectionErrorMessage(
        new Error('401 {"error":"bad header Authorization: Bearer abc.def+ghi/jkl=="}'),
        "Could not list models",
        [],
      ),
    ).not.toContain("abc.def");
  });

  it("falls back for a thrown non-error", () => {
    expect(modelConnectionErrorMessage("boom", "Could not list models", [])).toBe(
      "Could not list models",
    );
  });
});

describe("savedModelKey", () => {
  it("reads the key of a saved API key or compatible endpoint", () => {
    expect(savedModelKey("saved-test-value")).toBe("saved-test-value");
    expect(
      savedModelKey(
        JSON.stringify({
          kind: "openai_compatible",
          baseUrl: "https://models.example.test/v1",
          apiKey: "saved-test-value",
        }),
      ),
    ).toBe("saved-test-value");
    expect(savedModelKey(JSON.stringify({ kind: "openai_compatible" }))).toBeUndefined();
  });
});
