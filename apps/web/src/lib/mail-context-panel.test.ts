// @vitest-environment jsdom

import { afterEach, expect, it, vi } from "vitest";
import { readContextPanelOpen, writeContextPanelOpen } from "./mail-context-panel";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

it("remembers the choice per user and falls back to the screen width", () => {
  const wide = vi.fn(() => ({ matches: true }));
  vi.stubGlobal("matchMedia", wide);
  expect(readContextPanelOpen("u1")).toBe(true);
  writeContextPanelOpen("u1", false);
  expect(readContextPanelOpen("u1")).toBe(false);
  // Another user in the same browser keeps their own default.
  expect(readContextPanelOpen("u2")).toBe(true);
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  expect(readContextPanelOpen("u2")).toBe(false);
});

it("still answers when storage is blocked", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  expect(readContextPanelOpen("u1")).toBe(true);
  expect(() => writeContextPanelOpen("u1", false)).not.toThrow();
});

it("never restores or saves an open panel on a phone", () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  writeContextPanelOpen("u1", true);
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  expect(readContextPanelOpen("u1")).toBe(false);
  writeContextPanelOpen("u1", false);
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  expect(readContextPanelOpen("u1")).toBe(true);
});
