import path from "node:path";
import { describe, expect, it } from "vitest";
import { userDataPath } from "./user-data";

describe("userDataPath", () => {
  it("keeps the pre-rename directory so existing installs keep their data", () => {
    expect(userDataPath(path.join("/home/u", ".config"))).toBe(
      path.join("/home/u", ".config", "Rakazo"),
    );
  });
});
