import { createHmac } from "node:crypto";
import type * as SlackAdapterModule from "@chat-adapter/slack";
import type { MessagingInboundMessage } from "@rakazo/adapter-kit";
import { describe, expect, it, vi } from "vitest";
import { ChatSdkMessagingSurface } from "./chat-sdk-surface.js";
import { messagingPlatformsFromEnv } from "./messaging-platforms.js";

type SlackRequest = { method: string; params: Record<string, string> };

type SlackResponse = { status: number; headers: Record<string, string>; data: unknown };

const slack = vi.hoisted(() => ({
  requests: [] as SlackRequest[],
  reactionResult: { ok: true } as Record<string, unknown>,
  postMessageResponse: null as SlackResponse | null,
}));

const slackResults: Record<string, () => Record<string, unknown>> = {
  "auth.test": () => ({ ok: true, user_id: "UBOT", bot_id: "BBOT" }),
  "users.info": () => ({ ok: true, user: { name: "test-user", real_name: "Test User" } }),
  "reactions.add": () => slack.reactionResult,
  "chat.postMessage": () => ({ ok: true, ts: "1700000000.000002", channel: "CTEST" }),
};

function slackResponse(method: string): SlackResponse {
  if (method === "chat.postMessage" && slack.postMessageResponse) return slack.postMessageResponse;
  return {
    status: 200,
    headers: {},
    data: slackResults[method]?.() ?? { ok: false, error: "unknown_method" },
  };
}

vi.mock("@chat-adapter/slack", async (importOriginal) => {
  const actual = await importOriginal<typeof SlackAdapterModule>();
  return {
    ...actual,
    createSlackAdapter: (config: Parameters<typeof actual.createSlackAdapter>[0]) =>
      actual.createSlackAdapter({
        ...config,
        // Keep the production client options (retries, rate limits, timeout).
        webClientOptions: {
          ...config?.webClientOptions,
          adapter: async (request) => {
            const method = (request.url ?? "").replace("https://slack.com/api/", "");
            slack.requests.push({
              method,
              params: Object.fromEntries(new URLSearchParams(String(request.data ?? ""))),
            });
            return {
              ...slackResponse(method),
              statusText: "",
              config: request,
              request: { path: `/api/${method}` },
            };
          },
        },
      }),
  };
});

const signingSecret = "test-slack-signing-secret";

function createSlackSurface() {
  return new ChatSdkMessagingSurface(
    messagingPlatformsFromEnv({ slackBotToken: "xoxb-fake", slackSigningSecret: signingSecret }),
  );
}

function mentionWebhook(retryNum?: number, text = "<@UBOT> ship it?"): Request {
  const body = JSON.stringify({
    type: "event_callback",
    team_id: "TTEST",
    event_id: "EvTEST",
    authorizations: [{ user_id: "UBOT", is_bot: true }],
    event: {
      type: "message",
      channel_type: "channel",
      channel: "CTEST",
      user: "USENDER",
      text,
      ts: "1700000000.000001",
    },
  });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", signingSecret)
    .update(`v0:${timestamp}:${body}`)
    .digest("hex");
  return new Request("https://rakazo.test/api/v1/messaging/webhook/slack", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-slack-request-timestamp": timestamp,
      "x-slack-signature": `v0=${signature}`,
      ...(retryNum
        ? { "x-slack-retry-num": String(retryNum), "x-slack-retry-reason": "http_error" }
        : {}),
    },
    body,
  });
}

describe("Slack inbound formatting", () => {
  it.each([
    ["unmatched emphasis", "*_".repeat(8_000)],
    ["deeply nested quotes", ">".repeat(7_000)],
  ])("delivers a message full of %s promptly and in full", async (_name, hostile) => {
    const surface = createSlackSurface();
    const events: MessagingInboundMessage[] = [];
    surface.onInbound(async (event) => {
      if (event.type === "message") events.push(event);
    });
    const started = performance.now();
    const response = await surface.handleWebhook("slack", mentionWebhook(undefined, hostile));
    expect(performance.now() - started).toBeLessThan(1_500);
    expect(response?.status).toBe(200);
    expect(events[0]?.content).toBe(hostile);
  });

  it("still parses an ordinary message", async () => {
    const surface = createSlackSurface();
    const events: MessagingInboundMessage[] = [];
    surface.onInbound(async (event) => {
      if (event.type === "message") events.push(event);
    });
    await surface.handleWebhook("slack", mentionWebhook(undefined, "<@UBOT> *read* this first"));
    expect(events[0]?.content).toBe("@Test User read this first");
  });
});
