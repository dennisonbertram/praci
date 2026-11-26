import { describe, expect, it } from "vitest";
import type { ActionApprovalRule, ActionApprovalSource } from "./action-approval.js";
import {
  ACTION_TYPES,
  actionTypeForTool,
  applyJudgeDecision,
  backgroundAutoReviewAllowed,
  botAllowsAllSites,
  buildApprovalTable,
  connectorKindFromToolName,
  connectorReadRequiresApproval,
  connectorToolRequiresApproval,
  contentHasOutboundChannel,
  EXTERNAL_TAINT_SAFE_TOOLS,
  externalTaintAllowsTool,
  hardLineFor,
  isApprovalAskBlock,
  isBackgroundExcludedTool,
  isSecretAskBlock,
  mailModifyTouchesFixedLabel,
  newSiteOutcome,
  outboundSiteGate,
  pageWriteAddsChannel,
  planActionGate,
  privateDataAreas,
  ROUTINE_AUTO_REVIEW_READ_TOOLS,
  resolveActionApproval,
  resolveActionApprovalDetail,
  routineAlwaysAllowable,
  toolRequiresApproval,
  toolRequiresExplicitApproval,
  toolResultTaintsRun,
  toolRuleAllowsAllow,
  unattendedToolRequiresApproval,
  unattendedTriggerToolRequiresApproval,
} from "./action-approval.js";

describe("toolRequiresApproval", () => {
  it("requires approval for consequential builtins and destination writes", () => {
    expect(toolRequiresApproval("destination.write", false)).toBe(true);
    expect(toolRequiresApproval("destination.write", true)).toBe(true);
    expect(toolRequiresApproval("secret_request", false)).toBe(true);
    expect(toolRequiresApproval("forget_secret", false)).toBe(true);
    expect(toolRequiresApproval("forget_memory", false)).toBe(true);
    expect(toolRequiresApproval("list_secrets", false)).toBe(false);
    expect(toolRequiresApproval("delete_bot", false)).toBe(true);
    expect(toolRequiresApproval("archive_bot", false)).toBe(true);
    expect(toolRequiresApproval("cloud_agent_launch", false)).toBe(true);
    expect(toolRequiresApproval("create_space", false)).toBe(true);
    expect(toolRequiresApproval("contacts_save", false)).toBe(true);
    expect(toolRequiresApproval("contacts_add", false)).toBe(false);
    expect(toolRequiresApproval("fundraising_round_save", false)).toBe(true);
    expect(toolRequiresApproval("pipeline_import_review", false)).toBe(true);
    // Staging holds rows and changes nothing else.
    expect(toolRequiresApproval("pipeline_import_stage", false)).toBe(false);
    // No saved Allow rule or Auto Review may pass them: the executor's mandatory gate follows this.
    expect(toolRequiresExplicitApproval("fundraising_round_save")).toBe(true);
    expect(toolRequiresExplicitApproval("pipeline_import_review")).toBe(true);
    expect(toolRequiresApproval("cap_table_update", false)).toBe(false);
    expect(toolRequiresExplicitApproval("contacts_save")).toBe(false);
    expect(toolRequiresExplicitApproval("create_space")).toBe(true);
    expect(toolRequiresExplicitApproval("imessage_send")).toBe(true);
    expect(toolRequiresExplicitApproval("imessage_read")).toBe(false);
    expect(toolRequiresExplicitApproval("save_shared_memory")).toBe(false);
    expect(toolRequiresExplicitApproval("archive_bot")).toBe(false);
  });

  it("does not gate read-only or local work", () => {
    for (const name of [
      "list_files",
      "computer_observe",
      "read_file",
      "write_file",
      "shell",
      "remember",
      "save_shared_memory",
      "spawn_bot",
      "run_subagent",
    ]) {
      expect(toolRequiresApproval(name, false)).toBe(false);
    }
  });

  it("gates connector executes except obvious reads", () => {
    expect(toolRequiresApproval("gmail_send_email", true)).toBe(true);
    expect(toolRequiresApproval("crm_create_note", true)).toBe(true);
    expect(toolRequiresApproval("get_contact", true)).toBe(false);
    expect(toolRequiresApproval("contacts_get", true)).toBe(false);
    expect(toolRequiresApproval("GMAIL_LIST_THREADS", true)).toBe(false);
    expect(toolRequiresApproval("list_messages", true)).toBe(false);
    expect(toolRequiresApproval("search_threads", true)).toBe(false);
    expect(toolRequiresApproval("find_user", true)).toBe(false);
    expect(toolRequiresApproval("read_inbox", true)).toBe(false);
    expect(toolRequiresApproval("contacts_get_or_create", true)).toBe(true);
    expect(toolRequiresApproval("notion_search_and_update", true)).toBe(true);
    expect(toolRequiresApproval("crm_get_then_upsert", true)).toBe(true);
  });
});

describe("connectorToolRequiresApproval", () => {
  it("matches read-only connector tool names", () => {
    expect(connectorToolRequiresApproval("list_items")).toBe(false);
    expect(connectorToolRequiresApproval("send_message")).toBe(true);
  });

  it("requires approval for a declared write whatever its name says", () => {
    expect(connectorToolRequiresApproval("read_profile_card", false)).toBe(true);
    expect(connectorToolRequiresApproval("find_validator_record", false)).toBe(true);
    expect(connectorToolRequiresApproval("read_profile_card", true)).toBe(false);
    expect(connectorToolRequiresApproval("read_profile_card")).toBe(false);
  });

  it("never lets a declared read relax a mutating or ambiguous name", () => {
    expect(connectorToolRequiresApproval("delete_item", true)).toBe(true);
    expect(connectorToolRequiresApproval("get_or_create_contact", true)).toBe(true);
    expect(connectorToolRequiresApproval("profile_card", true)).toBe(true);
  });
});

describe("resolveActionApprovalDetail", () => {
  it("applies category rules to declared writes with read-looking names", () => {
    const rules = [
      { effect: "require_approval" as const, matchKind: "category" as const, matchValue: "email" },
    ];
    const base = { toolName: "gmail_read_thread", connectorKind: "gmail", rules };
    expect(resolveActionApprovalDetail(base).decision).toBe("allow");
    expect(resolveActionApprovalDetail({ ...base, readOnly: false }).decision).toBe("ask");
  });
});

