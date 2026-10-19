import { expect, it, vi } from "vitest";

vi.mock("@lingui/core/macro", () => ({ t: (parts: TemplateStringsArray) => parts.join("") }));

import { isNoiseImage, sizeText, statusLabel, typeLabel } from "./format";

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

it("names the classifier's short types clearly and capitalises the rest, for display only", () => {
  expect(
    [typeLabel("investor"), typeLabel("hr"), typeLabel("contract"), typeLabel("Board deck")].concat(
      typeLabel(null),
    ),
  ).toEqual(["Investor document", "HR document", "Contract", "Board deck", ""]);
});

it("treats small and logo-named images as noise but keeps documents and large photos", () => {
  const f = (filename: string, mimeType: string, size: number) => ({ filename, mimeType, size });
  expect(isNoiseImage(f("a.png", "image/png", 900))).toBe(true);
  expect(isNoiseImage(f("image001.png", "image/png", 80_000))).toBe(true);
  expect(isNoiseImage(f("Logo.jpg", "image/jpeg", 80_000))).toBe(true);
  expect(isNoiseImage(f("receipt-photo.jpg", "image/jpeg", 800_000))).toBe(false);
  expect(isNoiseImage(f("logo-guidelines.pdf", "application/pdf", 900))).toBe(false);
});
