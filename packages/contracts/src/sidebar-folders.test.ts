import { describe, expect, it } from "vitest";
import { cartaAgentSpawnKey } from "./carta.js";
import { dataRoomAgentSpawnKey } from "./data-room.js";
import { financeAgentSpawnKey } from "./finance.js";
import { inboxAgentSpawnKey } from "./inbox.js";
import { integrationAgentSpawnKey } from "./integration-agent.js";
import { legalAgentSpawnKey } from "./legal.js";
import { autoGroupFolderName } from "./sidebar-folders.js";

describe("autoGroupFolderName", () => {
  it("files page agents in Workspace, integration agents in Apps, other bots in Agents", () => {
    const bot = (spawnKey: string | null) => autoGroupFolderName({ kind: "bot", spawnKey });
    expect(bot(inboxAgentSpawnKey("u"))).toBe("Workspace");
    expect(bot(financeAgentSpawnKey("u"))).toBe("Workspace");
    expect(bot(legalAgentSpawnKey("u"))).toBe("Workspace");
    expect(bot(dataRoomAgentSpawnKey("u"))).toBe("Workspace");
    expect(bot(cartaAgentSpawnKey("u"))).toBe("Workspace");
    expect(bot(integrationAgentSpawnKey("mercury"))).toBe("Apps");
    expect(bot("onboarding:first")).toBe("Agents");
    expect(bot(null)).toBe("Agents");
  });

  it("files groups in Groups", () => {
    expect(autoGroupFolderName({ kind: "group" })).toBe("Groups");
  });
});
