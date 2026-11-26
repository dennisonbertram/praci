import type { MailAccount } from "@rakazo/adapter-kit";
import type { PrismaClient } from "@rakazo/db";
import { describe, expect, it } from "vitest";
import type { FirewallMailDeps } from "./firewall-mail.js";
import { firewallDraftIsWithinThread, firewallMailReadDecision } from "./firewall-mail.js";

const account: MailAccount = {
  id: "conn-1",
  connectorId: "google",
  app: "gmail",
  accountRef: "me",
  label: "Gmail",
  spaceId: "space-1",
  userId: "user-1",
  address: "support@example.test",
};

const LABEL = { id: "LBL", name: "Support" };
/** Gmail's own "Message" is free only inside the support label. */
const thread = [
  { fromAddress: "someone@example.test", toAddresses: ["support@example.test"], ccAddresses: [] },
];

function deps(
  options: { labelOnMailbox?: boolean; messageLabel?: "labelled" | "unlabelled" } = {},
) {
  const prisma = {
    cachedMailMessage: {
      findFirst: async () => ({ threadId: "t1", connectionId: account.id }),
      findMany: async () => thread,
    },
    botConnectionAccess: { count: async () => 1 },
    mailSearch: { findFirst: async () => null },
  } as unknown as PrismaClient;
  const mail = {
    listLabels: async () =>
      options.labelOnMailbox === false ? [{ id: "OTHER", name: "Other" }] : [LABEL],
    getMessage: async (_account: MailAccount, id: string) => ({
      labelIds: options.messageLabel ? (id === "labelled" ? [LABEL.id] : []) : [LABEL.id],
    }),
  } as unknown as FirewallMailDeps["mail"];
  const full = {
    prisma,
    mail,
    context: { spaceId: "space-1", userId: "user-1" } as never,
    owner: { spaceId: "space-1", userId: "user-1" },
    botId: "bot-1",
    accounts: [account],
    rows: [
      {
        id: account.id,
        allAgents: false,
        botAccess: [{ botId: "bot-1", supportLabel: LABEL.name }],
      },
    ],
  } satisfies FirewallMailDeps;
  return full;
}

describe("a support label limits a firewalled agent's reads", () => {
  it("refuses an inbox overview that would list other mail", async () => {
    expect((await firewallMailReadDecision("inbox_overview", {}, deps())).free).toBe(false);
  });

  it("asks for a message outside the label and frees one inside it", async () => {
    const d = deps({ messageLabel: "unlabelled" });
    expect(
      (await firewallMailReadDecision("mail_get", { account: account.address, id: "plain" }, d))
        .free,
    ).toBe(false);
    expect(
      (await firewallMailReadDecision("mail_get", { account: account.address, id: "labelled" }, d))
        .free,
    ).toBe(true);
  });

  it("asks when the mailbox does not carry the label", async () => {
    expect(
      (
        await firewallMailReadDecision(
          "mail_get",
          { account: account.address, id: "labelled" },
          deps({ labelOnMailbox: false }),
        )
      ).free,
    ).toBe(false);
  });
});

describe("a support label limits a firewalled agent's drafts", () => {
  const draft = (replyToId: string) => ({
    account: account.address,
    replyToId,
    to: ["someone@example.test"],
    body: "Thanks, will do.",
  });

  it("frees a reply inside the labelled thread", async () => {
    expect(
      await firewallDraftIsWithinThread(draft("labelled"), deps({ messageLabel: "labelled" })),
    ).toBe(true);
  });

  it("asks for a reply to a message outside the label", async () => {
    expect(
      await firewallDraftIsWithinThread(draft("plain"), deps({ messageLabel: "unlabelled" })),
    ).toBe(false);
  });

  it("asks when the mailbox does not carry the label", async () => {
    expect(
      await firewallDraftIsWithinThread(draft("labelled"), deps({ labelOnMailbox: false })),
    ).toBe(false);
  });
});
