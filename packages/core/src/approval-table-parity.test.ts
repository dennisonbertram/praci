import type { ApprovalActionType, PermissionLevel } from "@rakazo/contracts";
import { describe, expect, it } from "vitest";
import {
  ACTION_TYPES,
  ALWAYS_ASK_ACTION_TYPES,
  actionTypeForTool,
  buildApprovalTable,
  resolveActionApproval,
  toolRequiresExplicitApproval,
} from "./action-approval.js";

// One representative tool per action type. The table must show what the gate decides for it.
const TOOLS: Record<ApprovalActionType, { toolName: string; viaConnector?: boolean }> = {
  send_email: { toolName: "mail_send" },
  organize_mail: { toolName: "mail_modify" },
  spend_money: { toolName: "stripe_create_charge", viaConnector: true },
  connected_apps_write: { toolName: "notion_create_page", viaConnector: true },
  calendar_changes: { toolName: "calendar_create_event" },
  files_and_commands: { toolName: "write_file" },
  use_computer: { toolName: "browser_act" },
  delete_data: { toolName: "forget_memory" },
  message_outside: { toolName: "slack_post_message", viaConnector: true },
  use_credentials: { toolName: "request_secret" },
};

const LEVELS: PermissionLevel[] = ["open", "ask_changes", "ask_everything"];
const SAVED = [null, "always_allow", "require_approval", "block"] as const;

describe("approvals table agrees with the gate", () => {
  for (const { id } of ACTION_TYPES) {
    const tool = TOOLS[id];
    for (const level of LEVELS) {
      for (const saved of SAVED) {
        it(`${id} at ${level} with ${saved ?? "no rule"}`, () => {
          expect(actionTypeForTool(tool)).toBe(id);
          // A tool that always asks has no Allow to compare; the gate turns it into Ask.
          const rules = saved
            ? [{ effect: saved, matchKind: "category" as const, matchValue: id, botId: null }]
            : [];
          const gate = resolveActionApproval({ ...tool, rules, level });
          // The executor makes every non-free call ask at Ask for everything, and every call of an
          // always-ask type is a hard line, so a saved Allow asks there too. Block still blocks.
          const expected =
            gate !== "block" && (level === "ask_everything" || ALWAYS_ASK_ACTION_TYPES.has(id))
              ? "ask"
              : gate;
          const row = buildApprovalTable(rules, undefined, level).find(
            (entry) => entry.actionType === id,
          );
          expect(row?.effect).toBe(expected);
          expect(row?.spaceEffect).toBe(expected);
          expect(toolRequiresExplicitApproval(tool.toolName) && expected === "allow").toBe(false);
        });
      }
    }
  }

  it("keeps a bot override that the gate would honour", () => {
    const rules = [
      {
        effect: "always_allow" as const,
        matchKind: "category" as const,
        matchValue: "calendar_changes",
        botId: "b1",
      },
    ];
    const row = buildApprovalTable(rules, "b1", "ask_changes").find(
      (entry) => entry.actionType === "calendar_changes",
    );
    expect(row).toMatchObject({ effect: "allow", spaceEffect: "ask", botEffect: "allow" });
    expect(
      resolveActionApproval({
        ...TOOLS.calendar_changes,
        rules,
        botId: "b1",
        level: "ask_changes",
      }),
    ).toBe("allow");
  });
});
