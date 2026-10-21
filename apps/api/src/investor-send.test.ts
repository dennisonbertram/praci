import type { Actor, ComposeFields, ComposeResult } from "@rakazo/contracts";
import { getInvestorUpdate, SENDING_STALE_MS } from "@rakazo/db";
import { describe, expect, it, vi } from "vitest";
import type { InvestorSendDeps } from "./investor-send.js";
import {
  markdownToHtml,
  startInvestorUpdateRetry,
  startInvestorUpdateSend,
} from "./investor-send.js";

const actor: Actor = {
  userId: "user-1",
  spaceId: "space-1",
  email: "user-1@rakazo.test",
  isDeploymentOwner: false,
};

type Record = { [key: string]: unknown };

/** A tiny in-memory stand-in for the four Prisma delegates the send path uses. */
function fakePrisma() {
  const tables = {
    investorUpdate: [] as Record[],
    contact: [] as Record[],
    composeSend: [] as Record[],
  };
  const test = (value: unknown, cond: unknown): boolean => {
    if (cond && typeof cond === "object" && !(cond instanceof Date)) {
      const c = cond as Record;
      if ("in" in c) return (c.in as unknown[]).includes(value);
      if ("not" in c) return c.not === null ? value != null : value !== c.not;
      if ("lt" in c) return (value as Date) < (c.lt as Date);
    }
    if (cond instanceof Date) return (value as Date)?.getTime() === cond.getTime();
    return value === cond;
  };
  const matches = (row: Record, where: Record): boolean =>
    Object.entries(where).every(([key, cond]) =>
      key === "OR"
        ? (cond as Record[]).some((w) => matches(row, w))
        : key === "spaceId_userId_clientId"
          ? Object.entries(cond as Record).every(([k, v]) => row[k] === v)
          : test(row[key], cond),
    );
  const delegate = (rows: Record[]) => ({
    findFirst: async ({ where }: { where: Record }) => rows.find((r) => matches(r, where)) ?? null,
    findMany: async ({ where }: { where: Record }) => rows.filter((r) => matches(r, where)),
    updateMany: async ({ where, data }: { where: Record; data: Record }) => {
      const hit = rows.filter((r) => matches(r, where));
      for (const r of hit) Object.assign(r, data, { updatedAt: new Date() });
      return { count: hit.length };
    },
    upsert: async ({ where, create }: { where: Record; create: Record }) => {
      const found = rows.find((r) => matches(r, where));
      if (found) return found;
      rows.push(create);
      return create;
    },
  });
  const prisma = {
    investorUpdate: delegate(tables.investorUpdate),
    contact: delegate(tables.contact),
    composeSend: delegate(tables.composeSend),
    space: { findUnique: async () => ({ name: "Acme" }) },
  };
  return { prisma, tables };
}

