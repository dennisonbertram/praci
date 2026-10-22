import type { SecretStore } from "@rakazo/adapter-kit";
import {
  GTM_CHANNELS,
  GtmPostInputSchema,
  isIntegrationAgentForServer,
  isZernioEndpoint,
  ZERNIO_API_BASE_URL,
} from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import * as z from "zod";
import {
  claimIntendedEffect,
  completeExternalEffect,
  resolveDuplicateEffectGate,
  settleUncertainEffect,
  uncertainEffectResult,
} from "./approval-effect.js";
import { combineSignals } from "./connector-safety.js";
import { secureFetch } from "./mcp-transport.js";
import type { RemoteTransportDependencies } from "./remote-mcp.js";
import { clearPostStamp, consumeApprovedPost } from "./scratchpad-tools.js";

const ZernioPlatformSchema = z.enum(["twitter", "linkedin", "threads", "bluesky"]);
const ZernioCreateInputSchema = z.strictObject({
  ...GtmPostInputSchema.shape,
  platform: ZernioPlatformSchema,
});

export type ZernioCreateInput = z.infer<typeof ZernioCreateInputSchema>;

export type ZernioCreateResult =
  | { state: "completed"; postId: string; platformPostUrl: string }
  | { state: "queued"; postId: string }
  | { state: "rejected" }
  | { state: "uncertain" };

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function accountId(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  const object = record(value);
  return typeof object?._id === "string" ? object._id : undefined;
}

function validProofUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return (
      (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password
    );
  } catch {
    return false;
  }
}

export function parseZernioCreateResponse(
  status: number,
  body: unknown,
  expected: ZernioCreateInput,
): ZernioCreateResult {
  const root = record(body);
  if (root && Object.hasOwn(root, "success") && Object.hasOwn(root, "error")) {
    return { state: "uncertain" };
  }
  if ([400, 401, 403, 429].includes(status)) {
    const error = root;
    if (
      error &&
      typeof error.error === "string" &&
      !error.post &&
      !error.postId &&
      !error.existingPostId &&
      !error.success
    ) {
      return { state: "rejected" };
    }
    return { state: "uncertain" };
  }
  if (status < 200 || status >= 300 || status === 202) return { state: "uncertain" };
  const post = record(root?.post);
  if (
    !post ||
    typeof post._id !== "string" ||
    post._id.trim().length === 0 ||
    post.content !== expected.content ||
    typeof post.scheduledFor !== "string" ||
    new Date(post.scheduledFor).getTime() !== new Date(expected.scheduledFor).getTime() ||
    !Array.isArray(post.platforms) ||
    post.platforms.length !== 1
  ) {
    return { state: "uncertain" };
  }
  const target = record(post.platforms[0]);
  if (
    !target ||
    target.platform !== expected.platform ||
    accountId(target.accountId) !== expected.accountId
  ) {
    return { state: "uncertain" };
  }
  if (Object.hasOwn(target, "platformPostUrl")) {
    if (target.status !== "published" || !validProofUrl(target.platformPostUrl)) {
      return { state: "uncertain" };
    }
    return { state: "completed", postId: post._id, platformPostUrl: target.platformPostUrl };
  }
  if (target.status === "scheduled") {
    return { state: "queued", postId: post._id };
  }
  return { state: "uncertain" };
}

export function createZernioRestAdapter(network: RemoteTransportDependencies = {}) {
  const url = new URL(`${ZERNIO_API_BASE_URL}/v1/posts`);
  return {
    async createPost(input: { apiKey: string; input: ZernioCreateInput; signal?: AbortSignal }) {
      const parsed = ZernioCreateInputSchema.safeParse(input.input);
      if (!parsed.success || !input.apiKey.trim()) {
        return { state: "uncertain" as const };
      }
      const fetch = secureFetch(
        url,
        { allowedHosts: ["zernio.com"] },
        { headers: { authorization: `Bearer ${input.apiKey}` } },
        network,
      );
      try {
        const response = await fetch(url, {
          method: "POST",
          redirect: "manual",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({
            content: parsed.data.content,
            scheduledFor: parsed.data.scheduledFor,
            platforms: [{ platform: parsed.data.platform, accountId: parsed.data.accountId }],
          }),
          signal: combineSignals(input.signal, AbortSignal.timeout(15_000)),
        });
        if (response.status >= 300 && response.status < 400) return { state: "uncertain" as const };
        const text = await boundedText(response, 1_000_000);
        let body: unknown;
        try {
          body = JSON.parse(text);
        } catch {
          body = text;
        }
        return parseZernioCreateResponse(response.status, body, parsed.data);
      } catch {
        return { state: "uncertain" as const };
      } finally {
        await fetch.close().catch(() => undefined);
      }
    },
  };
}