describe("unattendedTriggerToolRequiresApproval", () => {
  it("forces approval for webhook-triggered local side effects", () => {
    for (const name of ["shell", "write_file", "browser_act", "computer_act"]) {
      expect(unattendedTriggerToolRequiresApproval("webhook", name, false)).toBe(true);
    }
  });

  it("allows webhook-triggered reads to stay unattended", () => {
    for (const name of [
      "computer_observe",
      "read_file",
      "web_search",
      "browser_snapshot",
      "request_takeover",
      "run_subagent",
    ]) {
      expect(unattendedTriggerToolRequiresApproval("webhook", name, false)).toBe(false);
    }
    expect(unattendedTriggerToolRequiresApproval("webhook", "github_get_issue", true)).toBe(false);
  });

  it("forces approval for webhook-triggered connector writes regardless of normal rules", () => {
    expect(unattendedTriggerToolRequiresApproval("webhook", "github_create_issue", true)).toBe(
      true,
    );
    expect(unattendedTriggerToolRequiresApproval("user", "shell", false)).toBe(false);
  });

  it("forces approval for webhook-triggered declared writes with read-looking names", () => {
    for (const name of ["read_profile_card", "find_validator_record", "get_status"]) {
      expect(unattendedTriggerToolRequiresApproval("webhook", name, true, false)).toBe(true);
      expect(toolRequiresApproval(name, true, false)).toBe(true);
    }
    expect(unattendedTriggerToolRequiresApproval("webhook", "read_profile_card", true, true)).toBe(
      false,
    );
    expect(unattendedTriggerToolRequiresApproval("webhook", "delete_record", true, true)).toBe(
      true,
    );
    expect(unattendedTriggerToolRequiresApproval("user", "read_profile_card", true, false)).toBe(
      false,
    );
  });
});

describe("isApprovalAskBlock", () => {
  it("detects allow/deny approval cards", () => {
    expect(
      isApprovalAskBlock({
        kind: "ask",
        approvalEffectId: "effect-1",
        actions: [
          { id: "allow", label: "Allow once" },
          { id: "always", label: "Always allow" },
          { id: "deny", label: "Deny" },
        ],
      }),
    ).toBe(true);
    expect(isApprovalAskBlock({ kind: "ask" })).toBe(false);
    expect(
      isApprovalAskBlock({
        kind: "ask",
        approvalEffectId: "effect-1",
        actions: [{ id: "deny", label: "No" }],
      }),
    ).toBe(false);
  });
});

describe("isSecretAskBlock", () => {
  it("detects masked secret asks", () => {
    expect(isSecretAskBlock({ kind: "ask", input: "secret" })).toBe(true);
    expect(isSecretAskBlock({ kind: "ask", input: "text" })).toBe(false);
    expect(
      isSecretAskBlock({
        kind: "ask",
        input: "secret",
        approvalEffectId: "effect-1",
      }),
    ).toBe(false);
  });
});

describe("connectorKindFromToolName", () => {
  it("uses the first underscore segment", () => {
    expect(connectorKindFromToolName("gmail_send_email")).toBe("gmail");
  });

  it("prefers the longest matching connected provider slug", () => {
    expect(
      connectorKindFromToolName("microsoft_outlook_send_email", ["microsoft", "microsoft_outlook"]),
    ).toBe("microsoft_outlook");
  });
});

describe("resolveActionApproval", () => {
  const alwaysAllowDestination: ActionApprovalRule[] = [
    { effect: "always_allow", matchKind: "tool", matchValue: "destination.write" },
  ];
  const requireEmail: ActionApprovalRule[] = [
    { effect: "require_approval", matchKind: "category", matchValue: "email" },
  ];
  const requireDestination: ActionApprovalRule[] = [
    { effect: "require_approval", matchKind: "tool", matchValue: "destination.write" },
  ];

  it("skips approval when always-allow matches", () => {
    expect(
      resolveActionApproval({
        toolName: "destination.write",
        rules: alwaysAllowDestination,
      }),
    ).toBe("allow");
  });

  it("requires approval for email even when always-allow would match another tool", () => {
    expect(
      resolveActionApproval({
        toolName: "gmail_send_email",
        rules: [...alwaysAllowDestination, ...requireEmail],
      }),
    ).toBe("ask");
  });

  it("applies the email category to the built-in mail write tools", () => {
    for (const toolName of ["mail_draft", "mail_send"])
      expect(resolveActionApproval({ toolName, rules: requireEmail })).toBe("ask");
    // Organizing mail is its own type, so the email category no longer covers it.
    expect(resolveActionApproval({ toolName: "mail_modify", rules: requireEmail })).toBe("allow");
    expect(resolveActionApproval({ toolName: "mail_read", rules: requireEmail })).toBe("allow");
  });

  it("does not apply consequential categories to connector reads", () => {
    expect(
      resolveActionApproval({
        toolName: "gmail_list_threads",
        rules: requireEmail,
      }),
    ).toBe("allow");
  });

  it("lets an explicit rule gate a tool that is exempt by default", () => {
    expect(
      resolveActionApproval({
        toolName: "shell",
        rules: [{ effect: "require_approval", matchKind: "tool", matchValue: "shell" }],
      }),
    ).toBe("ask");
  });

  it("lets require_approval beat always-allow at the same specificity", () => {
    expect(
      resolveActionApproval({
        toolName: "destination.write",
        rules: [...alwaysAllowDestination, ...requireDestination],
      }),
    ).toBe("ask");
  });

  it("allows actions by default when no rules match", () => {
    expect(
      resolveActionApproval({
        toolName: "list_files",
        rules: [],
      }),
    ).toBe("allow");
    expect(resolveActionApproval({ toolName: "remember", rules: [] })).toBe("allow");
  });

  it("lets a tool exception override a broader category rule", () => {
    expect(
      resolveActionApproval({
        toolName: "gmail_send_email",
        rules: [
          ...requireEmail,
          { effect: "always_allow", matchKind: "tool", matchValue: "gmail_send_email" },
        ],
      }),
    ).toBe("allow");
  });

  it("labels always-allow vs default allow", () => {
    expect(
      resolveActionApprovalDetail({
        toolName: "destination.write",
        rules: alwaysAllowDestination,
      }),
    ).toMatchObject({ decision: "allow", source: "always_allow" });
    expect(
      resolveActionApprovalDetail({
        toolName: "remember",
        rules: [],
      }),
    ).toMatchObject({ decision: "allow", source: "default" });
  });
});

