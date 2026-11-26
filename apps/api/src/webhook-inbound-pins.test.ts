import { describe, expect, it, vi } from "vitest";
import { deliverWebhookEvent } from "./webhook-inbound.js";

const sendUserMessage = () => vi.fn(async () => ({ messageId: "m", runId: null, seq: 1 }));
const routine = (name: string, modelCredentialId: string | null, id = `routine-${name}`) => ({
  id,
  name,
  prompt: `do ${name}`,
  modelProvider: "openai-compatible",
  modelId: "m",
  modelCredentialId,
  thinkingLevel: null,
});
const target = { bot: { id: "bot-1", spaceId: "s", userId: "u" }, threadId: "t" };
const callsOf = (send: ReturnType<typeof sendUserMessage>) =>
  send.mock.calls as unknown as Array<
    [
      {
        routineId?: string;
        modelPin?: { modelCredentialId?: string };
        prompt: string;
        clientNonce?: string;
      },
    ]
  >;

describe("deliverWebhookEvent with routines on different connections", () => {
  it("sends one turn per connection, each pinned to its own, never one on the bot's", async () => {
    const send = sendUserMessage();
    const sendUserMessageSpy = send;

    await deliverWebhookEvent(
      { events: { sendUserMessage: sendUserMessageSpy }, jobs: { enqueue: vi.fn() } } as never,
      target,
      {
        prompt: "payload",
        routines: [routine("a", "cred-a"), routine("b", "cred-b")],
        source: "webhook",
        idempotencyKey: "evt-1",
      },
    );

    const calls = callsOf(sendUserMessageSpy);
    expect(calls.map(([input]) => input.modelPin?.modelCredentialId)).toEqual(["cred-a", "cred-b"]);
    expect(calls[0]![0].prompt).toContain("do a");
    expect(calls[0]![0].prompt).not.toContain("do b");
    expect(new Set(calls.map(([input]) => input.clientNonce)).size).toBe(2);
  });
});

describe("deliverWebhookEvent routine attribution", () => {
  it("attributes the run when exactly one routine matched", async () => {
    const send = sendUserMessage();
    await deliverWebhookEvent(
      { events: { sendUserMessage: send }, jobs: { enqueue: vi.fn() } } as never,
      target,
      {
        prompt: "payload",
        routines: [routine("a", "cred-a", "r1")],
        source: "webhook",
      },
    );
    expect(callsOf(send).map(([input]) => input.routineId)).toEqual(["r1"]);
  });

  it("attributes nothing when two routines share one connection", async () => {
    const send = sendUserMessage();
    await deliverWebhookEvent(
      { events: { sendUserMessage: send }, jobs: { enqueue: vi.fn() } } as never,
      target,
      {
        prompt: "payload",
        routines: [routine("a", "cred-a", "r1"), routine("b", "cred-a", "r2")],
        source: "webhook",
      },
    );
    expect(callsOf(send).map(([input]) => input.routineId)).toEqual([undefined]);
  });

  it("attributes each turn to its own routine when two connections split them", async () => {
    const send = sendUserMessage();
    await deliverWebhookEvent(
      { events: { sendUserMessage: send }, jobs: { enqueue: vi.fn() } } as never,
      target,
      {
        prompt: "payload",
        routines: [routine("a", "cred-a", "r1"), routine("b", "cred-b", "r2")],
        source: "webhook",
        idempotencyKey: "evt-1",
      },
    );
    expect(callsOf(send).map(([input]) => input.routineId)).toEqual(["r1", "r2"]);
  });
});
