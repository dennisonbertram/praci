import {
  cartaAgentSpawnKey,
  DATA_ROOM_AGENT_BUILTIN_TOOLS,
  financeAgentSpawnKey,
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
      createdAt: new Date(0),
      updatedAt: new Date(0),
    };
    const findFirst = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(row);
    const create = vi.fn(async () => row);
    const update = vi.fn();
    const updateMany = vi.fn();
    const prisma = { contact: { findFirst, create, update, updateMany } } as never;
    const args = { name: "Ada Fund", email: "ada@example.test" };
    const added = await contactToolFromTool("contacts_add", { prisma, scope }, args);
    expect(added).toEqual({ contact: expect.objectContaining({ id: "c1" }) });
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ ...scope, ...args }) });
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
      note: expect.any(String),
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
      .mockResolvedValueOnce({ data: saved, updatedAt: new Date("2026-02-01T00:00:00Z") })
      .mockResolvedValueOnce(null);
    const prisma = { capTableSnapshot: { findUnique } } as never;
    const read = await contactToolFromTool("cap_table_read", { prisma, scope }, {});
    expect(read).toEqual({
      capTable: expect.objectContaining({ companyName: "Example Co", fullyDilutedShares: 1000 }),
    });
    expect(findUnique).toHaveBeenCalledWith({ where: { spaceId_userId: scope } });
    expect(await contactToolFromTool("cap_table_read", { prisma, scope }, {})).toEqual({
      capTable: null,
    });
  });

  it("cap_table_update validates, then saves for the run's owner", async () => {
    const upsert = vi.fn(async () => ({}));
    const prisma = { capTableSnapshot: { upsert } } as never;
    const bad = await contactToolFromTool(
      "cap_table_update",
      { prisma, scope },
      { companyName: "X" },
    );
    expect(bad).toEqual({ error: expect.stringContaining("asOf") });
    expect(upsert).not.toHaveBeenCalled();
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
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { spaceId_userId: scope } }),
    );
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
    const updateMany = vi.fn(async () => ({ count: 1 }));
    const create = vi.fn();
    const upsert = vi.fn();
    const findUniqueOrThrow = vi.fn(async () => ({ ...row, name: "Ada Capital" }));
    const prisma = {
      contact: { findFirst, updateMany, create, upsert, findUniqueOrThrow },
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
