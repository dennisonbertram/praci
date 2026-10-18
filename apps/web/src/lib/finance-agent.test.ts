import { financeAgentSpawnKey } from "@rakazo/contracts";
import { describe, expect, it, vi } from "vitest";

vi.mock("@lingui/core/macro", () => ({
  t: (parts: TemplateStringsArray) => parts.join(""),
}));

import { chatStarterQuestions, findFinanceAgent } from "./finance-agent";

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

describe("chatStarterQuestions", () => {
  it("offers the Finance panel's starter questions in the Finance agent's own empty chat", () => {
    const agent = bot("b1", financeAgentSpawnKey("user-1"));
    expect(chatStarterQuestions(agent, "user-1", true)).toEqual([
      "What is our runway?",
      "Where did spend go up this month?",
    ]);
    expect(chatStarterQuestions(agent, "user-1", false)).toBeNull();
    expect(chatStarterQuestions(bot("b2", null), "user-1", true)).toBeNull();
  });
});
