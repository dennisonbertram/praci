import { expect, it, vi } from "vitest";

vi.mock("@lingui/core/macro", () => ({ t: (parts: TemplateStringsArray) => parts.join("") }));

import { statusLabel } from "./format";

it("calls every working step Reading, never Filing, since filing waits for consent", () => {
  expect(["pending", "extracting", "classifying", "indexing"].map(statusLabel)).toEqual([
    "Reading",
    "Reading",
    "Reading",
    "Reading",
  ]);
  expect(statusLabel("failed")).toBe("Failed");
  expect(statusLabel("ready")).toBe("");
});
