import { expect, it } from "vitest";
import { anyWordQuery } from "./data-room.js";

it("turns a question into any-word search terms, leaving a single word alone", () => {
  expect(anyWordQuery("when does our office lease end")).toBe(
    "when or does or our or office or lease or end",
  );
  // Quotes, minus signs and a stray "or" never become search syntax.
  expect(anyWordQuery('"lease" -draft or end')).toBe("lease or draft or end");
  expect(anyWordQuery("lease")).toBeNull();
  expect(anyWordQuery("  lease  ")).toBeNull();
});