describe("planActionGate", () => {
  const consequential = true;

  it("never plans Auto Review for a goal run", () => {
    const base = { consequential, autoReviewEnabled: true, checkerConfigured: true, goalRun: true };
    for (const source of ["default", "action_type_default"] as const) {
      for (const decision of ["allow", "ask"] as const) {
        expect(planActionGate({ ...base, resolved: { decision, source, matchingRules: [] } })).toBe(
          decision,
        );
      }
    }
    // A new site asks instead of going to the judge.
    expect(
      planActionGate({
        ...base,
        resolved: { decision: "allow", source: "default", matchingRules: [] },
        newDestination: true,
      }),
    ).toBe("ask");
    // The same call in an owner run is still judged.
    expect(
      planActionGate({
        ...base,
        goalRun: false,
        resolved: { decision: "allow", source: "default", matchingRules: [] },
      }),
    ).toBe("judge");
  });

  it("lets require_approval win without judging", () => {
    expect(
      planActionGate({
        resolved: {
          decision: "ask",
          source: "require_approval",
          matchingRules: [],
        },
        consequential,
        autoReviewEnabled: true,
        checkerConfigured: true,
      }),
    ).toBe("ask");
  });

  it("lets always_allow skip the judge", () => {
    expect(
      planActionGate({
        resolved: {
          decision: "allow",
          source: "always_allow",
          matchingRules: [],
        },
        consequential,
        autoReviewEnabled: true,
        checkerConfigured: true,
      }),
    ).toBe("allow");
  });

  it("judges consequential default actions when auto review is ready", () => {
    expect(
      planActionGate({
        resolved: { decision: "allow", source: "default", matchingRules: [] },
        consequential,
        autoReviewEnabled: true,
        checkerConfigured: true,
      }),
    ).toBe("judge");
  });

  it("asks when auto review is off or checker missing", () => {
    expect(
      planActionGate({
        resolved: { decision: "allow", source: "default", matchingRules: [] },
        consequential,
        autoReviewEnabled: false,
        checkerConfigured: true,
      }),
    ).toBe("ask");
    expect(
      planActionGate({
        resolved: { decision: "allow", source: "default", matchingRules: [] },
        consequential,
        autoReviewEnabled: true,
        checkerConfigured: false,
      }),
    ).toBe("ask");
  });

  it("sends a new site to Auto Review, even with a rule for the whole tool", () => {
    const gate = (source: "default" | "always_allow") =>
      planActionGate({
        resolved: { decision: "allow", source, matchingRules: [] },
        consequential,
        autoReviewEnabled: true,
        checkerConfigured: true,
        newDestination: true,
      });
    expect(gate("default")).toBe("judge");
    expect(gate("always_allow")).toBe("judge");
  });

  it("asks before a new site when Auto Review is off or has no checker", () => {
    for (const [autoReviewEnabled, checkerConfigured] of [
      [false, true],
      [true, false],
    ] as const) {
      expect(
        planActionGate({
          resolved: { decision: "allow", source: "always_allow", matchingRules: [] },
          consequential,
          autoReviewEnabled,
          checkerConfigured,
          newDestination: true,
        }),
      ).toBe("ask");
    }
  });

  it("asks about a new site in an unattended run, which never plans a judge", () => {
    expect(
      planActionGate({
        resolved: { decision: "allow", source: "default", matchingRules: [] },
        consequential,
        autoReviewEnabled: true,
        checkerConfigured: true,
        unattended: true,
        newDestination: true,
      }),
    ).toBe("ask");
  });

  it("lets a require_approval rule ask about a new site without judging", () => {
    expect(
      planActionGate({
        resolved: { decision: "ask", source: "require_approval", matchingRules: [] },
        consequential,
        autoReviewEnabled: true,
        checkerConfigured: true,
        newDestination: true,
      }),
    ).toBe("ask");
  });

  it("does not judge non-consequential tools", () => {
    expect(
      planActionGate({
        resolved: { decision: "allow", source: "default", matchingRules: [] },
        consequential: false,
        autoReviewEnabled: true,
        checkerConfigured: true,
      }),
    ).toBe("allow");
  });
});

describe("applyJudgeDecision", () => {
  it("maps pass and ask", () => {
    expect(applyJudgeDecision({ decision: "pass", consequential: true })).toBe("allow");
    expect(applyJudgeDecision({ decision: "ask", consequential: true })).toBe("ask");
  });

  it("fails closed on consequential checker errors and open on exempt", () => {
    expect(applyJudgeDecision({ decision: "error", consequential: true })).toBe("ask");
    expect(applyJudgeDecision({ decision: "error", consequential: false })).toBe("allow");
  });
});

describe("newSiteOutcome", () => {
  it("allows a new site Auto Review passed, in any run", () => {
    for (const trigger of ["user", "routine", "webhook"]) {
      expect(newSiteOutcome({ trigger, decision: "allow" })).toBe("allow");
    }
  });

  it("asks a person about a new site that was not passed", () => {
    for (const trigger of ["user", "follow_up", "routine", "messaging"]) {
      expect(newSiteOutcome({ trigger, decision: "ask" })).toBe("ask");
    }
  });

  it("refuses it in a webhook run, which has nobody to ask", () => {
    expect(newSiteOutcome({ trigger: "webhook", decision: "ask" })).toBe("deny");
  });
});

describe("mail write tools", () => {
  it.each(["mail_draft", "mail_modify", "mail_send"])(
    "%s needs approval, also on an unattended run",
    (name) => {
      expect(toolRequiresApproval(name, false)).toBe(true);
      // mail_modify is reversible and cannot send or delete, so an unattended run follows its rules.
      expect(unattendedTriggerToolRequiresApproval("webhook", name, false)).toBe(
        name !== "mail_modify",
      );
      expect(toolRequiresExplicitApproval(name)).toBe(false);
    },
  );
});

describe("calendar write tools", () => {
  it.each(["calendar_create_event", "calendar_update_event", "calendar_delete_event"])(
    "%s needs approval, also on an unattended run",
    (name) => {
      expect(toolRequiresApproval(name, false)).toBe(true);
      expect(unattendedTriggerToolRequiresApproval("webhook", name, false)).toBe(true);
    },
  );
});

describe("drive write tools", () => {
  it.each(["drive_create_file", "drive_update_file"])("%s needs approval", (name) => {
    expect(toolRequiresApproval(name, false)).toBe(true);
    expect(unattendedTriggerToolRequiresApproval("webhook", name, false)).toBe(true);
  });
  it.each(["drive_search", "drive_read"])("%s does not", (name) => {
    expect(toolRequiresApproval(name, false)).toBe(false);
  });
});

const rule = (
  effect: "always_allow" | "require_approval" | "block",
  matchKind: "tool" | "connector" | "category",
  matchValue: string,
  botId: string | null = null,
) => ({ effect, matchKind, matchValue, botId });

