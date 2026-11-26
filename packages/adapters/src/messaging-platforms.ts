import { createSlackAdapter } from "@chat-adapter/slack";
import { createTelegramAdapter } from "@chat-adapter/telegram";
import { createWhatsAppAdapter, splitMessage, WhatsAppApiError } from "@chat-adapter/whatsapp";
import type { MessagingInboundMessage, MessagingOutboundStatus } from "@rakazo/adapter-kit";
import { asRecord } from "@rakazo/core";
import { getLogger } from "@rakazo/logging";
import { createLarkAdapter, Domain } from "chat-adapter-lark";
import { createSendblueAdapter } from "chat-adapter-sendblue";
import type { ClientOptions as SendblueClientOptions } from "sendblue";
import type { BlueBubblesPollState } from "./bluebubbles-adapter.js";
import { BlueBubblesAdapter, bluebubblesTransport } from "./bluebubbles-adapter.js";
import type { MessagingPlatform } from "./chat-sdk-surface.js";
import { boundInboundMarkdown } from "./chat-sdk-surface.js";
import { PhotonAdapter, photonTransport } from "./photon-adapter.js";
import { isVitestRuntime } from "./test-runtime.js";

/**
 * Parsed platform credentials, filled from process.env at the composition
 * roots. A platform mounts when its full credential set is present.
 */
export interface MessagingEnvironmentValues {
  /** Public API origin; vendors that push delivery status call back here. */
  apiUrl?: string | undefined;
  sendblueApiKeyId?: string | undefined;
  sendblueApiSecret?: string | undefined;
  sendblueSigningSecret?: string | undefined;
  sendbluePhoneNumber?: string | undefined;
  bluebubblesUrl?: string | undefined;
  bluebubblesPassword?: string | undefined;
  bluebubblesWebhookToken?: string | undefined;
  photonProjectId?: string | undefined;
  photonProjectSecret?: string | undefined;
  photonWebhookSecret?: string | undefined;
  /** Optional override of Photon's iMessage HTTP address. */
  photonImessageAddress?: string | undefined;
  slackBotToken?: string | undefined;
  slackSigningSecret?: string | undefined;
  whatsappAccessToken?: string | undefined;
  whatsappPhoneNumberId?: string | undefined;
  whatsappAppSecret?: string | undefined;
  whatsappVerifyToken?: string | undefined;
  telegramBotToken?: string | undefined;
  telegramWebhookSecret?: string | undefined;
  larkAppId?: string | undefined;
  larkAppSecret?: string | undefined;
  larkVerificationToken?: string | undefined;
  larkEncryptKey?: string | undefined;
  larkDomain?: string | undefined;
}

export function messagingEnvFromProcess(
  env: Record<string, string | undefined>,
): MessagingEnvironmentValues {
  // Same trim/empty-to-undefined normalization the API's env loader applies,
  // so a credential with stray whitespace behaves identically in both roles.
  const clean = (value: string | undefined) => value?.trim() || undefined;
  return {
    apiUrl: clean(env.API_URL),
    sendblueApiKeyId: clean(env.SENDBLUE_API_KEY_ID),
    sendblueApiSecret: clean(env.SENDBLUE_API_SECRET),
    sendblueSigningSecret: clean(env.SENDBLUE_SIGNING_SECRET),
    sendbluePhoneNumber: clean(env.SENDBLUE_PHONE_NUMBER),
    bluebubblesUrl: clean(env.BLUEBUBBLES_URL),
    bluebubblesPassword: clean(env.BLUEBUBBLES_PASSWORD),
    bluebubblesWebhookToken: clean(env.BLUEBUBBLES_WEBHOOK_TOKEN),
    photonProjectId: clean(env.PHOTON_PROJECT_ID),
    photonProjectSecret: clean(env.PHOTON_PROJECT_SECRET),
    photonWebhookSecret: clean(env.PHOTON_WEBHOOK_SECRET),
    photonImessageAddress: clean(env.PHOTON_IMESSAGE_ADDRESS),
    slackBotToken: clean(env.SLACK_BOT_TOKEN),
    slackSigningSecret: clean(env.SLACK_SIGNING_SECRET),
    whatsappAccessToken: clean(env.WHATSAPP_ACCESS_TOKEN),
    whatsappPhoneNumberId: clean(env.WHATSAPP_PHONE_NUMBER_ID),
    whatsappAppSecret: clean(env.WHATSAPP_APP_SECRET),
    whatsappVerifyToken: clean(env.WHATSAPP_VERIFY_TOKEN),
    telegramBotToken: clean(env.TELEGRAM_BOT_TOKEN),
    telegramWebhookSecret: clean(env.TELEGRAM_WEBHOOK_SECRET_TOKEN),
    larkAppId: clean(env.LARK_APP_ID),
    larkAppSecret: clean(env.LARK_APP_SECRET),
    larkVerificationToken: clean(env.LARK_VERIFICATION_TOKEN),
    larkEncryptKey: clean(env.LARK_ENCRYPT_KEY),
    larkDomain: clean(env.LARK_DOMAIN),
  };
}

