import { describe, expect, it } from "vitest";
import {
  channelMessageLine,
  messageProviderLabel,
  providerLabel,
  selectableMessageText,
} from "./messaging-labels.js";

describe("messaging labels", () => {
  it("names known providers and falls back to the raw id", () => {
    expect(providerLabel("lark")).toBe("Feishu");
    expect(providerLabel("matrix")).toBe("matrix");
  });

  it("narrows sendblue to a recognized transport only", () => {
    expect(messageProviderLabel("sendblue", "SMS")).toBe("SMS");
    expect(messageProviderLabel("sendblue", "fax")).toBe("iMessage");
    expect(messageProviderLabel("slack", "SMS")).toBe("Slack");
  });

  it("formats a channel message line", () => {
    expect(
      channelMessageLine({ provider: "sendblue", transport: "RCS", fromLabel: "Ada", text: "hi" }),
    ).toBe("RCS · Ada: hi");
  });

  it("joins text-like blocks untrimmed and skips the rest", () => {
    expect(
      selectableMessageText({
        blocks: [
          { kind: "text", text: "  a" },
          { kind: "channel_message", provider: "slack", fromLabel: "Ada", text: "b" },
          { kind: "text", text: "" },
        ],
      } as never),
    ).toBe("  a\nSlack · Ada: b");
  });
});
