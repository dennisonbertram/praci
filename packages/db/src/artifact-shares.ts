import { createHash, randomBytes } from "node:crypto";
import type { PrismaClient } from "./client.js";
import { IsolationError } from "./scope.js";

type Scope = { spaceId: string; userId: string };
type Db = Pick<PrismaClient, "$transaction" | "artifact" | "artifactShare">;

/** Public opens allowed per link in each one-minute window. */
export const ARTIFACT_SHARE_OPENS_PER_MINUTE = 60;

/** A link lasts 30 days from the day it was made. */
export const ARTIFACT_SHARE_TTL_MS = 30 * 24 * 60 * 60_000;

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export type ActiveShare = { artifactId: string; version: number; expiresAt: Date };

/** The owner's artifact row (any version), or an IsolationError. */
async function ownedVersion(db: Pick<PrismaClient, "artifact">, scope: Scope, artifactId: string) {
  const row = await db.artifact.findFirst({
    where: { id: artifactId, spaceId: scope.spaceId, userId: scope.userId },
    select: { id: true, rootArtifactId: true, mimeType: true },
  });
  if (!row) throw new IsolationError();
  return { ...row, familyId: row.rootArtifactId ?? row.id };
}

const inFamily = (familyId: string) => ({ OR: [{ id: familyId }, { rootArtifactId: familyId }] });

/** The family's live link, which points at one version. Never the token. */
export async function getArtifactShare(
  prisma: Db,
  scope: Scope,
  artifactId: string,
  now = new Date(),
): Promise<ActiveShare | null> {
  const { familyId } = await ownedVersion(prisma, scope, artifactId);
  const share = await prisma.artifactShare.findFirst({
    where: {
      spaceId: scope.spaceId,
      revokedAt: null,
      expiresAt: { gt: now },
      artifact: { spaceId: scope.spaceId, userId: scope.userId, ...inFamily(familyId) },
    },
    include: { artifact: { select: { version: true } } },
  });
  return share
    ? { artifactId: share.artifactId, version: share.artifact.version, expiresAt: share.expiresAt }
    : null;
}

/** Makes a link to this version and ends any live link of the same artifact. Returns the token once. */
export async function createArtifactShare(
  prisma: Db,
  scope: Scope,
  artifactId: string,
  isShareable: (mimeType: string) => boolean,
  now = new Date(),
): Promise<{ token: string; expiresAt: Date }> {
  const { familyId, mimeType } = await ownedVersion(prisma, scope, artifactId);
  if (!isShareable(mimeType)) throw new UnshareableArtifactError();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + ARTIFACT_SHARE_TTL_MS);
  await prisma.$transaction(async (tx) => {
    // Serialise rotations of one artifact family so two concurrent creates cannot both survive.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${familyId}, 0))`;
    await tx.artifactShare.updateMany({
      where: {
        spaceId: scope.spaceId,
        revokedAt: null,
        artifact: { spaceId: scope.spaceId, userId: scope.userId, ...inFamily(familyId) },
      },
      data: { revokedAt: now },
    });
    await tx.artifactShare.create({
      data: {
        spaceId: scope.spaceId,
        artifactId,
        tokenHash: sha256(token),
        createdByUserId: scope.userId,
        expiresAt,
      },
    });
  });
  return { token, expiresAt };
}

export async function revokeArtifactShare(
  prisma: Db,
  scope: Scope,
  artifactId: string,
  now = new Date(),
): Promise<void> {
  const { familyId } = await ownedVersion(prisma, scope, artifactId);
  await prisma.artifactShare.updateMany({
    where: {
      spaceId: scope.spaceId,
      revokedAt: null,
      artifact: { spaceId: scope.spaceId, userId: scope.userId, ...inFamily(familyId) },
    },
    data: { revokedAt: now },
  });
}

export class UnshareableArtifactError extends Error {
  constructor() {
    super("This file type cannot be shared by link.");
    this.name = "UnshareableArtifactError";
  }
}

/**
 * The public lookup: only the row the token names. Null for an unknown, expired or revoked token;
 * "limited" when the link was opened more than 60 times in the last minute.
 * No caller-supplied id reaches the query; the space comes from the share row itself.
 */
export async function openArtifactShare(
  prisma: Pick<PrismaClient, "artifactShare" | "$queryRaw">,
  token: string,
  now = new Date(),
) {
  const share = await prisma.artifactShare.findUnique({
    where: { tokenHash: sha256(token) },
    include: {
      artifact: {
        select: {
          id: true,
          spaceId: true,
          userId: true,
          name: true,
          mimeType: true,
          storageKey: true,
        },
      },
    },
  });
  if (!share || share.revokedAt || share.expiresAt <= now) return null;
  // A share row and its artifact always agree on the space; refuse if they ever do not.
  if (share.artifact.spaceId !== share.spaceId) return null;
  // One statement stamps the open and counts it in a one-minute window, so every API process
  // shares the same limit.
  const cutoff = new Date(now.getTime() - 60_000);
  const [counted] = await prisma.$queryRaw<{ openCount: number }[]>`
    UPDATE "artifact_shares" SET
      "openCount" = CASE WHEN "openWindowStart" IS NULL OR "openWindowStart" <= ${cutoff}
        THEN 1 ELSE "openCount" + 1 END,
      "openWindowStart" = CASE WHEN "openWindowStart" IS NULL OR "openWindowStart" <= ${cutoff}
        THEN ${now} ELSE "openWindowStart" END,
      "lastOpenedAt" = ${now}
    WHERE "id" = ${share.id}
    RETURNING "openCount"`;
  if (!counted || counted.openCount > ARTIFACT_SHARE_OPENS_PER_MINUTE) return "limited" as const;
  return share.artifact;
}
