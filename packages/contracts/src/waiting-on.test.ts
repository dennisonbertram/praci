import { describe, expect, it } from "vitest";
import { isWaitingOnSelf, WAITING_ON_SELF } from "./waiting-on.js";

describe("isWaitingOnSelf", () => {
  it("matches a self word at the start of a phrase", () => {
    expect(isWaitingOnSelf("you to sign the NDA")).toBe(true);
    expect(isWaitingOnSelf("You approve budget")).toBe(true);
    expect(isWaitingOnSelf("ME")).toBe(true);
    expect(isWaitingOnSelf(" you ")).toBe(true);
  });

  it("does not match another word that starts with one", () => {
    expect(isWaitingOnSelf("Youssef")).toBe(false);
    expect(isWaitingOnSelf("Acme legal")).toBe(false);
    expect(isWaitingOnSelf("")).toBe(false);
    expect(isWaitingOnSelf(null)).toBe(false);
    expect(isWaitingOnSelf(undefined)).toBe(false);
  });

  it("keeps the self words in one list", () => {
    expect(WAITING_ON_SELF).toEqual(["you", "me", "user"]);
  });
});
