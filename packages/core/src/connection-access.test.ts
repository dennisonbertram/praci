import { describe, expect, it } from "vitest";
import type { ConnectionAccessRow } from "./connection-access.js";
import {
  appStatus,
  botMayUseConnection,
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

  it("denies an agent-linked Google account on its own, not its siblings", () => {
    const google = { connectorId: "google", provider: "gmail" };
    const denied = deniedConnectionIds([
      row("a", "connected", false, { ...google, agentBotId: "agent-a" }),
      row("b", "connected", true, google),
      row("c", "connected", false, { ...google, agentBotId: "agent-c", botAccess: grant("bot-1") }),
    ]);
    expect([...denied]).toEqual(["a"]);
  });

  it("keeps the app-wide rule for Composio and Pipedream, linked or not", () => {
    for (const connectorId of ["composio", "pipedream"]) {
      const denied = deniedConnectionIds([
        row("a", "connected", false, { connectorId, agentBotId: "agent-a" }),
        row("b", "connected", true, { connectorId }),
      ]);
      expect([...denied].sort()).toEqual(["a", "b"]);
    }
  });

  it("keeps ordinary rows unchanged: shared rows are never denied", () => {
    expect(
      deniedConnectionIds([row("a", "connected", true), row("b", "connected", true)]).size,
    ).toBe(0);
  });
});

describe("Composio Gmail linked to the Inbox agent", () => {
  const inbox = { id: "inbox", spawnKey: "inbox-agent:user-1", archivedAt: null };
  const rows = [
    row("a", "connected", false, { agentBotId: "inbox", botAccess: grant("inbox") }),
    row("b", "connected", false, { agentBotId: "inbox", botAccess: grant("inbox") }),
  ];
  it("is not denied to the Inbox agent, so its mail tools see both accounts", () => {
    expect(deniedConnectionIds(rows).size).toBe(0);
  });
  it("lists the Inbox agent as able to use both accounts", () => {
    const access = effectiveAccessByConnection(rows, [inbox]);
    expect(access.a?.botIds).toEqual(["inbox"]);
    expect(access.b?.botIds).toEqual(["inbox"]);
  });
});

describe("effectiveAccessByConnection for an email's own agent", () => {
  const bots = [
    { id: "inbox", spawnKey: "inbox-agent:user-1", archivedAt: null },
    { id: "thread", spawnKey: "mail-thread:c1:t1", archivedAt: null },
  ];
  it("follows the Inbox agent's grants and ignores its own", () => {
    const result = effectiveAccessByConnection(
      [
        row("a", "connected", false, { botAccess: grant("inbox") }),
        row("b", "connected", false, { provider: "slack", botAccess: grant("thread") }),
      ],
      bots,
    );
    expect(result.a?.botIds).toEqual(["inbox", "thread"]);
    expect(result.b?.botIds).toEqual([]);
  });
});

