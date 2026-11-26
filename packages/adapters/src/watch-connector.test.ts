import { describe, expect, it } from "vitest";
import { watchToolIsRead } from "./watch-connector.js";

describe("watchToolIsRead", () => {
  it.each([
    "mcp__mercury__getAccounts",
    "mcp__mercury__getTreasury",
    "mcp__mercury__getRecipients",
    "mcp__mercury__listTransactions",
    "mcp__mercury__getSafeRequests",
    "mcp__x__get_accounts",
    "GITHUB_LIST_RELEASES",
  ])("accepts the read tool %s", (name) => {
    expect(watchToolIsRead({ name })).toBe(true);
  });

  it.each([
    "mcp__mercury__requestSendMoney",
    "mcp__mercury__requestTransferMoney",
    "mcp__mercury__updateTransaction",
    "mcp__mercury__createCategory",
    "mcp__x__getAndDelete",
    "shell",
    "write_file",
  ])("rejects the write or built-in tool %s", (name) => {
    expect(watchToolIsRead({ name })).toBe(false);
    expect(watchToolIsRead({ name, readOnly: false })).toBe(false);
  });

  it("lets a declared write or a false readOnlyHint win over a read name", () => {
    expect(watchToolIsRead({ name: "list_things", readOnly: false })).toBe(false);
    expect(watchToolIsRead({ name: "getThing", readOnlyHint: false })).toBe(false);
    expect(watchToolIsRead({ name: "getThing", readOnlyHint: true })).toBe(true);
  });
});
