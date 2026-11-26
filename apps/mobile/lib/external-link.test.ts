import { describe, expect, it } from "vitest";
import { sanitizeExternalPath } from "./external-link";

describe("external link paths", () => {
  it("does not start the computer automatically", () => {
    expect(sanitizeExternalPath("rakazo://computer?botId=b")).toBe("/");
  });

  it("opens a thread in the current space", () => {
    expect(sanitizeExternalPath("/thread?botId=b&spaceId=s&threadId=t")).toBe(
      "/thread?botId=b&threadId=t",
    );
  });

  it("does not prefill a new space", () => {
    expect(sanitizeExternalPath("/new-space?spaceId=s&name=x")).toBe("/new-space");
  });

  it("leaves sign-in callbacks unchanged", () => {
    const path = "/sign-in?cookie=session&nativeAttempt=1";

    expect(sanitizeExternalPath(path)).toBe(path);
  });

  it("leaves unrelated routes unchanged", () => {
    const path = "/settings/account?focus=usage";

    expect(sanitizeExternalPath(path)).toBe(path);
  });
});

it("treats group threads and trailing slashes like threads", () => {
  expect(sanitizeExternalPath("rakazo://group-thread?groupId=g&spaceId=s")).toBe(
    "/group-thread?groupId=g",
  );
  expect(sanitizeExternalPath("/thread/?botId=b&spaceId=s")).toBe("/thread/?botId=b");
  expect(sanitizeExternalPath("rakazo://computer/?botId=b")).toBe("/");
});