describe("actionTypeForTool", () => {
  it.each([
    ["mail_send", false, "send_email"],
    ["mail_draft", false, "send_email"],
    ["mail_modify", false, "organize_mail"],
    ["calendar_create_event", false, "calendar_changes"],
    ["calendar_delete_event", false, "calendar_changes"],
    ["write_file", false, "files_and_commands"],
    ["shell", false, "files_and_commands"],
    ["open_path", false, "files_and_commands"],
    ["launch_app", false, "files_and_commands"],
    ["computer_act", false, "use_computer"],
    ["browser_act", false, "use_computer"],
    ["browser_navigate", false, "use_computer"],
    ["delete_bot", false, "delete_data"],
    ["forget_memory", false, "delete_data"],
    ["forget_secret", false, "delete_data"],
    ["imessage_send", false, "message_outside"],
    ["secret_request", false, "use_credentials"],
    ["fill_secret", false, "use_credentials"],
    ["drive_create_file", false, "connected_apps_write"],
    ["gmail_send_email", true, "send_email"],
    ["stripe_create_charge", true, "spend_money"],
    ["mcp__finance-mercury__requestSendMoney", true, "spend_money"],
    ["googlecalendar_create_event", true, "calendar_changes"],
    ["slack_post_message", true, "message_outside"],
    ["github_delete_branch", true, "delete_data"],
    ["github_create_issue", true, "connected_apps_write"],
  ] as const)("%s (connector %s) is %s", (toolName, viaConnector, expected) => {
    expect(actionTypeForTool({ toolName, viaConnector })).toBe(expected);
  });

  it("maps read-only tools to no action type", () => {
    expect(actionTypeForTool({ toolName: "read_file" })).toBeNull();
    expect(actionTypeForTool({ toolName: "github_get_issue", viaConnector: true })).toBeNull();
    expect(
      actionTypeForTool({ toolName: "github_get_issue", viaConnector: true, readOnly: false }),
    ).toBe("connected_apps_write");
  });

  it("does not let a readOnly hint hide a mutating connector tool", () => {
    expect(
      actionTypeForTool({ toolName: "gmail_send_email", viaConnector: true, readOnly: true }),
    ).toBe("send_email");
    expect(
      actionTypeForTool({ toolName: "GMAIL_FETCH_EMAILS", viaConnector: true, readOnly: true }),
    ).toBeNull();
    expect(
      resolveActionApprovalDetail({
        toolName: "gmail_send_email",
        viaConnector: true,
        readOnly: true,
        rules: [
          {
            matchKind: "category",
            matchValue: "send_email",
            effect: "block",
            botId: null,
          },
        ],
      } as never).decision,
    ).toBe("block");
  });

  it("classifies namespaced MCP money tools for the spend-money rule", () => {
    for (const toolName of [
      "mcp__finance-mercury__requestSendMoney",
      "mcp__demo__requestSendMoney",
      "requestSendMoney",
    ]) {
      const call = { toolName, viaConnector: true, readOnly: true };
      expect(actionTypeForTool(call)).toBe("spend_money");
      expect(hardLineFor(call)).toBe("money");
      expect(
        resolveActionApprovalDetail({
          ...call,
          rules: [rule("block", "category", "spend_money")],
        }),
      ).toMatchObject({ decision: "block", source: "block" });
    }
  });

  it("keeps legacy Connected apps Blocks for payments without extending its Allow", () => {
    const call = {
      toolName: "mcp__finance-mercury__requestSendMoney",
      viaConnector: true,
      readOnly: true,
    };
    expect(
      resolveActionApprovalDetail({
        ...call,
        rules: [rule("block", "category", "connected_apps_write")],
      }),
    ).toMatchObject({ decision: "block", source: "block" });
    expect(
      resolveActionApprovalDetail({
        ...call,
        rules: [rule("always_allow", "category", "connected_apps_write")],
      }),
    ).toMatchObject({ decision: "ask", source: "action_type_default" });
    expect(
      resolveActionApprovalDetail({
        ...call,
        rules: [
          rule("block", "category", "connected_apps_write"),
          rule("always_allow", "category", "spend_money"),
        ],
      }),
    ).toMatchObject({ decision: "block", source: "block" });
  });

  it("uses a connector amount argument for the Spend money category", () => {
    const call = {
      toolName: "acme_create_record",
      viaConnector: true,
      args: { amount: 300 },
    };
    expect(actionTypeForTool(call)).toBe("spend_money");
    expect(
      resolveActionApprovalDetail({
        ...call,
        rules: [rule("block", "category", "spend_money")],
      }),
    ).toMatchObject({ decision: "block", source: "block" });
  });

  it("lists the ten action types, five shown by default", () => {
    expect(ACTION_TYPES.map((type) => type.id)).toHaveLength(10);
    expect(ACTION_TYPES.filter((type) => type.primary)).toHaveLength(5);
    expect(ACTION_TYPES.find((type) => type.id === "files_and_commands")?.defaultEffect).toBe(
      "allow",
    );
  });
});

describe("block rules and per-bot rules", () => {
  const gmail = { toolName: "gmail_send_email", connectorKind: "gmail", viaConnector: true };

  it("block beats ask beats allow at equal specificity", () => {
    expect(
      resolveActionApprovalDetail({
        ...gmail,
        rules: [rule("always_allow", "category", "send_email"), rule("block", "category", "email")],
      }),
    ).toMatchObject({ decision: "block", source: "block" });
    expect(
      resolveActionApprovalDetail({
        ...gmail,
        rules: [
          rule("always_allow", "category", "send_email"),
          rule("require_approval", "category", "email"),
        ],
      }),
    ).toMatchObject({ decision: "ask", source: "require_approval" });
  });

  it("a more specific rule still wins over a block", () => {
    expect(
      resolveActionApproval({
        ...gmail,
        rules: [
          rule("block", "category", "send_email"),
          rule("always_allow", "tool", "gmail_send_email"),
        ],
      }),
    ).toBe("allow");
  });

  it("a bot rule beats a space rule at any specificity", () => {
    const rules = [
      rule("always_allow", "tool", "gmail_send_email"),
      rule("block", "category", "send_email", "bot-1"),
    ];
    expect(resolveActionApproval({ ...gmail, rules, botId: "bot-1" })).toBe("block");
    expect(resolveActionApproval({ ...gmail, rules, botId: "bot-2" })).toBe("allow");
    expect(resolveActionApproval({ ...gmail, rules })).toBe("allow");
  });

  it("falls back to space rules when the bot has no matching rule", () => {
    const rules = [
      rule("block", "category", "send_email"),
      rule("always_allow", "category", "spend_money", "bot-1"),
    ];
    expect(resolveActionApproval({ ...gmail, rules, botId: "bot-1" })).toBe("block");
  });

  it("uses the action type default when no rule matches", () => {
    expect(resolveActionApprovalDetail({ ...gmail, rules: [] })).toMatchObject({
      decision: "ask",
      source: "action_type_default",
    });
    expect(resolveActionApprovalDetail({ toolName: "shell", rules: [] })).toMatchObject({
      decision: "allow",
      source: "action_type_default",
    });
    expect(resolveActionApprovalDetail({ toolName: "remember", rules: [] })).toMatchObject({
      decision: "allow",
      source: "default",
    });
  });

  it("never allows an explicit-approval tool, but can block it", () => {
    expect(
      resolveActionApprovalDetail({
        toolName: "imessage_send",
        rules: [rule("always_allow", "tool", "imessage_send")],
      }),
    ).toMatchObject({ decision: "ask" });
    expect(
      resolveActionApprovalDetail({
        toolName: "imessage_send",
        rules: [rule("block", "category", "message_outside")],
      }),
    ).toMatchObject({ decision: "block" });
    expect(toolRuleAllowsAllow("imessage_send")).toBe(false);
    expect(toolRuleAllowsAllow("shell")).toBe(true);
  });

  it("asks for share_meeting every time: attended or not, and no rule can allow it", () => {
    expect(toolRequiresExplicitApproval("share_meeting")).toBe(true);
    expect(toolRequiresApproval("share_meeting", false)).toBe(true);
    expect(unattendedToolRequiresApproval(true, "share_meeting", false)).toBe(true);
    expect(toolRuleAllowsAllow("share_meeting")).toBe(false);
    expect(
      resolveActionApprovalDetail({
        toolName: "share_meeting",
        rules: [rule("always_allow", "tool", "share_meeting")],
      }),
    ).toMatchObject({ decision: "ask" });
  });
});

