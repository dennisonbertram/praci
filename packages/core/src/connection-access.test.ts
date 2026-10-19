import { describe, expect, it } from "vitest";
import {
  botMayUseConnection,
  type ConnectionAccessRow,
  deniedConnectionIds,
  effectiveAccessByConnection,
} from "./connection-access.js";

const row = (
  id: string,
  status: string,
  allAgents: boolean,
  extra: Partial<ConnectionAccessRow> = {},
): ConnectionAccessRow => ({
  id,
  connectorId: "composio",
  provider: "gmail",
  status,
  allAgents,
  agentBotId: null,
  botAccess: [],
  ...extra,
});
const grant = (...botIds: string[]) => botIds.map((botId) => ({ botId }));

describe("botMayUseConnection", () => {
  it("lets every agent use a connection open to all agents", () => {
    expect(botMayUseConnection({ allAgents: true, botAccess: [] })).toBe(true);
  });
  it("limits a restricted connection to bots with an access row", () => {
    expect(botMayUseConnection({ allAgents: false, botAccess: [] })).toBe(false);
    expect(botMayUseConnection({ allAgents: false, botAccess: grant("bot-1") })).toBe(true);
  });
});

describe("deniedConnectionIds", () => {
  it("denies every account of a restricted ordinary app, including a pending sibling", () => {
    const denied = deniedConnectionIds([row("a", "connected", false), row("b", "pending", true)]);
    expect([...denied].sort()).toEqual(["a", "b"]);
  });

  it("ignores pending and errored rows when deciding denial", () => {
    expect(
      deniedConnectionIds([row("a", "connected", true), row("b", "pending", false)]).size,
    ).toBe(0);
    expect(deniedConnectionIds([row("a", "connected", true), row("b", "error", false)]).size).toBe(
      0,
    );
  });

  it("allows every account once the bot is granted", () => {
    const rows = [
      row("a", "connected", false, { botAccess: grant("bot-1") }),
      row("b", "error", false, { botAccess: grant("bot-1") }),
    ];
    expect(deniedConnectionIds(rows).size).toBe(0);
  });

  it("ignores revoked rows and leaves other apps alone", () => {
    const other = { ...row("c", "connected", true), provider: "slack" };
    expect(
      deniedConnectionIds([row("a", "connected", true), row("r", "revoked", false), other]).size,
    ).toBe(0);
    expect([...deniedConnectionIds([row("a", "connected", false), other])]).toEqual(["a"]);
  });

  it("denies an agent-linked account on its own, not its siblings", () => {
    const denied = deniedConnectionIds([
      row("a", "connected", false, { agentBotId: "agent-a" }),
      row("b", "connected", true),
      row("c", "connected", false, { agentBotId: "agent-c", botAccess: grant("bot-1") }),
    ]);
    expect([...denied]).toEqual(["a"]);
  });

  it("keeps ordinary rows unchanged: shared rows are never denied", () => {
    expect(
      deniedConnectionIds([row("a", "connected", true), row("b", "connected", true)]).size,
    ).toBe(0);
  });
});

describe("effectiveAccessByConnection", () => {
  const bots = [
    { id: "chief", spawnKey: null, archivedAt: null },
    { id: "other", spawnKey: null, archivedAt: null },
    { id: "gone", spawnKey: null, archivedAt: new Date() },
    { id: "agent-a", spawnKey: "integration-agent:a", archivedAt: null },
    { id: "agent-b", spawnKey: "integration-agent:b", archivedAt: null },
  ];

  it("shared with all lists every active bot except other connections' integration agents", () => {
    const result = effectiveAccessByConnection(
      [row("a", "connected", true, { agentBotId: "agent-a" }), row("x", "connected", true)],
      bots,
    );
    expect(result.a).toEqual({ shared: "all", botIds: ["chief", "other", "agent-a"] });
    expect(result.x).toEqual({ shared: "all", botIds: ["chief", "other"] });
  });

  it("lists granted bots only, and none for a private connection with no grants", () => {
    const result = effectiveAccessByConnection(
      [
        row("s", "connected", false, { botAccess: grant("chief", "gone") }),
        { ...row("p", "connected", false), provider: "slack" },
      ],
      bots,
    );
    expect(result.s).toEqual({ shared: "some", botIds: ["chief"] });
    expect(result.p).toEqual({ shared: "none", botIds: [] });
  });

  it("does not let an exclusive linked account hide its shared sibling", () => {
    const result = effectiveAccessByConnection(
      [
        row("a", "connected", false, { agentBotId: "agent-a", botAccess: grant("agent-a") }),
        row("b", "connected", true),
      ],
      bots,
    );
    expect(result.a).toEqual({ shared: "some", botIds: ["agent-a"] });
    expect(result.b?.botIds).toContain("chief");
  });

  it("gives a pending connection no users", () => {
    expect(effectiveAccessByConnection([row("p", "pending", true)], bots).p).toEqual({
      shared: "none",
      botIds: [],
    });
  });
});
