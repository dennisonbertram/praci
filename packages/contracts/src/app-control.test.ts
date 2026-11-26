import { describe, expect, it } from "vitest";
import { isDeniedApp } from "./app-control.js";

describe("isDeniedApp", () => {
  it.each([
    ["com.apple.systempreferences", "System Settings"],
    ["com.apple.keychainaccess", "Keychain Access"],
    ["com.apple.SecurityAgent", "SecurityAgent"],
    ["com.apple.Terminal", "Terminal"],
    ["com.apple.finder", "Finder"],
    ["com.apple.Safari", "Safari"],
    ["com.google.Chrome.canary", "Google Chrome Canary"],
    ["com.microsoft.VSCode", "Code"],
    ["com.1password.1password", "1Password"],
    ["dev.rakazo.desktop", "Praci"],
    ["com.github.Electron", "Electron"],
    // A renamed or unknown bundle id is still caught by its name.
    ["com.example.anything", "Super Password Vault"],
    ["com.example.term", "Terminal"],
  ])("refuses %s (%s)", (id, name) => {
    expect(isDeniedApp({ id, name })).toBe(true);
  });

  it("refuses an app without a bundle id or name", () => {
    expect(isDeniedApp({ id: "", name: "Music" })).toBe(true);
    expect(isDeniedApp({ id: "com.apple.Music", name: "" })).toBe(true);
  });

  it.each([
    ["com.apple.Music", "Music"],
    ["com.apple.calculator", "Calculator"],
    ["com.apple.TextEdit", "TextEdit"],
    ["com.apple.Notes", "Notes"],
  ])("allows %s (%s)", (id, name) => {
    expect(isDeniedApp({ id, name })).toBe(false);
  });
});
