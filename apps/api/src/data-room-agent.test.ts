import type { Actor, Bot } from "@rakazo/contracts";
import {
  DATA_ROOM_AGENT_BUILTIN_TOOLS,
  dataRoomAgentSpawnKey,
  pageAgentColor,
} from "@rakazo/contracts";
import { describe, expect, it, vi } from "vitest";
import { ensureDataRoomAgent } from "./data-room-agent.js";

const actor: Actor = {
  userId: "user-1",
  spaceId: "space-1",
  email: "user-1@rakazo.test",
  isDeploymentOwner: false,
};

describe("ensureDataRoomAgent", () => {
  it("creates the bot only through createBot, keyed by the user's spawn key", async () => {
    const bot = { id: "bot-1" } as Bot;
    const createBot = vi.fn(async () => bot);

    await expect(ensureDataRoomAgent({ repos: { createBot } }, actor)).resolves.toBe(bot);

    expect(dataRoomAgentSpawnKey("user-1")).toBe("data-room-agent:user-1");
    expect(createBot).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({
        spawnKey: "data-room-agent:user-1",
        name: "Data room agent",
        instructions: expect.stringContaining("markdown link"),
        color: pageAgentColor("data-room"),
      }),
    );
  });

  it("offers no delete, move or connector tool", () => {
    expect(DATA_ROOM_AGENT_BUILTIN_TOOLS).toEqual(
      expect.arrayContaining(["search_data_room", "read_data_room_item", "add_to_data_room"]),
    );
    for (const name of DATA_ROOM_AGENT_BUILTIN_TOOLS) {
      expect(name).not.toMatch(/delete|remove|move|rename|trash/);
    }
  });
});