describe("planActionGate with block and unattended runs", () => {
  const base = { consequential: true, autoReviewEnabled: true, checkerConfigured: true };
  const resolved = (decision: "ask" | "allow" | "block", source: ActionApprovalSource) => ({
    decision,
    source,
    matchingRules: [],
  });

  it("blocks without review", () => {
    expect(planActionGate({ ...base, resolved: resolved("block", "block") })).toBe("block");
  });

  it("plans a judge for a default only when attended", () => {
    expect(planActionGate({ ...base, resolved: resolved("allow", "default") })).toBe("judge");
    expect(planActionGate({ ...base, resolved: resolved("ask", "action_type_default") })).toBe(
      "judge",
    );
    expect(
      planActionGate({ ...base, unattended: true, resolved: resolved("allow", "default") }),
    ).toBe("allow");
    expect(
      planActionGate({
        ...base,
        unattended: true,
        resolved: resolved("ask", "action_type_default"),
      }),
    ).toBe("ask");
  });

  it("never judges a rule", () => {
    expect(planActionGate({ ...base, resolved: resolved("ask", "require_approval") })).toBe("ask");
    expect(planActionGate({ ...base, resolved: resolved("allow", "always_allow") })).toBe("allow");
  });
});

describe("unattendedToolRequiresApproval", () => {
  it("lets a background run read the owner's finance records, but a tainted run still asks", () => {
    for (const name of [
      "finance_overview",
      "finance_breakdown",
      "finance_transactions",
      "finance_recurring",
      "finance_crypto",
    ]) {
      expect(unattendedToolRequiresApproval(true, name, false)).toBe(false);
      expect(externalTaintAllowsTool(name)).toBe(false);
      expect(ROUTINE_AUTO_REVIEW_READ_TOOLS.has(name)).toBe(false);
    }
  });

  it("keeps message_bot asking in the gate; the executor lifts it for a clean own-bot relay", () => {
    expect(unattendedToolRequiresApproval(true, "message_bot", false)).toBe(true);
    expect(externalTaintAllowsTool("message_bot")).toBe(false);
  });

  it("lets a scheduled run read the owner's company context without a card", () => {
    expect(unattendedToolRequiresApproval(true, "company_context_lookup", false)).toBe(false);
  });

  it("never asks for an attended run", () => {
    expect(unattendedToolRequiresApproval(false, "shell", false)).toBe(false);
    expect(unattendedToolRequiresApproval(false, "github_create_issue", true)).toBe(false);
  });

  it.each([
    "write_file",
    "shell",
    "computer_act",
    "browser_act",
    "open_path",
    "launch_app",
    "add_to_data_room",
    "mail_send",
    "contacts_add",
    "cap_table_update",
    "mail_draft",
    "drive_create_file",
    "drive_update_file",
    "calendar_create_event",
    "calendar_update_event",
    "calendar_delete_event",
    "contacts_save",
    "fundraising_round_save",
    "pipeline_import_review",
  ])("asks for %s in an unattended run", (name) => {
    expect(unattendedToolRequiresApproval(true, name, false)).toBe(true);
  });

  it("leaves mail_modify to the rules: it cannot delete, send or mark spam, and is reversible", () => {
    expect(unattendedToolRequiresApproval(true, "mail_modify", false)).toBe(false);
    expect(toolRequiresApproval("mail_modify", false)).toBe(true);
  });

  it.each([
    "mail_search",
    "mail_grep",
    "mail_get",
    "inbox_overview",
    "drive_search",
    "drive_read",
    "calendar_list_events",
    "calendar_get_event",
    "contacts_list",
  ])("does not ask for the read-only %s in an unattended run", (name) => {
    expect(unattendedToolRequiresApproval(true, name, false)).toBe(false);
  });

  it.each([
    "read_file",
    "run_subagent",
    "notify_user",
    "create_ui_artifact",
    "attach_file",
    "page_write",
    "pins_write",
    "legal_unreviewed_documents",
    "legal_upsert_contract",
    "legal_upsert_deadline",
    "legal_upsert_node",
    "legal_link",
    "legal_query",
    "read_history",
    "search_history",
    "page_list",
    "page_read",
    "pins_read",
  ])("lets %s run in an unattended run", (name) => {
    expect(unattendedToolRequiresApproval(true, name, false)).toBe(false);
  });

  it.each(["message_user", "show_emails"])("lets the display tool %s run unattended", (name) => {
    expect(unattendedToolRequiresApproval(true, name, false)).toBe(false);
  });

  it("still asks for mail_send in an unattended run", () => {
    expect(unattendedToolRequiresApproval(true, "mail_send", false)).toBe(true);
  });

  it.each(["cap_table_read", "page_source_list"])(
    "still asks for %s in an unattended run",
    (name) => {
      expect(unattendedToolRequiresApproval(true, name, false)).toBe(true);
    },
  );

  it("keeps an internal legal tool asking in a tainted run", () => {
    expect(externalTaintAllowsTool("legal_upsert_contract")).toBe(false);
  });

  it("does not exempt a connector tool that shares a legal name", () => {
    expect(unattendedToolRequiresApproval(true, "legal_upsert_contract", true)).toBe(true);
  });

  it("allows only GET and HEAD secret requests", () => {
    expect(unattendedToolRequiresApproval(true, "secret_request", false, undefined, {})).toBe(
      false,
    );
    for (const method of ["GET", "HEAD"]) {
      expect(
        unattendedToolRequiresApproval(true, "secret_request", false, undefined, { method }),
      ).toBe(false);
    }
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      expect(
        unattendedToolRequiresApproval(true, "secret_request", false, undefined, { method }),
      ).toBe(true);
    }
  });

  it("gates scratchpad writes by category and fails closed when it is unknown", () => {
    const check = (name: string, args: Record<string, unknown>) =>
      unattendedToolRequiresApproval(true, name, false, undefined, args);
    expect(check("scratchpad_add", {})).toBe(false);
    expect(check("scratchpad_add", { category: "followup" })).toBe(false);
    expect(check("scratchpad_add", { category: "public_post" })).toBe(true);
    expect(check("scratchpad_update", { category: "followup" })).toBe(false);
    expect(check("scratchpad_update", { category: "outbound_email" })).toBe(true);
    expect(check("scratchpad_complete", {})).toBe(true);
    expect(check("scratchpad_complete", { category: "create_account" })).toBe(true);
  });

  it("asks for connector writes and lets declared reads run", () => {
    expect(unattendedToolRequiresApproval(true, "github_create_issue", true)).toBe(true);
    expect(unattendedToolRequiresApproval(true, "github_get_issue", true, true)).toBe(false);
  });
});

