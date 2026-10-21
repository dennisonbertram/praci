import type { ColorTokens } from "./index.js";
import { botColors, darkTokens, lightTokens } from "./index.js";

function swiftColor(value: string): string {
  const hex = /^#([\da-f]{6})$/i.exec(value);
  if (hex) {
    const channels = [0, 2, 4].map((offset) =>
      Number.parseInt(hex[1]!.slice(offset, offset + 2), 16),
    );
    return `Color(red: ${channels[0]}/255, green: ${channels[1]}/255, blue: ${channels[2]}/255)`;
  }

  const rgba = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/.exec(value);
  if (rgba) {
    return `Color(red: ${rgba[1]}/255, green: ${rgba[2]}/255, blue: ${rgba[3]}/255, opacity: ${rgba[4]})`;
  }

  throw new Error(`Unsupported native color token: ${value}`);
}

function renderPalette(name: string, palette: ColorTokens): string {
  const fields = Object.entries(palette)
    .map(([token, color]) => `        .${token}: ${swiftColor(color)},`)
    .join("\n");
  return `    private static let ${name}: [SemanticColor: Color] = [
${fields}
    ]`;
}

export function renderSwiftTokens(): string {
  const colorCases = Object.keys(darkTokens)
    .map((token) => `    case ${token}`)
    .join("\n");
  const bots = botColors.map(swiftColor).join(",\n        ");
  return `// Generated from packages/ui-tokens/src/index.ts by pnpm ios:tokens. Do not edit.
import SwiftUI

public enum SemanticColor: String, CaseIterable {
${colorCases}
}

public enum RakazoTokens {
    public static let botColors: [Color] = [
        ${bots}
    ]

${renderPalette("light", lightTokens)}

${renderPalette("dark", darkTokens)}

    public static func color(_ token: SemanticColor, for scheme: ColorScheme) -> Color {
        (scheme == .light ? light : dark)[token]!
    }
}
`;
}
