import { MailProviderError } from "@rakazo/adapter-kit";
import { describe, expect, it } from "vitest";
import { providerFailure } from "./inbox.js";

const failure = (kind: ConstructorParameters<typeof MailProviderError>[0]) => {
  try {
    providerFailure(new MailProviderError(kind, "x"), "inbox.markRead", "c1");
  } catch (error) {
    return error;
  }
};

describe("providerFailure", () => {
  it("tells the user Gmail is busy on a rate limit, not that mail is unavailable", () => {
    expect(failure("rate_limited")).toMatchObject({
      code: "TOO_MANY_REQUESTS",
      message: "Gmail is busy. Try again in a moment.",
    });
  });

  it("keeps other provider failures as unavailable", () => {
    expect(failure("unavailable")).toMatchObject({
      code: "SERVICE_UNAVAILABLE",
      message: "Mail is unavailable",
    });
  });
});