describe("buildApprovalTable", () => {
  it("shows defaults, space rules, legacy aliases and a bot override", () => {
    const rows = buildApprovalTable(
      [
        rule("require_approval", "category", "email"),
        rule("block", "category", "delete_data"),
        rule("always_allow", "category", "send_email", "bot-1"),
        rule("block", "category", "delete_data", "bot-2"),
      ],
      "bot-1",
    );
    const byType = Object.fromEntries(rows.map((row) => [row.actionType, row]));
    expect(rows).toHaveLength(10);
    expect(byType.send_email).toMatchObject({
      spaceEffect: "ask",
      botEffect: "allow",
      effect: "allow",
    });
    expect(byType.delete_data).toMatchObject({
      spaceEffect: "block",
      botEffect: null,
      effect: "block",
    });
    expect(byType.files_and_commands).toMatchObject({ spaceEffect: "allow", botEffect: null });
    expect(buildApprovalTable([], undefined)[0]).toMatchObject({ botEffect: null, primary: true });
  });

  it("never reports Allow for an always-ask type: a saved Allow asks, and a saved Block shows", () => {
    const rules = [rule("always_allow", "category", "spend_money")];
    for (const level of ["open", "ask_changes", "ask_everything"] as const) {
      const row = buildApprovalTable(rules, undefined, level).find(
        (entry) => entry.actionType === "spend_money",
      );
      // Every spend-money call is a hard line, so the gate asks whatever the saved Allow says.
      expect(row).toMatchObject({ spaceEffect: "ask", effect: "ask" });
    }
    const blocked = buildApprovalTable(
      [rule("block", "category", "spend_money")],
      undefined,
      "open",
    ).find((entry) => entry.actionType === "spend_money");
    expect(blocked).toMatchObject({ spaceEffect: "block", effect: "block" });
  });

  it("shows an always-ask type's blocked state for a bot, its own or inherited", () => {
    const inherited = buildApprovalTable(
      [rule("block", "category", "spend_money")],
      "bot-1",
      "open",
    ).find((entry) => entry.actionType === "spend_money");
    expect(inherited).toMatchObject({ spaceEffect: "block", botEffect: null, effect: "block" });
    const own = buildApprovalTable(
      [rule("block", "category", "spend_money", "bot-1")],
      "bot-1",
      "open",
    ).find((entry) => entry.actionType === "spend_money");
    expect(own).toMatchObject({ spaceEffect: "ask", botEffect: "block", effect: "block" });
    // A bot's saved Allow on an always-ask type asks too, and it outranks the space's Block.
    const softened = buildApprovalTable(
      [
        rule("block", "category", "spend_money"),
        rule("always_allow", "category", "spend_money", "bot-1"),
      ],
      "bot-1",
      "open",
    ).find((entry) => entry.actionType === "spend_money");
    expect(softened).toMatchObject({ spaceEffect: "block", botEffect: "ask", effect: "ask" });
  });
});

describe("tool_run", () => {
  it("runs without a card in unattended and tainted runs", () => {
    expect(unattendedToolRequiresApproval(true, "tool_run", false)).toBe(false);
    expect(externalTaintAllowsTool("tool_run")).toBe(true);
  });
});

describe("external taint safe tools", () => {
  it("excludes tools that can carry private data out", () => {
    for (const name of ["web_fetch", "web_search", "search_data_room", "company_get", "shell"]) {
      expect(EXTERNAL_TAINT_SAFE_TOOLS.has(name)).toBe(false);
    }
    expect(externalTaintAllowsTool("ask_user")).toBe(true);
    expect(externalTaintAllowsTool("web_fetch")).toBe(false);
  });

  it("keeps internal metadata reads free", () => {
    for (const name of ["task_catalog", "schedule_list", "schedule_runs", "list_secrets"]) {
      expect(externalTaintAllowsTool(name)).toBe(true);
    }
  });

  it("applies the scratchpad category rule", () => {
    expect(externalTaintAllowsTool("scratchpad_list")).toBe(true);
    expect(externalTaintAllowsTool("scratchpad_add", { category: "followup" })).toBe(true);
    expect(externalTaintAllowsTool("scratchpad_add", { category: "public_post" })).toBe(false);
    expect(externalTaintAllowsTool("scratchpad_complete", {})).toBe(false);
  });
});

describe("outboundSiteGate", () => {
  const siteRule: ActionApprovalRule = {
    effect: "always_allow",
    matchKind: "site",
    matchValue: "example.com",
  };

  it("lets a run reach sites it was given", () => {
    expect(outboundSiteGate({ site: "example.com", trusted: true, rules: [] })).toBe("allow");
  });

  it("marks any other site new, even with a rule for the whole tool", () => {
    expect(outboundSiteGate({ site: "attacker.test", trusted: false, rules: [] })).toBe("new");
    expect(
      outboundSiteGate({
        site: "attacker.test",
        trusted: false,
        rules: [{ effect: "always_allow", matchKind: "tool", matchValue: "web_fetch" }],
      }),
    ).toBe("new");
  });

  it("allows a site the owner always allowed, and only that site", () => {
    expect(outboundSiteGate({ site: "example.com", trusted: false, rules: [siteRule] })).toBe(
      "allow",
    );
    expect(outboundSiteGate({ site: "other.com", trusted: false, rules: [siteRule] })).toBe("new");
  });

  it("matches site rules ahead of tool rules", () => {
    expect(
      resolveActionApprovalDetail({
        toolName: "web_fetch",
        site: "example.com",
        rules: [
          { effect: "require_approval", matchKind: "tool", matchValue: "web_fetch" },
          siteRule,
        ],
      }).decision,
    ).toBe("allow");
    expect(
      resolveActionApprovalDetail({ toolName: "web_fetch", site: "other.com", rules: [siteRule] })
        .source,
    ).toBe("default");
  });
});

describe("connectorReadRequiresApproval", () => {
  it("keeps reads free until outside content enters the run", () => {
    expect(connectorReadRequiresApproval({ tainted: false, connectorTrusted: false })).toBe(false);
  });

  it("keeps reads free on a connector the run already used or was approved for", () => {
    expect(connectorReadRequiresApproval({ tainted: true, connectorTrusted: true })).toBe(false);
  });

  it("asks before a read on a new connector once the run is tainted", () => {
    expect(connectorReadRequiresApproval({ tainted: true, connectorTrusted: false })).toBe(true);
  });
});

describe("toolResultTaintsRun", () => {
  it("treats outside content as taint, including connector tools and new tools", () => {
    for (const tool of [
      "web_fetch",
      "web_search",
      "browser_snapshot",
      "computer_observe",
      "shell",
      "read_file",
      "run_subagent",
      "gmail_list_messages",
      "some_future_tool",
    ]) {
      expect(toolResultTaintsRun(tool)).toBe(true);
    }
  });

  it("does not taint on the bot's own writes and saved state", () => {
    for (const tool of ["ask_user", "remember", "recall_memory", "skill_read", "write_file"]) {
      expect(toolResultTaintsRun(tool)).toBe(false);
    }
  });
});

it("requires human confirmation to approve an agent connection", () => {
  expect(toolRequiresExplicitApproval("respond_agent_connection")).toBe(true);
  expect(toolRequiresApproval("respond_agent_connection", false)).toBe(true);
});

