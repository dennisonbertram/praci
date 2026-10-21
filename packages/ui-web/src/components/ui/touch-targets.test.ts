import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

// Menu-like rows only render inside an open popup, so check their source: each must grow to
// 44 px on a coarse pointer (phones) and stay as is on desktop.
it.each(["command.tsx", "select.tsx", "context-menu.tsx", "dropdown-menu.tsx"])(
  "%s items grow to 44 px on a coarse pointer",
  (file) => {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    expect(source).toContain("pointer-coarse:min-h-11");
  },
);