async function boundedText(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new Error("Response too large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

type GtmCredentialScope = { spaceId: string; userId: string; botId: string };

export async function resolveZernioApiKey(input: {
  prisma: Pick<PrismaClient, "mcpServer" | "secret">;
  secretStore: Pick<SecretStore, "load">;
  scope: GtmCredentialScope;
}): Promise<string | null> {
  try {
    const servers = await input.prisma.mcpServer.findMany({
      where: {
        spaceId: input.scope.spaceId,
        userId: input.scope.userId,
        agentBotId: input.scope.botId,
        enabled: true,
      },
      include: { agentBot: true },
    });
    const linked = servers.filter(
      (server) =>
        server.spaceId === input.scope.spaceId &&
        server.userId === input.scope.userId &&
        server.agentBotId === input.scope.botId &&
        isZernioEndpoint(server.endpoint) &&
        server.agentExclusive &&
        !server.writesEnabled &&
        isIntegrationAgentForServer(server, server.agentBot),
    );
    if (linked.length !== 1 || !linked[0]?.secretId) return null;
    const server = linked[0]!;
    const secret = await input.prisma.secret.findFirst({
      where: {
        id: server.secretId!,
        spaceId: input.scope.spaceId,
        userId: input.scope.userId,
        kind: "mcp",
      },
    });
    if (!secret) return null;
    const material: unknown = JSON.parse(
      await input.secretStore.load(secret.ciphertext, secret.id),
    );
    const data = record(material);
    return data &&
      typeof data.secret === "string" &&
      data.secret.length > 0 &&
      data.secret.trim() === data.secret
      ? data.secret
      : null;
  } catch {
    return null;
  }
}

export async function executeApprovedGtmPost(input: {
  prisma: PrismaClient;
  scope: { runId: string; spaceId: string; userId: string; botId: string };
  input: { content: string; scheduledFor: string; accountId: string };
  platform: string;
  effectKey: string;
  createEffect: () => Promise<{ duplicate: boolean; effect: Record<string, unknown> }>;
  dispatch: (input: ZernioCreateInput) => Promise<ZernioCreateResult>;
  now?: () => Date;
}) {
  const existing = await input.prisma.externalEffect.findUnique({
    where: { idempotencyKey: input.effectKey },
  });
  if (existing) {
    if (
      existing.runId !== input.scope.runId ||
      existing.spaceId !== input.scope.spaceId ||
      existing.kind !== "gtm_post"
    ) {
      return { error: "The stored post effect does not match this run." };
    }
    if (existing.status === "completed") return existing.result;
    if (existing.status === "executing")
      return settleUncertainEffect(input.prisma, existing.id, "gtm_post");
    if (existing.status === "uncertain")
      return existing.result ?? uncertainEffectResult("gtm_post");
    if (existing.status !== "intended")
      return { error: "The previous post attempt cannot be resumed." };
  }
  const approved = await input.prisma.scratchpadItem.findMany({
    where: {
      spaceId: input.scope.spaceId,
      userId: input.scope.userId,
      botId: input.scope.botId,
      category: "public_post",
      status: "open",
      approvedAt: { not: null },
      notes: input.input.content,
      scheduledFor: new Date(input.input.scheduledFor),
      target: input.input.accountId,
      OR: existing ? [{ proof: input.effectKey }] : [{ proof: null }, { proof: input.effectKey }],
      channel: {
        in: Object.keys(GTM_CHANNELS).filter(
          (key) => "platform" in GTM_CHANNELS[key as keyof typeof GTM_CHANNELS],
        ),
      },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  if (!approved.length || new Set(approved.map((item) => item.channel)).size !== 1) {
    return { error: "No unique matching approved post is available." };
  }
  const channel = GTM_CHANNELS[approved[0]!.channel as keyof typeof GTM_CHANNELS];
  if (!("platform" in channel) || channel.platform !== input.platform) {
    return { error: "The approved channel does not match this posting target." };
  }
  const now = input.now?.() ?? new Date();
  if (new Date(input.input.scheduledFor).getTime() < now.getTime() + 10 * 60_000) {
    return { error: "The approved post must be scheduled at least ten minutes ahead." };
  }
  const consumed = await consumeApprovedPost(
    { prisma: input.prisma },
    {
      spaceId: input.scope.spaceId,
      userId: input.scope.userId,
      botId: input.scope.botId,
      text: input.input.content,
      scheduledFor: input.input.scheduledFor,
      target: input.input.accountId,
      effectKey: input.effectKey,
      now: () => now,
    },
  );
  if (!consumed.count || consumed.item.channel !== approved[0]!.channel) {
    return { error: "The approved post changed before it could be consumed." };
  }
  let recorded: Awaited<ReturnType<typeof input.createEffect>>;
  try {
    recorded = await input.createEffect();
  } catch (error) {
    if ((error as { code?: unknown } | null)?.code !== "P2002") {
      return { error: "The approved post could not be safely recorded.", uncertain: true };
    }
    const raced = await input.prisma.externalEffect.findUnique({
      where: { idempotencyKey: input.effectKey },
    });
    if (!raced) return uncertainEffectResult("gtm_post");
    recorded = { duplicate: true, effect: raced as unknown as Record<string, unknown> };
  }
  if (recorded.duplicate && recorded.effect.status !== "intended") {
    const gate = resolveDuplicateEffectGate(recorded.effect as never, "gtm_post");
    if (gate.action === "uncertain")
      return settleUncertainEffect(input.prisma, String(recorded.effect.id), "gtm_post");
    if (gate.action === "return") return gate.result;
    return { error: "The previous post attempt cannot be resumed.", uncertain: true };
  }
  const effectId = String(recorded.effect.id);
  if (!(await claimIntendedEffect(input.prisma, effectId))) {
    const current = await input.prisma.externalEffect.findUnique({ where: { id: effectId } });
    if (current?.status === "executing")
      return settleUncertainEffect(input.prisma, effectId, "gtm_post");
    const gate = current ? resolveDuplicateEffectGate(current as never, "gtm_post") : undefined;
    return gate?.action === "return" ? gate.result : uncertainEffectResult("gtm_post");
  }
  let result: ZernioCreateResult;
  try {
    result = await input.dispatch({
      ...input.input,
      platform: input.platform,
    });
  } catch {
    return settleUncertainEffect(input.prisma, effectId, "gtm_post");
  }
  const outcome = record(result);
  if (!outcome) return settleUncertainEffect(input.prisma, effectId, "gtm_post");
  if (outcome?.state === "rejected") {
    await clearPostStamp(
      { prisma: input.prisma },
      { ...input.scope, itemId: consumed.item.id, effectKey: input.effectKey },
    );
    const rejected = { error: "Zernio rejected the approved post.", rejected: true };
    await completeExternalEffect(input.prisma, effectId, "executing", rejected);
    return rejected;
  }
  if (outcome?.state === "uncertain")
    return settleUncertainEffect(input.prisma, effectId, "gtm_post");
  if (
    (outcome?.state !== "completed" && outcome?.state !== "queued") ||
    typeof outcome.postId !== "string" ||
    outcome.postId.trim().length === 0
  ) {
    return settleUncertainEffect(input.prisma, effectId, "gtm_post");
  }
  const isCompleted =
    outcome.state === "completed" &&
    typeof outcome.platformPostUrl === "string" &&
    validProofUrl(outcome.platformPostUrl);
  const proof = isCompleted ? String(outcome.platformPostUrl) : `zernio:${String(outcome.postId)}`;
  if (outcome.state === "completed" && !isCompleted) {
    return settleUncertainEffect(input.prisma, effectId, "gtm_post");
  }
  await input.prisma.scratchpadItem.updateMany({
    where: {
      id: consumed.item.id,
      spaceId: input.scope.spaceId,
      userId: input.scope.userId,
      botId: input.scope.botId,
      status: "open",
      proof: input.effectKey,
    },
    data: { ...(isCompleted ? { status: "done" } : {}), proof },
  });
  const stored = isCompleted
    ? { ok: true, postId: outcome.postId, platformPostUrl: proof }
    : { ok: true, queued: true, postId: outcome.postId };
  await completeExternalEffect(input.prisma, effectId, "executing", stored);
  return stored;
}
