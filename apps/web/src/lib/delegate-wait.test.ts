import type { MessageBlock } from "@rakazo/contracts";
import { expect, it } from "vitest";
import { delegateWaitTarget } from "./delegate-wait";

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
