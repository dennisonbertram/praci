import {
  BlueBubblesEmulator,
  createEmulatedBlueBubblesPlatform,
  createEmulatedPhotonPlatform,
  createEmulatedSendbluePlatform,
  PhotonEmulator,
  SendBlueEmulator,
} from "@rakazo/adapters";
import type { MessagingPlatformHarness } from "./messaging-platform-conformance.js";
import { describeMessagingPlatformConformance } from "./messaging-platform-conformance.js";

describeMessagingPlatformConformance("sendblue", (): MessagingPlatformHarness => {
  const emulator = new SendBlueEmulator();
  return {
    platform: createEmulatedSendbluePlatform(emulator),
    inbound: ({ from, text, handle }) =>
      emulator.buildInboundRequest({
        fromNumber: from,
        content: text,
        ...(handle ? { handle } : {}),
      }),
    forged: ({ from, text }) => {
      const request = emulator.buildInboundRequest({ fromNumber: from, content: text });
      const headers = new Headers(request.headers);
      headers.set("sb-signing-secret", "wrong-secret");
      return new Request(request, { headers });
    },
    ownEcho: () => emulator.buildStatusRequest({ handle: "echo-1", status: "SENT" }),
    sentTexts: () => emulator.sent.map((s) => s.body),
    // The official Sendblue SDK retries failed sends twice before throwing.
    failNextSends: (count) => emulator.failNextSends(count * 3),
  };
});

describeMessagingPlatformConformance("bluebubbles", (): MessagingPlatformHarness => {
  const emulator = new BlueBubblesEmulator();
  return {
    platform: createEmulatedBlueBubblesPlatform(emulator),
    inbound: ({ from, text, handle }) =>
      emulator.buildInboundRequest({ from, text, ...(handle ? { guid: handle } : {}) }),
    forged: ({ from, text }) => emulator.buildInboundRequest({ from, text }, "wrong-token"),
    ownEcho: ({ text }) =>
      emulator.buildInboundRequest({ from: emulator.line, text, isFromMe: true }),
    otherTransport: ({ from, text }) =>
      emulator.buildInboundRequest({ from, text, service: "SMS" }),
    sentTexts: () => emulator.sent.map((s) => s.text),
    failNextSends: (count, status) => emulator.failNextSends(count, status),
    maxChunkLength: 2000,
    classifiesErrors: true,
  };
});

describeMessagingPlatformConformance("photon", (): MessagingPlatformHarness => {
  const emulator = new PhotonEmulator();
  let platform: MessagingPlatformHarness["platform"] | undefined;
  return {
    // Built on first use, after start() gave the emulator its address.
    get platform() {
      platform ??= createEmulatedPhotonPlatform(emulator);
      return platform;
    },
    start: () => emulator.start(),
    stop: () => emulator.stop(),
    inbound: ({ from, text, handle }) =>
      emulator.buildInboundRequest({ from, text, ...(handle ? { id: handle } : {}) }),
    forged: ({ from, text }) => emulator.buildInboundRequest({ from, text }, "b".repeat(64)),
    ownEcho: ({ text }) =>
      emulator.buildInboundRequest({ from: emulator.line, text, direction: "outbound" }),
    otherTransport: ({ from, text }) =>
      emulator.buildInboundRequest({ from, text, service: "SMS" }),
    sentTexts: () => emulator.sent.map((s) => s.text),
    failNextSends: (count, status) => emulator.failNextSends(count, status),
    maxChunkLength: 2000,
    classifiesErrors: true,
  };
});
