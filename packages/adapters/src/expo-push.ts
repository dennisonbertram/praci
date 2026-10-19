import { randomUUID } from "node:crypto";
import type {
  AdapterContext,
  NotificationChannel,
  NotificationEndpointRef,
  NotificationEnvelope,
  NotificationMessage,
  NotificationProvider,
  NotificationSendResult,
} from "@rakazo/adapter-kit";
import type { PrismaClient, PushEndpoint } from "@rakazo/db";
import { deletePushEndpoint, listPushEndpoints } from "@rakazo/db";
import { getLogger } from "@rakazo/logging";
import { combineSignals } from "./connector-safety.js";
import { readBodyCapped, withAbort } from "./web-ssrf.js";

const EXPO_PUSH_TIMEOUT_MS = 15_000;
export const MAX_EXPO_PUSH_RESPONSE_BYTES = 64 * 1024;

/** Data a notification tap uses to open the bot or group thread in its space.
 * `deliveryId` distinguishes this send from another push for the same thread:
 * the Expo request identifier stays the thread id. */
export function expoPushData(message: NotificationMessage, spaceId: string, deliveryId: string) {
  return {
    kind: message.kind,
    botId: message.botId,
    threadId: message.threadId,
    deliveryId,
    ...(spaceId ? { spaceId } : {}),
    ...(message.groupId ? { groupId: message.groupId } : {}),
  };
}

/** Expiry of the session that registered a token, or null when that session is gone. */
export type PushSessionExpiresAt = (sessionId: string) => Promise<Date | null>;

export type ExpoPushTicket = {
  status?: string;
  message?: string;
  details?: { error?: string };
};

export function expoPushTickets(body: unknown): ExpoPushTicket[] {
  if (!body || typeof body !== "object") return [];
  const data = (body as { data?: unknown }).data;
  if (Array.isArray(data)) {
    return data.filter((item): item is ExpoPushTicket => Boolean(item) && typeof item === "object");
  }
  if (data && typeof data === "object") return [data as ExpoPushTicket];
  return [];
}

export function expoPushErrorMessage(body: unknown, status: number): string | undefined {
  if (body && typeof body === "object" && "errors" in body) {
    const errors = (body as { errors?: Array<{ message?: string }> }).errors;
    if (Array.isArray(errors) && errors.length > 0) {
      return errors.map((error) => error.message ?? "expo push error").join("; ");
    }
  }
  const failed = expoPushTickets(body).filter((ticket) => ticket.status === "error");
  if (failed.length > 0) {
    return failed
      .map((ticket) => ticket.message ?? ticket.details?.error ?? "expo push ticket error")
      .join("; ");
  }
  if (status < 200 || status >= 300) return `expo push failed (${status})`;
  return undefined;
}

/** Expo reported the token as no longer registered; the endpoint should be deleted. */
export class ExpoDeviceNotRegisteredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExpoDeviceNotRegisteredError";
  }
}

/** Data a notification tap uses to open the notification's page or thread. */
export function expoNotificationData(envelope: NotificationEnvelope, spaceId: string) {
  return {
    kind: "notification",
    notificationId: envelope.id,
    surface: envelope.surface,
    ...(envelope.link ? { link: envelope.link } : {}),
    ...(envelope.botId ? { botId: envelope.botId } : {}),
    ...(envelope.threadId ? { threadId: envelope.threadId } : {}),
    spaceId,
  };
}

/** Also the "push" notification channel; the outbox worker calls `send` per endpoint. */
export class ExpoPushProvider implements NotificationProvider, NotificationChannel {
  readonly channel = "push";

  constructor(
    private readonly prisma: Pick<PrismaClient, "notificationEndpoint">,
    private readonly sessionExpiresAt?: PushSessionExpiresAt,
  ) {}

  describe() {
    return {
      id: "expo-push",
      contractVersion: "1",
      adapterVersion: "0.1.0",
      capabilities: { push: true, email: false },
    };
  }

  async hasPushRecipient(userId: string): Promise<boolean> {
    return (await this.deliverableEndpoints(userId)).length > 0;
  }

  async send(message: NotificationMessage, context: AdapterContext): Promise<undefined>;
  async send(
    envelope: NotificationEnvelope,
    endpoint: NotificationEndpointRef,
    context: AdapterContext,
  ): Promise<NotificationSendResult>;
  async send(
    message: NotificationMessage | NotificationEnvelope,
    endpointOrContext: NotificationEndpointRef | AdapterContext,
    maybeContext?: AdapterContext,
  ): Promise<NotificationSendResult | undefined> {
    if (!maybeContext) {
      await this.deliver(message as NotificationMessage, endpointOrContext as AdapterContext);
      return undefined;
    }
    return this.sendEnvelope(
      message as NotificationEnvelope,
      endpointOrContext as NotificationEndpointRef,
      maybeContext,
    );
  }

