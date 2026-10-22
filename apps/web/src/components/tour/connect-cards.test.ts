import type { MessageBlock } from "@rakazo/contracts";
import { expect, it } from "vitest";
import { connectCardsOpen } from "./connect-cards";

const card = (status: "pending" | "connected"): MessageBlock => ({
  kind: "app_connect",
  provider: "gmail",
  name: "Gmail",
  description: "",
  logo: null,
  status,
});
const text: MessageBlock = { kind: "text", text: "hi" };

it("waits only while cards exist and none is connected", () => {
  expect(connectCardsOpen([{ blocks: [text] }])).toBe(false);
  expect(connectCardsOpen([{ blocks: [text, card("pending"), card("pending")] }])).toBe(true);
  expect(connectCardsOpen([{ blocks: [card("pending"), card("connected")] }])).toBe(false);
});
