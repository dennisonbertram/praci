import type {
  AdapterContext,
  JobPublisher,
  NotificationChannel,
  NotificationEndpointRef,
  NotificationEnvelope,
  NotificationSendResult,
} from "@rakazo/adapter-kit";
import { messagingDeliverJob } from "@rakazo/adapter-kit";
import type { PrismaClient } from "@rakazo/db";
import { linkedImessageIdentities } from "@rakazo/db";
import { MESSAGING_DM_OUTBOUND_CAP } from "./messaging-delivery.js";

/** Texting first (no recent message from the owner) gets lines flagged, so only reply inside this window. */
export const IMESSAGE_OPEN_CONVERSATION_MS = 24 * 60 * 60_000;

/** Text for one notification: title, body, and an absolute link to the app. */
export function imessageNotificationText(envelope: NotificationEnvelope, appUrl: string): string {
  const link = envelope.link ? new URL(envelope.link, appUrl).toString() : null;
  return [envelope.title, envelope.body, link].filter(Boolean).join("\n");
}

/**
 * Sends `attention` notifications to the owner's linked iMessage identity by queueing a row in
 * the messaging outbox, so the 140-message cap, Photon's AI disclosure, chunking and retries are
 * the same as for every other message. The row key is the notification id: one text per
 * notification.
 *
 * ponytail: the text is agent-written and "Hide amounts" is a browser-only setting the server
 * cannot read, so amounts are not masked here. Move the switch to NotificationPreference to mask.
 */
export class ImessageNotificationChannel implements NotificationChannel {
  readonly channel = "imessage";

  constructor(
    private readonly deps: {
      prisma: Pick<PrismaClient, "messagingIdentity" | "messagingOutbound">;
      jobs: Pick<JobPublisher, "enqueue">;
      /** Absolute origin of the app, for the link in the text. */
      appUrl: string;
    },
  ) {}

  describe() {
    return {
      id: "imessage",
      contractVersion: "1",
      adapterVersion: "0.1.0",
      capabilities: { push: true, email: false },
    };
  }

  /** The most recently active linked identity, only while the owner's conversation is open. */
  async endpoints(
    scope: { userId: string; spaceId: string },
    _context?: unknown,
    now = new Date(),
  ): Promise<NotificationEndpointRef[]> {
    const [identity] = (await linkedImessageIdentities(this.deps.prisma, scope)).filter(
      (i) =>
        i.lastInboundAt !== null &&
        now.getTime() - i.lastInboundAt.getTime() < IMESSAGE_OPEN_CONVERSATION_MS &&
        i.outboundSinceInbound < MESSAGING_DM_OUTBOUND_CAP,
    );
    return identity ? [{ id: identity.id, address: identity.address, sessionId: null }] : [];
  }

  async send(
    envelope: NotificationEnvelope,
    endpoint: NotificationEndpointRef,
    _context: AdapterContext,
  ): Promise<NotificationSendResult> {
    await this.deps.prisma.messagingOutbound.createMany({
      data: [
        {
          idempotencyKey: `notification:${envelope.id}`,
          kind: "dm",
          identityId: endpoint.id,
          body: imessageNotificationText(envelope, this.deps.appUrl),
        },
      ],
      skipDuplicates: true,
    });
    await this.deps.jobs.enqueue(messagingDeliverJob());
    return "sent";
  }
}
