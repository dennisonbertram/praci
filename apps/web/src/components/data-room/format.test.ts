import { expect, it, vi } from "vitest";

vi.mock("@lingui/core/macro", () => ({ t: (parts: TemplateStringsArray) => parts.join("") }));

import { sizeText, statusLabel, typeLabel } from "./format";

it("calls every working step Reading, never Filing, since filing waits for consent", () => {
  expect(["pending", "extracting", "classifying"].map(statusLabel)).toEqual([
    "Reading",
    "Reading",
    "Reading",
  ]);
  expect(statusLabel("failed")).toBe("Failed");
  expect(statusLabel("ready")).toBe("");
});

it("shows a file being re-indexed (after a rename or move) as done, not Reading again", () => {
  expect(statusLabel("indexing")).toBe("");
});

it("puts a space between a size and its unit, and spells out bytes", () => {
  expect([722, 1, 12_345, 4_100_000].map(sizeText)).toEqual([
    "722 bytes",
    "1 byte",
    "12.3 kB",
    "4.1 MB",
  ]);
});

it("capitalises a document type for display only", () => {
  expect([typeLabel("investor"), typeLabel("Board deck"), typeLabel(null)]).toEqual([
    "Investor",
    "Board deck",
    "",
  ]);
});
