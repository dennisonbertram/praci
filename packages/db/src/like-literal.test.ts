import { describe, expect, it } from "vitest";
import { likeLiteral } from "./like-literal.js";

describe("likeLiteral", () => {
  it("escapes LIKE metacharacters and backslashes", () => {
    expect(likeLiteral("50%_a\\b")).toBe("50\\%\\_a\\\\b");
  });

  it("leaves plain text unchanged", () => {
    expect(likeLiteral("plain")).toBe("plain");
  });
});
