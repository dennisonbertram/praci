import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PersonContextDeps } from "./inbox-person-context.js";
import { inboxPersonContext, inboxPersonSummary } from "./inbox-person-context.js";
import type { MailFixture } from "./test-support/mail-fixture.js";
import { createMailFixture, daysAgo } from "./test-support/mail-fixture.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

const KEVIN = "kevin@acme.example.test";

describePostgres("person context for the mail side panel (PostgreSQL)", () => {
  let f: MailFixture;
  let deps: PersonContextDeps;
  let summarize: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    f = await createMailFixture("person", databaseUrl as string);
  });
  afterAll(async () => {
    if (f) {
      await f.prisma.contact.deleteMany({ where: { spaceId: { in: f.spaceIds } } });
      await f.prisma.inboxTodo.deleteMany({ where: { spaceId: { in: f.spaceIds } } });
      await f.wipe();
      await f.dispose();
    }
  });
  beforeEach(async () => {
    await f.prisma.contact.deleteMany({ where: { spaceId: { in: f.spaceIds } } });
    await f.prisma.inboxTodo.deleteMany({ where: { spaceId: { in: f.spaceIds } } });
    await f.wipe();
    summarize = vi.fn(async () => ({ status: "ok", summary: "Kevin is an investor." }));
    deps = {
      prisma: f.prisma,
      searchDataRoom: async () => [{ id: "item1", name: "Acme term sheet.pdf" }],
      calendarMeetings: async () => [
        {
          title: "Intro call",
          start: daysAgo(10).toISOString(),
          href: "https://cal.example.test/1",
        },
        { title: "Follow-up", start: daysAgo(-3).toISOString(), href: null },
      ],
      summarize,
    };
  });

  /** Kevin wrote once and the user answered once, in the same thread. */
  async function seedKevin(who = f.a, connectionId = f.connA) {
    const inbound = await f.cache(who, connectionId, "k1", {
      threadId: "tk",
      from: KEVIN.toUpperCase(),
      fromName: "Kevin Zhao",
      receivedAt: daysAgo(5),
    });
    const reply = await f.cache(who, connectionId, "k2", {
      threadId: "tk",
      fromSelf: true,
      receivedAt: daysAgo(4),
    });
    await f.prisma.cachedMailMessage.update({
      where: { id: reply.id },
      data: { toAddresses: [KEVIN], subject: "Re: Term sheet" },
    });
    await f.prisma.cachedMailMessage.update({
      where: { id: inbound.id },
      data: { subject: "Term sheet", toAddresses: ["me@example.test"] },
    });
    return { inbound, reply };
  }

  it("returns every source for the actor's own mail, contact, to-dos and documents", async () => {
    const { inbound, reply } = await seedKevin();
    await f.prisma.contact.create({
      data: {
        spaceId: f.a.spaceId,
        userId: f.a.userId,
        name: "Kevin Zhao",
        email: KEVIN,
        organization: "Acme Capital",
        kind: "investor",
      },
    });
    await f.prisma.inboxTodo.create({
      data: {
        spaceId: f.a.spaceId,
        userId: f.a.userId,
        connectionId: f.connA,
        messageId: inbound.id,
        text: "Send the cap table",
      },
    });
    const facts = await inboxPersonContext(deps, f.a, { email: KEVIN });
    expect(facts).toMatchObject({
      email: KEVIN,
      name: "Kevin Zhao",
      organization: "Acme Capital",
      kind: "investor",
      threadCount: 1,
      documents: [{ id: "item1", name: "Acme term sheet.pdf" }],
      lastMeeting: { title: "Intro call" },
      nextMeeting: { title: "Follow-up" },
    });
    expect(facts.threads).toHaveLength(1);
    expect(facts.threads[0]?.subject).toBe("Re: Term sheet");
    expect(facts.lastEmailedAt).toBe(reply.receivedAt.toISOString());
    expect(facts.todos.map((todo) => todo.text)).toEqual(["Send the cap table"]);
    expect(summarize).not.toHaveBeenCalled();
  });

  it("never shows another user's or another space's mail, contacts or to-dos", async () => {
    // b shares the space with a; c is in another space. Both hold Kevin data a must not see.
    const { inbound } = await seedKevin(f.b, f.connB);
    await seedKevin(f.c, f.connC);
    await f.prisma.contact.create({
      data: { spaceId: f.b.spaceId, userId: f.b.userId, name: "Kevin Zhao", email: KEVIN },
    });
    await f.prisma.inboxTodo.create({
      data: {
        spaceId: f.b.spaceId,
        userId: f.b.userId,
        connectionId: f.connB,
        messageId: inbound.id,
        text: "Private to b",
      },
    });
    const facts = await inboxPersonContext(deps, f.a, { email: KEVIN });
    expect(facts).toMatchObject({
      name: null,
      kind: null,
      threadCount: 0,
      threads: [],
      lastEmailedAt: null,
      todos: [],
    });
  });

  it("passes the actor to the Data room search so its visibility rules apply", async () => {
    const search = vi.fn(async () => []);
    await inboxPersonContext({ ...deps, searchDataRoom: search }, f.a, { email: KEVIN });
    expect(search).toHaveBeenCalledWith(f.a, expect.stringContaining(KEVIN));
  });

  it("still answers when a source fails", async () => {
    await seedKevin();
    const facts = await inboxPersonContext(
      {
        ...deps,
        searchDataRoom: async () => {
          throw new Error("search down");
        },
        calendarMeetings: async () => {
          throw new Error("google down");
        },
      },
      f.a,
      { email: KEVIN },
    );
    expect(facts.threadCount).toBe(1);
    expect(facts.documents).toEqual([]);
    expect(facts.lastMeeting).toBeNull();
    expect(facts.nextMeeting).toBeNull();
  });

  it("summarizes from the facts, with the mail as untrusted data", async () => {
    await seedKevin();
    const result = await inboxPersonSummary(deps, f.a, { email: KEVIN });
    expect(result).toEqual({ status: "ok", summary: "Kevin is an investor." });
    const [input] = summarize.mock.calls[0] as [{ scope: unknown; context: string }];
    expect(input.scope).toEqual({ userId: f.a.userId, spaceId: f.a.spaceId });
    expect(input.context).toContain("Term sheet");
    expect(input.context).toContain("Acme term sheet.pdf");
  });

  it("does not call the model when nothing is known about the address", async () => {
    const empty = await inboxPersonSummary(
      { ...deps, searchDataRoom: async () => [], calendarMeetings: async () => [] },
      f.a,
      { email: "nobody@example.test" },
    );
    expect(empty).toEqual({ status: "unavailable" });
    expect(summarize).not.toHaveBeenCalled();
  });

  it("reports unavailable with no summarizer and passes needs_consent through", async () => {
    await seedKevin();
    expect(
      await inboxPersonSummary({ ...deps, summarize: undefined }, f.a, { email: KEVIN }),
    ).toEqual({ status: "unavailable" });
    const needs = {
      status: "needs_consent",
      recipient: { key: "openai", name: "OpenAI" },
    } as const;
    expect(
      await inboxPersonSummary({ ...deps, summarize: async () => needs }, f.a, { email: KEVIN }),
    ).toEqual(needs);
  });
});
