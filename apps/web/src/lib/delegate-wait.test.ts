import type { MessageBlock } from "@rakazo/contracts";
import { expect, it } from "vitest";
import { delegateWaitState, delegateWaitTarget, pendingDelegateAgents } from "./delegate-wait";

const sent = {
  kind: "bot_message_sent",
  toBotId: "b2",
  toBotName: "Mercury agent",
  text: "x",
  intent: "request",
};
const received = {
  kind: "bot_message_received",
  fromBotId: "b2",
  fromBotName: "Mercury agent",
  text: "y",
};
const msg = (block: unknown) => ({ blocks: [block as MessageBlock] });

it("names the agent a message went to while no answer has come back", () => {
  expect(delegateWaitTarget([msg({ kind: "text", text: "hi" }), msg(sent)])).toBe("Mercury agent");
});

it("names nobody once the answer arrived, or when nothing was sent", () => {
  expect(delegateWaitTarget([msg(sent), msg(received)])).toBeNull();
  expect(delegateWaitTarget([msg({ kind: "text", text: "hi" })])).toBeNull();
});

it("lists each agent holding an approval once, in the order asked", () => {
  expect(
    pendingDelegateAgents([
      { id: "b2", name: "Mercury agent" },
      { id: "b2", name: "Mercury agent" },
      { id: "b3", name: "Inbox agent" },
    ]),
  ).toEqual([
    { id: "b2", name: "Mercury agent" },
    { id: "b3", name: "Inbox agent" },
  ]);
  expect(pendingDelegateAgents(undefined)).toEqual([]);
});

const at = (ms: number) => new Date(ms).toISOString();
const sentAt = (ms: number) => ({ blocks: [sent as MessageBlock], createdAt: at(ms) });

it("shows nothing for the first minute, then the wait, then an unanswered request", () => {
  const messages = [sentAt(0)];
  expect(delegateWaitState(messages, 59_000)).toBeNull();
  expect(delegateWaitState(messages, 61_000)).toEqual({ name: "Mercury agent", state: "waiting" });
  expect(delegateWaitState(messages, 5 * 60_000 + 1)).toEqual({
    name: "Mercury agent",
    state: "unanswered",
  });
});

it("shows nothing once the answer arrived, or for an old unanswered message", () => {
  expect(delegateWaitState([sentAt(0), msg(received)], 10 * 60_000)).toBeNull();
  expect(delegateWaitState([sentAt(0)], 2 * 60 * 60_000)).toBeNull();
});

it("does not wait on a result, status or FYI this chat sent back", () => {
  for (const intent of ["result", "status", "fyi"]) {
    expect(
      delegateWaitState(
        [{ blocks: [{ ...sent, intent } as MessageBlock], createdAt: at(0) }],
        10 * 60_000,
      ),
    ).toBeNull();
  }
});

it("waits on a question or a message with no intent", () => {
  const { intent: _, ...bare } = sent;
  for (const block of [{ ...sent, intent: "question" }, bare]) {
    expect(
      delegateWaitState([{ blocks: [block as MessageBlock], createdAt: at(0) }], 2 * 60_000),
    ).not.toBeNull();
  }
});

it("keeps waiting on a request when a later FYI goes to another agent", () => {
  const fyi = { ...sent, toBotId: "b3", toBotName: "Inbox agent", intent: "fyi" };
  expect(delegateWaitTarget([msg(sent), msg(fyi)])).toBe("Mercury agent");
});

it("ends a request only when that same agent answers", () => {
  const other = { ...received, fromBotId: "b3", fromBotName: "Inbox agent" };
  expect(delegateWaitTarget([msg(sent), msg(other)])).toBe("Mercury agent");
  expect(delegateWaitTarget([msg(sent), msg(received)])).toBeNull();
});
