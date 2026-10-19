import { BUILTIN_TOOL_NAMES } from "@rakazo/contracts";
import { toolRequiresApproval, unattendedTriggerToolRequiresApproval } from "@rakazo/core";
import { describe, expect, it } from "vitest";
import {
  DATA_ROOM_GUIDANCE,
  DATA_ROOM_TOOL_NAMES,
  dataRoomToolsAllowed,
  isNotADocument,
} from "./data-room-tools.js";
import {
  PLAIN_CAPABILITY_GUIDANCE,
  READ_ONLY_AGENT_TOOLS,
  selectBuiltinToolsForRun,
  userTurnInstructions,
} from "./executor.js";

const run = {
  graphicalToolsAllowed: false,
  pageBrowserAllowed: false,
  groupId: null,
  trigger: "message",
  semanticMemoryEnabled: false,
  messagingChannelRun: false,
};

describe("Data room tool gate", () => {
  const owner = {
    hasProvider: true,
    groupId: null,
    runUserId: "user-1",
    botUserId: "user-1",
    messagingChannelRun: false,
    trigger: "user",
  };

  it("allows the bot owner in a direct thread, on a run the owner started", () => {
    for (const trigger of ["user", "follow_up", "routine"]) {
      expect(dataRoomToolsAllowed({ ...owner, trigger })).toBe(true);
    }
  });

  it("refuses a bot_message run: another agent asked, under the owner's id", () => {
    expect(dataRoomToolsAllowed({ ...owner, trigger: "bot_message" })).toBe(false);
  });

  it.each([
    ["the thread is a group", { groupId: "group-1" }],
    ["someone other than the bot owner started the run", { runUserId: "user-2" }],
    ["the run answers a messaging channel", { messagingChannelRun: true }],
  ])("refuses when %s", (_label, change) => {
    expect(dataRoomToolsAllowed({ ...owner, ...change } as typeof owner)).toBe(false);
  });
});

describe("Data room tool lists", () => {
  const offered = (dataRoomEnabled: boolean, disabledBuiltinTools?: string[]) =>
    selectBuiltinToolsForRun({ ...run, dataRoomEnabled, disabledBuiltinTools })
      .map((tool) => tool.name)
      .filter((name) => DATA_ROOM_TOOL_NAMES.has(name))
      .sort();

  it("offers the three tools only when the Data room is enabled, and honours the per-bot switch", () => {
    expect(offered(false)).toEqual([]);
    expect(offered(true)).toEqual(["add_to_data_room", "read_data_room_item", "search_data_room"]);
    expect(offered(true, ["add_to_data_room"])).toEqual([
      "read_data_room_item",
      "search_data_room",
    ]);
  });

  it("lists the names for the per-bot disable setting", () => {
    for (const name of DATA_ROOM_TOOL_NAMES) expect(BUILTIN_TOOL_NAMES).toContain(name);
  });

  it("runs the tools unattended without approval, and records only the writing one", () => {
    for (const name of DATA_ROOM_TOOL_NAMES) {
      expect(toolRequiresApproval(name, false)).toBe(false);
      expect(unattendedTriggerToolRequiresApproval("webhook", name, false)).toBe(false);
    }
    expect(READ_ONLY_AGENT_TOOLS.has("search_data_room")).toBe(true);
    expect(READ_ONLY_AGENT_TOOLS.has("read_data_room_item")).toBe(true);
    expect(READ_ONLY_AGENT_TOOLS.has("add_to_data_room")).toBe(false);
  });
});

describe("Data room guidance", () => {
  const instructions = (extra: { dataRoomEnabled?: boolean; disabled?: string[] }) =>
    userTurnInstructions({
      botInstructions: "Bot",
      computerInstruction: "Computer",
      pageBrowserAllowed: false,
      workspaceInstruction: "Home",
      replyGuidance: "Reply",
      groupContext: undefined,
      messagingContext: undefined,
      redactedMemoryContext: undefined,
      redactedScratchpadContext: undefined,
      hasHistoricalContext: false,
      agentEnvironmentInstruction: undefined,
      botDirectory: undefined,
      pluginLine: undefined,
      agentSkillsLine: undefined,
      taughtSkillsLine: undefined,
      dataRoomEnabled: extra.dataRoomEnabled,
      disabledBuiltinTools: new Set(extra.disabled ?? []),
    });

  it("tells every agent to describe its abilities in plain words", () => {
    expect(instructions({})).toContain(PLAIN_CAPABILITY_GUIDANCE);
    expect(PLAIN_CAPABILITY_GUIDANCE).toContain("never as raw tool names");
  });

  it("appears only when add_to_data_room is offered", () => {
    expect(instructions({ dataRoomEnabled: true })).toContain(DATA_ROOM_GUIDANCE);
    expect(instructions({})).not.toContain(DATA_ROOM_GUIDANCE);
    expect(instructions({ dataRoomEnabled: true, disabled: ["add_to_data_room"] })).not.toContain(
      DATA_ROOM_GUIDANCE,
    );
  });
});

describe("isNotADocument", () => {
  const file = (mimeType: string, size: number, name = "file") => ({ mimeType, size, name });
  it("skips small images, calendar invites and contact cards", () => {
    expect(isNotADocument(file("image/png", 20 * 1024 - 1))).toBe(true);
    expect(isNotADocument(file("text/calendar", 5000))).toBe(true);
    expect(isNotADocument(file("text/x-vcard", 5000))).toBe(true);
    expect(isNotADocument(file("application/octet-stream", 5000, "invite.ics"))).toBe(true);
    expect(isNotADocument(file("application/octet-stream", 5000, "Card.VCF"))).toBe(true);
  });
  it("keeps images of 20 KB or more and ordinary documents", () => {
    expect(isNotADocument(file("image/png", 20 * 1024))).toBe(false);
    expect(isNotADocument(file("application/pdf", 10))).toBe(false);
  });
});