describe("bot approval of contact tools (unchanged by MCP writes)", () => {
  it("allows a bot's contacts_add with no rule, and asks for contacts_save by default", () => {
    const add = resolveActionApprovalDetail({ toolName: "contacts_add", rules: [], botId: "b1" });
    expect(add).toMatchObject({ decision: "allow", source: "default" });
    expect(toolRequiresApproval("contacts_add", false)).toBe(false);
    expect(toolRequiresApproval("contacts_save", false)).toBe(true);
  });
});

describe("all-sites rule and private data tools", () => {
  const rule = (botId: string | null, matchValue = "web_fetch", effect = "always_allow") =>
    ({ effect, matchKind: "tool", matchValue, botId }) as ActionApprovalRule;

  it("reads only this bot's always_allow rule for web_fetch", () => {
    expect(botAllowsAllSites([rule("bot-1")], "bot-1")).toBe(true);
    expect(botAllowsAllSites([rule("bot-2")], "bot-1")).toBe(false);
    expect(botAllowsAllSites([rule(null)], "bot-1")).toBe(false);
    expect(botAllowsAllSites([rule("bot-1", "web_search")], "bot-1")).toBe(false);
    expect(botAllowsAllSites([rule("bot-1", "web_fetch", "require_approval")], "bot-1")).toBe(
      false,
    );
  });

  it("names the private data a tool list can read, and ignores web, page and agenda tools", () => {
    expect(privateDataAreas(["mail_search", "show_emails", "drive_read"])).toEqual([
      "mail",
      "Drive",
    ]);
    expect(privateDataAreas(["finance_overview"])).toEqual(["finance"]);
    expect(privateDataAreas(["search_data_room"])).toEqual(["Data room"]);
    expect(privateDataAreas(["calendar_list_events"])).toEqual(["calendar"]);
    expect(
      privateDataAreas(["web_fetch", "web_search", "page_write", "read_file", "calendar_agenda"]),
    ).toEqual([]);
  });
});

describe("mail_reply_batch gates", () => {
  const tool = "mail_reply_batch";

  it("needs approval, cannot be auto-reviewed, and is a send_email action", () => {
    expect(toolRequiresApproval(tool, false)).toBe(true);
    expect(toolRequiresExplicitApproval(tool)).toBe(true);
    expect(actionTypeForTool({ toolName: tool, viaConnector: false })).toBe("send_email");
  });

  it("a saved Allow leaves it asking; a saved Block, by tool or category, refuses it", () => {
    const decide = (rules: ActionApprovalRule[]) =>
      resolveActionApproval({ toolName: tool, rules });
    expect(decide([{ effect: "always_allow", matchKind: "tool", matchValue: tool }])).toBe("ask");
    expect(
      decide([{ effect: "always_allow", matchKind: "category", matchValue: "send_email" }]),
    ).toBe("ask");
    expect(decide([{ effect: "block", matchKind: "tool", matchValue: tool }])).toBe("block");
    expect(decide([{ effect: "block", matchKind: "category", matchValue: "send_email" }])).toBe(
      "block",
    );
    // A rule saved before the table used this category name; the email list covers the new tool.
    expect(decide([{ effect: "block", matchKind: "category", matchValue: "email" }])).toBe("block");
  });
});

describe("isApprovalAskBlock with a reply batch card", () => {
  const card = (actions: { id: string; label: string }[], mailBatch?: object) => ({
    kind: "ask",
    approvalEffectId: "effect-1",
    actions,
    ...(mailBatch ? { mailBatch } : {}),
  });
  const counts = { count: 2, sent: 0, failed: 0, unknown: 0 };

  it("is an approval card with only Discard, so composer text cannot answer it", () => {
    expect(isApprovalAskBlock(card([{ id: "deny", label: "Discard" }], counts))).toBe(true);
  });

  it("does not treat a deny-only card without the batch mark as an approval", () => {
    expect(isApprovalAskBlock(card([{ id: "deny", label: "Discard" }]))).toBe(false);
  });
});

describe("routine rules and Auto Review of routine reads", () => {
  const base = { consequential: true, autoReviewEnabled: true, checkerConfigured: true };
  const resolved = (decision: "ask" | "allow", source: ActionApprovalSource) => ({
    decision,
    source,
    matchingRules: [],
  });

  it("judges only a routine read in an unattended run", () => {
    const r = resolved("allow", "default");
    expect(planActionGate({ ...base, resolved: r, unattended: true })).toBe("allow");
    expect(planActionGate({ ...base, resolved: r, unattended: true, routineRead: true })).toBe(
      "judge",
    );
  });

  it("lets a rule win over the routine judge", () => {
    const flags = { ...base, unattended: true, routineRead: true };
    expect(planActionGate({ ...flags, resolved: resolved("ask", "require_approval") })).toBe("ask");
  });

  it("lists only reads for the routine judge, all of which ask in the background today", () => {
    for (const name of ROUTINE_AUTO_REVIEW_READ_TOOLS) {
      expect(unattendedToolRequiresApproval(true, name, false)).toBe(true);
      expect(toolRequiresExplicitApproval(name)).toBe(false);
      expect(name).not.toMatch(/send|write|save|update|upsert|create|delete|modify/);
    }
  });

  it.each([
    "mail_send",
    "mail_draft",
    "imessage_send",
    "share_meeting",
    "fundraising_round_save",
    "company_fact_upsert",
    "create_space",
  ])("never offers Always for this routine on %s", (toolName) => {
    expect(routineAlwaysAllowable({ toolName })).toBe(false);
  });

  it("never offers it for a payment, outside message or delete on a connector", () => {
    for (const toolName of ["stripe_charge_card", "slack_post_message", "github_delete_branch"]) {
      expect(routineAlwaysAllowable({ toolName, viaConnector: true })).toBe(false);
    }
  });

  it("offers it for an ordinary background write, and accepts the answer on a card", () => {
    expect(routineAlwaysAllowable({ toolName: "write_file" })).toBe(true);
    expect(
      isApprovalAskBlock({
        kind: "ask",
        approvalEffectId: "e",
        actions: [
          { id: "allow", label: "Allow once" },
          { id: "always_routine", label: "Always for this routine" },
          { id: "deny", label: "Deny" },
        ],
      }),
    ).toBe(true);
  });
});

