import { inboxAgentSpawnKey } from "@rakazo/contracts";
import { describe, expect, it } from "vitest";
import { findInboxAgent } from "./inbox-agent";

const bot = (id: string, spawnKey: string | null, name = "Bot") => ({ id, spawnKey, name });

describe("findInboxAgent", () => {
  it("returns the bot with this user's spawn key", () => {
    const mine = bot("b2", inboxAgentSpawnKey("user-1"));
    expect(findInboxAgent([bot("b1", null), mine], "user-1")).toBe(mine);
  });

  it("ignores a bot that is only named Inbox agent", () => {
    expect(findInboxAgent([bot("b1", null, "Inbox agent")], "user-1")).toBeUndefined();
  });

  it("ignores another member's Inbox agent in the same space", () => {
    expect(
      findInboxAgent([bot("b1", inboxAgentSpawnKey("user-2"))], "user-1"),
    ).toBeUndefined();
  });

  it("finds nothing without a user id", () => {
    expect(findInboxAgent([bot("b1", inboxAgentSpawnKey("undefined"))], undefined)).toBeUndefined();
  });
});
