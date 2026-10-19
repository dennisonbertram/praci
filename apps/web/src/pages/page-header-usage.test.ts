import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

// Each page's title goes through PageHeader, so no page can hand-write its own title row again.
it.each(["CapTable", "Inbox", "Finance", "Legal", "DataRoom", "Artifacts"])(
  "%s renders its title with PageHeader",
  (page) => {
    const source = readFileSync(new URL(`./${page}.tsx`, import.meta.url), "utf8");
    expect(source).toContain("<PageHeader");
    expect(source).not.toMatch(/<h1 className="[^"]*text-lg/);
  },
);
