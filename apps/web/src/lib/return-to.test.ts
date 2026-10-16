import { expect, it } from "vitest";
import { appReturnPath } from "./return-to";

it("accepts paths inside /app", () => {
  expect(appReturnPath("/app")).toBe("/app");
  expect(appReturnPath("/app/data-room")).toBe("/app/data-room");
  expect(appReturnPath("/app/data-room?folder=a#top")).toBe("/app/data-room?folder=a#top");
});

it("rejects absolute, external and out-of-app targets", () => {
  for (const bad of [
    null,
    "",
    "https://evil.example/app",
    "//evil.example/app",
    "/\\evil.example",
    "/app\\..\\evil",
    "/app/../sign-in",
    "/appx",
    "/sign-in",
    "app/data-room",
    "javascript:alert(1)",
    "/app\n//evil.example",
    "/app/%2e%2e/%2e%2e/sign-in",
  ]) {
    expect(appReturnPath(bad), String(bad)).toBeNull();
  }
});
