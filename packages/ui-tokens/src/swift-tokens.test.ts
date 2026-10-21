import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { renderSwiftTokens } from "./generate-swift.js";
import { botColors, darkTokens, lightTokens } from "./index.js";

describe("native semantic tokens", () => {
  it("renders every light and dark semantic color and bot accent deterministically", () => {
    const rendered = renderSwiftTokens();

    expect(rendered).toBe(renderSwiftTokens());
    for (const token of Object.keys(lightTokens)) expect(rendered).toContain(`case ${token}\n`);
    expect(Object.keys(lightTokens)).toEqual(Object.keys(darkTokens));
    for (const color of botColors) {
      const match = /^#([\da-f]{6})$/i.exec(color);
      expect(match).not.toBeNull();
      const channels = [0, 2, 4].map((offset) =>
        Number.parseInt(match![1]!.slice(offset, offset + 2), 16),
      );
      expect(rendered).toContain(
        `Color(red: ${channels[0]}/255, green: ${channels[1]}/255, blue: ${channels[2]}/255)`,
      );
    }
  });

  it("matches the committed Swift token file", () => {
    const path = fileURLToPath(
      new URL("../../../apps/ios/Packages/RakazoUI/Sources/RakazoUI/Tokens.swift", import.meta.url),
    );
    expect(readFileSync(path, "utf8")).toBe(renderSwiftTokens());
  });
});
