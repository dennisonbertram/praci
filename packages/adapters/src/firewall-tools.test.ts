import { BUILTIN_TOOL_NAMES } from "@rakazo/contracts";
import { FIREWALL_ASK_TOOLS, FIREWALL_FREE_TOOLS, firewallToolClass } from "@rakazo/core";
import { describe, expect, it } from "vitest";
import { agentConnectionTools, builtinAgentTools, gtmPostTool } from "./builtin-tools.js";
import { companyAgentTools, companyImporterTools, companyReadTools } from "./company-tools.js";
import { DATA_ROOM_TOOL_NAMES } from "./data-room-tools.js";
import { parseUpdateBotPatch } from "./executor.js";
import { AGENT_SEND_DESCRIPTOR, THREAD_READ_DESCRIPTOR } from "./mcp-agent-tools.js";
import { MEETING_TOOL_NAMES } from "./meeting-tools.js";
import { VOICE_WORKSPACE_TOOL_NAMES, voiceAgentTools } from "./voice-agent-tools.js";

// Every tool name the executor can put in front of a model, from the modules that define them.
const offered = new Set<string>([
  ...BUILTIN_TOOL_NAMES,
  ...[
    ...builtinAgentTools,
    ...agentConnectionTools,
    gtmPostTool,
    ...companyReadTools,
    ...companyAgentTools,
    ...companyImporterTools,
    ...voiceAgentTools,
  ].map((tool) => tool.name),
  AGENT_SEND_DESCRIPTOR.name,
  THREAD_READ_DESCRIPTOR.name,
  ...VOICE_WORKSPACE_TOOL_NAMES,
  ...MEETING_TOOL_NAMES,
  ...DATA_ROOM_TOOL_NAMES,
]);

describe("agent firewall tool classes", () => {
  it("enumerates the real tool sources", () => {
    expect(offered.size).toBeGreaterThan(150);
    for (const name of ["mail_send", "agent_send", "calendar_query", "search_data_room"]) {
      expect(offered.has(name), name).toBe(true);
    }
  });

  it("gives every offered tool exactly one class, and drops the sensitive ones", () => {
    const dropped = [...offered].filter((name) => firewallToolClass(name) === "dropped");
    for (const name of [
      "agent_send",
      "thread_read",
      "calendar_query",
      "timeline_query",
      "search_data_room",
      "meetings_get",
      "search_agent_history",
      "update_bot",
      "save_shared_memory",
      "shell",
      "web_search",
      "run_subagent",
      "spawn_bot",
      "secret_request",
      "request_secret",
      "drive_read",
      "cap_table_read",
    ]) {
      expect(dropped, name).toContain(name);
    }
    expect(dropped.filter((name) => name.startsWith("company_")).length).toBeGreaterThan(0);
    for (const name of dropped.filter((n) => n.startsWith("company_"))) {
      expect(firewallToolClass(name)).toBe("dropped");
    }
  });

  it("only lists tools that exist, so a renamed tool cannot silently fall off a list", () => {
    const listed = [...offered].filter((name) => firewallToolClass(name) !== "dropped");
    const expected = [
      "notify_user",
      "ask_user",
      "mail_get",
      "mail_search",
      "mail_grep",
      "inbox_overview",
      "show_emails",
      "read_history",
      "search_history",
      "mail_send",
      "mail_draft",
      "mail_modify",
      "web_fetch",
      "save_memory",
      "remember",
      "skill_create",
      "skill_update",
      "schedule_create",
      "schedule_update",
      "watch_create",
      "message_bot",
    ];
    for (const name of expected) expect(listed, name).toContain(name);
  });
});

describe("firewall list entries", () => {
  it("exist in the real tool inventory, so a rename or typo fails", () => {
    for (const name of [...FIREWALL_FREE_TOOLS, ...FIREWALL_ASK_TOOLS]) {
      expect(offered.has(name), name).toBe(true);
    }
  });

  it("have their intended class", () => {
    const intended = {
      ask: ["page_write", "page_create", "page_edit"],
      dropped: ["page_source_set", "page_source_remove", "pins_write", "list_secrets"],
      free: ["page_list", "page_read", "pins_read", "scratchpad_add", "mail_get"],
    } as const;
    for (const [cls, names] of Object.entries(intended)) {
      for (const name of names) expect(firewallToolClass(name), name).toBe(cls);
    }
  });
});

describe("update_bot and the firewall flag", () => {
  const update = builtinAgentTools.find((tool) => tool.name === "update_bot");

  it("does not offer a firewall field", () => {
    expect(JSON.stringify(update?.inputSchema)).not.toMatch(/firewall/i);
  });

  it("does not offer a proactivity field, and an agent cannot raise its own level", () => {
    expect(JSON.stringify(update?.inputSchema)).not.toMatch(/proactiv/i);
    const parsed = parseUpdateBotPatch({ proactivity: "high", name: "Ada" }, "Ada");
    expect(parsed).toEqual({
      patch: expect.not.objectContaining({ proactivity: expect.anything() }),
    });
    const only = parseUpdateBotPatch({ proactivity: "high" }, "Ada");
    expect("patch" in only ? Object.keys(only.patch) : []).toEqual([]);
  });

  it("ignores a firewall argument", () => {
    const parsed = parseUpdateBotPatch({ firewall: false, name: "Ada" }, "Ada");
    expect(parsed).toEqual({ patch: expect.not.objectContaining({ firewall: expect.anything() }) });
    const only = parseUpdateBotPatch({ firewall: true }, "Ada");
    // Nothing else was named, so the call changes nothing (an error or an empty patch).
    expect("patch" in only ? Object.keys(only.patch) : []).toEqual([]);
  });

  it("does not offer a permission level, and an agent cannot set its own", () => {
    expect(JSON.stringify(update?.inputSchema)).not.toMatch(/permission/i);
    const only = parseUpdateBotPatch({ permissionLevel: "open" }, "Ada");
    expect("patch" in only ? Object.keys(only.patch) : []).toEqual([]);
  });
});