describe("backgroundAutoReviewAllowed", () => {
  const clean = {
    enabled: true,
    trigger: "routine",
    tainted: false,
    outsideContentSeen: false,
    meetingMarked: false,
    firewalled: false,
    externalBot: false,
    ownerWords: "Summarize my cap table every Monday.",
    toolName: "cap_table_read",
  };

  it("allows a clean run's ordinary call", () => {
    expect(backgroundAutoReviewAllowed(clean)).toBe(true);
    expect(
      backgroundAutoReviewAllowed({
        ...clean,
        toolName: "notion_create_page",
        viaConnector: true,
        connectorKind: "notion",
      }),
    ).toBe(true);
  });

  it.each([
    ["background off", { enabled: false }],
    ["webhook", { trigger: "webhook" }],
    ["tainted run", { tainted: true }],
    ["outside content", { outsideContentSeen: true }],
    ["meeting mark", { meetingMarked: true }],
    ["firewalled", { firewalled: true }],
    ["external bot", { externalBot: true }],
    ["empty owner words", { ownerWords: "  " }],
  ])("never judges: %s", (_label, patch) => {
    expect(backgroundAutoReviewAllowed({ ...clean, ...patch })).toBe(false);
  });

  it.each([
    "schedule_create",
    "schedule_update",
    "schedule_cancel",
    "skill_create",
    "skill_update",
    "skill_delete",
    "remember",
    "save_memory",
    "save_shared_memory",
    "forget_memory",
    "mail_send",
    "mail_draft",
    "message_outside",
    "imessage_send",
    "calendar_create_event",
    "calendar_delete_event",
    "gtm_post",
    "add_mcp_server",
    "spawn_bot",
    "update_bot",
    "cloud_agent_launch",
    "share_meeting",
    "fundraising_round_save",
  ])("never judges %s", (toolName) => {
    expect(backgroundAutoReviewAllowed({ ...clean, toolName })).toBe(false);
  });

  it("never judges a money, message or calendar connector call", () => {
    for (const [toolName, connectorKind] of [
      ["stripe_create_charge", "stripe"],
      ["slack_post_message", "slack"],
      ["google_calendar_create_event", "googlecalendar"],
    ] as const) {
      expect(
        backgroundAutoReviewAllowed({ ...clean, toolName, viaConnector: true, connectorKind }),
      ).toBe(false);
    }
  });
});

describe("contentHasOutboundChannel", () => {
  it("accepts plain text", () => {
    expect(
      contentHasOutboundChannel({ page: "Notes", content: "Call Sam on Monday at 3pm." }),
    ).toBe(false);
  });
  it.each([
    "see https://evil.test/x",
    "![pixel](https://evil.test/p.png)",
    "[click](mailto:a@b.test)",
    "<img src=x>",
    "visit evil.com now",
    "www.evil.test",
  ])("rejects %s", (text) => {
    expect(contentHasOutboundChannel({ content: text })).toBe(true);
    expect(contentHasOutboundChannel({ nested: [{ deep: text }] })).toBe(true);
  });
});

describe("mailModifyTouchesFixedLabel", () => {
  it("flags trash and spam, not archive", () => {
    expect(mailModifyTouchesFixedLabel({ addLabels: ["trash"] })).toBe(true);
    expect(mailModifyTouchesFixedLabel({ addLabels: ["SPAM"] })).toBe(true);
    expect(mailModifyTouchesFixedLabel({ id: "m", archive: true })).toBe(false);
  });
});

describe("pageWriteAddsChannel", () => {
  const page = "Notes\n\n![logo](https://cdn.example.test/logo.png)\n";
  it("allows plain edits to a page without links", () => {
    expect(pageWriteAddsChannel("Notes", "My notes")).toBe(false);
  });
  it("catches private text swapped into an existing image URL", () => {
    expect(
      pageWriteAddsChannel(page, page.replace("logo.png", "logo.png?d=PLACEHOLDER-CUSTOMER")),
    ).toBe(true);
  });
  it("rejects a new link, any HTML, and any URL on a new page", () => {
    expect(pageWriteAddsChannel(page, `${page}\nsee https://evil.test`)).toBe(true);
    expect(pageWriteAddsChannel("", "<b>hi</b>")).toBe(true);
    expect(pageWriteAddsChannel("", "go to https://x.test")).toBe(true);
  });
});

describe("pageWriteAddsChannel destinations", () => {
  it("asks for nested parentheses, reference images and any destination", () => {
    expect(pageWriteAddsChannel("", "![x](https://evil.test/a(b)?d=PLACEHOLDER)")).toBe(true);
    expect(
      pageWriteAddsChannel("![x][r]\n\n[r]: https://e.test/p", "![x][r]\n\n[r]: https://e.test/p"),
    ).toBe(true);
    expect(pageWriteAddsChannel("", "![x][r]\n[r]: foo")).toBe(true);
    expect(pageWriteAddsChannel("", "Plain notes.")).toBe(false);
  });
});

describe("organize_mail", () => {
  it("is its own action type that runs without a rule", () => {
    expect(ACTION_TYPES.find((entry) => entry.id === "organize_mail")?.defaultEffect).toBe("allow");
    expect(resolveActionApprovalDetail({ toolName: "mail_modify", rules: [] }).decision).toBe(
      "allow",
    );
  });

  it("still asks when the owner sets organize_mail to ask", () => {
    const rules = [rule("require_approval", "category", "organize_mail")];
    expect(resolveActionApproval({ toolName: "mail_modify", rules })).toBe("ask");
  });

  it("keeps Trash, Spam, Drafts and Sent mandatory, whatever the type says", () => {
    for (const label of ["TRASH", "spam", "DRAFT", "Sent"]) {
      expect(mailModifyTouchesFixedLabel({ id: "m1", addLabels: [label] })).toBe(true);
      expect(mailModifyTouchesFixedLabel({ id: "m1", removeLabels: [label] })).toBe(true);
    }
    expect(mailModifyTouchesFixedLabel({ id: "m1", archive: true, read: true })).toBe(false);
  });

  it("leaves send and draft as send_email", () => {
    for (const toolName of ["mail_send", "mail_draft", "mail_reply_batch"])
      expect(actionTypeForTool({ toolName })).toBe("send_email");
  });
});

describe("the permission level in rule resolution", () => {
  const call = { toolName: "calendar_create_event", rules: [] as ActionApprovalRule[] };

  it("leaves a call with no level as today", () => {
    expect(resolveActionApprovalDetail(call).decision).toBe("allow");
  });

  it("asks for every action type at Ask for changes and Ask for everything", () => {
    for (const level of ["ask_changes", "ask_everything"] as const) {
      expect(resolveActionApprovalDetail({ ...call, level })).toMatchObject({
        decision: "ask",
        source: "action_type_default",
      });
      expect(
        resolveActionApprovalDetail({ toolName: "mail_modify", rules: [], level }).decision,
      ).toBe("ask");
    }
  });

  it("does not ask for a read, which has no action type", () => {
    expect(
      resolveActionApprovalDetail({ toolName: "recall_memory", rules: [], level: "ask_changes" })
        .decision,
    ).toBe("allow");
  });

  it("lets a saved rule beat the level, and a Block still block", () => {
    const rule = (effect: ActionApprovalRule["effect"]): ActionApprovalRule => ({
      effect,
      matchKind: "tool",
      matchValue: "calendar_create_event",
    });
    expect(
      resolveActionApprovalDetail({ ...call, rules: [rule("always_allow")], level: "ask_changes" })
        .decision,
    ).toBe("allow");
    expect(
      resolveActionApprovalDetail({ ...call, rules: [rule("block")], level: "ask_changes" })
        .decision,
    ).toBe("block");
  });

  it("names the tools no background lift reaches", () => {
    for (const name of [
      "schedule_create",
      "skill_write",
      "watch_create",
      "spawn_bot",
      "remember",
    ]) {
      expect(isBackgroundExcludedTool(name)).toBe(true);
    }
    expect(isBackgroundExcludedTool("mail_modify")).toBe(false);
  });
});
