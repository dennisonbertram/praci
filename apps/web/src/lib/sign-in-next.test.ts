import { describe, expect, it } from "vitest";
import { signInFor, signInNext } from "./sign-in-next";

describe("signInNext", () => {
  it("keeps in-app pages with their query", () => {
    expect(signInNext("/app/cap-table")).toBe("/app/cap-table");
    expect(signInNext("/app/finance/runway?x=1")).toBe("/app/finance/runway?x=1");
    expect(signInNext("/integrations/setup")).toBe("/integrations/setup");
  });

  it("falls back to /app for missing, outside or off-origin targets", () => {
    for (const raw of [
      null,
      "",
      "app",
      "//evil.example/app",
      "/\\evil",
      "/pricing",
      "/apps",
      "/app\\x",
      "/app/%2e%2e/sign-in",
      "/app/%00",
      "/app/\n/x",
    ]) {
      expect(signInNext(raw)).toBe("/app");
    }
  });
});

describe("signInFor", () => {
  it("carries the requested page through sign-in", () => {
    expect(signInFor("/app/cap-table")).toBe("/sign-in?next=%2Fapp%2Fcap-table");
    expect(signInFor("/app")).toBe("/sign-in");
  });
});

describe("signInNext setup page", () => {
  it("keeps the setup page and refuses unsafe tails", () => {
    expect(signInNext("/integrations/setup?next=%2Fapp")).toBe("/integrations/setup?next=%2Fapp");
    for (const raw of [
      "/integrations/setupx",
      "/integrations/setup?a=\\b",
      "/integrations/setup?a=%00",
    ]) {
      expect(signInNext(raw)).toBe("/app");
    }
  });
});
