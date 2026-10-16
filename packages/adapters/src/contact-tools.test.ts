import { cartaAgentSpawnKey, financeAgentSpawnKey } from "@rakazo/contracts";
import { describe, expect, it } from "vitest";
import { CONTACT_TOOL_NAMES, contactToolsAllowed } from "./contact-tools.js";
import { selectBuiltinToolsForRun } from "./executor.js";

describe("contact tools", () => {
  const base = {
    hasProvider: true,
    groupId: null,
    runUserId: "u",
    botUserId: "u",
    botSpawnKey: cartaAgentSpawnKey("u"),
    trigger: "user",
    messagingChannelRun: false,
  };

  it("are for the Carta agent's owner-initiated runs only", () => {
    expect(contactToolsAllowed(base)).toBe(true);
    expect(contactToolsAllowed({ ...base, trigger: "routine" })).toBe(true);
    expect(contactToolsAllowed({ ...base, botSpawnKey: null })).toBe(false);
    expect(contactToolsAllowed({ ...base, botSpawnKey: financeAgentSpawnKey("u") })).toBe(false);
    expect(contactToolsAllowed({ ...base, trigger: "bot_message" })).toBe(false);
    expect(contactToolsAllowed({ ...base, groupId: "g" })).toBe(false);
    expect(contactToolsAllowed({ ...base, runUserId: "other" })).toBe(false);
  });

  it("are offered only when enabled", () => {
    const offered = (contactsEnabled: boolean) =>
      selectBuiltinToolsForRun({
        graphicalToolsAllowed: false,
        pageBrowserAllowed: false,
        groupId: null,
        trigger: "message",
        semanticMemoryEnabled: false,
        messagingChannelRun: false,
        contactsEnabled,
      })
        .map((tool) => tool.name)
        .filter((name) => CONTACT_TOOL_NAMES.has(name))
        .sort();
    expect(offered(false)).toEqual([]);
    expect(offered(true)).toEqual(["contacts_list", "contacts_save"]);
  });
});
