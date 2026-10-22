import { randomUUID } from "node:crypto";
import type { AdapterContext, MailAccount, ManagedConnectorProvider } from "@rakazo/adapter-kit";
import type { Actor } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDataRoomRepos, createDb } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fakeAi, MemoryArtifacts, RecordingJobs } from "./data-room-test-fakes.js";
import type { DataRoomToolDeps } from "./data-room-tools.js";
import { dataRoomToolFromTool } from "./data-room-tools.js";
import { DriveApiEmulator, emulatedDriveStream } from "./drive-api-emulator.js";
import type { DriveAccount } from "./drive-tools.js";
import { GmailApiEmulator } from "./gmail-api-emulator.js";
import { createMailProvider } from "./gmail-mail-provider.js";
import { buildXlsx } from "./spreadsheet.js";
import { readSpreadsheetTool } from "./spreadsheet-tools.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

const b64 = (text: string) => Buffer.from(text).toString("base64");

describePostgres("Data room agent tools (PostgreSQL, Gmail and Drive emulators)", () => {
  const run = randomUUID().slice(0, 8);
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let repo: ReturnType<typeof createDataRoomRepos>;
  let artifacts: MemoryArtifacts;
  let jobs: RecordingJobs;
  const spaces: string[] = [];
  const users: Record<string, Actor> = {};
  let mailAccount: MailAccount;
  let driveAccount: DriveAccount;
  let drive: DriveApiEmulator;
  let gmail: GmailApiEmulator;
  let mail: ReturnType<typeof createMailProvider>;

  const context = (who: Actor): AdapterContext =>
    ({
      operationId: "op",
      traceId: "trace",
      spaceId: who.spaceId,
      userId: who.userId,
      signal: new AbortController().signal,
    }) as AdapterContext;

  const deps = (
    who: Actor,
    over: Partial<DataRoomToolDeps> & { denyMail?: boolean; denyDrive?: boolean } = {},
  ): DataRoomToolDeps => ({
    prisma,
    artifacts,
    jobs,
    resolveAi: async () => fakeAi(),
    scope: { spaceId: who.spaceId, userId: who.userId },
    mail,
    mailAccounts: async () => (over.denyMail ? [] : [mailAccount]),
    connectors: {
      managed: () =>
        ({
          proxy: async (r: {
            accountRef: string;
            url: string;
            method: string;
            responseType?: string;
          }) => emulatedDriveStream(drive.handle(r.accountRef, r.url, r.method), r.responseType),
        }) as unknown as ManagedConnectorProvider,
    },
    driveAccounts: async () => (over.denyDrive ? [] : [driveAccount]),
    ...over,
  });
  const call = (
    name: string,
    args: Record<string, unknown>,
    who = users.a as Actor,
    over: Parameters<typeof deps>[1] = {},
  ) => dataRoomToolFromTool(name, deps(who, over), context(who), args);
  const itemCount = (who: Actor) =>
    prisma.dataRoomItem.count({ where: { spaceId: who.spaceId, userId: who.userId } });
  const attachmentId = async (messageId: string, filename: string) => {
    const message = await mail.getMessage(mailAccount, messageId, context(users.a as Actor));
    return message.attachments.find((part) => part.filename === filename)?.id ?? "";
  };

  beforeAll(async () => {
    const db = createDb(databaseUrl as string);
    prisma = db.prisma;
    close = async () => {
      await prisma.dataRoomItem.deleteMany({ where: { spaceId: { in: spaces } } });
      await prisma.artifact.deleteMany({ where: { spaceId: { in: spaces } } });
      await prisma.connection.deleteMany({ where: { spaceId: { in: spaces } } });
      await prisma.space.deleteMany({ where: { id: { in: spaces } } });
      await prisma.organization.deleteMany({ where: { id: { in: spaces } } });
      await prisma.user.deleteMany({
        where: { id: { in: Object.values(users).map((u) => u.userId) } },
      });
      await prisma.$disconnect();
      await db.pool.end();
    };
    repo = createDataRoomRepos(prisma);
    artifacts = new MemoryArtifacts();
    jobs = new RecordingJobs();
    const space = async (label: string) => {
      const id = `drt-space-${label}-${run}`;
      spaces.push(id);
      await prisma.organization.create({
        data: { id, name: label, slug: id, createdAt: new Date() },
      });
      await prisma.space.create({ data: { id, organizationId: id, name: label, isDefault: true } });
      return id;
    };
    const user = async (label: string, spaceId: string) => {
      const userId = `drt-user-${label}-${run}`;
      await prisma.user.create({
        data: { id: userId, name: label, email: `${userId}@rakazo.test`, emailVerified: false },
      });
      users[label] = { userId, spaceId, email: `${userId}@rakazo.test`, isDeploymentOwner: false };
    };
    const s1 = await space("one");
    const s2 = await space("two");
    await user("a", s1);
    await user("b", s1);
    await user("c", s2);

    const a = users.a as Actor;
    const gmailRow = await prisma.connection.create({
      data: {
        spaceId: a.spaceId,
        userId: a.userId,
        connectorId: "google",
        provider: "gmail",
        displayName: "Mail",
        status: "connected",
      },
    });
    const driveRow = await prisma.connection.create({
      data: {
        spaceId: a.spaceId,
        userId: a.userId,
        connectorId: "google",
        provider: "googledrive",
        providerRef: "acct-d",
        displayName: "Drive",
        status: "connected",
      },
    });
    mailAccount = {
      id: gmailRow.id,
      connectorId: "google",
      app: "gmail",
      accountRef: "acct-m",
      label: "Mail",
      spaceId: a.spaceId,
      userId: a.userId,
      address: "me@example.test",
    } as MailAccount;
    driveAccount = {
      id: driveRow.id,
      connectorId: "google",
      app: "googledrive",
      accountRef: "acct-d",
      label: "Drive",
      email: null,
    };
    gmail = new GmailApiEmulator({
      now: new Date("2026-10-01T12:00:00Z"),
      mailboxes: {
        "acct-m": {
          address: "me@example.test",
          messages: [
            {
              id: "m1",
              date: "2026-10-01T10:00:00Z",
              labels: ["INBOX"],
              from: "Jana <jana@example.test>",
              to: "Me <me@example.test>",
              subject: "Files",
              text: "See attached",
              attachments: [
                {
                  filename: "invoice.pdf",
                  mimeType: "application/pdf",
                  size: 0,
                  data: b64("%PDF-invoice"),
                },
                {
                  filename: "long-report.pdf",
                  mimeType: "application/pdf",
                  size: 0,
                  data: b64("%PDF-a-report-that-is-longer-than-three-bytes"),
                },
                { filename: "dot.png", mimeType: "image/png", size: 0, data: b64("png") },
                {
                  filename: "invite.ics",
                  mimeType: "text/calendar",
                  size: 0,
                  data: b64("BEGIN:VCALENDAR"),
                },
              ],
              inlineImages: [{ contentId: "logo", mimeType: "image/png", data: b64("logo") }],
            },
          ],
        },
      },
    });
    mail = createMailProvider({
      prisma: {} as never,
      connectors: {
        managed: () =>
          ({
            proxy: async (r: { accountRef: string; url: string; method: "GET" }) =>
              gmail.handle(r.accountRef, r.url, r.method),
          }) as unknown as ManagedConnectorProvider,
      },
      sleep: async () => undefined,
      random: () => 0,
    });
    drive = new DriveApiEmulator({
      accounts: {
        "acct-d": {
          email: "me@example.test",
          files: [
            {
              id: "pdf1",
              name: "contract.pdf",
              mimeType: "application/pdf",
              bytes: new TextEncoder().encode("%PDF-contract"),
            },
            { id: "tiny", name: "logo.png", mimeType: "image/png", bytes: new Uint8Array(100) },
            {
              id: "big1",
              name: "board-deck.bin",
              mimeType: "application/octet-stream",
              bytes: new Uint8Array(60 * 1024 * 1024).fill(9),
            },
          ],
        },
      },
    });
  });
  afterAll(async () => close?.());

  it("files an attachment once, and says so on a repeat", async () => {
    const id = await attachmentId("m1", "invoice.pdf");
    expect(id).not.toBe("");
    const args = { message_id: "m1", attachment_id: id };
    expect(await call("add_to_data_room", args)).toEqual({
      text: "Added invoice.pdf to the Data room.",
    });
    const row = await prisma.dataRoomItem.findFirstOrThrow({
      where: { spaceId: users.a?.spaceId, externalId: `gmail:m1:${id}` },
    });
    expect(row).toMatchObject({
      source: "gmail",
      sourceConnectionId: mailAccount.id,
      folderId: null,
      userId: users.a?.userId,
    });
    expect(jobs.queue.some((job) => job.name === "dataroom.ingest")).toBe(true);
    expect(await call("add_to_data_room", args)).toEqual({
      text: "invoice.pdf is already in the Data room.",
    });
    expect(await itemCount(users.a as Actor)).toBe(1);
  });

  it("skips tiny images, inline parts and calendar invites", async () => {
    const before = await itemCount(users.a as Actor);
    const message = await mail.getMessage(mailAccount, "m1", context(users.a as Actor));
    const inline = message.attachments.find((part) => part.inline);
    expect(inline).toBeDefined();
    for (const id of [
      await attachmentId("m1", "dot.png"),
      await attachmentId("m1", "invite.ics"),
      inline?.id ?? "",
    ]) {
      expect(await call("add_to_data_room", { message_id: "m1", attachment_id: id })).toEqual({
        text: "Not a document.",
      });
    }
    expect(await itemCount(users.a as Actor)).toBe(before);
  });

  it("files a Drive file once and skips a tiny image", async () => {
    expect(await call("add_to_data_room", { drive_file_id: "pdf1" })).toEqual({
      text: "Added contract.pdf to the Data room.",
    });
    const row = await prisma.dataRoomItem.findFirstOrThrow({
      where: { spaceId: users.a?.spaceId, externalId: "pdf1" },
    });
    expect(row).toMatchObject({ source: "drive", sourceConnectionId: driveAccount.id });
    expect(await call("add_to_data_room", { drive_file_id: "pdf1" })).toEqual({
      text: "contract.pdf is already in the Data room.",
    });
    expect(await call("add_to_data_room", { drive_file_id: "tiny" })).toEqual({
      text: "Not a document.",
    });
  });

  it("adds a large Drive file by streaming it into storage", async () => {
    artifacts.failPut = true;
    artifacts.maxChunkBytes = 0;
    try {
      expect(await call("add_to_data_room", { drive_file_id: "big1" })).toEqual({
        text: "Added board-deck.bin to the Data room.",
      });
    } finally {
      artifacts.failPut = false;
    }
    const row = await prisma.dataRoomItem.findFirstOrThrow({
      where: { spaceId: users.a?.spaceId, externalId: "big1" },
    });
    expect(Number(row.size)).toBe(60 * 1024 * 1024);
    expect(artifacts.maxChunkBytes).toBeLessThanOrEqual(1024 * 1024);
  });

  it("copies an artifact over 50 MB store to store without reading it whole", async () => {
    const a = users.a as Actor;
    const stored = await artifacts.put({ bytes: new Uint8Array(60 * 1024 * 1024).fill(5) });
    const row = await prisma.artifact.create({
      data: {
        spaceId: a.spaceId,
        userId: a.userId,
        name: "dump.bin",
        mimeType: "application/octet-stream",
        size: 60 * 1024 * 1024,
        hash: stored.hash,
        storageKey: stored.id,
      },
    });
    const realGet = artifacts.get.bind(artifacts);
    artifacts.failPut = true;
    artifacts.get = async () => {
      throw new Error("get is not allowed here");
    };
    try {
      expect(await call("add_to_data_room", { artifact_id: row.id })).toEqual({
        text: "Added dump.bin to the Data room.",
      });
    } finally {
      artifacts.failPut = false;
      artifacts.get = realGet;
    }
    expect(
      Number(
        (
          await prisma.dataRoomItem.findFirstOrThrow({
            where: { externalId: `artifact:${row.id}` },
          })
        ).size,
      ),
    ).toBe(60 * 1024 * 1024);
  });

  it("keeps the mail provider's bound on an attachment", async () => {
    const id = await attachmentId("m1", "long-report.pdf");
    expect(
      await call("add_to_data_room", { message_id: "m1", attachment_id: id }, users.a as Actor, {
        maxBytes: 3,
      }),
    ).toEqual({ error: "The attachment is too large to add." });
  });

  it("files only the owner's artifacts of this space", async () => {
    const a = users.a as Actor;
    const make = async (who: Actor, name: string) => {
      const stored = await artifacts.put({ bytes: new TextEncoder().encode(`report ${name}`) });
      return prisma.artifact.create({
        data: {
          spaceId: who.spaceId,
          userId: who.userId,
          name,
          mimeType: "text/markdown",
          size: 20,
          hash: stored.hash,
          storageKey: stored.id,
        },
      });
    };
    const mine = await make(a, "report.md");
    const other = await make(users.b as Actor, "theirs.md");
    const elsewhere = await make(users.c as Actor, "elsewhere.md");
    expect(await call("add_to_data_room", { artifact_id: mine.id })).toEqual({
      text: "Added report.md to the Data room.",
    });
    expect(
      await prisma.dataRoomItem.findFirstOrThrow({ where: { externalId: `artifact:${mine.id}` } }),
    ).toMatchObject({ source: "chat", userId: a.userId, folderId: null });
    expect(await call("add_to_data_room", { artifact_id: mine.id })).toEqual({
      text: "report.md is already in the Data room.",
    });
    for (const foreign of [other, elsewhere]) {
      expect(await call("add_to_data_room", { artifact_id: foreign.id })).toEqual({
        error: "Artifact not found",
      });
    }
  });

  it("files two concurrent adds of one artifact as one item", async () => {
    const a = users.a as Actor;
    const stored = await artifacts.put({ bytes: new TextEncoder().encode("race") });
    const row = await prisma.artifact.create({
      data: {
        spaceId: a.spaceId,
        userId: a.userId,
        name: "race.md",
        mimeType: "text/markdown",
        size: 4,
        hash: stored.hash,
        storageKey: stored.id,
      },
    });
    const results = (await Promise.all([
      call("add_to_data_room", { artifact_id: row.id }),
      call("add_to_data_room", { artifact_id: row.id }),
    ])) as { text?: string; error?: string }[];
    expect(results.every((r) => r.text)).toBe(true);
    expect(results.filter((r) => r.text?.startsWith("Added")).length).toBeGreaterThanOrEqual(1);
    expect(await prisma.dataRoomItem.count({ where: { externalId: `artifact:${row.id}` } })).toBe(
      1,
    );
  });

  it("hides items from a connection the user denied this agent, but not uploads", async () => {
    const a = users.a as Actor;
    const make = async (name: string, sourceConnectionId?: string) => {
      const { item } = await repo.createItem(a, {
        source: sourceConnectionId ? "drive" : "upload",
        sha256: randomUUID(),
        name,
        mimeType: "text/plain",
        size: 5,
        ...(sourceConnectionId ? { sourceConnectionId, externalId: randomUUID() } : {}),
      });
      await repo.finishExtraction(a, item.id, 0, "walrus ledger");
      await repo.replaceChunks(a, item.id, [
        { ordinal: 0, text: "walrus ledger", contentHash: randomUUID() },
      ]);
      return item;
    };
    const imported = await make("imported.txt", driveAccount.id);
    const upload = await make("upload.txt");
    const denied = { deniedConnectionIds: [driveAccount.id] };

    const ids = async (over: Parameters<typeof deps>[1]) =>
      (
        (await call("search_data_room", { query: "walrus" }, users.a, over)) as {
          results: { id: string }[];
        }
      ).results
        .map((r) => r.id)
        .sort();
    expect(await ids({})).toEqual([imported.id, upload.id].sort());
    expect(await ids(denied)).toEqual([upload.id]);
    expect(await call("read_data_room_item", { item_id: imported.id }, users.a, denied)).toEqual({
      error: "Item not found",
    });
    expect(
      await call("read_data_room_item", { item_id: upload.id }, users.a, denied),
    ).toMatchObject({
      name: "upload.txt",
    });
  });

  it("adds nothing until the Data room consent is accepted", async () => {
    const before = await itemCount(users.a as Actor);
    const queued = jobs.queue.length;
    const off = { resolveAi: async () => fakeAi({ allowed: false }) };
    for (const args of [
      { drive_file_id: "pdf1" },
      { artifact_id: "anything" },
      { message_id: "m1", attachment_id: "x" },
    ]) {
      expect(await call("add_to_data_room", args, users.a, off)).toEqual({
        text: "The Data room is off for this person.",
      });
    }
    expect(await itemCount(users.a as Actor)).toBe(before);
    expect(jobs.queue.length).toBe(queued);
  });

  it("cannot use a mail or Drive connection the user denied this agent", async () => {
    const id = await attachmentId("m1", "invoice.pdf");
    expect(
      await call("add_to_data_room", { message_id: "m1", attachment_id: id }, users.a, {
        denyMail: true,
      }),
    ).toEqual({ error: "No connected mail account" });
    expect(
      await call("add_to_data_room", { drive_file_id: "pdf1" }, users.a, { denyDrive: true }),
    ).toEqual({ error: "No connected Drive account" });
  });

  it("needs exactly one source", async () => {
    for (const args of [{}, { message_id: "m1" }, { drive_file_id: "a", artifact_id: "b" }]) {
      expect(await call("add_to_data_room", args)).toHaveProperty("error");
    }
  });

  it("searches and reads only the bot owner's items in the run's space", async () => {
    const make = async (who: Actor, name: string, text: string) => {
      const { item } = await repo.createItem(who, {
        source: "upload",
        sha256: randomUUID(),
        name,
        mimeType: "text/plain",
        size: text.length,
      });
      await repo.finishExtraction(who, item.id, 0, text);
      await repo.replaceChunks(who, item.id, [{ ordinal: 0, text, contentHash: randomUUID() }]);
      return item;
    };
    const mine = await make(users.a as Actor, "mine.txt", "quarterly zebra report");
    const theirs = await make(users.b as Actor, "theirs.txt", "quarterly zebra secrets");
    const elsewhere = await make(users.c as Actor, "elsewhere.txt", "quarterly zebra abroad");

    const found = (await call("search_data_room", { query: "zebra" })) as {
      results: { id: string; name: string; snippet: string }[];
    };
    expect(found.results.map((r) => r.id)).toEqual([mine.id]);
    // The file has been read but is not tagged and indexed yet: the agent is told.
    expect(found).toMatchObject({ note: expect.stringContaining("still being indexed") });
    expect(found.results[0]?.snippet).not.toContain("\u0001");
    expect(found.results[0]).toMatchObject({ link: `/app/data-room?item=${mine.id}` });

    const read = (await call("read_data_room_item", { item_id: mine.id })) as Record<
      string,
      unknown
    >;
    expect(read).toMatchObject({
      id: mine.id,
      name: "mine.txt",
      link: `/app/data-room?item=${mine.id}`,
      text: "quarterly zebra report",
      truncated: false,
    });
    for (const foreign of [theirs, elsewhere]) {
      expect(await call("read_data_room_item", { item_id: foreign.id })).toEqual({
        error: "Item not found",
      });
    }
  });

  it("reads spreadsheets only from the run user's artifacts and Data room items", async () => {
    const xlsx = buildXlsx([
      {
        name: "Sheet1",
        rows: [
          ["a", "b"],
          [1, 2],
        ],
      },
    ]);
    const stored = await artifacts.put({ bytes: xlsx });
    const mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    const artifact = (who: Actor) =>
      prisma.artifact.create({
        data: {
          spaceId: who.spaceId,
          userId: who.userId,
          name: "t.xlsx",
          mimeType: mime,
          size: xlsx.byteLength,
          hash: stored.hash,
          storageKey: stored.id,
        },
      });
    const item = async (who: Actor) =>
      (
        await repo.createItem(who, {
          source: "upload",
          sha256: randomUUID(),
          name: "t.xlsx",
          mimeType: mime,
          size: xlsx.byteLength,
          storageKey: stored.id,
        })
      ).item;
    const a = users.a as Actor;
    const read = (args: Record<string, unknown>, who = a, dataRoomEnabled = true) =>
      readSpreadsheetTool(
        {
          prisma,
          artifacts,
          scope: { spaceId: who.spaceId, userId: who.userId },
          dataRoomEnabled,
        },
        context(who),
        args,
      );

    expect(await read({ artifact_id: (await artifact(a)).id })).toMatchObject({
      header: ["a", "b"],
    });
    expect(await read({ item_id: (await item(a)).id })).toMatchObject({ header: ["a", "b"] });
    for (const foreign of [users.b as Actor, users.c as Actor]) {
      expect(await read({ artifact_id: (await artifact(foreign)).id })).toEqual({
        error: "File not found",
      });
      expect(await read({ item_id: (await item(foreign)).id })).toEqual({
        error: "File not found",
      });
    }
    expect(await read({ item_id: (await item(a)).id }, a, false)).toHaveProperty("error");
  });
});
