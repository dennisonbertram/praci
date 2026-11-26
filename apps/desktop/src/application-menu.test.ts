import { readFileSync } from "node:fs";
import type { MenuItemConstructorOptions } from "electron";
import { describe, expect, it } from "vitest";
import { buildApplicationMenuTemplate } from "./application-menu.js";

const handlers = { openLocalSettings() {}, changeServer() {}, stopLocalStack() {} };

function find(items: MenuItemConstructorOptions[], id: string): MenuItemConstructorOptions | null {
  for (const item of items) {
    if (item.id === id) return item;
    if (Array.isArray(item.submenu)) {
      const hit = find(item.submenu, id);
      if (hit) return hit;
    }
  }
  return null;
}

describe("Stop Local Stack menu item", () => {
  for (const platform of ["darwin", "win32", "linux"] as const) {
    it(`is hidden unless the app manages the local stack (${platform})`, () => {
      const hidden = find(
        buildApplicationMenuTemplate(platform, "Praci", handlers, false),
        "stop-local-stack",
      );
      const shown = find(
        buildApplicationMenuTemplate(platform, "Praci", handlers, true),
        "stop-local-stack",
      );
      expect(hidden?.visible).toBe(false);
      expect(shown?.visible).toBe(true);
    });
  }

  it("rebuilds the menu whenever the connected setup changes", () => {
    const source = readFileSync(new URL("./main.ts", import.meta.url), "utf8");
    const writes = source.match(/^\s*currentSetup = /gm) ?? [];
    // One initial read at startup plus the setter itself.
    expect(writes).toHaveLength(2);
  });
});
