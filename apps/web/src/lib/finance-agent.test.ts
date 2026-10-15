import { financeAgentSpawnKey } from "@rakazo/contracts";
import { describe, expect, it } from "vitest";
import { findFinanceAgent } from "./finance-agent";

const bot = (id: string, spawnKey: string | null, name = "Bot") => ({ id, spawnKey, name });

describe("findFinanceAgent", () => {
  it("returns the bot with this user's spawn key", () => {
    const mine = bot("b2", financeAgentSpawnKey("user-1"));
    expect(findFinanceAgent([bot("b1", null), mine], "user-1")).toBe(mine);
  });

  it("ignores a bot that is only named Finance agent", () => {
    expect(findFinanceAgent([bot("b1", null, "Finance agent")], "user-1")).toBeUndefined();
  });

  it("ignores another member's Finance agent in the same space", () => {
    expect(findFinanceAgent([bot("b1", financeAgentSpawnKey("user-2"))], "user-1")).toBeUndefined();
  });

  it("finds nothing without a user id", () => {
    expect(findFinanceAgent([bot("b1", financeAgentSpawnKey("undefined"))], undefined)).toBe(
      undefined,
    );
  });
});
