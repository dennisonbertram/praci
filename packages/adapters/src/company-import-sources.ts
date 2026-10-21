import { createHash, randomUUID } from "node:crypto";
import type {
  AdapterContext,
  CompanyExtractor,
  CompanyImportReadPage,
  CompanyImportSourceDescriptor,
  CompanyImportWorker,
  CompanyImportWorkerContext,
  MailAccount,
  MailProvider,
} from "@rakazo/adapter-kit";
import { CompanyDataRoomScopeSchema, CompanyMailScopeSchema } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import * as z from "zod";
import { skipCompanyMail, validateCompanyExtraction } from "./company-extraction-safety.js";
import { CompanyImportWorkerError } from "./company-import-engine.js";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const noFacts: CompanyImportReadPage = { items: [], facts: [], nextCursor: null, done: true };
const itemCursor = z.strictObject({
  itemId: z.string().min(1).max(300),
  truncated: z.boolean().optional(),
});
const discoveryCursor = z.strictObject({
  afterId: z.string().optional(),
  pageToken: z.string().nullable().optional(),
  pendingIds: z.array(z.string()).max(100).optional(),
  nextPageToken: z.string().nullable().optional(),
});
const MAX_TITLE_BYTES = 1_024;

type SourceDocument = {
  id: string;
  title: string;
  text: string;
  snippet: string;
  sourceUrl?: string | null;
  truncated?: boolean;
};

function utf8Prefix(value: string, maxBytes: number) {
  if (maxBytes <= 0) return "";
  const bytes = Buffer.from(value);
  if (bytes.length <= maxBytes) return value;
  let end = maxBytes;
  while (end > 0 && (bytes[end]! & 0xc0) === 0x80) end--;
  return bytes.subarray(0, end).toString();
}

/** Capture the default window once, before consent, rather than moving it on every retry. */
export function companySourceScope(kind: string, raw: Record<string, unknown>, now = new Date()) {
  if (kind === "data_room") return CompanyDataRoomScopeSchema.parse(raw);
  if (kind !== "gmail") return raw;
  const scope = CompanyMailScopeSchema.parse(raw);
  if (scope.allTime || scope.after) return scope;
  const year = now.getUTCFullYear() - 3;
  const month = now.getUTCMonth();
  const day = Math.min(now.getUTCDate(), new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
  return { ...scope, after: new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10) };
}

