import type { Actor, Bot } from "@rakazo/contracts";
import { inboxAgentSpawnKey } from "@rakazo/contracts";
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
        description: "Searches your connected mail.",
        notifyOnFinish: true,
      }),
    );
    const input = (createBot.mock.calls[0] as unknown as [Actor, Record<string, unknown>])[1];
    expect(input).not.toHaveProperty("disabledBuiltinTools");
    expect(input).not.toHaveProperty("color");
    // A reply goes out through mail_send, which the user approves on a card before it is sent.
    expect(String(input.instructions)).toContain("call mail_send");
    expect(String(input.instructions)).toContain("approves, edits or discards it");
    expect(String(input.instructions)).not.toContain("not send");
  });
});
