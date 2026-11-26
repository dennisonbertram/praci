import { describe, expect, it, vi } from "vitest";
import {
  firewalledBotIds,
  groupHasFirewalledMember,
  groupTaintedByFirewall,
  readsFirewalledContent,
} from "./firewall-runtime.js";

const scope = { spaceId: "space-1", userId: "user-1" };
const rows =
  <T>(list: T[]) =>
  async () =>
    list;

describe("firewalledBotIds", () => {
  it("keeps only bots whose switch is on", async () => {
    const prisma = {
      bot: {
        findMany: rows([{ id: "a", firewall: true }, { id: "b", firewall: false }, { id: "c" }]),
      },
    };
    expect([...(await firewalledBotIds(prisma as never, "space-1"))]).toEqual(["a"]);
  });
});

describe("groupHasFirewalledMember", () => {
  const prisma = (members: string[]) => ({
    chatGroupMember: { findMany: rows(members.map((botId) => ({ botId }))) },
  });
  it("is true when a member is firewalled and false otherwise", async () => {
    expect(await groupHasFirewalledMember(prisma(["x", "a"]) as never, "g", new Set(["a"]))).toBe(
      true,
    );
    expect(await groupHasFirewalledMember(prisma(["x"]) as never, "g", new Set(["a"]))).toBe(false);
    expect(await groupHasFirewalledMember(prisma(["a"]) as never, "g", new Set())).toBe(false);
  });
});

