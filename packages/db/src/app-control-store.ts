import type {
  AppControlScope,
  AppControlSnapshotRecord,
  AppControlStore,
} from "@rakazo/adapter-kit";
import type { PrismaClient } from "./client.js";

const STALE_MS = 24 * 60 * 60 * 1000;

type Row = {
  snapshotId: string;
  appId: string;
  windowId: string | null;
  surface: string;
  sensitive: boolean;
  spent: boolean;
};

function toRecord(row: Row): AppControlSnapshotRecord {
  return {
    snapshotId: row.snapshotId,
    appId: row.appId,
    ...(row.windowId ? { windowId: row.windowId } : {}),
    surface: row.surface as AppControlSnapshotRecord["surface"],
    sensitive: row.sensitive,
    spent: row.spent,
  };
}

/** Ref ownership for app control, in Postgres so a paused run can resume in another process. */
export class PostgresAppControlStore implements AppControlStore {
  constructor(private readonly prisma: PrismaClient) {}

  async record(
    scope: AppControlScope,
    snapshot: Omit<AppControlSnapshotRecord, "spent">,
  ): Promise<void> {
    // Rows left by a crashed run of this bot.
    await this.prisma.appControlSnapshot.deleteMany({
      where: {
        spaceId: scope.spaceId,
        userId: scope.userId,
        botId: scope.botId,
        createdAt: { lt: new Date(Date.now() - STALE_MS) },
      },
    });
    const where = {
      spaceId_userId_botId_runId_snapshotId: { ...scope, snapshotId: snapshot.snapshotId },
    };
    const data = {
      appId: snapshot.appId,
      windowId: snapshot.windowId ?? null,
      surface: snapshot.surface,
    };
    // Never clear `sensitive` or `spent` of an existing row: OR in SQL, not read-modify-write.
    await this.prisma.appControlSnapshot.upsert({
      where,
      create: { ...scope, snapshotId: snapshot.snapshotId, ...data, sensitive: snapshot.sensitive },
      update: snapshot.sensitive ? { ...data, sensitive: true } : data,
    });
  }

  async get(scope: AppControlScope, snapshotId: string) {
    const row = await this.prisma.appControlSnapshot.findUnique({
      where: { spaceId_userId_botId_runId_snapshotId: { ...scope, snapshotId } },
    });
    return row ? toRecord(row) : undefined;
  }

  async latest(scope: AppControlScope, appId: string) {
    const row = await this.prisma.appControlSnapshot.findFirst({
      where: { ...scope, appId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return row ? toRecord(row) : undefined;
  }

  async markSpent(scope: AppControlScope, snapshotId: string): Promise<void> {
    await this.prisma.appControlSnapshot.updateMany({
      where: { ...scope, snapshotId },
      data: { spent: true },
    });
  }

  async clearRun(scope: AppControlScope): Promise<void> {
    await this.prisma.appControlSnapshot.deleteMany({ where: { ...scope } });
  }
}
