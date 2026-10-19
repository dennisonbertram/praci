import type {
  AdapterContext,
  NotificationChannel,
  NotificationEndpointRef,
  NotificationEnvelope,
} from "@rakazo/adapter-kit";
import { describe, expect, it } from "vitest";

/** What a channel adapter needs to be driven offline: a fake of its vendor transport. */
export interface NotificationChannelHarness {
  channel: NotificationChannel;
  /** A live endpoint the channel can reach. */
  endpoint: NotificationEndpointRef;
  /** A vendor request counts as one delivery; `sent()` lists the envelope ids it received. */
  transport: {
    accept(): void;
    fail(): void;
    reportEndpointGone(): void;
    sent(): string[];
  };
  /** Makes the endpoint unknown to the system, as if the user signed out. */
  removeEndpoint(): void;
}

export const conformanceEnvelope: NotificationEnvelope = {
  id: "notification-1",
  title: "Runway dropped",
  body: "Below 12 months",
  link: "/app/finance",
  surface: "finance",
  importance: "attention",
  botId: "bot-1",
  threadId: null,
};

export const conformanceContext: AdapterContext = {
  operationId: "conformance",
  traceId: "conformance",
  spaceId: "space-1",
  userId: "user-1",
  signal: new AbortController().signal,
};

/**
 * Behaviour every external notification channel must have. `create` returns a fresh harness per
 * test, so a channel is exercised against its fake vendor transport with no network.
 */
export function describeNotificationChannelConformance(
  name: string,
  create: () => NotificationChannelHarness,
): void {
  describe(`NotificationChannel conformance: ${name}`, () => {
    it("describes itself and names the channel stored on deliveries and endpoints", () => {
      const { channel } = create();
      expect(channel.channel).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(channel.describe()).toMatchObject({
        id: expect.any(String),
        contractVersion: expect.any(String),
      });
    });

    it("sends the notification to the endpoint and reports sent", async () => {
      const h = create();
      h.transport.accept();
      await expect(
        h.channel.send(conformanceEnvelope, h.endpoint, conformanceContext),
      ).resolves.toBe("sent");
      expect(h.transport.sent()).toEqual([conformanceEnvelope.id]);
    });

    it("throws when the vendor fails, so the outbox retries", async () => {
      const h = create();
      h.transport.fail();
      await expect(
        h.channel.send(conformanceEnvelope, h.endpoint, conformanceContext),
      ).rejects.toThrow();
      expect(h.transport.sent()).toEqual([]);
    });

    it("reports endpointGone when the vendor says the address is dead", async () => {
      const h = create();
      h.transport.reportEndpointGone();
      await expect(
        h.channel.send(conformanceEnvelope, h.endpoint, conformanceContext),
      ).resolves.toBe("endpointGone");
    });

    it("reports endpointGone without calling the vendor when the endpoint was removed", async () => {
      const h = create();
      h.transport.accept();
      h.removeEndpoint();
      await expect(
        h.channel.send(conformanceEnvelope, h.endpoint, conformanceContext),
      ).resolves.toBe("endpointGone");
      expect(h.transport.sent()).toEqual([]);
    });
  });
}
