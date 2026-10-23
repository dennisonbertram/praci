import {
  cartaAgentSpawnKey,
  DATA_ROOM_AGENT_BUILTIN_TOOLS,
  financeAgentSpawnKey,
  INVESTORS_AGENT_BUILTIN_TOOLS,
  investorsAgentSpawnKey,
  LEGAL_AGENT_BUILTIN_TOOLS,
} from "@rakazo/contracts";
import { describe, expect, it, vi } from "vitest";
import {
  CONTACT_TOOL_NAMES,
  capTableToolsAllowed,
  contactToolFromTool,
  contactToolsAllowed,
} from "./contact-tools.js";
import { selectBuiltinToolsForRun } from "./executor.js";

describe("contact tools", () => {
  const base = {
    hasProvider: true,
    groupId: null,
    runUserId: "u",
    botUserId: "u",
    botSpawnKey: cartaAgentSpawnKey("u"),
    trigger: "user",
    messagingChannelRun: false,
  };

  it("contact tools are for any agent's owner-initiated runs", () => {
    const { botSpawnKey: _key, ...run } = base;
    expect(contactToolsAllowed(run)).toBe(true);
    expect(contactToolsAllowed({ ...run, trigger: "routine" })).toBe(true);
    expect(contactToolsAllowed({ ...run, trigger: "bot_message" })).toBe(false);
    expect(contactToolsAllowed({ ...run, trigger: "webhook" })).toBe(false);
    expect(contactToolsAllowed({ ...run, groupId: "g" })).toBe(false);
    expect(contactToolsAllowed({ ...run, messagingChannelRun: true })).toBe(false);
    expect(contactToolsAllowed({ ...run, runUserId: "other" })).toBe(false);
  });

  it("cap table tools stay with the Carta agent's owner-initiated runs", () => {
    expect(capTableToolsAllowed(base)).toBe(true);
    expect(capTableToolsAllowed({ ...base, botSpawnKey: null })).toBe(false);
    expect(capTableToolsAllowed({ ...base, botSpawnKey: financeAgentSpawnKey("u") })).toBe(false);
    expect(capTableToolsAllowed({ ...base, trigger: "bot_message" })).toBe(false);
  });

  it("the Investors agent passes the cap table gate and its fixed list has cap_table_update", () => {
    const investors = { ...base, botSpawnKey: investorsAgentSpawnKey("u") };
    expect(capTableToolsAllowed(investors)).toBe(true);
    expect(capTableToolsAllowed({ ...investors, trigger: "bot_message" })).toBe(false);
    expect(INVESTORS_AGENT_BUILTIN_TOOLS).toContain("cap_table_read");
    expect(INVESTORS_AGENT_BUILTIN_TOOLS).toContain("cap_table_update");
    expect(INVESTORS_AGENT_BUILTIN_TOOLS).toEqual(
      expect.arrayContaining(["contacts_list", "contacts_add", "contacts_save"]),
    );
  });

  it("the Legal and Data room agents are offered contacts_list and contacts_add", () => {
    for (const tools of [LEGAL_AGENT_BUILTIN_TOOLS, DATA_ROOM_AGENT_BUILTIN_TOOLS]) {
      expect(tools).toEqual(expect.arrayContaining(["contacts_list", "contacts_add"]));
    }
  });

  it("are offered only when enabled", () => {
    const offered = (flags: { contactsEnabled?: boolean; capTableEnabled?: boolean }) =>
      selectBuiltinToolsForRun({
        graphicalToolsAllowed: false,
        pageBrowserAllowed: false,
        groupId: null,
        trigger: "message",
        semanticMemoryEnabled: false,
        messagingChannelRun: false,
        ...flags,
      })
        .map((tool) => tool.name)
        .filter((name) => CONTACT_TOOL_NAMES.has(name))
        .sort();
    expect(offered({})).toEqual([]);
    expect(offered({ contactsEnabled: true })).toEqual([
      "contacts_add",
      "contacts_list",
      "contacts_save",
    ]);
    expect(offered({ capTableEnabled: true })).toEqual(["cap_table_read", "cap_table_update"]);
    expect(offered({ contactsEnabled: true, capTableEnabled: true })).toHaveLength(5);
  });

  const scope = { spaceId: "s1", userId: "u" };
  it("contacts_add creates a new contact and returns an existing one without writing", async () => {
    const row = {
      id: "c1",
      name: "Ada Fund",
      email: "ada@example.test",
      organization: null,
      kind: "investor",
      notes: null,
      bot: null,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    };
    const findFirst = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(row);
    const create = vi.fn(async () => row);
    const update = vi.fn();
    const updateMany = vi.fn();
    const prisma = { contact: { findFirst, create, update, updateMany } } as never;
    const args = { name: "Ada Fund", email: "ada@example.test" };
    // The agent comes from the run; a botId in the model's arguments is dropped.
    const added = await contactToolFromTool(
      "contacts_add",
      { prisma, scope, botId: "bot1" },
      { ...args, botId: "someone-else" },
    );
    expect(added).toEqual({ contact: expect.objectContaining({ id: "c1" }) });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ ...scope, ...args, botId: "bot1" }),
      }),
    );
    const again = await contactToolFromTool(
      "contacts_add",
      { prisma, scope },
      {
        ...args,
        name: "Changed",
        notes: "x",
      },
    );
    expect(again).toEqual({
      contact: expect.objectContaining({ id: "c1", name: "Ada Fund" }),
      alreadySaved: true,
      note: "Already saved as investor; nothing was changed. Use contacts_save to change the kind.",
    });
    expect(create).toHaveBeenCalledTimes(1);
    expect(update).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("cap_table_read returns the run owner's saved cap table, or null before the first save", async () => {
    const saved = {
      companyName: "Example Co",
      asOf: "2026-01-31",
      fullyDilutedShares: 1000,
      shareClasses: [],
      holders: [],
    };
    const findUnique = vi
      .fn()
      .mockResolvedValueOnce({
        data: saved,
        source: "carta",
        previous: null,
        updatedAt: new Date("2026-02-01T00:00:00Z"),
      })
      .mockResolvedValueOnce(null);
    const safeRow = (id: string, extra: Record<string, unknown>) => ({
      id,
      source: "native",
      investorName: id,
      amountCents: 5_000_000n,
      capCents: 100_000_000n,
      valuationType: "post_money_cap",
      mfn: false,
      proRata: false,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      ...extra,
    });
    const sent = new Date("2026-02-01T00:00:00Z");
    const findMany = vi.fn(async () => [
      safeRow("Sent Fund", { sentAt: sent }),
      safeRow("Draft Fund", {}),
    ]);
    const prisma = { capTableSnapshot: { findUnique }, safe: { findMany } } as never;
    const read = await contactToolFromTool("cap_table_read", { prisma, scope }, {});
    expect(read).toEqual({
      capTable: expect.objectContaining({
        companyName: "Example Co",
        fullyDilutedShares: 1000,
        // The page's figure (no Funded SAFE here), not an amount stored by the source.
        amountRaisedUsd: 0,
        amountRaisedSource: expect.stringContaining("Funded SAFEs"),
      }),
      // A Draft is not on the Cap Table page, so the agent does not see it here either.
      safes: [
        {
          investor: "Sent Fund",
          status: "sent",
          amountUsd: 50_000,
          postMoneyCapUsd: 1_000_000,
          atCapPercent: 5,
        },
      ],
    });
    expect(findUnique).toHaveBeenCalledWith({ where: { spaceId_userId: scope } });
    expect(await contactToolFromTool("cap_table_read", { prisma, scope }, {})).toEqual(
      expect.objectContaining({ capTable: null }),
    );
  });

  it("cap_table_read gives each holder's ownership percent as the page shows it", async () => {
    const findUnique = vi.fn(async () => ({
      data: {
        companyName: "Example Co",
        asOf: "2026-01-31",
        fullyDilutedShares: 1000,
        optionPoolAvailable: 200,
        shareClasses: [],
        holders: [
          { name: "Maya", security: "Common", shares: 500, amountUsd: null },
          { name: "River", security: "Common", shares: 300, amountUsd: null },
          { name: "Quill SAFE", security: "SAFE", shares: null, amountUsd: 250000 },
        ],
      },
      source: "carta",
      previous: null,
      updatedAt: new Date("2026-02-01T00:00:00Z"),
    }));
    const prisma = {
      capTableSnapshot: { findUnique },
      safe: { findMany: async () => [] },
    } as never;
    const read = (await contactToolFromTool("cap_table_read", { prisma, scope }, {})) as {
      capTable: { holders: { name: string; ownershipPercent: number | null }[] };
    };
    expect(read.capTable.holders.map((h) => [h.name, h.ownershipPercent])).toEqual([
      ["Maya", 50],
      ["River", 30],
    ]); // the SAFE holder is not a table row, as on the Investors page
  });

  it("cap_table_update validates, then saves for the run's owner", async () => {
    const updateMany = vi.fn(async () => ({ count: 1 }));
    const prisma = { capTableSnapshot: { updateMany } } as never;
    const bad = await contactToolFromTool(
      "cap_table_update",
      { prisma, scope },
      { companyName: "X" },
    );
    expect(bad).toEqual({ error: expect.stringContaining("asOf") });
    expect(updateMany).not.toHaveBeenCalled();
    const ok = await contactToolFromTool(
      "cap_table_update",
      { prisma, scope },
      {
        companyName: "Example Co",
        asOf: "2026-01-31",
        fullyDilutedShares: 1000,
        shareClasses: [],
        holders: [],
      },
    );
    expect(ok).toEqual({ ok: true });
    // Written as Carta, whatever the model passes for the source.
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ ...scope, source: "carta" }) }),
    );
  });

  it("cap_table_update writes as the sheet for the Investors agent and refuses a table of another source", async () => {
    const updateMany = vi.fn(async () => ({ count: 1 }));
    const prisma = { capTableSnapshot: { updateMany } } as never;
    const args = {
      companyName: "Example Co",
      asOf: "2026-01-31",
      fullyDilutedShares: 1000,
      source: "carta",
      sourceRef: { driveFileId: "file-1", name: "Cap table" },
      shareClasses: [],
      holders: [{ name: "Ada Fund", security: "Common", shares: 1000 }],
    };
    expect(
      await contactToolFromTool("cap_table_update", { prisma, scope, writer: "sheet" }, args),
    ).toEqual({ ok: true });
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ ...scope, source: "sheet" }) }),
    );
    const empty = await contactToolFromTool(
      "cap_table_update",
      { prisma, scope, writer: "sheet" },
      { ...args, holders: [] },
    );
    expect(empty).toEqual({ error: expect.stringContaining("nothing was changed") });
  });

  it("cap_table_update says so when another source owns the table", async () => {
    const prisma = {
      capTableSnapshot: {
        updateMany: vi.fn(async () => ({ count: 0 })),
        findUnique: vi.fn(async () => ({ id: "row" })),
      },
    } as never;
    const refused = await contactToolFromTool(
      "cap_table_update",
      { prisma, scope },
      {
        companyName: "Example Co",
        asOf: "2026-01-31",
        fullyDilutedShares: 1000,
        source: "native",
        shareClasses: [],
        holders: [],
      },
    );
    expect(refused).toEqual({ error: expect.stringContaining("not read from Carta") });
  });

  it("contacts_save updates a matching contact and never creates one", async () => {
    const row = {
      id: "c1",
      name: "Ada Fund",
      email: "ada@example.test",
      organization: null,
      kind: "investor",
      notes: null,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    };
    const findFirst = vi.fn().mockResolvedValueOnce(null).mockResolvedValue({ id: "c1" });
    const create = vi.fn();
    const upsert = vi.fn();
    const update = vi.fn(async () => row);
    const findUniqueOrThrow = vi.fn(async () => ({ ...row, name: "Ada Capital" }));
    // The write runs in a transaction that locks the row, whose email and kind are read first.
    const tx = {
      $queryRaw: vi.fn(async () => [{ email: row.email, kind: row.kind }]),
      contact: { update, findUniqueOrThrow },
      investorPortalToken: { deleteMany: vi.fn() },
      portalSession: { deleteMany: vi.fn() },
      investorShare: { deleteMany: vi.fn() },
    };
    const prisma = {
      contact: { findFirst, create, upsert },
      $transaction: async (work: (client: typeof tx) => unknown) => work(tx),
    } as never;
    const args = { name: "Ada Capital", email: "ada@example.test" };
    const missing = await contactToolFromTool("contacts_save", { prisma, scope }, args);
    expect(missing).toEqual({
      error: "No contact with this email. Use contacts_add for new people.",
    });
    const noEmail = await contactToolFromTool("contacts_save", { prisma, scope }, { name: "X" });
    expect(noEmail).toHaveProperty("error");
    expect(create).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
    const saved = await contactToolFromTool("contacts_save", { prisma, scope }, args);
    expect(saved).toEqual({ contact: expect.objectContaining({ name: "Ada Capital" }) });
    expect(upsert).not.toHaveBeenCalled();
  });
});

describe("fundraising_read", () => {
  const offered = (flags: { fundraisingEnabled?: boolean; capTableEnabled?: boolean }) =>
    selectBuiltinToolsForRun({
      graphicalToolsAllowed: false,
      pageBrowserAllowed: false,
      groupId: null,
      trigger: "message",
      semanticMemoryEnabled: false,
      messagingChannelRun: false,
      ...flags,
    }).map((tool) => tool.name);

  it("is offered only with its own gate, which the cap table gate does not open", () => {
    expect(offered({})).not.toContain("fundraising_read");
    expect(offered({ capTableEnabled: true })).not.toContain("fundraising_read");
    expect(offered({ fundraisingEnabled: true })).toContain("fundraising_read");
  });

  it("is in the Investors agent's fixed list and in no other agent's", () => {
    expect(INVESTORS_AGENT_BUILTIN_TOOLS).toContain("fundraising_read");
    for (const tools of [LEGAL_AGENT_BUILTIN_TOOLS, DATA_ROOM_AGENT_BUILTIN_TOOLS])
      expect(tools).not.toContain("fundraising_read");
  });
});
