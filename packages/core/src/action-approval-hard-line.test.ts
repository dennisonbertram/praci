import { describe, expect, it } from "vitest";
import type { HardLine, HardLineCall } from "./action-approval.js";
import {
  backgroundAutoReviewAllowed,
  emailSendRecipients,
  hardLineFor,
  planActionGate,
  routineAlwaysAllowable,
} from "./action-approval.js";

const connector = (toolName: string, args: Record<string, unknown> = {}): HardLineCall => ({
  toolName,
  viaConnector: true,
  args,
});

/** One call per hard line the owner set (2026-11-15), and the line it must cross. */
const HARD_LINE_CALLS: Array<[string, HardLineCall, HardLine]> = [
  [
    "mail_send to an outside recipient",
    { toolName: "mail_send", args: { to: ["stranger@example.test"], subject: "Hi", body: "x" } },
    "outside_email",
  ],
  [
    "mail_send of a saved draft (recipients not in the call)",
    { toolName: "mail_send", args: { draftId: "d1" }, recipientsTrusted: true },
    "outside_email",
  ],
  ["mail_reply_batch", { toolName: "mail_reply_batch", args: {} }, "outside_email"],
  [
    "a connector email send",
    connector("GMAIL_SEND_EMAIL", { recipient_email: "stranger@example.test", body: "x" }),
    "outside_email",
  ],
  ["a connector reply with no address", connector("gmail_reply_to_thread", {}), "outside_email"],
  ["a Stripe charge", connector("stripe_create_charge", { amount: 500 }), "money"],
  ["a Mercury send", connector("mercury__requestSendMoney", { amount: 300 }), "money"],
  [
    "a money call that claims to be a read",
    { ...connector("mcp__demo__requestSendMoney"), readOnly: true },
    "money",
  ],
  ["a payout by name", connector("acme_create_payout"), "money"],
  ["a write that names an amount", connector("acme_update_record", { amount: 10 }), "money"],
  ["forget_memory", { toolName: "forget_memory", args: {} }, "permanent_delete"],
  ["calendar_delete_event", { toolName: "calendar_delete_event", args: {} }, "permanent_delete"],
  ["skill_delete", { toolName: "skill_delete", args: {} }, "permanent_delete"],
  ["a connector delete", connector("github_delete_branch"), "permanent_delete"],
  ["a connector trash", connector("drive_trash_file"), "permanent_delete"],
  ["forget_secret", { toolName: "forget_secret", args: {} }, "credentials"],
  [
    "a non-GET secret_request",
    { toolName: "secret_request", args: { method: "POST", url: "https://api.example.test" } },
    "credentials",
  ],
  ["request_access", { toolName: "request_access", args: {} }, "credentials"],
  ["respond_agent_connection", { toolName: "respond_agent_connection", args: {} }, "credentials"],
  ["create_space", { toolName: "create_space", args: {} }, "credentials"],
  ["share_meeting", { toolName: "share_meeting", args: {} }, "credentials"],
  ["a connector share", connector("drive_share_file"), "credentials"],
  ["a connector invite", connector("slack_invite_user"), "credentials"],
  ["a connector token", connector("github_create_access_token"), "credentials"],
];

describe("hardLineFor", () => {
  it.each(HARD_LINE_CALLS)("%s crosses a hard line", (_label, call, line) => {
    expect(hardLineFor(call)).toBe(line);
  });

  it.each([
    [
      "mail_send to owner-trusted recipients",
      {
        toolName: "mail_send",
        args: { to: ["Pat <pat@example.test>"], cc: ["me@example.test"] },
        recipientsTrusted: true,
      },
    ],
    ["mail_draft (it never sends)", { toolName: "mail_draft", args: { to: ["x@example.test"] } }],
    ["mail_modify", { toolName: "mail_modify", args: { id: "m1", archive: true } }],
    ["a GET secret_request", { toolName: "secret_request", args: { method: "GET" } }],
    ["a secret_request with no method", { toolName: "secret_request", args: {} }],
    ["archive_bot (restorable)", { toolName: "archive_bot", args: {} }],
    ["delete_bot (restorable)", { toolName: "delete_bot", args: {} }],
    ["calendar_create_event", { toolName: "calendar_create_event", args: {} }],
    ["a connector read of payments", connector("stripe_list_charges")],
    ["a connector read of mail", connector("gmail_list_messages")],
    [
      "a camelCase read that names money",
      { toolName: "mcp__bank__listSendMoneyApprovalRequests", viaConnector: true, readOnly: true },
    ],
    ["a declared read with a plain name", { ...connector("GMAIL_FETCH_EMAILS"), readOnly: true }],
    ["a connector draft", connector("gmail_create_email_draft", { to: "x@example.test" })],
    ["a plain connector write", connector("notion_update_page", { title: "x" })],
    ["a built-in named like a delete is not guessed", { toolName: "page_source_remove" }],
  ] as Array<[string, HardLineCall]>)("%s is not a hard line", (_label, call) => {
    expect(hardLineFor(call)).toBeNull();
  });

  it("counts any untrusted or unparsable recipient as outside", () => {
    expect(hardLineFor({ toolName: "mail_send", args: { to: ["pat@example.test"] } })).toBe(
      "outside_email",
    );
    expect(hardLineFor({ toolName: "mail_send", args: { to: [] }, recipientsTrusted: true })).toBe(
      "outside_email",
    );
    expect(
      hardLineFor({
        toolName: "mail_send",
        args: { to: ["not an address"] },
        recipientsTrusted: true,
      }),
    ).toBe("outside_email");
  });
});

