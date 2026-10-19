import { describe, expect, it } from "vitest";
import { syncErrorText } from "./inbox-sync-error";

describe("syncErrorText", () => {
  it("says nothing while no account failed", () => {
    expect(syncErrorText({ failedAccounts: [], reconnectAccounts: [] })).toBe("");
  });

  it("says Gmail could not be reached when an account failed for any other reason", () => {
    expect(syncErrorText({ failedAccounts: ["c1"], reconnectAccounts: [] })).toBe(
      "Couldn't reach Gmail.",
    );
  });

  it("says Gmail is limiting requests when a failed account was rate limited", () => {
    expect(
      syncErrorText({ failedAccounts: ["c1"], reconnectAccounts: [], rateLimitedAccounts: ["c1"] }),
    ).toBe("Gmail is limiting requests right now.");
  });

  it("says Gmail is still limiting requests after a retry that failed again", () => {
    expect(
      syncErrorText(
        { failedAccounts: ["c1"], reconnectAccounts: [], rateLimitedAccounts: ["c1"] },
        true,
      ),
    ).toBe("Gmail is still limiting requests.");
  });

  it("prefers the reconnect notice over the rate limit notice", () => {
    expect(
      syncErrorText({
        failedAccounts: ["c1", "c2"],
        reconnectAccounts: ["c2"],
        rateLimitedAccounts: ["c1"],
      }),
    ).toBe("Gmail needs to be reconnected.");
  });

  it("asks for a reconnect when any failed account has to be reconnected", () => {
    expect(syncErrorText({ failedAccounts: ["c1", "c2"], reconnectAccounts: ["c2"] })).toBe(
      "Gmail needs to be reconnected.",
    );
  });
});
