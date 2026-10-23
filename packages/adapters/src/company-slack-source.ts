import { createHash } from "node:crypto";
import type {
  AdapterContext,
  CompanyConnectionReader,
  CompanyImportSourceDescriptor,
  ConnectorTool,
} from "@rakazo/adapter-kit";
import type { CompanyImportChannels } from "@rakazo/contracts";
import {
  CompanyImportChannelsSchema,
  CompanySlackChannelIdSchema,
  CompanySlackScopeSchema,
} from "@rakazo/contracts";
import { z } from "zod";
import { CompanyImportWorkerError } from "./company-import-engine.js";

export const COMPANY_SLACK_READ_TOOLS = [
  "SLACK_LIST_CONVERSATIONS",
  "SLACK_RETRIEVE_CONVERSATION_INFORMATION",
  "SLACK_FETCH_CONVERSATION_HISTORY",
  "SLACK_FETCH_MESSAGE_THREAD_FROM_A_CONVERSATION",
  "SLACK_RETRIEVE_DETAILED_USER_INFORMATION",
  "slack_list_channels",
  "slack_get_channel_history",
  "slack_get_thread_replies",
  "slack_get_user_profile",
  "slack_v2-list-channels",
  "slack_v2-find-user-by-id",
] as const;
export const COMPANY_SLACK_WRITE_TOOLS = [
  "SLACK_SEND_MESSAGE",
  "SLACK_POST_MESSAGE",
  "SLACK_JOIN_AN_EXISTING_CONVERSATION",
  "SLACK_OPEN_A_CONVERSATION",
  "SLACK_SET_READ_CURSOR_IN_A_CONVERSATION",
  "slack_post_message",
  "slack_reply_to_thread",
  "slack_add_reaction",
  "slack_v2-get-channel-history",
  "slack_v2-get-channel-details",
  "slack_v2-get-thread-replies",
] as const;

const COOLDOWN_MS = 60_000;
const timestamp = z.string().regex(/^\d{1,12}\.\d{1,6}$/);
const cursorToken = z.string().min(1).max(4096);
const channel = z.object({
  id: CompanySlackChannelIdSchema,
  name: z.string().max(200).optional(),
  is_private: z.boolean().optional(),
  is_im: z.boolean().optional(),
  is_mpim: z.boolean().optional(),
  is_channel: z.boolean().optional(),
  is_archived: z.boolean().optional(),
});
const message = z.object({
  ts: timestamp,
  text: z.string().max(200_000).default(""),
  user: z
    .string()
    .regex(/^[UW][A-Z0-9]{1,100}$/)
    .optional(),
  reply_count: z.number().int().nonnegative().optional(),
  thread_ts: timestamp.optional(),
});
const unitCursor = z.strictObject({
  channelId: CompanySlackChannelIdSchema,
  historyCursor: cursorToken.nullable().optional(),
  threadTs: timestamp.optional(),
  threadCursor: cursorToken.nullable().optional(),
  historyDone: z.boolean().optional(),
});
const discoveryCursor = z.strictObject({
  pageToken: cursorToken.nullable().optional(),
  offset: z.number().int().nonnegative().optional(),
  publicDone: z.boolean().optional(),
});
const operations = {
  channels: "SLACK_LIST_CONVERSATIONS",
  channel: "SLACK_RETRIEVE_CONVERSATION_INFORMATION",
  history: "SLACK_FETCH_CONVERSATION_HISTORY",
  replies: "SLACK_FETCH_MESSAGE_THREAD_FROM_A_CONVERSATION",
  user: "SLACK_RETRIEVE_DETAILED_USER_INFORMATION",
} as const;
const requiredArguments: Record<keyof typeof operations, string[]> = {
  channels: ["types", "limit", "cursor"],
  channel: ["channel"],
  history: ["channel", "limit", "cursor", "oldest", "latest", "inclusive"],
  replies: ["channel", "ts", "limit", "cursor", "oldest", "latest", "inclusive"],
  user: ["user"],
};

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new CompanyImportWorkerError("invalid_source_response");
  return value as Record<string, unknown>;
}

