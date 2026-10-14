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

  it("asks for a reconnect when any failed account has to be reconnected", () => {
    expect(syncErrorText({ failedAccounts: ["c1", "c2"], reconnectAccounts: ["c2"] })).toBe(
      "Gmail needs to be reconnected.",
    );
  });
});
