import { expect, it } from "vitest";
import { badgeVariants } from "./badge.js";

it("enumerates the transitioned properties instead of transition-all", () => {
  const className = badgeVariants();
  expect(className).not.toContain("transition-all");
  // The focus-visible ring is box-shadow; it must keep animating.
  expect(className).toContain("box-shadow");
});
