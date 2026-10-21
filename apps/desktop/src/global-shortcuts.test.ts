import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

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
const FLOW_DEFAULTS = [
  "Fn",
  "Fn+Space",
  "Fn+Ctrl",
  "Ctrl+Win",
  "Ctrl+Win+Space",
  "Ctrl+Win+Alt",
  "Ctrl+Alt",
  "Ctrl+Alt+Space",
  "Cmd+Ctrl+Alt",
  "Cmd+Ctrl+V",
  "Cmd+Ctrl+C",
  "Shift+Alt+Z",
  "Shift+Alt+X",
  "Escape",
];

const normalize = (accelerator: string) =>
  accelerator
    .split("+")
    .map((key) => {
      const k = key.toLowerCase();
      if (k === "cmdorctrl") return "ctrl";
      if (["command", "cmd", "super", "meta"].includes(k)) return "cmd";
      if (["option", "opt", "alt"].includes(k)) return "alt";
      if (["control", "ctrl"].includes(k)) return "ctrl";
      return k;
    })
    .sort()
    .join("+");

describe("desktop shortcuts vs Wispr Flow defaults", () => {
  const source = readFileSync(new URL("./main.ts", import.meta.url), "utf8");
  const accelerators = [...source.matchAll(/accelerator:\s*"([^"]+)"/g)].map((m) => m[1] as string);

  it("registers no OS-wide shortcut", () => {
    expect(source).not.toMatch(/globalShortcut/);
  });

  it("lists the menu accelerators, which only fire while Rakazo is focused", () => {
    expect(accelerators).toEqual(["CmdOrCtrl+,", "CmdOrCtrl+Shift+K"]);
  });

  it("uses none of Flow's default hotkeys", () => {
    const flow = new Set(FLOW_DEFAULTS.map(normalize));
    for (const accelerator of accelerators) expect(flow.has(normalize(accelerator))).toBe(false);
  });
});
