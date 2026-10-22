import type { Actor, Bot } from "@rakazo/contracts";
import { inboxAgentSpawnKey, pageAgentColor } from "@rakazo/contracts";
import { describe, expect, it, vi } from "vitest";
import { ensureInboxAgent } from "./inbox-agent.js";

const actor: Actor = {
  userId: "user-1",
  spaceId: "space-1",
  email: "user-1@rakazo.test",
  isDeploymentOwner: false,
};

describe("ensureInboxAgent", () => {
  it("creates the bot only through createBot, keyed by the helper and the session actor", async () => {
    const bot = { id: "bot-1" } as Bot;
    const createBot = vi.fn(async () => bot);

    await expect(ensureInboxAgent({ createBot }, actor)).resolves.toBe(bot);

    expect(createBot).toHaveBeenCalledTimes(1);
    expect(createBot).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({
        spawnKey: inboxAgentSpawnKey("user-1"),
        name: "Inbox agent",
        title: "",
        description: "Reads your mail, finds what needs a reply and writes replies.",
        notifyOnFinish: true,
      }),
    );
    const input = (createBot.mock.calls[0] as unknown as [Actor, Record<string, unknown>])[1];
    expect(input).not.toHaveProperty("disabledBuiltinTools");
    expect(input.color).toBe(pageAgentColor("inbox"));
    // A reply goes out through mail_send, which the user approves on a card before it is sent.
    expect(String(input.instructions)).toContain("call mail_send");
    expect(String(input.instructions)).toContain("approves, edits or discards it");
    expect(String(input.instructions)).not.toContain("not send");
    // A reply keeps the message's Cc, counts match the Inbox, and times are never shown in UTC.
    expect(String(input.instructions)).toContain("every other To and Cc recipient");
    expect(String(input.instructions)).toContain("give its full count");
    expect(String(input.instructions)).toContain('first sentence is "I could not read');
    expect(String(input.instructions)).toContain("never quote a clock time");
  });
});
