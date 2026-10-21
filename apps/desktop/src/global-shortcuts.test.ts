import { readFileSync } from "node:fs";
import type { MenuItemConstructorOptions } from "electron";
import { describe, expect, it } from "vitest";
import { buildApplicationMenuTemplate } from "./application-menu.js";

// Wispr Flow system dictation hotkeys, from
// https://docs.wisprflow.ai/articles/2612050838-supported-unsupported-keyboard-hotkey-shortcuts
// (Settings > General > Shortcuts, "Reset to default" table, read 2026-10-21):
//   Push to talk: Mac Fn; Windows Ctrl+Win (new setups may start on Caps Lock)
//   Hands-free:   Mac Fn+Space; Windows Ctrl+Win+Space
//   Command Mode: Mac Fn+Ctrl; Windows Ctrl+Win+Alt
//   Paste last transcript: Mac Cmd+Ctrl+V; Windows Shift+Alt+Z
//   Copy last transcript:  Mac Cmd+Ctrl+C; Windows Shift+Alt+X
//   Cancel: Escape
//   Mac without an Fn key: Ctrl+Opt, Ctrl+Opt+Space, Cmd+Ctrl+Opt
type Platform = "darwin" | "win32";

// Per platform, including the Mac layout used when no Fn key is detected.
const FLOW_DEFAULTS: Record<Platform, string[][]> = {
  darwin: [
    ["Fn"],
    ["Fn", "Space"],
    ["Fn", "Ctrl"],
    ["Ctrl", "Alt"],
    ["Ctrl", "Alt", "Space"],
    ["Cmd", "Ctrl", "Alt"],
    ["Cmd", "Ctrl", "V"],
    ["Cmd", "Ctrl", "C"],
    ["Escape"],
  ],
  win32: [
    ["Ctrl", "Win"],
    ["Ctrl", "Win", "Space"],
    ["Ctrl", "Win", "Alt"],
    ["Shift", "Alt", "Z"],
    ["Shift", "Alt", "X"],
    ["Escape"],
  ],
};

function normalize(accelerator: string, platform: Platform) {
  return accelerator
    .split("+")
    .map((key) => {
      const k = key.toLowerCase();
      if (k === "cmdorctrl") return platform === "darwin" ? "cmd" : "ctrl";
      if (k === "command" || k === "cmd") return "cmd";
      if (k === "super" || k === "meta") return platform === "darwin" ? "cmd" : "win";
      if (k === "option" || k === "opt" || k === "alt") return "alt";
      if (k === "control" || k === "ctrl") return "ctrl";
      return k;
    })
    .sort()
    .join("+");
}

function collectAccelerators(items: MenuItemConstructorOptions[]): string[] {
  return items.flatMap((item) => [
    ...(typeof item.accelerator === "string" ? [item.accelerator] : []),
    ...(Array.isArray(item.submenu) ? collectAccelerators(item.submenu) : []),
  ]);
}

const handlers = { openLocalSettings() {}, changeServer() {}, stopLocalStack() {} };

describe("desktop shortcuts vs Wispr Flow defaults", () => {
  it("registers no OS-wide shortcut", () => {
    const source = readFileSync(new URL("./main.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/globalShortcut/);
  });

  for (const platform of ["darwin", "win32"] as const) {
    it(`uses none of Flow's ${platform} defaults in the application menu`, () => {
      const accelerators = collectAccelerators(
        buildApplicationMenuTemplate(platform, "Praci", handlers),
      );
      // Menu accelerators only fire while Praci is focused.
      expect(accelerators).toEqual(["CmdOrCtrl+,", "CmdOrCtrl+Shift+K"]);
      const flow = new Set(
        FLOW_DEFAULTS[platform].map((keys) => normalize(keys.join("+"), platform)),
      );
      for (const accelerator of accelerators) {
        expect(flow.has(normalize(accelerator, platform))).toBe(false);
      }
    });
  }
});
