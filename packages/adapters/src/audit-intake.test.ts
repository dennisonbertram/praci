import type { MailAccount, MailProvider } from "@rakazo/adapter-kit";
import type { PrismaClient } from "@rakazo/db";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  fileAuditRequestFromMail: vi.fn(),
  claimAuditDraft: vi.fn(),
  releaseAuditDraft: vi.fn(async () => undefined),
}));
vi.mock("@rakazo/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@rakazo/db")>()),
  ...db,
  createThreadMessageInTransaction: vi.fn(async () => ({ id: "m1" })),
  appendEventInTransaction: vi.fn(async () => ({})),
}));
const filing = vi.hoisted(() => ({ fileMailAttachment: vi.fn() }));
vi.mock("./data-room-tools.js", () => filing);

import { enqueueAuditIntake, matchesAuditMail, runAuditIntake } from "./audit-intake.js";

const scope = { spaceId: "space-1", userId: "user-1" };
const payload = { ...scope, connectionId: "conn-1", messageId: "msg-1" };
const account = { id: "conn-1" } as MailAccount;
const pdf = {
  id: "a1",
  filename: "letter.pdf",
  mimeType: "application/pdf",
  size: 50_000,
  inline: false,
};

type Cached = {
  threadId: string;
  subject: string;
  snippet: string;
  fromAddress: string;
  fromSelf: boolean;
  isSpam: boolean;
  receivedAt: Date;
};
const cached = (over: Partial<Cached> = {}): Cached => ({
  threadId: "thread-1",
  subject: "Audit confirmation request, Example Fund I",
  snippet: "Please confirm your holdings",
  fromAddress: "partner@auditor.example",
  fromSelf: false,
  isSpam: false,
  receivedAt: new Date("2026-10-20T10:00:00Z"),
  ...over,
});

function fixture(
  opts: {
    row?: Cached | null;
    attachments?: (typeof pdf)[];
    auditor?: boolean;
    agent?: boolean;
    knownThread?: boolean;
  } = {},
) {
  const taskCreate = vi.fn(async () => ({ id: "task-1" }));
  const runCreate = vi.fn(async () => ({ id: "run-1" }));
  const enqueue = vi.fn(async (_job: unknown) => undefined);
  const prisma = {
    spaceMember: { findUnique: async () => ({ id: "member" }) },
    cachedMailMessage: { findFirst: async () => (opts.row === undefined ? cached() : opts.row) },
    auditRequest: { findFirst: async () => (opts.knownThread ? { id: "ar-0" } : null) },
    contact: { findFirst: async () => (opts.auditor ? { id: "c1" } : null) },
    bot: {
      findFirst: async () =>
        opts.agent === false ? null : { id: "bot-1", thread: { id: "th-1" } },
    },
    $transaction: async (fn: (tx: unknown) => unknown) =>
      fn({ task: { create: taskCreate }, run: { create: runCreate } }),
  } as unknown as PrismaClient;
  const getMessage = vi.fn(async () => ({ attachments: opts.attachments ?? [pdf] }));
  const mail = {
    listAccounts: async () => [account],
    getMessage,
  } as unknown as MailProvider;
  const deps = { prisma, jobs: { enqueue }, mail, artifacts: {} } as never;
  return { deps, taskCreate, runCreate, enqueue, getMessage };
}

beforeEach(() => {
  vi.clearAllMocks();
  db.fileAuditRequestFromMail.mockResolvedValue({ id: "ar-1", created: true });
  db.claimAuditDraft.mockResolvedValue(true);
  filing.fileMailAttachment.mockResolvedValue({
    kind: "filed",
    item: { id: "item-1", name: "letter.pdf" },
    created: true,
    fileName: "letter.pdf",
  });
});

describe("matchesAuditMail", () => {
  it("matches audit, confirmation, 409A and DocuSign wording in the subject or snippet", () => {
    for (const subject of ["Audit request", "Balance confirmation", "409A valuation", "Sign"])
      expect(matchesAuditMail({ subject, snippet: "" }), subject).toBe(subject !== "Sign");
    expect(matchesAuditMail({ subject: "Please sign", snippet: "via DocuSign" })).toBe(true);
    expect(matchesAuditMail({ subject: "Lunch?", snippet: "tomorrow" })).toBe(false);
  });
});

describe("enqueueAuditIntake", () => {
  const rows = [
    { providerMessageId: "m-audit", threadId: "t1", subject: "Audit request", snippet: "" },
    { providerMessageId: "m-lunch", threadId: "t2", subject: "Lunch?", snippet: "" },
    { providerMessageId: "m-reply", threadId: "t3", subject: "Thanks", snippet: "" },
  ];
  it("queues matching messages and replies in a thread that already has a request, whatever the auto-file setting", async () => {
    const enqueue = vi.fn(async (_job: unknown) => undefined);
    const findMany = vi.fn(async () => rows);
    const prisma = {
      cachedMailMessage: { findMany },
      auditRequest: { findMany: async () => [{ mailThreadId: "t3" }] },
      // The Data room setting is never read.
      dataRoomPreference: { findUnique: vi.fn(async () => ({ autoFileEmail: false })) },
    };
    await enqueueAuditIntake(
      { prisma, jobs: { enqueue } } as never,
      { ...scope, connectionId: "conn-1" },
      ["m-audit", "m-lunch", "m-reply"],
      new Date("2026-10-21T00:00:00Z"),
    );
    expect(
      enqueue.mock.calls.map(
        ([job]) => (job as { payload: { messageId: string } }).payload.messageId,
      ),
    ).toEqual(["m-audit", "m-reply"]);
    expect(prisma.dataRoomPreference.findUnique).not.toHaveBeenCalled();
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ fromSelf: false, isSpam: false, ...scope }),
      }),
    );
  });

  it("never throws when the queue is down", async () => {
    const prisma = {
      cachedMailMessage: { findMany: async () => rows },
      auditRequest: { findMany: async () => [] },
    };
    await expect(
      enqueueAuditIntake(
        { prisma, jobs: { enqueue: async () => Promise.reject(new Error("down")) } } as never,
        { ...scope, connectionId: "conn-1" },
        ["m-audit"],
        new Date("2026-10-21T00:00:00Z"),
      ),
    ).resolves.toBeUndefined();
  });
});

