import { describe, expect, it } from "vitest";
import { isSpaceOwnerRole } from "./space-owner.js";

describe("isSpaceOwnerRole", () => {
  it("accepts owner, alone or among comma-joined roles", () => {
    expect(isSpaceOwnerRole("owner")).toBe(true);
    expect(isSpaceOwnerRole("admin, owner")).toBe(true);
    expect(isSpaceOwnerRole("superowner")).toBe(false);
    expect(isSpaceOwnerRole("member")).toBe(false);
    expect(isSpaceOwnerRole(undefined)).toBe(false);
  });
});