export function createCompanySourceWorker(deps: {
  prisma: PrismaClient;
  mail?: MailProvider;
  extractor: CompanyExtractor;
}): CompanyImportWorker {
  // Narrow the capability object at construction, not by trusting a model's instructions.
  const mail = deps.mail
    ? {
        listMessages: deps.mail.listMessages.bind(deps.mail),
        getMessage: deps.mail.getMessage.bind(deps.mail),
      }
    : undefined;
  const contextFor = (context: CompanyImportWorkerContext): AdapterContext => {
    const id = randomUUID();
    return { ...context.actor, signal: context.signal, operationId: id, traceId: id };
  };
  const dataRoomWhere = async (
    source: CompanyImportSourceDescriptor,
    context: CompanyImportWorkerContext,
  ) => {
    const scope = CompanyDataRoomScopeSchema.parse(source.scope);
    const blockedConnections = await deps.prisma.companySourceBlock.findMany({
      where: {
        spaceId: context.actor.spaceId,
        ownerUserId: context.actor.userId,
        sourceKind: "data_room",
        connectionId: { not: null },
      },
      select: { connectionId: true },
    });
    const allowedConnectionIds = blockedConnections.flatMap((row) =>
      row.connectionId ? [row.connectionId] : [],
    );
    return {
      spaceId: context.actor.spaceId,
      userId: context.actor.userId,
      ...(scope.itemIds ? { id: { in: [...new Set(scope.itemIds)] } } : {}),
      ...(scope.folderIds
        ? {
            folderId: { in: [...new Set(scope.folderIds)] },
            folder: { spaceId: context.actor.spaceId, userId: context.actor.userId },
          }
        : {}),
      ...(source.connectionId
        ? {
            sourceConnectionId: source.connectionId,
            sourceConnection: {
              spaceId: context.actor.spaceId,
              userId: context.actor.userId,
              status: "connected",
              allAgents: true,
              privateByDefault: false,
            },
          }
        : {
            OR: [
              { sourceConnectionId: null },
              {
                sourceConnection: {
                  spaceId: context.actor.spaceId,
                  userId: context.actor.userId,
                  status: "connected",
                  allAgents: true,
                  privateByDefault: false,
                  ...(allowedConnectionIds.length ? { id: { notIn: allowedConnectionIds } } : {}),
                },
              },
            ],
          }),
      ...(scope.itemIds !== undefined ? { id: { in: [...new Set(scope.itemIds)] } } : {}),
      ...(scope.folderIds !== undefined ? { folderId: { in: [...new Set(scope.folderIds)] } } : {}),
    };
  };
  const accountFor = async (
    source: CompanyImportSourceDescriptor,
    context: CompanyImportWorkerContext,
  ): Promise<MailAccount> => {
    if (!mail || !source.connectionId) throw new CompanyImportWorkerError("mail_unavailable");
    const row = await deps.prisma.connection.findFirst({
      where: {
        id: source.connectionId,
        spaceId: context.actor.spaceId,
        userId: context.actor.userId,
        status: "connected",
        allAgents: true,
        privateByDefault: false,
      },
      select: {
        id: true,
        connectorId: true,
        provider: true,
        providerRef: true,
        displayName: true,
        spaceId: true,
        userId: true,
      },
    });
    if (
      row?.provider.toLowerCase() !== "gmail" ||
      typeof row.providerRef !== "string" ||
      !row.providerRef
    )
      throw new CompanyImportWorkerError("source_unavailable");
    return {
      id: row.id,
      connectorId: row.connectorId,
      app: row.provider,
      accountRef: row.providerRef,
      label: row.displayName,
      spaceId: row.spaceId,
      userId: row.userId,
      address: null,
    };
  };
  const extract = async (
    source: CompanyImportSourceDescriptor,
    document: SourceDocument,
    maxBytes: number,
    context: CompanyImportWorkerContext,
  ): Promise<CompanyImportReadPage> => {
    const title = utf8Prefix(document.title, Math.min(MAX_TITLE_BYTES, Math.max(0, maxBytes)));
    const separator = maxBytes > Buffer.byteLength(title) ? "\n" : "";
    const text = utf8Prefix(
      document.text,
      Math.max(0, maxBytes - Buffer.byteLength(title) - Buffer.byteLength(separator)),
    );
    const extractionDocument = {
      id: document.id,
      title,
      text,
      snippet: document.snippet,
      sourceUrl: document.sourceUrl,
    };
    const content = `${title}${separator}${text}`;
    const truncated =
      Boolean(document.truncated) || title !== document.title || text !== document.text;
    const nextCursor = truncated ? { itemId: document.id, truncated: true } : null;
    const contentHash = hash(content);
    const items = [{ sourceItemId: document.id, contentHash, content }];
    const prior = await deps.prisma.companyEvidence.findMany({
      where: {
        spaceId: context.actor.spaceId,
        ownerUserId: context.actor.userId,
        sourceKind: source.sourceKind,
        connectionId: source.connectionId,
        sourceItemId: document.id,
        contentHash,
      },
      select: { id: true },
    });
    if (prior.length)
      return {
        ...noFacts,
        items,
        nextCursor,
        reusedEvidenceIds: prior.map((row) => row.id),
      };
    if (
      !text.trim() ||
      !(await deps.extractor.relevant({ title, text: document.snippet }, context))
    )
      return { ...noFacts, items, nextCursor };
    const result = await deps.extractor.extract(extractionDocument, context);
    const extraction = validateCompanyExtraction(result.extraction, extractionDocument);
    return {
      ...noFacts,
      items,
      nextCursor,
      extractions: [
        {
          sourceItemId: document.id,
          contentHash,
          sourceUrl: document.sourceUrl,
          extraction,
          model: result.model,
        },
      ],
    };
  };

  return {
    async discover({ source, cursor, maxUnits }, context) {
      const page = discoveryCursor.parse(cursor ?? {});
      if (source.sourceKind === "data_room") {
        const rows = await deps.prisma.dataRoomItem.findMany({
          where: {
            AND: [
              await dataRoomWhere(source, context),
              ...(page.afterId ? [{ id: { gt: page.afterId } }] : []),
            ],
          },
          orderBy: { id: "asc" },
          take: maxUnits,
          select: { id: true },
        });
        const done = rows.length < maxUnits;
        return {
          units: rows.map((row) => ({
            unitKey: `data_room:${hash(row.id)}`,
            cursor: { itemId: row.id },
          })),
          nextCursor: done ? null : { afterId: rows.at(-1)!.id },
          done,
        };
      }
      if (source.sourceKind !== "gmail") throw new CompanyImportWorkerError("unsupported_source");
      const account = await accountFor(source, context);
      const scope = CompanyMailScopeSchema.parse(source.scope);
      const query = [
        scope.after ? `after:${Math.floor(Date.parse(scope.after) / 1000) - 1}` : "",
        scope.before ? `before:${Math.floor(Date.parse(scope.before) / 1000)}` : "",
      ]
        .filter(Boolean)
        .join(" ");
      const result = await mail!.listMessages(
        account,
        {
          query,
          labelIds: scope.labelIds,
          pageSize: maxUnits,
          useCache: false,
          ...(page.pendingIds?.length
            ? { ids: page.pendingIds }
            : { pageToken: page.pageToken ?? undefined }),
        },
        contextFor(context),
      );
      const nextPageToken = page.pendingIds?.length ? page.nextPageToken : result.nextPageToken;
      const pendingIds = result.unhydratedIds ?? [];
      if (pendingIds.length && !result.messages.length)
        throw new CompanyImportWorkerError("source_rate_limited", 60_000);
      const nextCursor = pendingIds.length
        ? { pendingIds, nextPageToken: nextPageToken ?? null }
        : nextPageToken
          ? { pageToken: nextPageToken }
          : null;
      return {
        units: result.messages.map((message) => ({
          unitKey: `gmail:${hash(message.id)}`,
          cursor: { itemId: message.id },
        })),
        nextCursor,
        done: nextCursor === null,
      };
    },
    async read({ source, cursor, maxBytes }, context) {
      const { itemId } = itemCursor.parse(cursor);
      if (source.sourceKind === "data_room") {
        const item = await deps.prisma.dataRoomItem.findFirst({
          where: { AND: [await dataRoomWhere(source, context), { id: itemId }] },
          select: {
            id: true,
            name: true,
            docType: true,
            docDate: true,
            parties: true,
            summary: true,
            sourceUrl: true,
            status: true,
          },
        });
        if (!item) throw new CompanyImportWorkerError("source_item_unavailable");
        if (item.status !== "ready")
          throw new CompanyImportWorkerError("source_item_not_ready", 60_000);
        const text = await deps.prisma.dataRoomItemText.findFirst({
          where: { itemId: item.id, spaceId: context.actor.spaceId, userId: context.actor.userId },
          select: { text: true },
        });
        const facets = [item.docType, item.docDate?.toISOString().slice(0, 10), ...item.parties]
          .filter(Boolean)
          .join("; ");
        return extract(
          source,
          {
            id: item.id,
            title: item.name,
            text: text?.text ?? "",
            snippet: `${facets}\n${item.summary ?? text?.text.slice(0, 1200) ?? ""}`,
            sourceUrl: item.sourceUrl,
          },
          maxBytes,
          context,
        );
      }
      if (source.sourceKind !== "gmail") throw new CompanyImportWorkerError("unsupported_source");
      const account = await accountFor(source, context);
      const scope = CompanyMailScopeSchema.parse(source.scope);
      const metadata = await mail!.listMessages(
        account,
        { query: "", ids: [itemId], pageSize: 1, useCache: false },
        contextFor(context),
      );
      if (metadata.unhydratedIds?.length)
        throw new CompanyImportWorkerError("source_rate_limited", 60_000);
      const message = metadata.messages.find((message) => message.id === itemId);
      if (!message) return noFacts;
      const date = message.date.slice(0, 10);
      if (
        (scope.after && date < scope.after) ||
        (scope.before && date >= scope.before) ||
        scope.labelIds?.some((label) => !message.labelIds.includes(label))
      )
        return noFacts;
      const cached = await deps.prisma.cachedMailMessage.findFirst({
        where: { ...context.actor, connectionId: account.id, providerMessageId: itemId },
        select: { category: true, pile: true },
      });
      const sender = message.from?.address.toLowerCase();
      const decision = sender
        ? await deps.prisma.mailSenderDecision.findFirst({
            where: {
              ...context.actor,
              connectionId: account.id,
              senderAddress: sender,
              skipInboxAt: { not: null },
            },
            select: { id: true },
          })
        : null;
      const feedback = sender
        ? await deps.prisma.inboxSenderFeedback.findFirst({
            where: { ...context.actor, senderAddress: sender, mark: "noise" },
            select: { id: true },
          })
        : null;
      if (
        skipCompanyMail({
          ...message,
          category: cached?.category,
          skipSender: Boolean(decision || feedback),
        }) ||
        ["newsletters", "updates", "spam"].includes(cached?.pile ?? "")
      )
        return noFacts;
      const full = await mail!.getMessage(account, itemId, contextFor(context));
      return extract(
        source,
        {
          id: itemId,
          title: full.subject,
          text: full.text,
          snippet: message.snippet,
          sourceUrl: `https://mail.google.com/mail/u/0/#all/${encodeURIComponent(full.threadId)}`,
          truncated: full.truncated,
        },
        maxBytes,
        context,
      );
    },
  };
}