function payload(value: unknown): Record<string, unknown> {
  for (let depth = 0; depth < 6; depth++) {
    if (typeof value === "string") {
      if (Buffer.byteLength(value) > 2_000_000)
        throw new CompanyImportWorkerError("source_response_too_large");
      try {
        value = JSON.parse(value);
      } catch {
        throw new CompanyImportWorkerError("invalid_source_response");
      }
    }
    const current = object(value);
    if (
      current.successful === false ||
      current.ok === false ||
      current.isError === true ||
      current.error
    ) {
      const error = JSON.stringify(current.error ?? current.content ?? "").toLowerCase();
      if (/ratelimit|rate.limit|too_many_requests|\b429\b/.test(error)) {
        const seconds = Number(current.retry_after ?? current.retryAfter ?? 60);
        throw new CompanyImportWorkerError(
          "source_rate_limited",
          Number.isFinite(seconds)
            ? Math.max(COOLDOWN_MS, Math.min(seconds * 1000, 86_400_000))
            : COOLDOWN_MS,
        );
      }
      throw new CompanyImportWorkerError("source_read_failed");
    }
    if (current.structuredContent !== undefined) {
      value = current.structuredContent;
      continue;
    }
    if (Array.isArray(current.content)) {
      value = current.content
        .filter((part) => part?.type === "text")
        .map((part) => part.text)
        .join("\n");
      continue;
    }
    if (
      current.data !== undefined &&
      !current.channels &&
      !current.messages &&
      !current.channel &&
      !current.user
    ) {
      value = current.data;
      continue;
    }
    return current;
  }
  throw new CompanyImportWorkerError("invalid_source_response");
}

function nextCursor(result: Record<string, unknown>): string | null {
  const metadata = result.response_metadata === undefined ? {} : object(result.response_metadata);
  const raw = metadata.next_cursor ?? result.next_cursor;
  const next = raw === undefined || raw === null || raw === "" ? null : cursorToken.parse(raw);
  if (result.has_more === true && !next)
    throw new CompanyImportWorkerError("source_pagination_unavailable");
  return next;
}

function publicChannel(value: z.infer<typeof channel>) {
  return (
    value.is_channel === true &&
    value.is_private === false &&
    value.is_im !== true &&
    value.is_mpim !== true
  );
}

function sourceUnit(channelId: string) {
  return {
    unitKey: `slack:${createHash("sha256").update(channelId).digest("hex")}`,
    cursor: { channelId },
  };
}

export function isCompanySlackSource(
  source: Pick<CompanyImportSourceDescriptor, "sourceKind" | "scope">,
) {
  return (
    source.sourceKind === "slack" ||
    (source.sourceKind === "mcp" && source.scope.reader === "slack")
  );
}

