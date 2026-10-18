import { describe, expect, it } from "vitest";
import { MIN_CHAT_WIDTH, PANEL_DOCKED_QUERY, SIDEBAR_DOCKED_QUERY } from "./shell-layout";

describe("shell layout breakpoints", () => {
  it("docks the sidebar at Tailwind lg (1024px) and the panel at xl (1280px)", () => {
    expect(SIDEBAR_DOCKED_QUERY).toBe("(min-width: 1024px)");
    expect(PANEL_DOCKED_QUERY).toBe("(min-width: 1280px)");
  });

  it("leaves room for a readable chat beside the docked sidebar and panel", () => {
    const sidebar = 316;
    const minPanel = 320;
    expect(1280 - sidebar - minPanel).toBeGreaterThanOrEqual(MIN_CHAT_WIDTH);
  });
});
