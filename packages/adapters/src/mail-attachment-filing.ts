import type {
  AdapterContext,
  ArtifactStore,
  JobPublisher,
  MailAttachmentInfo,
  MailProvider,
} from "@rakazo/adapter-kit";
import { mailAttachmentsJob } from "@rakazo/adapter-kit";
import type { Actor } from "@rakazo/contracts";
import { MailSignalsSchema } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { getLogger } from "@rakazo/logging";
import { fileMailAttachment } from "./data-room-tools.js";

type Scope = { spaceId: string; userId: string };

/**
 * Only mail that arrived this recently is filed. The first sync of a connection (and the backfill of
 * the 90-day cache) stores old mail as new rows; this age limit keeps them from importing months of
 * attachments at once. Turning the setting on later files nothing already in the cache.
 */
export const AUTO_FILE_MAX_AGE_MS = 2 * 86_400_000;
/** Most messages one sync queues; the rest of a burst is left for the owner or the agents. */
export const AUTO_FILE_MAX_PER_SYNC = 20;
/** Smaller files are signatures, logos and tracking pixels. */
export const AUTO_FILE_MIN_BYTES = 10 * 1024;

const DOCUMENT_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/csv",
  "application/zip",
  "application/x-zip-compressed",
]);
/** Mail clients often label a document application/octet-stream, so the extension decides then. */
const DOCUMENT_EXTENSION = /\.(pdf|docx?|xlsx?|csv|pptx|zip)$/i;
const NO_REPLY = /^(no[-_.]?reply|do[-_.]?not[-_.]?reply|mailer-daemon|postmaster)(\+.*)?@/i;

/** A document worth filing: a known document type, not inline, and not tiny. */
export function isAutoFileAttachment(part: MailAttachmentInfo): boolean {
  if (part.inline || part.size < AUTO_FILE_MIN_BYTES) return false;
  const type = part.mimeType.toLowerCase().split(";")[0]?.trim() ?? "";
  return (
    DOCUMENT_TYPES.has(type) ||
    (type === "application/octet-stream" && DOCUMENT_EXTENSION.test(part.filename))
  );
}

export interface FilingCandidate {
  fromAddress: string;
  toAddresses: string[];
  ccAddresses: string[];
  fromSelf: boolean;
  isSpam: boolean;
  pile: string | null;
  category: string | null;
  signals: unknown;
}

/**
 * Mail the owner sent is filed (its attachments are often the documents that matter) unless it went
 * only to themselves. Received mail is skipped when it is spam, in the newsletters pile, bulk or
 * promotional by its headers, or from a no-reply address.
 */
export function isAutoFileMessage(row: FilingCandidate): boolean {
  if (row.isSpam) return false;
  const from = row.fromAddress.toLowerCase();
  if (row.fromSelf) {
    const recipients = [...row.toAddresses, ...row.ccAddresses].map((a) => a.toLowerCase());
    return recipients.length > 0 && recipients.some((address) => address !== from);
  }
  if (row.pile === "newsletters" || row.pile === "spam" || row.category === "bulk") return false;
  if (NO_REPLY.test(from)) return false;
  const parsed = MailSignalsSchema.safeParse(row.signals);
  if (!parsed.success) return true;
  const { bulk, listUnsubscribe, categories } = parsed.data;
  return !(
    bulk ||
    listUnsubscribe.length > 0 ||
    categories.promotions ||
    categories.social ||
    categories.forums ||
    categories.spam
  );
}

/** The owner's setting; no row means on. */
export async function autoFileEmailEnabled(
  prisma: Pick<PrismaClient, "dataRoomPreference">,
  scope: Scope,
): Promise<boolean> {
  const row = await prisma.dataRoomPreference.findUnique({
    where: { spaceId_userId: { spaceId: scope.spaceId, userId: scope.userId } },
    select: { autoFileEmail: true },
  });
  return row?.autoFileEmail ?? true;
}