function setup(results: Record = {}) {
  const { prisma, tables } = fakePrisma();
  const scope = { spaceId: actor.spaceId, userId: actor.userId };
  for (const [id, email] of [
    ["ann", "ann@example.test"],
    ["bob", "bob@example.test"],
    ["cy", null],
  ] as const)
    tables.contact.push({ id, name: id, email, ...scope });
  tables.investorUpdate.push({
    id: "upd1",
    ...scope,
    audience: "investors",
    subject: "Acme · 2026-10 update",
    period: "2026-10",
    body: "Hello **team**",
    status: "draft",
    recipientContactIds: ["ann", "bob", "cy"],
    fromConnectionId: null,
    deliveries: {},
    sentAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const calls: ComposeFields[] = [];
  const compose = vi.fn(async (_actor: Actor, fields: ComposeFields): Promise<ComposeResult> => {
    calls.push(fields);
    const status = (results[fields.to] as ComposeResult["status"]) ?? "sent";
    // The composer records the outcome in its own row.
    if (status !== "disabled")
      tables.composeSend.push({
        ...scope,
        clientId: fields.clientId,
        connectionId: fields.connectionId,
        state: status === "sent" ? "sent" : status === "unknown" ? "unknown" : "failed",
      });
    return { status };
  });
  const deps: InvestorSendDeps = {
    prisma: prisma as never,
    compose,
    gmailConnectionIds: async () => ["conn-1"],
  };
  return { deps, tables, calls, compose, scope, prisma };
}

describe("startInvestorUpdateSend", () => {
  it("sends one message per recipient with an email, each under its own attempt key", async () => {
    const { deps, calls } = setup();
    const { update, done } = await startInvestorUpdateSend(deps, actor, "upd1");
    expect(update.status).toBe("sending");
    await done;
    expect(calls.map((c) => [c.to, c.clientId, c.cc, c.bcc])).toEqual([
      ["ann@example.test", "upd1:ann:1", "", ""],
      ["bob@example.test", "upd1:bob:1", "", ""],
    ]);
    expect(calls[0]?.html).toContain("<strong>team</strong>");
    const after = await getInvestorUpdate(deps.prisma, actor, "upd1");
    expect(after.status).toBe("sent");
    expect(after.deliveries.map((d) => d.state)).toEqual(["sent", "sent"]);
  });

  it("sends board updates with the same formatting as investor updates", async () => {
    const { deps, calls, tables } = setup();
    tables.investorUpdate[0] = { ...tables.investorUpdate[0], audience: "board" };
    await (await startInvestorUpdateSend(deps, actor, "upd1")).done;
    expect(calls[0]?.html).toContain("<strong>team</strong>");
    expect(calls[0]?.body).toBe("Hello **team**");
  });

  it("a second Send is a no-op", async () => {
    const { deps, compose } = setup();
    const first = await startInvestorUpdateSend(deps, actor, "upd1");
    const second = await startInvestorUpdateSend(deps, actor, "upd1");
    await Promise.all([first.done, second.done]);
    expect(compose).toHaveBeenCalledTimes(2);
  });

  it("records a failed recipient and retries only that one as a new attempt", async () => {
    const { deps, calls } = setup({ "bob@example.test": "failed" });
    await (await startInvestorUpdateSend(deps, actor, "upd1")).done;
    const partly = await getInvestorUpdate(deps.prisma, actor, "upd1");
    expect(partly.status).toBe("partly_sent");
    expect(partly.deliveries.map((d) => d.state)).toEqual(["sent", "failed"]);
    // The next attempt for Bob goes through.
    calls.length = 0;
    const retry = await startInvestorUpdateRetry(deps, actor, { id: "upd1" });
    expect(retry.update.status).toBe("sending");
    await retry.done;
    expect(calls.map((c) => c.clientId)).toContain("upd1:bob:2");
    expect(calls.every((c) => c.to === "bob@example.test")).toBe(true);
  });

  it("shows a failure before the composer wrote a row as Failed, not Unknown", async () => {
    const { deps } = setup();
    deps.compose = async () => {
      throw new Error("account gone");
    };
    await (await startInvestorUpdateSend(deps, actor, "upd1")).done;
    const after = await getInvestorUpdate(deps.prisma, actor, "upd1");
    expect(after.deliveries.map((d) => d.state)).toEqual(["failed", "failed"]);
  });

  it("refuses with no connected Gmail, no recipient with an email, or writes turned off", async () => {
    const none = setup();
    await expect(
      startInvestorUpdateSend({ ...none.deps, gmailConnectionIds: async () => [] }, actor, "upd1"),
    ).rejects.toMatchObject({ message: "Connect Gmail to send" });
    const off = setup();
    await expect(
      startInvestorUpdateSend({ ...off.deps, mailWritesDisabled: true }, actor, "upd1"),
    ).rejects.toMatchObject({ message: "Sending is off" });
    const empty = setup();
    empty.tables.investorUpdate[0] = {
      ...empty.tables.investorUpdate[0],
      recipientContactIds: ["cy"],
    };
    await expect(startInvestorUpdateSend(empty.deps, actor, "upd1")).rejects.toMatchObject({
      message: "Pick at least one recipient",
    });
    expect(none.compose).not.toHaveBeenCalled();
  });

  it("reads a send that stopped moving as Partly sent, with an attempt that has no result as Unknown and not resent", async () => {
    const { deps, tables, compose } = setup();
    // The process died after recording Ann's attempt and before any result.
    tables.investorUpdate[0] = {
      ...tables.investorUpdate[0],
      status: "sending",
      deliveries: { ann: [{ n: 1, at: new Date().toISOString() }] },
      updatedAt: new Date(Date.now() - SENDING_STALE_MS - 1000),
    };
    const view = await getInvestorUpdate(deps.prisma, actor, "upd1");
    expect(view.status).toBe("partly_sent");
    expect(view.deliveries).toEqual([
      { contactId: "ann", name: "ann", state: "unknown" },
      { contactId: "bob", name: "bob", state: "failed" },
      { contactId: "cy", name: "cy", state: "failed" },
    ]);
    // Retry without the confirmation skips the Unknown recipient.
    const retry = await startInvestorUpdateRetry(deps, actor, { id: "upd1" });
    await retry.done;
    expect(compose.mock.calls.map(([, f]) => f.to)).toEqual(["bob@example.test"]);
  });
});

describe("markdownToHtml", () => {
  it("escapes markup and keeps headings, bullets, bold and links", () => {
    expect(
      markdownToHtml(
        "## Highlights\n- one **big** win\n- <b>two</b>\n\nSee [site](https://example.test)",
      ),
    ).toBe(
      '<p><strong>Highlights</strong></p><ul><li>one <strong>big</strong> win</li><li>&lt;b&gt;two&lt;/b&gt;</li></ul><p>See <a href="https://example.test">site</a></p>',
    );
  });
});
