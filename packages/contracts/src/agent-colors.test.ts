import { describe, expect, it } from "vitest";
import { appAgentColor, pageAgentColor } from "./agent-colors.js";
import { BOT_COLORS } from "./ids.js";

describe("agent colours", () => {
  it("gives each page agent a distinct palette colour", () => {
    const colours = ["inbox", "finance", "data-room", "company", "carta", "legal"].map(
      pageAgentColor,
    );
    expect(new Set(colours).size).toBe(6);
    for (const c of colours) expect(BOT_COLORS).toContain(c);
  });
  it("maps apps to their nearest brand colour, case-insensitively", () => {
    expect(appAgentColor(["Box"], "k")).toBe(BOT_COLORS[4]);
    expect(appAgentColor([undefined, "BREX"], "k")).toBe(BOT_COLORS[5]);
  });
  it("hashes an unknown app's spawn key to the same palette colour every time", () => {
    const a = appAgentColor(["Unknown"], "integration-agent:abc");
    expect(appAgentColor(["Other"], "integration-agent:abc")).toBe(a);
    expect(BOT_COLORS).toContain(a);
  });
});