export function createCompanySlackReader(reader: CompanyConnectionReader) {
  async function toolsFor(source: CompanyImportSourceDescriptor, context: AdapterContext) {
    const tools = await reader.listTools(source, context);
    const found = {} as Record<keyof typeof operations, ConnectorTool>;
    for (const key of Object.keys(operations) as Array<keyof typeof operations>) {
      const tool = tools.find((item) => (item.route?.toolName ?? item.name) === operations[key]);
      const properties = tool?.inputSchema.properties;
      if (
        !tool ||
        !properties ||
        typeof properties !== "object" ||
        !requiredArguments[key].every((arg) => arg in properties)
      )
        throw new CompanyImportWorkerError("unsupported_reader");
      found[key] = tool;
    }
    return found;
  }
  async function call(
    source: CompanyImportSourceDescriptor,
    operation: keyof typeof operations,
    args: Record<string, unknown>,
    context: AdapterContext,
  ) {
    const tools = await toolsFor(source, context);
    return payload(await reader.callTool(source, tools[operation].name, args, context));
  }
  async function channels(
    input: {
      source: CompanyImportSourceDescriptor;
      cursor?: string | null;
      includePrivate?: boolean;
      limit?: number;
    },
    context: AdapterContext,
  ): Promise<CompanyImportChannels> {
    const limit = Math.max(1, Math.min(100, input.limit ?? 100));
    const result = await call(
      input.source,
      "channels",
      {
        types: input.includePrivate ? "private_channel,im,mpim" : "public_channel",
        exclude_archived: true,
        limit,
        ...(input.cursor ? { cursor: input.cursor } : {}),
      },
      context,
    );
    const rows = z.array(channel).max(limit).parse(result.channels);
    const next = nextCursor(result);
    if (next && next === input.cursor) throw new CompanyImportWorkerError("source_cursor_stalled");
    return CompanyImportChannelsSchema.parse({
      channels: rows
        .filter((item) => !item.is_archived && (input.includePrivate || publicChannel(item)))
        .map((item) => ({
          id: item.id,
          name: item.name || item.id,
          private: !publicChannel(item),
          direct: item.is_im === true || item.is_mpim === true,
        })),
      nextCursor: next,
    });
  }
  return {
    async supports(source: CompanyImportSourceDescriptor, context: AdapterContext) {
      await toolsFor(source, context);
      return true;
    },
    channels,
    async discover(
      source: CompanyImportSourceDescriptor,
      rawCursor: unknown,
      maxUnits: number,
      context: AdapterContext,
    ) {
      const scope = CompanySlackScopeSchema.parse(source.scope);
      const state = discoveryCursor.parse(rawCursor ?? {});
      const limit = Math.max(1, Math.min(100, maxUnits));
      if (scope.channelIds !== undefined || state.publicDone) {
        const ids = [...new Set([...(scope.channelIds ?? []), ...scope.privateChannelIds])];
        const offset = state.offset ?? 0;
        const slice = ids.slice(offset, offset + limit);
        const done = offset + slice.length >= ids.length;
        return {
          units: slice.map(sourceUnit),
          nextCursor: done ? null : { publicDone: true, offset: offset + slice.length },
          done,
          cooldownMs: COOLDOWN_MS,
        };
      }
      const page = await channels({ source, cursor: state.pageToken, limit }, context);
      const done = page.nextCursor === null && scope.privateChannelIds.length === 0;
      return {
        units: page.channels.filter((item) => !item.private).map((item) => sourceUnit(item.id)),
        nextCursor: page.nextCursor
          ? { pageToken: page.nextCursor }
          : done
            ? null
            : { publicDone: true, offset: 0 },
        done,
        cooldownMs: COOLDOWN_MS,
      };
    },
    async read(source: CompanyImportSourceDescriptor, rawCursor: unknown, context: AdapterContext) {
      const scope = CompanySlackScopeSchema.parse(source.scope);
      const state = unitCursor.parse(rawCursor);
      const explicitPrivate = scope.privateChannelIds.includes(state.channelId);
      if (
        !explicitPrivate &&
        scope.channelIds !== undefined &&
        !scope.channelIds.includes(state.channelId)
      )
        throw new CompanyImportWorkerError("source_access_denied");
      const info = channel.parse(
        (await call(source, "channel", { channel: state.channelId }, context)).channel,
      );
      if (info.id !== state.channelId || (!explicitPrivate && !publicChannel(info)))
        throw new CompanyImportWorkerError("source_access_denied");
      if (info.is_archived)
        return { document: null, nextCursor: null, done: true, cooldownMs: COOLDOWN_MS };
      const cursor = state.threadTs ? state.threadCursor : state.historyCursor;
      const result = await call(
        source,
        state.threadTs ? "replies" : "history",
        {
          channel: state.channelId,
          ...(state.threadTs ? { ts: state.threadTs } : {}),
          ...(cursor ? { cursor } : {}),
          ...(scope.after ? { oldest: String(Date.parse(scope.after) / 1000 - 1) } : {}),
          ...(scope.before ? { latest: String(Date.parse(scope.before) / 1000) } : {}),
          inclusive: false,
          limit: 1,
        },
        context,
      );
      const messages = z.array(message).max(1).parse(result.messages);
      const next = nextCursor(result);
      if (next && next === cursor) throw new CompanyImportWorkerError("source_cursor_stalled");
      const item = messages[0];
      let resume: z.infer<typeof unitCursor> | null;
      if (state.threadTs) {
        resume = next
          ? { ...state, threadCursor: next }
          : state.historyDone
            ? null
            : { channelId: state.channelId, historyCursor: state.historyCursor };
      } else if (item && (item.reply_count ?? 0) > 0) {
        resume = {
          channelId: state.channelId,
          historyCursor: next,
          historyDone: !next,
          threadTs: item.ts,
        };
      } else {
        resume = next ? { channelId: state.channelId, historyCursor: next } : null;
      }
      const answer = { nextCursor: resume, done: resume === null, cooldownMs: COOLDOWN_MS };
      if (!item || !item.text.trim() || (state.threadTs && item.ts === state.threadTs))
        return { ...answer, document: null };
      const instant = Number(item.ts) * 1000;
      if (
        (scope.after && instant < Date.parse(scope.after)) ||
        (scope.before && instant >= Date.parse(scope.before))
      )
        return { ...answer, document: null };
      let author = item.user ? `Slack user: ${item.user}` : "";
      if (item.user) {
        const user = object((await call(source, "user", { user: item.user }, context)).user);
        if (user.id !== item.user) throw new CompanyImportWorkerError("invalid_source_response");
        const profile = user.profile ? object(user.profile) : {};
        const name =
          typeof profile.real_name === "string"
            ? profile.real_name
            : typeof user.real_name === "string"
              ? user.real_name
              : "";
        const email = z.email().max(254).safeParse(profile.email);
        author = [
          author,
          name ? `Author: ${name.slice(0, 200).replace(/[\r\n]/g, " ")}` : "",
          email.success ? `Work email: ${email.data.toLowerCase()}` : "",
        ]
          .filter(Boolean)
          .join("\n");
      }
      const text = `${author}\n${item.text}`;
      return {
        ...answer,
        document: {
          id: `${state.channelId}:${item.ts}`,
          title: `Slack #${info.name ?? info.id} · ${new Date(instant).toISOString()}`,
          text,
          snippet: text.slice(0, 1200),
          sourceUrl: null,
        },
      };
    },
  };
}
export type CompanySlackReader = ReturnType<typeof createCompanySlackReader>;
