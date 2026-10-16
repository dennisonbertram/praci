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
    "/app/%2e/integrations",
    "/app/a/%2E%2E/x",
    "/app/\u007f",
    "/app/%00",
    "/app/%1F",
    "/app/%7f",
  ]) {
    expect(appReturnPath(bad), String(bad)).toBeNull();
  }
});

it("allows an encoded dot in a query value but not in the path", () => {
  expect(appReturnPath("/app/data-room?name=a%2Eb")).toBe("/app/data-room?name=a%2Eb");
  expect(appReturnPath("/app/x?next=%2Fapp%2F%2e%2e")).not.toBeNull();
  expect(appReturnPath("/app/%2e/x")).toBeNull();
  expect(appReturnPath("/app/%2E%2E/x?ok=1")).toBeNull();
});

it("round-trips the nested setup continuation", () => {
  const app = "/app/integrations/app/google/gmail?connect=1&next=%2Fapp%2Fdata-room%3Fa%3Db%252Ec";
  const setupNext = new URLSearchParams(`next=${encodeURIComponent(app)}`).get("next");
  expect(appReturnPath(setupNext)).toBe(app);
  const inner = new URLSearchParams(app.split("?")[1]).get("next");
  expect(appReturnPath(inner)).toBe("/app/data-room?a=b%2Ec");
});
