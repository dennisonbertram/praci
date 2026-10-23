import type { MessageBlock } from "@rakazo/contracts";
import { expect, it } from "vitest";
import { delegateWaitState, delegateWaitTarget, pendingDelegateAgents } from "./delegate-wait";

const sent = { kind: "bot_message_sent", toBotId: "b2", toBotName: "Mercury agent", text: "x" };
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