describe("readsFirewalledContent", () => {
  const ids = new Set(["fw"]);
  const prisma = (over: Record<string, unknown> = {}) => ({
    scratchpadItem: { findMany: rows([] as { botId: string }[]) },
    routine: { findMany: rows([] as { botId: string }[]) },
    ticket: { findMany: rows([] as { createdByBotId: string | null }[]) },
    ticketComment: { findMany: rows([] as { authorBotId: string | null }[]) },
    ...over,
  });
  const reads = (p: object, name: string, args: Record<string, unknown> = {}, set = ids) =>
    readsFirewalledContent(p as never, scope, name, args, set);

  it("never taints when no agent has Firewall on", async () => {
    expect(await reads(prisma(), "calendar_agenda", {}, new Set())).toBe(false);
  });
  it("taints calendar_agenda when a firewalled agent's to-do or routine is in range", async () => {
    expect(
      await reads(
        prisma({ scratchpadItem: { findMany: rows([{ botId: "fw" }]) } }),
        "calendar_agenda",
      ),
    ).toBe(true);
    expect(
      await reads(prisma({ routine: { findMany: rows([{ botId: "fw" }]) } }), "calendar_agenda"),
    ).toBe(true);
    expect(
      await reads(
        prisma({ scratchpadItem: { findMany: rows([{ botId: "other" }]) } }),
        "calendar_agenda",
      ),
    ).toBe(false);
  });
  it("taints board_tickets and ticket_get on a firewalled ticket or comment author", async () => {
    const ticket = prisma({ ticket: { findMany: rows([{ createdByBotId: "fw" }]) } });
    const comment = prisma({ ticketComment: { findMany: rows([{ authorBotId: "fw" }]) } });
    const args = { ref: "RK-1" };
    const withTicket = prisma({
      ticket: { findMany: rows([{ id: "t1", createdByBotId: "fw" }]) },
    });
    const withComment = prisma({
      ticket: { findMany: rows([{ id: "t1", createdByBotId: null }]) },
      ticketComment: { findMany: rows([{ authorBotId: "fw" }]) },
    });
    expect(await reads(ticket, "board_tickets")).toBe(true);
    expect(await reads(prisma(), "board_tickets")).toBe(false);
    expect(await reads(withTicket, "ticket_get", args)).toBe(true);
    expect(await reads(withComment, "ticket_get", args)).toBe(true);
    expect(await reads(prisma(), "ticket_get", args)).toBe(false);
    void comment;
  });
  it("asks the database only about the ticket the call names", async () => {
    const find = vi.fn(async () => [] as { createdByBotId: string | null }[]);
    const p = prisma({ ticket: { findMany: find } });
    await reads(p, "ticket_get", { ref: "RK-7" });
    expect(JSON.stringify(find.mock.calls[0])).toContain("7");
  });
  it("taints a read of a firewalled agent's context or history by botId", async () => {
    for (const name of ["agent_context", "search_agent_history", "read_agent_history"]) {
      expect(await reads(prisma(), name, { botId: "fw" })).toBe(true);
      expect(await reads(prisma(), name, { botId: "other" })).toBe(false);
    }
  });
  it("taints contacts_list when a firewalled agent wrote a matching contact", async () => {
    const find = vi.fn(async () => [{ botId: "fw" }]);
    expect(
      await reads(prisma({ contact: { findMany: find } }), "contacts_list", { query: "ann" }),
    ).toBe(true);
    expect(JSON.stringify(find.mock.calls[0])).toContain("ann");
    expect(
      await reads(prisma({ contact: { findMany: rows([{ botId: null }]) } }), "contacts_list"),
    ).toBe(false);
    expect(
      await reads(prisma({ contact: { findMany: rows([{ botId: "other" }]) } }), "contacts_list"),
    ).toBe(false);
  });
  it("taints contacts_list when a firewalled agent last edited a contact", async () => {
    const find = vi.fn(async () => [{ botId: null, lastEditedByBotId: "fw" }]);
    expect(await reads(prisma({ contact: { findMany: find } }), "contacts_list")).toBe(true);
    expect(JSON.stringify(find.mock.calls[0])).toContain("lastEditedByBotId");
  });
  it("taints contacts_add and contacts_save that return a contact a firewalled agent wrote", async () => {
    const find = vi.fn(async () => [{ botId: "fw", lastEditedByBotId: null }]);
    const p = prisma({ contact: { findMany: find } });
    expect(await reads(p, "contacts_add", { name: "Ann", email: "ANN@x.example" })).toBe(true);
    expect(JSON.stringify(find.mock.calls[0])).toContain("ann@x.example");
    expect(await reads(p, "contacts_save", { name: "Ann", organization: "Acme" })).toBe(true);
    // Nothing matching: a new contact, nothing to read.
    expect(
      await reads(prisma({ contact: { findMany: rows([]) } }), "contacts_add", { name: "Bo" }),
    ).toBe(false);
    expect(await reads(p, "contacts_add", {})).toBe(false);
  });
  it("taints contacts_save with a new email when only an email-less firewalled contact matches", async () => {
    const find = vi.fn(async () => [{ botId: "fw", lastEditedByBotId: null }]);
    const p = prisma({ contact: { findMany: find } });
    expect(
      await reads(p, "contacts_save", {
        name: "Ann",
        organization: "Acme",
        email: "new@x.example",
      }),
    ).toBe(true);
    const where = JSON.stringify(find.mock.calls[0]);
    expect(where).toContain("new@x.example");
    expect(where).toContain('"email":null');
    expect(where).toContain("Acme");
    find.mockClear();
    await reads(p, "contacts_add", { name: "Ann", organization: "Acme", email: "new@x.example" });
    expect(JSON.stringify(find.mock.calls[0])).not.toContain('"email":null');
  });
  it("ignores tools that read nothing an agent wrote", async () => {
    expect(await reads(prisma(), "mail_get", { botId: "fw" })).toBe(false);
  });
});

describe("groupTaintedByFirewall", () => {
  const prisma = (members: string[]) => ({
    chatGroupMember: { findMany: rows(members.map((botId) => ({ botId }))) },
  });
  it("taints on a firewalled message author even after the member left", async () => {
    const ids = new Set(["fw"]);
    expect(await groupTaintedByFirewall(prisma([]) as never, "g", ["fw", null], ids)).toBe(true);
    expect(await groupTaintedByFirewall(prisma([]) as never, "g", ["x", null], ids)).toBe(false);
    expect(await groupTaintedByFirewall(prisma(["fw"]) as never, "g", [], ids)).toBe(true);
  });
});