describe("runAuditIntake", () => {
  it("files the attachment, creates the row and starts one drafting run with the filed ids", async () => {
    const f = fixture({ auditor: true });
    await runAuditIntake(f.deps, payload);
    expect(filing.fileMailAttachment).toHaveBeenCalledOnce();
    expect(db.fileAuditRequestFromMail).toHaveBeenCalledWith(
      expect.anything(),
      scope,
      expect.objectContaining({
        fund: "Audit confirmation request, Example Fund I",
        mailThreadId: "thread-1",
        senderKnown: true,
        dataRoomItemId: "item-1",
      }),
    );
    expect(db.claimAuditDraft).toHaveBeenCalledWith(expect.anything(), scope, "ar-1", 10);
    expect(f.runCreate).toHaveBeenCalledOnce();
    const prompt = (f.taskCreate.mock.calls[0] as unknown as [{ data: { prompt: string } }])[0].data
      .prompt;
    expect(prompt).toContain("ar-1");
    expect(prompt).toContain("msg-1");
    expect(prompt).toContain("thread-1");
    expect(prompt).toContain("item-1");
    expect(prompt).toContain("is one of the user's Auditor contacts");
    expect(f.enqueue).toHaveBeenCalledWith(expect.objectContaining({ name: "run.continue" }));
  });

  it("a message in a known thread only touches the row: nothing is filed or started", async () => {
    db.fileAuditRequestFromMail.mockResolvedValue({ id: "ar-0", created: false });
    const f = fixture({ knownThread: true, row: cached({ subject: "Thanks", snippet: "" }) });
    await runAuditIntake(f.deps, payload);
    expect(f.getMessage).not.toHaveBeenCalled();
    expect(filing.fileMailAttachment).not.toHaveBeenCalled();
    expect(db.fileAuditRequestFromMail).toHaveBeenCalledOnce();
    expect(f.runCreate).not.toHaveBeenCalled();
  });

  it("creates the row even when the Investors agent does not exist, and starts no run", async () => {
    const f = fixture({ agent: false });
    await runAuditIntake(f.deps, payload);
    expect(db.fileAuditRequestFromMail).toHaveBeenCalledOnce();
    expect(db.claimAuditDraft).not.toHaveBeenCalled();
    expect(f.runCreate).not.toHaveBeenCalled();
  });

  it("request eleven creates the row and starts no run", async () => {
    db.claimAuditDraft.mockResolvedValue(false);
    const f = fixture();
    await runAuditIntake(f.deps, payload);
    expect(db.fileAuditRequestFromMail).toHaveBeenCalledOnce();
    expect(f.runCreate).not.toHaveBeenCalled();
  });

  it("gives the claim back when the run cannot be created, but keeps it when only the enqueue fails", async () => {
    const created = fixture();
    created.runCreate.mockRejectedValue(new Error("db down"));
    await runAuditIntake(created.deps, payload);
    expect(db.releaseAuditDraft).toHaveBeenCalledWith(expect.anything(), scope, "ar-1");

    db.releaseAuditDraft.mockClear();
    const queued = fixture();
    queued.enqueue.mockRejectedValue(new Error("queue down"));
    await runAuditIntake(queued.deps, payload);
    expect(queued.runCreate).toHaveBeenCalledOnce();
    expect(db.releaseAuditDraft).not.toHaveBeenCalled();
  });

  it("a DocuSign notice with no attachment from an unknown sender is still picked up", async () => {
    const f = fixture({
      attachments: [],
      row: cached({ subject: "Please sign: Audit letter", fromAddress: "dse@docusign.net" }),
    });
    await runAuditIntake(f.deps, payload);
    expect(filing.fileMailAttachment).not.toHaveBeenCalled();
    expect(db.fileAuditRequestFromMail).toHaveBeenCalledWith(
      expect.anything(),
      scope,
      expect.objectContaining({ senderKnown: false, dataRoomItemId: null }),
    );
  });

  it("ignores audit wording from an unknown sender with no document and no DocuSign", async () => {
    const f = fixture({ attachments: [] });
    await runAuditIntake(f.deps, payload);
    expect(db.fileAuditRequestFromMail).not.toHaveBeenCalled();
  });

  it("does not file mail that is spam, sent by the owner or not audit related", async () => {
    for (const row of [
      cached({ isSpam: true }),
      cached({ fromSelf: true }),
      cached({ subject: "Lunch", snippet: "" }),
    ]) {
      await runAuditIntake(fixture({ row }).deps, payload);
    }
    expect(db.fileAuditRequestFromMail).not.toHaveBeenCalled();
  });
});
