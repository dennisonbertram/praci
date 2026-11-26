import { expect, it } from "vitest";
import { initials } from "./contact-avatar";

it("skips parenthesised text and punctuation", () => {
  expect(initials("Casey Advisor (Mock)")).toBe("CA");
  expect(initials("Ada Lovelace")).toBe("AL");
  expect(initials("Acme Inc.")).toBe("A");
});