const FILING_SELECT = {
  providerMessageId: true,
  fromAddress: true,
  toAddresses: true,
  ccAddresses: true,
  fromSelf: true,
  isSpam: true,
  pile: true,
  category: true,
  signals: true,
  receivedAt: true,
} as const;

/**
 * Queues one filing job per newly cached message that is recent and not obviously clutter. Called by
 * the sync with the ids it inserted. Never throws: the mail is already cached, and a lost enqueue
 * only means those attachments are not filed automatically.
 */
export async function enqueueMailAttachmentFiling(
  deps: { prisma: PrismaClient; jobs: JobPublisher },
  scope: Scope & { connectionId: string },
  insertedIds: string[],
  now: Date,
): Promise<void> {
  if (insertedIds.length === 0) return;
  try {
    if (!(await autoFileEmailEnabled(deps.prisma, scope))) return;
    const rows = await deps.prisma.cachedMailMessage.findMany({
      where: {
        spaceId: scope.spaceId,
        userId: scope.userId,
        connectionId: scope.connectionId,
        providerMessageId: { in: insertedIds },
        receivedAt: { gte: new Date(now.getTime() - AUTO_FILE_MAX_AGE_MS) },
      },
      select: FILING_SELECT,
      orderBy: { receivedAt: "desc" },
    });
    // ponytail: the newest 20 per sync; a larger burst is not queued later. Add a cursor if it matters.
    for (const row of rows.filter(isAutoFileMessage).slice(0, AUTO_FILE_MAX_PER_SYNC)) {
      await deps.jobs.enqueue(mailAttachmentsJob(scope, row.providerMessageId));
    }
  } catch (error) {
    getLogger().warn("mail attachment filing enqueue failed", {
      connectionId: scope.connectionId,
      reason: error instanceof Error ? error.name : "error",
    });
  }
}

export interface MailAttachmentFilingDeps {
  prisma: PrismaClient;
  artifacts: ArtifactStore;
  jobs: JobPublisher;
  mail: MailProvider;
}

/**
 * Files the qualifying attachments of one cached message through the same path as
 * `add_to_data_room`. It re-checks everything when it runs: the setting, that the owner still
 * belongs to the space and still has the connected account, and the message rules. Without Data room
 * AI consent the files are still stored (as a manual upload is), and the ingest step sends nothing
 * to a model. A rate limit or provider error is thrown so the queue retries it with its backoff.
 */
export async function runMailAttachmentFiling(
  deps: MailAttachmentFilingDeps,
  payload: Scope & { connectionId: string; messageId: string },
  signal: AbortSignal = new AbortController().signal,
): Promise<void> {
  const { spaceId, userId, connectionId, messageId } = payload;
  const scope = { spaceId, userId };
  if (!(await autoFileEmailEnabled(deps.prisma, scope))) return;
  const [member, row] = await Promise.all([
    deps.prisma.spaceMember.findUnique({
      where: { spaceId_userId: { spaceId, userId } },
      select: { id: true },
    }),
    deps.prisma.cachedMailMessage.findFirst({
      where: { spaceId, userId, connectionId, providerMessageId: messageId },
      select: FILING_SELECT,
    }),
  ]);
  if (!member || !row || !isAutoFileMessage(row)) return;
  const operationId = `mail.attachments:${connectionId}:${messageId}`;
  const context: AdapterContext = { operationId, traceId: operationId, spaceId, userId, signal };
  const account = (await deps.mail.listAccounts(scope, context)).find((a) => a.id === connectionId);
  if (!account) return;
  const message = await deps.mail.getMessage(account, messageId, context);
  const actor: Actor = { ...scope, email: "", isDeploymentOwner: false };
  for (const part of message.attachments.filter(isAutoFileAttachment)) {
    await fileMailAttachment(
      { ...deps, scope },
      actor,
      context,
      account,
      messageId,
      part.id,
      message,
    );
  }
}
