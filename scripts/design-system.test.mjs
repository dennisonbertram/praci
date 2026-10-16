import { describe, expect, it } from "vitest";
import { findComponents, storiesFor } from "./design-system.mjs";

const files = [
  "apps/web/src/components/A.tsx",
  "apps/web/src/components/A.stories.tsx",
  "apps/web/src/components/B.tsx",
  "apps/web/src/components/C.tsx",
  "apps/web/src/screens/Host.stories.tsx",
  "packages/chat-ui/src/md.tsx",
];
const sources = { "apps/web/src/screens/Host.stories.tsx": 'import { C } from "../components/C";' };
const read = (f) => sources[f] ?? "";

describe("storiesFor", () => {
  it("accepts a sibling stories file", () => {
    expect(storiesFor("apps/web/src/components/A.tsx", files, read)).toEqual([
      "apps/web/src/components/A.stories.tsx",
    ]);
  });
  it("accepts a stories file elsewhere that imports the source", () => {
    expect(storiesFor("apps/web/src/components/C.tsx", files, read)).toEqual([
      "apps/web/src/screens/Host.stories.tsx",
    ]);
  });
  it("reports no stories when neither applies", () => {
    expect(storiesFor("apps/web/src/components/B.tsx", files, read)).toEqual([]);
  });
});

describe("findComponents", () => {
  it("finds rendered components and skips non-rendering helpers and children-only providers", () => {
    const src = `export function Card() {\n  return <div />;\n}\nexport function fmt() {\n  return 1;\n}\nexport function ThemeProvider({ children }) {\n  return <Ctx.Provider value={1}>{children}</Ctx.Provider>;\n}\n`;
    expect(findComponents(src)).toEqual(["Card"]);
  });
});