  /**
   * Pushes one notification to one device. The id is the collapse id and tag, so a repeat of the
   * same notification replaces the earlier one on the device instead of stacking. An endpoint that
   * was removed, claimed by another account, or whose session ended is reported gone.
   */
  private async sendEnvelope(
    envelope: NotificationEnvelope,
    endpoint: NotificationEndpointRef,
    context: AdapterContext,
  ): Promise<NotificationSendResult> {
    const current = (await listPushEndpoints(this.prisma, context.userId)).find((e) =>
      sameEndpoint(e, endpoint),
    );
    if (!current) return "endpointGone";
    if (current.sessionId) {
      const expiresAt = await this.sessionExpiresAt?.(current.sessionId);
      if (!expiresAt || expiresAt.getTime() <= Date.now()) return "endpointGone";
    }
    // Re-read after every await: the device may have moved to another account or session meanwhile.
    const latest = (await listPushEndpoints(this.prisma, context.userId)).find((e) =>
      sameEndpoint(e, endpoint),
    );
    if (!latest) return "endpointGone";
    const signal = combineSignals(context.signal, AbortSignal.timeout(EXPO_PUSH_TIMEOUT_MS));
    try {
      await this.post(
        endpoint.address,
        {
          title: envelope.title,
          body: envelope.body ?? "",
          collapseId: envelope.id,
          tag: envelope.id,
          data: expoNotificationData(envelope, context.spaceId),
        },
        signal,
      );
      return "sent";
    } catch (error) {
      if (error instanceof ExpoDeviceNotRegisteredError) return "endpointGone";
      throw error;
    }
  }

  /**
   * Posts the push to each of the user's devices. `undeliverable` means this user has no usable
   * token, which is not an Expo acceptance — callers must not record it as a successful reminder.
   * Delivered when at least one device accepted; throws the first failure when none did.
   */
  async deliver(message: NotificationMessage, context: AdapterContext): Promise<ExpoPushDelivery> {
    const endpoints = await this.deliverableEndpoints(context.userId);
    if (endpoints.length === 0) return "undeliverable";
    const signal = combineSignals(context.signal, AbortSignal.timeout(EXPO_PUSH_TIMEOUT_MS));
    const failures: unknown[] = [];
    let delivered = false;
    for (const endpoint of endpoints) {
      try {
        // Another account may have claimed this device, or its session ended, during an earlier send.
        const current = await this.deliverableEndpoints(context.userId);
        if (!current.some((e) => sameEndpoint(e, endpoint))) continue;
        await this.post(
          endpoint.address,
          {
            title: message.title,
            body: message.body,
            collapseId: message.threadId,
            tag: message.threadId,
            data: expoPushData(message, context.spaceId, randomUUID()),
          },
          signal,
        );
        delivered = true;
      } catch (error) {
        failures.push(error);
      }
    }
    if (!delivered) {
      if (failures.length === 0) return "undeliverable";
      throw failures[0];
    }
    return "delivered";
  }

  private async post(
    token: string,
    payload: { title: string; body: string; collapseId: string; tag: string; data: object },
    signal: AbortSignal,
  ): Promise<void> {
    let response: Response;
    try {
      response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          to: token,
          ...payload,
        }),
        signal,
      });
    } catch (error) {
      getLogger().error("expo push request failed", error);
      throw error;
    }
    const body = await readExpoPushBody(response, signal);
    if (response.ok && body === undefined) {
      throw new Error("Expo push returned an invalid response.");
    }
    const failure = expoPushErrorMessage(body, response.status);
    if (!failure) return;
    getLogger().error(failure);
    if (expoPushTickets(body).some((ticket) => ticket.details?.error === "DeviceNotRegistered")) {
      throw new ExpoDeviceNotRegisteredError(failure);
    }
    throw new Error(failure);
  }

  /**
   * A token bound to a session is delivered only while that session is still live. A missing
   * session is left for session replacement to retarget; an expired one is removed. The endpoints
   * are read again after the lookups so a token another account claimed meanwhile is not sent.
   */
  private async deliverableEndpoints(userId: string): Promise<PushEndpoint[]> {
    const saved = await listPushEndpoints(this.prisma, userId);
    const live: PushEndpoint[] = [];
    for (const endpoint of saved) {
      if (!endpoint.sessionId) {
        live.push(endpoint);
        continue;
      }
      if (!this.sessionExpiresAt) continue;
      let expiresAt: Date | null;
      try {
        expiresAt = await this.sessionExpiresAt(endpoint.sessionId);
      } catch (error) {
        getLogger().error("push session lookup failed", error);
        continue;
      }
      if (!expiresAt) continue;
      if (expiresAt.getTime() <= Date.now()) {
        await deletePushEndpoint(this.prisma, endpoint);
        continue;
      }
      live.push(endpoint);
    }
    // Same row, token and session as when it was checked, or it is not sent.
    const current = await listPushEndpoints(this.prisma, userId);
    const kept = live.filter((endpoint) => current.some((c) => sameEndpoint(c, endpoint)));
    return kept.filter((e, i) => kept.findIndex((o) => o.address === e.address) === i);
  }
}

const sameEndpoint = (a: PushEndpoint, b: PushEndpoint) =>
  a.id === b.id && a.address === b.address && a.sessionId === b.sessionId;

export type ExpoPushDelivery = "delivered" | "undeliverable";

async function readExpoPushBody(response: Response, signal: AbortSignal): Promise<unknown> {
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > MAX_EXPO_PUSH_RESPONSE_BYTES) {
    const cancel = response.body?.cancel() ?? Promise.resolve();
    await withAbort(
      cancel.catch(() => undefined),
      signal,
    ).catch(() => undefined);
    throw new Error("Expo push response is too large.");
  }
  try {
    const bytes = await readBodyCapped(response, MAX_EXPO_PUSH_RESPONSE_BYTES, signal);
    if (bytes.byteLength === 0) return undefined;
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch (error) {
    if (error instanceof Error && error.message === "Response is too large") {
      throw new Error("Expo push response is too large.");
    }
    if (error instanceof SyntaxError) return undefined;
    throw error;
  }
}
