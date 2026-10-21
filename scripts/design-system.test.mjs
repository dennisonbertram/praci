import { describe, expect, it } from "vitest";
import {
  findComponents,
  findSwiftViews,
  renderComponentsMd,
  storiesFor,
} from "./design-system.mjs";

// Same inventory the real run passes: every scanned file, sources and stories together.
const files = [
  "apps/web/src/components/A.tsx",
  "apps/web/src/components/A.stories.tsx",
  "apps/web/src/components/B.tsx",
  "apps/web/src/components/C.tsx",
  "apps/web/src/screens/Host.stories.tsx",
  "packages/chat-ui/src/md.tsx",
];
const story = "export default {};\nexport const Basic = {};\n";
const sources = {
  "apps/web/src/components/A.stories.tsx": story,
  "apps/web/src/screens/Host.stories.tsx": `import { C } from "../components/C";\n${story}`,
};
const read = (f) => sources[f] ?? "";

describe("native SwiftUI catalog", () => {
  it("lists views without treating models, app entry points, or comments as views", () => {
    expect(
      findSwiftViews(`
      // struct Fake: View {}
      struct Model: Codable {}
      struct PraciApp: App {}
      struct SignIn: View { var body: some View { Text("Sign in") } }
      struct Status: View, Sendable {}
    `),
    ).toEqual(["SignIn", "Status"]);
    const catalog = renderComponentsMd({
      web: [],
      mobile: [],
      native: [{ file: "apps/ios/Sources/SignIn.swift", names: ["SignIn"] }],
    });
    expect(catalog).toContain("SwiftUI views: 1 in 1 files");
    expect(catalog).toContain("native story pending | iOS |");
  });
});

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
  it("finds compact one-line components", () => {
    expect(findComponents("export const Foo = () => <div />;\n")).toEqual(["Foo"]);
    expect(findComponents("export function Bar() { return <div />; }\n")).toEqual(["Bar"]);
  });
  it("ignores a stories file with no story export", () => {
    const empty = { ...sources, "apps/web/src/components/A.stories.tsx": "export default {};\n" };
    expect(storiesFor("apps/web/src/components/A.tsx", files, (f) => empty[f] ?? "")).toEqual([]);
  });
});
