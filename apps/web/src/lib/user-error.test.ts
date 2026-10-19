import { describe, expect, it } from "vitest";
import { errorText } from "./user-error";

describe("errorText", () => {
  it("shows the message of a raw stored provider error", () => {
    const raw =
      '400 {"error":{"message":"Composio does not manage auth for toolkit box_mcp","code":601}}';
    expect(errorText(new Error(raw))).toBe("Composio does not manage auth for toolkit box_mcp");
  });
});
