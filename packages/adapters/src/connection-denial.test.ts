import { describe, expect, it } from "vitest";
import { CONNECTION_UNAVAILABLE_MESSAGE, connectionDenial } from "./connection-denial.js";

const row = (over: Record<string, unknown> = {}) => ({
  id: "c1",
  connectorId: "composio",
  provider: "slack",
  status: "connected",
  allAgents: false,
  agentBotId: "owner",
  writesEnabled: true,
  privateByDefault: false,
  botAccess: [{ botId: "ada", canWrite: false }],
  ...over,
});
const prisma = (rows: unknown[]) =>
  ({ connection: { findMany: async () => rows } }) as unknown as Parameters<
    typeof connectionDenial
  >[0];
const ask = (rows: unknown[], bot: { id: string; audience: string | null }, readOnly = false) =>
  connectionDenial(prisma(rows), {
    spaceId: "s",
    userId: "u",
    bot,
    route: { connectorId: "composio", connectionId: "c1" },
    availableIds: ["c1"],
    declaredReadOnly: readOnly,
  });

describe("connectionDenial for a bot that is not the connection's agent", () => {
  const ada = { id: "ada", audience: "internal" };
  it("refuses a change with only a read grant, and allows a read", async () => {
    expect(await ask([row()], ada)).toBe(CONNECTION_UNAVAILABLE_MESSAGE);
    expect(await ask([row()], ada, true)).toBeNull();
  });
  it("allows a change with the write grant while changes are on", async () => {
    expect(await ask([row({ botAccess: [{ botId: "ada", canWrite: true }] })], ada)).toBeNull();
  });
  it("refuses both when the connection's changes switch is off", async () => {
    const off = row({ writesEnabled: false, botAccess: [{ botId: "ada", canWrite: true }] });
    expect(await ask([off], ada)).toBe(CONNECTION_UNAVAILABLE_MESSAGE);
  });
  it("refuses a bot with no grant at all, as when the agent is not shared", async () => {
    expect(await ask([row({ botAccess: [] })], ada, true)).toBe(CONNECTION_UNAVAILABLE_MESSAGE);
  });
  it("never lets an external bot change, even with a write grant", async () => {
    const granted = row({ botAccess: [{ botId: "ada", canWrite: true }] });
    expect(await ask([granted], { id: "ada", audience: "external" })).toBe(
      CONNECTION_UNAVAILABLE_MESSAGE,
    );
  });
});
