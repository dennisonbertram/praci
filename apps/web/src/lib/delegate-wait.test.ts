import type { MessageBlock } from "@rakazo/contracts";
import { expect, it } from "vitest";
import { delegateWaitTarget, pendingDelegateAgents } from "./delegate-wait";

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

it("lists each agent holding an approval once, only for the messages still pending", () => {
  const asked = (id: string) => ({ id, blocks: [sent as MessageBlock] });
  const other = { ...sent, toBotId: "b3", toBotName: "Inbox agent" } as MessageBlock;
  const messages = [asked("m1"), asked("m2"), { id: "m3", blocks: [other] }, asked("m4")];
  expect(pendingDelegateAgents(messages, ["m1", "m2", "m3"])).toEqual([
    { id: "b2", name: "Mercury agent" },
    { id: "b3", name: "Inbox agent" },
  ]);
  expect(pendingDelegateAgents(messages, undefined)).toEqual([]);
});
