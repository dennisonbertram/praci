import { describe, expect, it, vi } from "vitest";

vi.mock("@lingui/core/macro", () => ({ t: (parts: TemplateStringsArray) => parts.join("") }));

import {
  dateText,
  isNoiseImage,
  isStuck,
  readingAge,
  sizeText,
  statusLabel,
  typeLabel,
} from "./format";

it("calls every working step Reading, never Filing, since filing waits for consent", () => {
  expect(["pending", "extracting", "classifying"].map((s) => statusLabel(s))).toEqual([
    "Reading",
    "Reading",
    "Reading",
  ]);
  expect(statusLabel("failed")).toBe("Failed");
  expect(statusLabel("ready")).toBe("");
});

it("never calls a file Reading once its text is stored", () => {
  expect(statusLabel("classifying", true)).toBe("");
  expect(statusLabel("extracting", false)).toBe("Reading");
  expect(statusLabel("failed", true)).toBe("Failed");
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

it("shows when something happened as the viewer's day and a document date as written", () => {
  const zone = process.env.TZ;
  process.env.TZ = "America/Los_Angeles";
  try {
    expect(dateText("2026-03-04T02:00:00.000Z", true)).toContain("3,");
    expect(dateText("2026-03-04T00:00:00.000Z")).toContain("4,");
  } finally {
    if (zone === undefined) delete process.env.TZ;
    else process.env.TZ = zone;
  }
});

describe("readingAge and isStuck", () => {
  const now = Date.parse("2026-03-04T12:00:00.000Z");
  const ago = (minutes: number) => new Date(now - minutes * 60_000).toISOString();
  it("counts from the last write and flags a file quiet for over 3 minutes", () => {
    expect(readingAge(ago(1), now)).toBe("");
    expect(readingAge(ago(5), now)).toMatch(/^Reading for/);
    expect(isStuck({ status: "extracting", updatedAt: ago(2) }, now)).toBe(false);
    expect(isStuck({ status: "extracting", updatedAt: ago(4) }, now)).toBe(true);
    expect(isStuck({ status: "ready", updatedAt: ago(60) }, now)).toBe(false);
    expect(isStuck({ status: "failed", updatedAt: ago(60) }, now)).toBe(false);
  });
});
