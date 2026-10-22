import type { Actor, ComposeFields, ComposeResult } from "@rakazo/contracts";
import { getInvestorUpdate, SENDING_STALE_MS } from "@rakazo/db";
import { describe, expect, it, vi } from "vitest";
import type { InvestorSendDeps } from "./investor-send.js";
import {
  deliverPortalLinks,
  markdownToHtml,
  postInvestorUpdate,
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
    if (cond === null) return value == null;
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
    tables.contact.push({ id, name: id, email, kind: "investor", ...scope });
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
    portalLink: async (_actor, contactId) => ({
      link: `https://app.test/portal/open#tok-${contactId}`,
      email: ((tables.contact.find((c) => c.id === contactId) as Record | undefined)?.email ??
        null) as string | null,
    }),
    email: { send: vi.fn(async () => undefined) },
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

describe("portal links in investor updates", () => {
  it("gives each recipient their own link, as a text line and a button-style link", async () => {
    const { deps, calls } = setup();
    await (await startInvestorUpdateSend(deps, actor, "upd1")).done;
    expect(calls[0]?.body).toContain(
      "View online and past updates: https://app.test/portal/open#tok-ann",
    );
    expect(calls[0]?.body).not.toContain("tok-bob");
    expect(calls[1]?.body).toContain("#tok-bob");
    expect(calls[0]?.html).toMatch(
      /<a href="https:\/\/app\.test\/portal\/open#tok-ann"[^>]*>View online and past updates<\/a>/,
    );
    expect(calls[0]?.html).toContain("min-height:44px");
  });

  it("fails the recipient, rather than sending with no link, when a link cannot be made", async () => {
    const { deps, calls } = setup();
    deps.portalLink = async (_actor, contactId) => {
      if (contactId === "ann") throw new Error("no link");
      return {
        link: `https://app.test/portal/open#tok-${contactId}`,
        email: `${contactId}@example.test`,
      };
    };
    await (await startInvestorUpdateSend(deps, actor, "upd1")).done;
    expect(calls.map((c) => c.to)).toEqual(["bob@example.test"]);
    const after = await getInvestorUpdate(deps.prisma, actor, "upd1");
    expect(after.deliveries.map((d) => d.state)).toEqual(["failed", "sent"]);
  });

  it("never emails a revoked contact", async () => {
    const { deps, calls, tables } = setup();
    Object.assign(tables.contact[0] as Record, { portalBlockedAt: new Date() });
    await (await startInvestorUpdateSend(deps, actor, "upd1")).done;
    expect(calls.map((c) => c.to)).toEqual(["bob@example.test"]);
  });

  it("sends to the address the link was minted for, even if the contact's address changed meanwhile", async () => {
    const { deps, calls } = setup();
    deps.portalLink = async (_actor, contactId) => ({
      link: `https://app.test/portal/open#tok-${contactId}`,
      email: `${contactId}-new@example.test`,
    });
    await (await startInvestorUpdateSend(deps, actor, "upd1")).done;
    expect(calls.map((c) => c.to)).toEqual(["ann-new@example.test", "bob-new@example.test"]);
  });

  it("still emails a board contact whose investor access was revoked", async () => {
    const { deps, calls, tables } = setup();
    tables.investorUpdate[0] = { ...tables.investorUpdate[0], audience: "board" };
    Object.assign(tables.contact[0] as Record, { portalBlockedAt: new Date() });
    await (await startInvestorUpdateSend(deps, actor, "upd1")).done;
    expect(calls.map((c) => c.to)).toEqual(["ann@example.test", "bob@example.test"]);
  });

  it("gives a board update no link", async () => {
    const { deps, calls, tables } = setup();
    const portalLink = vi.fn(async () => ({ link: "x", email: "x@example.test" }));
    deps.portalLink = portalLink;
    tables.investorUpdate[0] = { ...tables.investorUpdate[0], audience: "board" };
    await (await startInvestorUpdateSend(deps, actor, "upd1")).done;
    expect(portalLink).not.toHaveBeenCalled();
    expect(calls[0]?.body).toBe("Hello **team**");
  });
});

describe("postInvestorUpdate", () => {
  it("posts the draft and sends each investor with an email a notice with a fresh link", async () => {
    const { deps, compose, tables } = setup();
    const result = await postInvestorUpdate(deps, actor, "upd1");
    expect(result.update.status).toBe("posted");
    expect(result.notified).toBe(2);
    expect(compose).not.toHaveBeenCalled();
    const sent = vi.mocked(deps.email!.send).mock.calls.map(([m]) => m);
    expect(sent.map((m) => m.to)).toEqual(["ann@example.test", "bob@example.test"]);
    expect(sent[0]?.text).toContain("https://app.test/portal/open#tok-ann");
    expect(sent[0]?.text).not.toContain("tok-bob");
    expect(tables.investorUpdate[0]?.status).toBe("posted");
  });

  it("notifies nobody it should not: revoked, no email, or other kinds", async () => {
    const { deps, tables, scope } = setup();
    Object.assign(tables.contact[0] as Record, { portalBlockedAt: new Date() });
    tables.contact.push({
      id: "dee",
      name: "dee",
      email: "dee@example.test",
      kind: "board",
      ...scope,
    });
    const result = await postInvestorUpdate(deps, actor, "upd1");
    expect(result.notified).toBe(1);
    expect(vi.mocked(deps.email!.send).mock.calls.map(([m]) => m.to)).toEqual(["bob@example.test"]);
  });

  it("counts only notices that went out and keeps going after one fails", async () => {
    const { deps } = setup();
    vi.mocked(deps.email!.send).mockRejectedValueOnce(new Error("smtp down"));
    const result = await postInvestorUpdate(deps, actor, "upd1");
    expect(result.update.status).toBe("posted");
    expect(result.notified).toBe(1);
  });

  it("posts with nobody notified when no email provider is configured", async () => {
    const { deps } = setup();
    deps.email = undefined;
    const result = await postInvestorUpdate(deps, actor, "upd1");
    expect(result.update.status).toBe("posted");
    expect(result.notified).toBe(0);
  });

  it("a second post changes nothing and sends nothing", async () => {
    const { deps } = setup();
    await postInvestorUpdate(deps, actor, "upd1");
    const again = await postInvestorUpdate(deps, actor, "upd1");
    expect(again.notified).toBe(0);
    expect(deps.email?.send).toHaveBeenCalledTimes(2);
  });

  it("does not post a board update", async () => {
    const { deps, tables } = setup();
    tables.investorUpdate[0] = { ...tables.investorUpdate[0], audience: "board" };
    await expect(postInvestorUpdate(deps, actor, "upd1")).rejects.toThrow();
    expect(tables.investorUpdate[0]?.status).toBe("draft");
  });
});

describe("deliverPortalLinks", () => {
  it("emails each contact a fresh link, with the company in the subject", async () => {
    const { deps } = setup();
    const result = await deliverPortalLinks(deps, actor, ["ann"], { copy: false });
    expect(result.links).toEqual([]);
    const [message] = vi.mocked(deps.email!.send).mock.calls[0] ?? [];
    expect(message?.to).toBe("ann@example.test");
    expect(message?.subject).toBe("Acme · your link");
    expect(message?.text).toContain("#tok-ann");
  });

  it("returns the link instead when copying, with no email provider, or with no address", async () => {
    const { deps } = setup();
    const copied = await deliverPortalLinks(deps, actor, ["ann"], { copy: true });
    expect(copied.links).toEqual([
      { contactId: "ann", name: "ann", link: "https://app.test/portal/open#tok-ann" },
    ]);
    const noAddress = await deliverPortalLinks(deps, actor, ["cy"], { copy: false });
    expect(noAddress.links.map((l) => l.contactId)).toEqual(["cy"]);
    deps.email = undefined;
    const noProvider = await deliverPortalLinks(deps, actor, ["bob"], { copy: false });
    expect(noProvider.links.map((l) => l.contactId)).toEqual(["bob"]);
  });

  it("hands back the link when an email fails and still tries the rest", async () => {
    const { deps } = setup();
    vi.mocked(deps.email!.send).mockRejectedValueOnce(new Error("smtp down"));
    const result = await deliverPortalLinks(deps, actor, ["ann", "bob"], { copy: false });
    expect(result.links.map((l) => l.contactId)).toEqual(["ann"]);
    expect(deps.email!.send).toHaveBeenCalledTimes(2);
  });

  it("skips a contact that is not the owner's", async () => {
    const { deps } = setup();
    const result = await deliverPortalLinks(deps, actor, ["ghost"], { copy: true });
    expect(result.links).toEqual([]);
  });
});
