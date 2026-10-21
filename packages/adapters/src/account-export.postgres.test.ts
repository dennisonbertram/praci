import { randomUUID } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { ArtifactStore } from "@rakazo/adapter-kit";
import type { PrismaClient } from "@rakazo/db";
import { createDb } from "@rakazo/db";
import { strFromU8, unzipSync } from "fflate";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  cleanupAccountExports,
  latestAccountExport,
  requestAccountExport,
  runAccountExport,
} from "./account-export.js";
import { RecordingJobs } from "./data-room-test-fakes.js";
import { createArtifactStore } from "./s3-artifacts.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

// Markers that must never reach the zip.
const SECRET = "SECRET-MARKER-9f3a";

describePostgres("account export (PostgreSQL)", () => {
  const run = randomUUID().slice(0, 8);
  const org = `exp-org-${run}`;
  const userA = `exp-a-${run}`;
  const userB = `exp-b-${run}`;
  const shared = `exp-shared-${run}`;
  const onlyA = `exp-onlya-${run}`;
  const left = `exp-left-${run}`;
  const ctx = (spaceId: string, userId: string) => ({
    operationId: "t",
    traceId: "t",
    spaceId,
    userId,
    signal: new AbortController().signal,
  });
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let artifacts: ArtifactStore;
  const jobs = new RecordingJobs();
  const fileBytes = new Uint8Array(300_000).map((_, i) => i % 251);

  const unzipExport = async (id: string) => {
    const row = await prisma.accountExport.findUniqueOrThrow({ where: { id } });
    const bytes = await artifacts.get(row.storageKey as string, ctx(row.spaceId, row.userId));
    const files = unzipSync(bytes);
    const text = (name: string) => strFromU8(files[name] as Uint8Array);
    return { files, text, json: (name: string) => JSON.parse(text(name)) as any[] };
  };

  beforeAll(async () => {
    const db = createDb(databaseUrl as string);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    artifacts = createArtifactStore(process.env, await mkdtemp(path.join(tmpdir(), "export-")));
    await prisma.user.createMany({
      data: [userA, userB].map((id) => ({ id, name: id, email: `${id}@example.test` })),
    });
    await prisma.organization.create({
      data: { id: org, name: "Org", slug: org, createdAt: new Date() },
    });
    await prisma.space.createMany({
      data: [shared, onlyA, left].map((id) => ({ id, organizationId: org, name: `Space ${id}` })),
    });
    await prisma.member.createMany({
      data: [userA, userB].map((userId) => ({
        id: `m-${userId}`,
        organizationId: org,
        userId,
        role: "member",
        createdAt: new Date(),
      })),
    });
    const membership = (spaceId: string, userId: string) => ({
      id: `sm-${spaceId}-${userId}`,
      spaceId,
      userId,
      organizationId: org,
      role: "member",
      createdAt: new Date(),
    });
    // userA left the third space: nothing in it may be exported.
    await prisma.spaceMember.createMany({
      data: [membership(shared, userA), membership(shared, userB), membership(onlyA, userA)],
    });
    await prisma.aiDataConsent.create({
      data: { userId: userA, spaceId: shared, recipientKey: `recipient-${SECRET}`, version: "1" },
    });

    for (const [userId, spaceId, tag] of [
      [userA, shared, "A-shared"],
      [userA, onlyA, "A-only"],
      [userA, left, "A-left"],
      [userB, shared, "B-private"],
    ] as const) {
      const bot = await prisma.bot.create({
        data: { spaceId, userId, name: `bot-${tag}`, color: "#111111", webhookSecretId: SECRET },
      });
      const thread = await prisma.thread.create({ data: { spaceId, userId, botId: bot.id } });
      await prisma.message.create({
        data: { threadId: thread.id, seq: 1, role: "user", blocks: [{ text: `hello-${tag}` }] },
      });
      await prisma.memoryDocument.create({
        data: { spaceId, userId, botId: bot.id, scope: "bot", path: "m.md", content: `mem-${tag}` },
      });
      await prisma.agentSkill.create({
        data: { spaceId, userId, name: `skill-${tag}`, description: "d", content: "c" },
      });
      await prisma.routine.create({
        data: {
          spaceId,
          userId,
          botId: bot.id,
          name: `routine-${tag}`,
          prompt: "p",
          crons: ["0 9 * * *"],
        },
      });
      await prisma.contact.create({ data: { spaceId, userId, name: `contact-${tag}` } });
      await prisma.meeting.create({
        data: {
          spaceId,
          userId,
          provider: "granola",
          externalId: `ext-${tag}`,
          title: `meeting-${tag}`,
          startedAt: new Date("2026-01-10T15:00:00Z"),
          sourceUpdatedAt: new Date("2026-01-10T16:00:00Z"),
          privateNotes: `notes-${tag}`,
          transcript: `Ada: transcript-${tag}`,
        },
      });
      await prisma.capTableSnapshot.create({ data: { spaceId, userId, data: { tag } } });
      await prisma.notificationPreference.create({ data: { spaceId, userId } });
      await prisma.connection.create({
        data: {
          spaceId,
          userId,
          provider: "gmail",
          displayName: `conn-${tag}`,
          status: "active",
          secretId: SECRET,
          providerRef: SECRET,
          metadata: { token: SECRET },
        },
      });
      await prisma.dataRoomFolder.create({
        data: { spaceId, userId, name: `folder-${tag}`, createdBy: "user" },
      });
      const stored = await artifacts.put(
        { name: "f.bin", mimeType: "application/octet-stream", bytes: fileBytes },
        ctx(spaceId, userId),
      );
      const item = await prisma.dataRoomItem.create({
        data: {
          spaceId,
          userId,
          source: "upload",
          sha256: tag,
          storageKey: stored.id,
          name: `doc-${tag}.bin`,
          mimeType: "application/octet-stream",
          size: BigInt(fileBytes.length),
        },
      });
      await prisma.dataRoomItem.create({
        data: {
          spaceId,
          userId,
          source: "drive",
          sha256: `${tag}-remote`,
          name: `remote-${tag}.pdf`,
          mimeType: "application/pdf",
          size: 5n,
          sourceUrl: "https://example.test/doc",
        },
      });
      const contract = await prisma.legalContract.create({
        data: {
          spaceId,
          userId,
          dataRoomItemId: item.id,
          title: `contract-${tag}`,
          contractType: "nda",
          status: "active",
          analyzedRevision: 0,
          analyzedAt: new Date(),
        },
      });
      const from = await prisma.legalNode.create({
        data: {
          spaceId,
          userId,
          kind: "company",
          label: `co-${tag}`,
          key: "co",
          contractId: contract.id,
        },
      });
      const to = await prisma.legalNode.create({
        data: { spaceId, userId, kind: "person", label: `p-${tag}`, key: "p" },
      });
      await prisma.legalEdge.create({
        data: { spaceId, userId, fromId: from.id, toId: to.id, relation: "party_to" },
      });
      await prisma.sidebarPage.create({ data: { spaceId, userId, templateKey: "t", position: 0 } });
      await prisma.botSection.create({ data: { spaceId, userId, name: `sec-${tag}` } });
    }
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: org } });
    await prisma.user.deleteMany({ where: { id: { in: [userA, userB] } } });
    await close();
  });

  it("exports the user's own rows and files, and nothing of another user or any secret", async () => {
    const started = await requestAccountExport(
      { prisma, jobs },
      { userId: userA, spaceId: shared },
    );
    expect(started.status).toBe("pending");
    await runAccountExport({ prisma, artifacts }, started.id);
    const row = await prisma.accountExport.findUniqueOrThrow({ where: { id: started.id } });
    expect(row.status).toBe("ready");
    expect(row.progress).toBe(100);
    expect(row.expiresAt.getTime() - Date.now()).toBeGreaterThan(6.9 * 86_400_000);

    const zip = await unzipExport(started.id);
    expect(zip.text("README.txt")).toContain("Praci data export");
    const manifest = zip.json("manifest.json") as any;
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.counts["bots.json"]).toBe(2);
    expect(manifest.files).toEqual({ included: 2, missing: [] });

    const names = (file: string, key: string) =>
      zip
        .json(file)
        .map((r) => r[key])
        .sort();
    expect(names("bots.json", "name")).toEqual(["bot-A-only", "bot-A-shared"]);
    expect(names("memories.json", "content")).toEqual(["mem-A-only", "mem-A-shared"]);
    expect(names("skills.json", "name")).toEqual(["skill-A-only", "skill-A-shared"]);
    expect(names("meetings.json", "title")).toEqual(["meeting-A-only", "meeting-A-shared"]);
    expect(
      zip
        .json("meetings.json")
        .map((m) => [m.privateNotes, m.transcript])
        .sort(),
    ).toEqual([
      ["notes-A-only", "Ada: transcript-A-only"],
      ["notes-A-shared", "Ada: transcript-A-shared"],
    ]);
    expect(zip.json("routines.json")[0].crons).toEqual(["0 9 * * *"]);
    expect(zip.json("messages.json")).toHaveLength(2);
    expect(zip.json("legal-edges.json")).toHaveLength(2);
    expect(zip.json("legal-nodes.json")).toHaveLength(4);
    expect(names("spaces.json", "id")).toEqual([onlyA, shared].sort());
    expect(zip.json("ai-consent.json")).toEqual([{ spaceId: shared, allowedRecipients: 1 }]);
    expect(zip.json("connections.json").map((c) => Object.keys(c).includes("secretId"))).toEqual([
      false,
      false,
    ]);

    const items = zip.json("data-room/items.json");
    const withFile = items.filter((item) => item.exportedFile);
    expect(withFile).toHaveLength(2);
    for (const item of withFile) {
      expect(
        Buffer.from(zip.files[item.exportedFile] as Uint8Array).equals(Buffer.from(fileBytes)),
      ).toBe(true);
    }

    const everything = Object.entries(zip.files)
      .filter(([name]) => name.endsWith(".json"))
      .map(([, bytes]) => strFromU8(bytes))
      .join("\n");
    expect(everything).not.toContain("B-private");
    expect(everything).not.toContain("A-left");
    expect(everything).not.toContain(SECRET);
    expect(await latestAccountExport(prisma, userB)).toBeNull();
  });

  it("allows one export at a time per user", async () => {
    const before = jobs.all.length;
    const [one, two] = await Promise.all([
      requestAccountExport({ prisma, jobs }, { userId: userB, spaceId: shared }),
      requestAccountExport({ prisma, jobs }, { userId: userB, spaceId: shared }),
    ]);
    expect(two.id).toBe(one.id);
    expect(jobs.all.length - before).toBe(1);
    expect(await prisma.accountExport.count({ where: { userId: userB } })).toBe(1);
    // Another user is not blocked by it.
    const mine = await requestAccountExport({ prisma, jobs }, { userId: userA, spaceId: shared });
    expect(mine.id).not.toBe(one.id);
    // Once the first finishes, a new one may start.
    await runAccountExport({ prisma, artifacts }, one.id);
    const again = await requestAccountExport({ prisma, jobs }, { userId: userB, spaceId: shared });
    expect(again.id).not.toBe(one.id);
  });

  it("deletes expired exports with their zips and keeps the rest", async () => {
    const make = async (expiresAt: Date) => {
      const stored = await artifacts.put(
        { name: "z.zip", mimeType: "application/zip", bytes: new Uint8Array([1]) },
        ctx(onlyA, userA),
      );
      return prisma.accountExport.create({
        data: { userId: userA, spaceId: onlyA, status: "ready", storageKey: stored.id, expiresAt },
      });
    };
    const old = await make(new Date(Date.now() - 1000));
    const fresh = await make(new Date(Date.now() + 86_400_000));
    expect(await cleanupAccountExports({ prisma, artifacts })).toBeGreaterThanOrEqual(1);
    expect(await prisma.accountExport.findUnique({ where: { id: old.id } })).toBeNull();
    await expect(artifacts.get(old.storageKey as string, ctx(onlyA, userA))).rejects.toThrow();
    expect(await prisma.accountExport.findUnique({ where: { id: fresh.id } })).not.toBeNull();
    expect((await artifacts.get(fresh.storageKey as string, ctx(onlyA, userA))).length).toBe(1);
  });
});