describe("effectiveAccessByConnection for an external bot", () => {
  const bots = [
    { id: "chief", spawnKey: null, archivedAt: null },
    { id: "support", spawnKey: null, archivedAt: null, audience: "external" },
  ];
  it("shared with all agents does not reach an external bot; an explicit grant does", () => {
    const result = effectiveAccessByConnection(
      [
        row("open", "connected", true),
        { ...row("granted", "connected", true), provider: "slack", botAccess: grant("support") },
      ],
      bots,
    );
    expect(result.open?.botIds).toEqual(["chief"]);
    expect(result.granted?.botIds).toEqual(["chief", "support"]);
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

  it("does not let an exclusive linked Google account hide its shared sibling", () => {
    const google = { connectorId: "google", provider: "gmail" };
    const result = effectiveAccessByConnection(
      [
        row("a", "connected", false, {
          ...google,
          agentBotId: "agent-g",
          botAccess: grant("agent-g"),
        }),
        row("b", "connected", true, google),
      ],
      [...bots, { id: "agent-g", spawnKey: "integration-agent:a", archivedAt: null }],
    );
    expect(result.a?.botIds).toEqual(["agent-g"]);
    expect(result.b?.botIds).toEqual(["chief", "other"]);
  });

  it("hides a shared Composio sibling while an exclusive linked account exists", () => {
    const result = effectiveAccessByConnection(
      [
        row("a", "connected", false, { agentBotId: "agent-a", botAccess: grant("agent-a") }),
        row("b", "connected", true),
      ],
      bots,
    );
    expect(result.a).toEqual({ shared: "some", botIds: ["agent-a"] });
    expect(result.b).toEqual({ shared: "none", botIds: [] });
  });

  it("gives each of two private accounts of one app its own linked agent", () => {
    const result = effectiveAccessByConnection(
      [
        row("a", "connected", false, { agentBotId: "agent-a", botAccess: grant("agent-a") }),
        row("b", "connected", false, { agentBotId: "agent-b", botAccess: grant("agent-b") }),
      ],
      bots,
    );
    expect(result.a).toEqual({ shared: "some", botIds: ["agent-a"] });
    expect(result.b).toEqual({ shared: "some", botIds: ["agent-b"] });
  });

  it("lists only agents whose identity can reach the connector", () => {
    const special = [
      "finance-agent:u1",
      "inbox-agent:u1",
      "legal-agent:u1",
      "carta-agent:u1",
      "investors-agent:u1",
      "voice-agent:u1",
    ].map((spawnKey, i) => ({ id: `s${i}`, spawnKey, archivedAt: null }));
    const all = [...bots, ...special];
    const slack = effectiveAccessByConnection(
      [row("x", "connected", true, { provider: "slack" })],
      all,
    ).x;
    expect(slack?.botIds).toEqual(["chief", "other"]);
    const gmail = effectiveAccessByConnection(
      [row("g", "connected", true, { connectorId: "google", provider: "gmail" })],
      all,
    ).g;
    expect(gmail?.botIds).toEqual(["chief", "other", "s0", "s1", "s2", "s3", "s4"]);
  });

  it("gives a pending connection no users", () => {
    expect(effectiveAccessByConnection([row("p", "pending", true)], bots).p).toEqual({
      shared: "none",
      botIds: [],
    });
  });
});

describe("effectiveAccessByConnection for Google agents", () => {
  const bots = [
    { id: "chief", spawnKey: null, archivedAt: null },
    { id: "inbox", spawnKey: "inbox-agent:u1", archivedAt: null },
    { id: "cal", spawnKey: "integration-agent:cal-1", archivedAt: null },
  ];
  const rows = [
    row("gm", "connected", false, {
      connectorId: "google",
      provider: "gmail",
      agentBotId: "inbox",
      botAccess: grant("inbox"),
    }),
    row("cal-1", "connected", false, {
      connectorId: "google",
      provider: "googlecalendar",
      agentBotId: "cal",
      botAccess: grant("cal"),
    }),
  ];

  it("keeps a linked private account to its own agent", () => {
    const result = effectiveAccessByConnection(rows, bots);
    expect(result.gm?.botIds).toEqual(["inbox"]);
    expect(result["cal-1"]?.botIds).toEqual(["cal"]);
  });

  it("adds the other bots once the account is shared with all agents", () => {
    const shared = rows.map((r) => ({ ...r, allAgents: true }));
    const result = effectiveAccessByConnection(shared, bots);
    expect(result["cal-1"]?.botIds).toEqual(["chief", "inbox", "cal"]);
  });
});

describe("connections created private", () => {
  it("native Google is denied one account at a time, with or without its agent", () => {
    for (const agentBotId of [null, "agent"]) {
      const rows = [
        row("private", "connected", false, {
          connectorId: "google",
          privateByDefault: true,
          agentBotId,
        }),
        row("legacy", "connected", true, { connectorId: "google" }),
      ];
      expect([...deniedConnectionIds(rows)]).toEqual(["private"]);
    }
  });

  it.each(["composio", "pipedream"])(
    "%s keeps denying the whole app, because dispatch does not pin the account",
    (connectorId) => {
      for (const agentBotId of [null, "agent"]) {
        const rows = [
          row("private", "connected", false, { connectorId, privateByDefault: true, agentBotId }),
          row("legacy", "connected", true, { connectorId }),
        ];
        expect([...deniedConnectionIds(rows)].sort()).toEqual(["legacy", "private"]);
      }
    },
  );
});

describe("appStatus", () => {
  const conn = (status: string, needsReconnect?: boolean) => ({ status, needsReconnect }) as never;
  it("maps connection rows: a working account wins, then pending, then error", () => {
    expect(appStatus([conn("error"), conn("connected")])).toBe("connected");
    expect(appStatus([conn("error"), conn("pending")])).toBe("connecting");
    expect(appStatus([conn("error")])).toBe("failed");
    expect(appStatus([conn("revoked")])).toBeNull();
  });
  it("needs a reconnect when every connected account's sign-in was refused", () => {
    expect(appStatus([conn("connected", true)])).toBe("reconnect");
    expect(appStatus([conn("connected", true), conn("connected")])).toBe("connected");
  });
});

describe("an email's own agent shares the Inbox agent's Gmail access", () => {
  const thread = { id: "bot-thread", userId: "u1", spawnKey: "mail-thread:c1:t1" };
  const inboxKey = "inbox-agent:u1";
  // The demo's Gmail: limited to the Inbox agent, which is also its linked agent.
  const gmail = {
    id: "c1",
    connectorId: "composio",
    provider: "GMAIL",
    status: "connected",
    allAgents: false,
    agentBotId: "bot-inbox",
    agentBot: { spawnKey: inboxKey },
  };

  it("reads the Inbox agent's access rows too, so Gmail is not denied to it", async () => {
    const { connectionAccessFilter, deniedConnectionIds, withInboxAgentStandIn } = await import(
      "./connection-access.js"
    );
    expect(connectionAccessFilter(thread)).toEqual({ bot: { spawnKey: inboxKey } });
    expect(connectionAccessFilter({ id: "b", userId: "u1", spawnKey: null })).toEqual({
      botId: "b",
    });
    const row = { ...gmail, botAccess: [{ botId: "bot-inbox" }] };
    expect(deniedConnectionIds([row]).size).toBe(0);
    expect(withInboxAgentStandIn(row, thread).agentBotId).toBe("bot-thread");
  });

  it("gives the thread agent exactly what Inbox gets when accounts are granted unevenly", async () => {
    const { connectionAccessFilter, deniedConnectionIds } = await import("./connection-access.js");
    // A grants only Inbox; legacy unlinked B grants only the thread agent.
    const grants = [
      { rowId: "A", botId: "bot-inbox", spawnKey: inboxKey },
      { rowId: "B", botId: "bot-thread", spawnKey: thread.spawnKey },
    ];
    const base = {
      connectorId: "composio",
      provider: "GMAIL",
      status: "connected",
      allAgents: false,
      agentBotId: null,
    };
    // The filter lets through only grants held by the Inbox agent.
    expect(connectionAccessFilter(thread)).not.toHaveProperty("OR");
    const seen = (rowId: string) =>
      grants
        .filter((g) => g.rowId === rowId && g.spawnKey === inboxKey)
        .map((g) => ({ botId: g.botId }));
    const rows = [
      { ...base, id: "A", botAccess: seen("A") },
      { ...base, id: "B", botAccess: seen("B") },
    ];
    // Same denial Inbox sees: B has no Inbox grant, so the whole app is denied to both.
    expect([...deniedConnectionIds(rows)].sort()).toEqual(["A", "B"]);
  });

  it("does not stand in for another bot, or for another agent's connection", async () => {
    const { withInboxAgentStandIn } = await import("./connection-access.js");
    expect(withInboxAgentStandIn(gmail, { id: "x", spawnKey: null }).agentBotId).toBe("bot-inbox");
    const other = { ...gmail, agentBot: { spawnKey: "integration-agent:c1" } };
    expect(withInboxAgentStandIn(other, thread).agentBotId).toBe("bot-inbox");
  });
});