/**
 * Build the platform list for every fully configured provider. Group
 * conversations stay sendblue-only until channel semantics are mapped for
 * the other platforms, so their capabilities say so instead of half-working.
 *
 * `pollInboundMessages` must be true only in the one process that also
 * registers the inbound sink (messaging.onInbound — apps/api/src/app.ts).
 * Telegram's "auto" mode starts a long-poll the moment anything calls
 * chat.initialize() when no webhook is registered — and that includes a
 * process that only ever meant to *send*: outbound delivery
 * (sendToThread) lazily initializes too. A second process polling with no
 * inbound sink attached doesn't just do nothing — it actively steals
 * Telegram's single getUpdates slot away from the process that IS
 * listening, so both sides spend every cycle losing a 409 Conflict to the
 * other and messages stop arriving at all. Any caller that only sends
 * (e.g. apps/worker/src/index.ts, for messaging.deliver jobs) must leave
 * this false so Telegram mode resolves to "webhook" (passive — resolves
 * bot identity for outbound calls, never polls, and no webhook route is
 * mounted there for it to receive on anyway).
 */
export function messagingPlatformsFromEnv(
  env: MessagingEnvironmentValues,
  options: {
    pollInboundMessages?: boolean;
    bluebubblesPollState?: BlueBubblesPollState;
    /** Test seam: point the Sendblue SDK at an emulator. */
    sendblueTransport?: Pick<SendblueClientOptions, "baseURL" | "fetch">;
  } = {},
): MessagingPlatform[] {
  const platforms: MessagingPlatform[] = [];

  if (
    env.sendblueApiKeyId &&
    env.sendblueApiSecret &&
    env.sendblueSigningSecret &&
    env.sendbluePhoneNumber
  ) {
    const lineNumber = env.sendbluePhoneNumber;
    const adapter = createSendblueAdapter({
      apiKey: env.sendblueApiKeyId,
      apiSecret: env.sendblueApiSecret,
      defaultFromNumber: lineNumber,
      webhookSecret: env.sendblueSigningSecret,
      allowedServices: ["iMessage", "SMS", "RCS"],
      // Delivery-status callbacks need a public HTTPS origin; local setups skip them.
      ...(env.apiUrl?.startsWith("https://")
        ? { statusCallbackUrl: new URL("/api/v1/messaging/webhook/sendblue", env.apiUrl).href }
        : {}),
    });
    // chat@4.39 derives thread.isDM solely from the optional Adapter.isDM
    // hook, and chat-adapter-sendblue@0.2.0 omits it — without this every
    // 1:1 message would route as a group. Derive it from the thread id.
    // The SDK's own retries (twice, no idempotency key) would duplicate
    // texts and stall the outbox drain; the outbox owns retries instead.
    Object.assign(adapter, {
      isDM: (threadId: string) => !adapter.decodeThreadId(threadId).groupId,
      sdk: adapter.getSdk().withOptions({
        maxRetries: 0,
        timeout: MESSAGING_SEND_TIMEOUT_MS,
        ...options.sendblueTransport,
      }),
    });
    platforms.push({
      provider: "sendblue",
      capabilities: { direct: true, groups: true, typing: true },
      adapter,
      directThreadId: (address) =>
        adapter.encodeThreadId({ fromNumber: lineNumber, contactNumber: address }),
      peekStatuses: parseSendblueStatuses,
      participants: (raw) => sendblueParticipants(raw, lineNumber),
      channelName: (raw) => sendblueGroupName(raw),
      transport: (raw) => sendblueTransport(raw),
    });
  }

  if (env.slackBotToken && env.slackSigningSecret) {
    const slackAdapter = createSlackAdapter({
      botToken: env.slackBotToken,
      signingSecret: env.slackSigningSecret,
      // WebClient defaults to ten retries over ~30 minutes with no timeout,
      // sleeping through rate limits; that duplicates posts and stalls the
      // outbox. Fail fast and let the outbox back off (honouring retryAfter).
      webClientOptions: {
        retryConfig: { retries: 0 },
        rejectRateLimitedCalls: true,
        timeout: MESSAGING_SEND_TIMEOUT_MS,
      },
    });
    boundInboundMarkdown(slackAdapter);
    platforms.push({
      provider: "slack",
      capabilities: { direct: true, groups: true, typing: false },
      adapter: slackAdapter,
      enrichTeamRoom: enrichSlackTeamRoom,
      redeliveryKeys: slackRedeliveryKeys,
      isPermanentSendError: (error) => SLACK_PERMANENT_ERRORS.has(slackPlatformError(error) ?? ""),
    });
  }

  if (
    env.whatsappAccessToken &&
    env.whatsappPhoneNumberId &&
    env.whatsappAppSecret &&
    env.whatsappVerifyToken
  ) {
    platforms.push({
      provider: "whatsapp",
      capabilities: { direct: true, groups: false, typing: false },
      adapter: createWhatsAppAdapter({
        accessToken: env.whatsappAccessToken,
        phoneNumberId: env.whatsappPhoneNumberId,
        appSecret: env.whatsappAppSecret,
        verifyToken: env.whatsappVerifyToken,
      }),
      peekStatuses: parseWhatsAppStatuses,
      isPermanentSendError: (error) =>
        error instanceof WhatsAppApiError && error.errorCode === WHATSAPP_REENGAGEMENT_REQUIRED,
    });
  }

  // Both required: without the secret token the adapter accepts unsigned
  // webhook posts, so a forged update could reach inbound processing.
  if (env.telegramBotToken && env.telegramWebhookSecret) {
    platforms.push({
      provider: "telegram",
      capabilities: { direct: true, groups: false, typing: false },
      // Auto mode: uses the webhook route when Telegram has one registered
      // (checked via getWebhookInfo), and otherwise falls back to
      // long-polling getUpdates. Self-hosted/local deployments typically
      // have no public HTTPS endpoint for Telegram to push to, so the API
      // process calls initialize() at startup (apps/api/src/app.ts) to
      // start that polling loop immediately rather than waiting for the
      // first inbound webhook or outbound send. It must be the API
      // process specifically: that's where the inbound sink is registered,
      // and Telegram allows only one live getUpdates connection per bot —
      // a second poller elsewhere would just steal that slot and drop
      // every message into the void.
      adapter: createTelegramAdapter({
        botToken: env.telegramBotToken,
        secretToken: env.telegramWebhookSecret,
        mode: options.pollInboundMessages ? "auto" : "webhook",
      }),
      isPermanentSendError: isTelegramBlocked,
    });
  }

  // App ID, secret, and verification token are all required: without the
  // token the adapter accepts unsigned webhook posts. Encrypt key and
  // domain are optional (event encryption / open.feishu.cn vs open.larksuite.com).
  if (env.larkAppId && env.larkAppSecret && env.larkVerificationToken) {
    platforms.push({
      provider: "lark",
      capabilities: { direct: true, groups: false, typing: false },
      // Webhook-only: ws/long-connection incoming would consume events so
      // the HTTP webhook at /api/v1/messaging/webhook/lark never sees them.
      adapter: createLarkAdapter({
        appId: env.larkAppId,
        appSecret: env.larkAppSecret,
        verificationToken: env.larkVerificationToken,
        incoming: { events: "webhook", callbacks: "webhook" },
        // Explicit defaults prevent the adapter from rereading untrimmed process.env values.
        encryptKey: env.larkEncryptKey ?? "",
        domain: env.larkDomain?.toLowerCase() === "lark" ? Domain.Lark : Domain.Feishu,
      }),
    });
  }

  // All three required: without the webhook token anyone could post fake
  // inbound messages, and without the password the server refuses every call.
  // Polling for missed webhooks runs only in the process that owns the inbound
  // sink (same rule as Telegram's long-poll above), and one replica per
  // interval through the shared poll state.
  if (env.bluebubblesUrl && env.bluebubblesPassword && env.bluebubblesWebhookToken) {
    try {
      const adapter = new BlueBubblesAdapter({
        serverUrl: env.bluebubblesUrl,
        password: env.bluebubblesPassword,
        webhookToken: env.bluebubblesWebhookToken,
        pollIntervalMs: options.pollInboundMessages ? 60_000 : 0,
        ...(options.bluebubblesPollState ? { pollState: options.bluebubblesPollState } : {}),
      });
      platforms.push({
        provider: "bluebubbles",
        capabilities: { direct: true, groups: false, typing: false },
        adapter,
        history: adapter,
        directThreadId: (address) => adapter.directThreadId(address),
        transport: bluebubblesTransport,
      });
    } catch (error) {
      // A bad BlueBubbles setting turns off iMessage through BlueBubbles only;
      // the API and worker still boot with every other platform.
      getLogger().error(
        `BlueBubbles is disabled: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // All three required: without the signing secret anyone could post fake
  // inbound messages. Direct iMessage only; groups and SMS/RCS are ignored.
  if (env.photonProjectId && env.photonProjectSecret && env.photonWebhookSecret) {
    try {
      const adapter = new PhotonAdapter({
        projectId: env.photonProjectId,
        projectSecret: env.photonProjectSecret,
        webhookSecret: env.photonWebhookSecret,
        ...(env.photonImessageAddress ? { address: env.photonImessageAddress } : {}),
      });
      platforms.push({
        provider: "photon",
        capabilities: { direct: true, groups: false, typing: true },
        adapter,
        history: adapter,
        directThreadId: (address) => adapter.directThreadId(address),
        transport: photonTransport,
      });
    } catch (error) {
      // A bad Photon setting turns off Photon only; the API and worker still
      // boot with every other platform.
      getLogger().error(
        `Photon is disabled: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return platforms;
}

/** Never live under the test runner; tests build surfaces explicitly. */
export function isMessagingEnabled(platforms: MessagingPlatform[]): boolean {
  return platforms.length > 0 && !isVitestRuntime();
}

/**
 * Linked users run on their own credentials, so linking-only deployments
 * need no deployment model. Open signup provisions users with no credential
 * of their own, so that mode requires a configured deployment model — without
 * it their runs cannot execute.
 */
export function isMessagingSurfaceEnabled(
  platforms: MessagingPlatform[],
  options: { deploymentModelConfigured: boolean; openSignup: boolean },
): boolean {
  if (!isMessagingEnabled(platforms)) return false;
  return options.openSignup ? options.deploymentModelConfigured : true;
}

/** Bounds one vendor send so a hung request cannot stall the sequential outbox drain. */
const MESSAGING_SEND_TIMEOUT_MS = 10_000;

/** Slack errors a retry cannot fix: the bot cannot reach the channel or its token is dead. */
const SLACK_PERMANENT_ERRORS = new Set([
  "channel_not_found",
  "not_in_channel",
  "is_archived",
  "invalid_auth",
  "account_inactive",
  "token_revoked",
]);

/** Meta 131047: outside the 24-hour window only a template can reach the user. */
const WHATSAPP_REENGAGEMENT_REQUIRED = 131047;

/**
 * WhatsApp caps one text at 4096 characters and the adapter sends longer
 * ones as several messages. The outbox splits first, the same way, so each
 * part is its own row and a retry re-sends only the parts that failed.
 */
export function splitOutboundBody(provider: string, body: string): string[] {
  return provider === "whatsapp" ? splitMessage(body) : [body];
}

/** Sendblue reports outbound delivery as webhooks the Chat SDK ignores. */
export function parseSendblueStatuses(payload: unknown): MessagingOutboundStatus[] {
  const body = asRecord(payload);
  const handle = body && stringField(body, "message_handle");
  if (body?.is_outbound !== true || !handle) return [];
  return [
    { type: "status", provider: "sendblue", handle, status: stringField(body, "status") ?? "" },
  ];
}

/**
 * WhatsApp reports asynchronous delivery (including 24-hour-window failures
 * such as 131047) only as `statuses[]` webhooks, which the Chat SDK skips.
 */
export function parseWhatsAppStatuses(payload: unknown): MessagingOutboundStatus[] {
  const statuses: MessagingOutboundStatus[] = [];
  for (const entry of arrayField(asRecord(payload), "entry")) {
    for (const change of arrayField(asRecord(entry), "changes")) {
      for (const item of arrayField(asRecord(asRecord(change)?.value), "statuses")) {
        const record = asRecord(item) ?? {};
        const handle = stringField(record, "id");
        const status = stringField(record, "status");
        if (!handle || !status) continue;
        statuses.push({
          type: "status",
          provider: "whatsapp",
          handle,
          status: status.toUpperCase(),
        });
      }
    }
  }
  return statuses;
}

/** Slack's marker for a dispatched event; it turns Slack's retries into no-ops. */
function slackRedeliveryKeys(payload: unknown): string[] {
  const eventId = stringField(asRecord(payload) ?? {}, "event_id");
  return eventId ? [`slack:event-delivered:${eventId}`] : [];
}

/** Telegram 403 (Chat SDK PermissionError): the user blocked the bot. */
function isTelegramBlocked(error: unknown): boolean {
  return error instanceof Error && error.name === "PermissionError";
}

/** Pull Slack team-room fields the Chat SDK does not expose on Message. */
export function enrichSlackTeamRoom(
  raw: unknown,
  base: MessagingInboundMessage,
): Partial<MessagingInboundMessage> {
  const root = asRecord(raw);
  if (!root) return {};
  const event = asRecord(root.event) ?? root;
  const teamId =
    stringField(root, "team_id") ?? stringField(event, "team") ?? stringField(event, "team_id");
  const eventType = stringField(event, "type");
  const botProfile = asRecord(event.bot_profile) ?? {};
  const botId = stringField(event, "bot_id") ?? stringField(botProfile, "id");
  const threadTs = stringField(event, "thread_ts");
  const channel = stringField(event, "channel");
  const enrichment: Partial<MessagingInboundMessage> = {};
  if (teamId) enrichment.workspaceId = teamId;
  if (channel) enrichment.conversationKey = channel;
  if (botId) enrichment.senderIsBot = true;
  else if (typeof event.bot_id === "string" || event.subtype === "bot_message") {
    enrichment.senderIsBot = true;
  }
  if (threadTs) enrichment.replyThreadId = threadTs;
  else enrichment.replyThreadId = null;
  if (!base.isDirect) {
    const text = stringField(event, "text") ?? base.content;
    const botUserId = slackAuthorizedBotUserId(root);
    // app_mention is Slack's bot-directed event. A bare <@U…> mention of
    // someone else must stay ambient so listen policy still applies.
    enrichment.kind =
      eventType === "app_mention" || mentionsSlackBot(text, botUserId) ? "mention" : "ambient";
  }
  return enrichment;
}

function slackPlatformError(error: unknown): string | undefined {
  const record = asRecord(error);
  if (record?.code !== "slack_webapi_platform_error") return undefined;
  return stringField(asRecord(record.data) ?? {}, "error");
}

/** Bot user id from Slack's event authorizations (the app that received the event). */
function slackAuthorizedBotUserId(root: Record<string, unknown>): string | undefined {
  const authorizations = root.authorizations;
  if (!Array.isArray(authorizations)) return undefined;
  for (const entry of authorizations) {
    const record = asRecord(entry);
    if (record?.is_bot !== true) continue;
    const userId = stringField(record, "user_id");
    if (userId) return userId;
  }
  return undefined;
}

function mentionsSlackBot(text: string, botUserId: string | undefined): boolean {
  if (!botUserId) return false;
  return text.includes(`<@${botUserId}>`);
}

function arrayField(record: Record<string, unknown> | null | undefined, key: string): unknown[] {
  const value = record?.[key];
  return Array.isArray(value) ? value : [];
}

function stringField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value ? value : undefined;
}

function sendblueParticipants(raw: unknown, lineNumber: string): string[] {
  if (typeof raw !== "object" || raw === null) return [];
  const participants = (raw as { participants?: unknown }).participants;
  if (!Array.isArray(participants)) return [];
  return participants.filter(
    (entry): entry is string => typeof entry === "string" && entry !== lineNumber,
  );
}

function sendblueGroupName(raw: unknown): string | null {
  if (typeof raw !== "object" || raw === null) return null;
  const name = (raw as { group_display_name?: unknown }).group_display_name;
  return typeof name === "string" && name ? name : null;
}

function sendblueTransport(raw: unknown): string | null {
  if (typeof raw !== "object" || raw === null) return null;
  const service = (raw as { service?: unknown }).service;
  return service === "iMessage" || service === "SMS" || service === "RCS" ? service : null;
}