describe("emailSendRecipients", () => {
  it("reads to, cc and bcc of mail_send, lowercased", () => {
    expect(
      emailSendRecipients({
        toolName: "mail_send",
        args: { to: ["Pat <Pat@Example.test>"], cc: ["a@example.test"], bcc: ["b@example.test"] },
      }),
    ).toEqual(["pat@example.test", "a@example.test", "b@example.test"]);
  });

  it("marks a saved-draft send and an entry with no address as unknown", () => {
    expect(emailSendRecipients({ toolName: "mail_send", args: { draftId: "d1" } })).toContain("");
    expect(emailSendRecipients({ toolName: "mail_send", args: { to: ["Pat"] } })).toEqual([""]);
  });

  it("is undefined for anything that is not an email send", () => {
    expect(emailSendRecipients({ toolName: "mail_draft", args: {} })).toBeUndefined();
    expect(emailSendRecipients(connector("slack_send_message"))).toBeUndefined();
  });
});

describe("hard lines and the paths that lift an ask", () => {
  const routineArgs = (call: HardLineCall) => ({
    toolName: call.toolName,
    viaConnector: call.viaConnector,
    readOnly: call.readOnly,
    args: call.args,
  });

  it.each(HARD_LINE_CALLS)("%s: no routine allowance is offered", (_label, call) => {
    expect(routineAlwaysAllowable(routineArgs(call))).toBe(false);
  });

  it.each(HARD_LINE_CALLS)("%s: background Auto Review never judges it", (_label, call) => {
    expect(
      backgroundAutoReviewAllowed({
        enabled: true,
        trigger: "schedule",
        tainted: false,
        outsideContentSeen: false,
        meetingMarked: false,
        firewalled: false,
        externalBot: false,
        ownerWords: "Tidy up",
        ...routineArgs(call),
      }),
    ).toBe(false);
  });
});

describe("planActionGate with no reviewer", () => {
  const resolvedAllow = { decision: "allow" as const, source: "action_type_default" as const };

  it("asks for a call that would have gone to Auto Review when Auto Review is off", () => {
    for (const source of ["default", "action_type_default"] as const) {
      expect(
        planActionGate({
          resolved: { decision: "allow", source, matchingRules: [] },
          consequential: true,
          autoReviewEnabled: false,
          checkerConfigured: false,
        }),
      ).toBe("ask");
    }
  });

  it("asks when Auto Review is on but no checker is configured", () => {
    expect(
      planActionGate({
        resolved: { ...resolvedAllow, matchingRules: [] },
        consequential: true,
        autoReviewEnabled: true,
        checkerConfigured: false,
      }),
    ).toBe("ask");
  });

  it("still lets a saved Allow rule and a call that is not consequential run", () => {
    expect(
      planActionGate({
        resolved: { decision: "allow", source: "always_allow", matchingRules: [] },
        consequential: true,
        autoReviewEnabled: false,
        checkerConfigured: false,
      }),
    ).toBe("allow");
    expect(
      planActionGate({
        resolved: { ...resolvedAllow, matchingRules: [] },
        consequential: false,
        autoReviewEnabled: false,
        checkerConfigured: false,
      }),
    ).toBe("allow");
  });
});
