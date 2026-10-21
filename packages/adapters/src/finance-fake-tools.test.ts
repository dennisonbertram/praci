import { describe, expect, it } from "vitest";
import { fakeMercury, MERCURY_CHECKING } from "./finance-fake-tools.js";

describe("fakeMercury single-item reads", () => {
  it("serves a payee and an account by id, as the live server does", async () => {
    const { callTool } = fakeMercury({ txns: {} });
    expect(await callTool("getRecipient", { recipientId: "recipient_mock_acme" })).toMatchObject({
      name: "Acme Servo Supply (Mock)",
    });
    expect(await callTool("getAccount", { accountId: MERCURY_CHECKING })).toMatchObject({
      id: MERCURY_CHECKING,
    });
    await expect(callTool("getRecipient", { recipientId: "nope" })).rejects.toThrow(/not found/);
  });
});
