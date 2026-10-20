import { botColors, darkTokens } from "@rakazo/ui-tokens";
import { describe, expect, it } from "vitest";
import { accentTokens } from "./accent-tokens.js";

describe("accentTokens", () => {
  it("fills the user bubble and primary button with the bot colour", () => {
    const t = accentTokens(darkTokens, botColors[4]);
    expect(t.secondary).toBe(botColors[4]);
    expect(t.primary).toBe(botColors[4]);
    expect(t.secondaryForeground).toMatch(/^#(fff|111)/);
  });
  it("ignores the avatar shape suffix and non-colour values", () => {
    expect(accentTokens(darkTokens, "#3B82F6::shape_7").primary).toBe("#3B82F6");
    expect(accentTokens(darkTokens, "data:image/png;base64,AAAA")).toBe(darkTokens);
  });
  it("leaves the thread monochrome with no bot colour", () => {
    expect(accentTokens(darkTokens, null)).toBe(darkTokens);
  });
});
