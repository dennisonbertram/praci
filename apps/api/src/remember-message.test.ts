import { describe, expect, it } from "vitest";
import { plainMemoryText } from "./remember-message.js";

describe("plainMemoryText", () => {
  it("strips markdown syntax and keeps link targets", () => {
    expect(plainMemoryText("## Plan\n**Ship** the [guide](https://example.test/g) `now`")).toBe(
      "Plan\nShip the guide (https://example.test/g) now",
    );
  });

  it("caps long text", () => {
    const text = plainMemoryText("a".repeat(5000));
    expect(text).toHaveLength(2000);
    expect(text.endsWith("…")).toBe(true);
  });
});
