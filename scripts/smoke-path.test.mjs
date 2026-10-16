import { describe, expect, it } from "vitest";
import { insideRoot } from "../apps/web/.storybook/safe-path.mjs";

describe("insideRoot", () => {
  it("allows files under root", () => {
    expect(insideRoot("/srv/build", "/iframe.html")).toBe("/srv/build/iframe.html");
    expect(insideRoot("/srv/build", "/")).toBe("/srv/build/");
  });
  it("refuses paths that climb out of root", () => {
    expect(insideRoot("/srv/build", "/../secret")).toBeNull();
    expect(insideRoot("/srv/build", "/a/../../secret")).toBeNull();
    expect(insideRoot("/srv/build", "/../build-other/x")).toBeNull();
  });
});
