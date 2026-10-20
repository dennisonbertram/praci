import type { AdapterContext, MailAccount } from "@rakazo/adapter-kit";
import { MailProviderError } from "@rakazo/adapter-kit";
import { describe, expect, it } from "vitest";
import { createMailEmulator } from "./gmail-api-emulator.js";
import { GMAIL_SETTINGS_BASIC } from "./google-connector.js";
import { senderRulesState } from "./mail-sender-rules.js";
import { assertMailSenderRuleConformance } from "./testing/mail-conformance.js";

const FILTERS = "https://gmail.googleapis.com/gmail/v1/users/me/settings/filters";

function setup(options: { native?: boolean } = { native: true }) {
  const emulator = createMailEmulator(options);
  const [a, b] = emulator.accounts as [MailAccount, MailAccount];
  const context: AdapterContext = {
    operationId: "op",
    traceId: "op",
    spaceId: a.spaceId,
    userId: a.userId,
    signal: new AbortController().signal,
  };
  const accountOf = async (target = a) =>
    (await emulator.provider.listAccounts({ spaceId: a.spaceId, userId: a.userId }, context)).find(
      (account) => account.id === target.id,
    ) as MailAccount;
  const requests = () => emulator.gmail.requests.filter((r) => r.url.startsWith(FILTERS));
  return { ...emulator, a, b, context, accountOf, requests };
}
const create = (s: ReturnType<typeof setup>, account: MailAccount, from: string) =>
  s.provider.createSenderRule?.(account, { from, skipInbox: true }, s.context);
const kindOf = (promise: Promise<unknown> | undefined) =>
  promise?.then(
    () => "ok",
    (error: unknown) => (error instanceof MailProviderError ? error.kind : "other"),
  );

describe("Gmail sender rules", () => {
  it("passes the sender rule conformance on the native route", async () => {
    const s = setup();
    await assertMailSenderRuleConformance(s.provider, s);
  });

  it("passes the conformance on a route that cannot hold rules, sending nothing", async () => {
    const s = setup({ native: false });
    await assertMailSenderRuleConformance(s.provider, s);
  });

  it("reports whether each account can have rules", async () => {
    const native = setup();
    expect((await native.accountOf()).senderRules).toBe("needs_permission");
    native.gmail.grantScope(native.a.accountRef, GMAIL_SETTINGS_BASIC);
    expect((await native.accountOf()).senderRules).toBe("ready");
    expect((await native.accountOf(native.b)).senderRules).toBe("needs_permission");
    expect((await setup({ native: false }).accountOf()).senderRules).toBe("unsupported");
  });

  it("reads the stored scope as a space-separated list", () => {
    expect(senderRulesState("google", { scope: `openid ${GMAIL_SETTINGS_BASIC}` })).toBe("ready");
    expect(senderRulesState("google", { scope: `${GMAIL_SETTINGS_BASIC}x` })).toBe(
      "needs_permission",
    );
    expect(senderRulesState("google", {})).toBe("needs_permission");
    expect(senderRulesState("google", null)).toBe("needs_permission");
    expect(senderRulesState("composio", { scope: GMAIL_SETTINGS_BASIC })).toBe("unsupported");
  });

  it("sends exactly the sender and the inbox label, with the address lowercased", async () => {
    const s = setup();
    s.gmail.grantScope(s.a.accountRef, GMAIL_SETTINGS_BASIC);
    await create(s, s.a, " News@Lists.Example.test ");
    expect(s.gmail.filtersOf(s.a.accountRef)).toMatchObject([
      {
        criteria: { from: "news@lists.example.test" },
        action: { removeLabelIds: ["INBOX"] },
      },
    ]);
  });

  it("reuses an identical filter without a create request", async () => {
    const s = setup();
    s.gmail.grantScope(s.a.accountRef, GMAIL_SETTINGS_BASIC);
    const existing = s.gmail.addFilter(s.a.accountRef, {
      criteria: { from: "News@lists.example.test" },
      action: { removeLabelIds: ["INBOX", "UNREAD"] },
    });
    expect(await create(s, s.a, "news@lists.example.test")).toEqual({
      ruleId: existing.id,
      created: false,
    });
    expect(s.requests().map((r) => r.method)).toEqual(["GET"]);
  });

  it.each([
    [
      "an extra criterion",
      { from: "n@lists.example.test", subject: "sale" },
      { removeLabelIds: ["INBOX"] },
    ],
    [
      "a label to add",
      { from: "n@lists.example.test" },
      { removeLabelIds: ["INBOX"], addLabelIds: ["Label_1"] },
    ],
    [
      "a forward",
      { from: "n@lists.example.test" },
      { removeLabelIds: ["INBOX"], forward: "x@example.test" },
    ],
    ["no archive", { from: "n@lists.example.test" }, { addLabelIds: ["STARRED"] }],
  ])("does not reuse a filter with %s", async (_name, criteria, action) => {
    const s = setup();
    s.gmail.grantScope(s.a.accountRef, GMAIL_SETTINGS_BASIC);
    s.gmail.addFilter(s.a.accountRef, { criteria, action });
    const made = await create(s, s.a, "n@lists.example.test");
    expect(made?.created).toBe(true);
    expect(s.gmail.filtersOf(s.a.accountRef)).toHaveLength(2);
  });

  it.each([
    "x@b.test OR y@c.test",
    "-x@b.test",
    "a@b.test,c@d.test",
    "{a@b.test c@d.test}",
    "a@b.test c@d.test",
    '"a@b.test"',
    "(a@b.test)",
    "a@b",
    "a@@b.test",
    "",
  ])("refuses %j with no request at all", async (from) => {
    const s = setup();
    s.gmail.grantScope(s.a.accountRef, GMAIL_SETTINGS_BASIC);
    expect(await kindOf(create(s, s.a, from))).toBe("invalid");
    expect(s.gmail.requests).toHaveLength(0);
  });

  it("refuses at 1,000 filters without a create request", async () => {
    const s = setup();
    s.gmail.grantScope(s.a.accountRef, GMAIL_SETTINGS_BASIC);
    s.gmail.fillFilters(s.a.accountRef, 1000);
    expect(await kindOf(create(s, s.a, "n@lists.example.test"))).toBe("limit");
    expect(s.requests().map((r) => r.method)).toEqual(["GET"]);
  });

  it("maps a missing permission to auth", async () => {
    const s = setup();
    expect(await kindOf(create(s, s.a, "n@lists.example.test"))).toBe("auth");
  });

  it("returns null on other routes without any request", async () => {
    const s = setup({ native: false });
    expect(await create(s, s.a, "n@lists.example.test")).toBeNull();
    await s.provider.deleteSenderRule?.(s.a, "filter-1", s.context);
    expect(s.gmail.requests).toHaveLength(0);
  });

  it("ignores a filter that is already gone and reports other delete failures", async () => {
    const s = setup();
    s.gmail.grantScope(s.a.accountRef, GMAIL_SETTINGS_BASIC);
    await s.provider.deleteSenderRule?.(s.a, "filter-missing", s.context);
    s.gmail.failNext(503, { urlIncludes: "settings/filters", times: 5 });
    expect(await kindOf(s.provider.deleteSenderRule?.(s.a, "filter-1", s.context))).toBe(
      "unavailable",
    );
  });

  it("rejects a caller whose user is not the account's", async () => {
    const s = setup();
    const stranger = { ...s.context, userId: "someone-else" };
    const rule = { from: "n@lists.example.test", skipInbox: true } as const;
    expect(await kindOf(s.provider.createSenderRule?.(s.a, rule, stranger))).toBe("auth");
    expect(await kindOf(s.provider.deleteSenderRule?.(s.a, "filter-1", stranger))).toBe("auth");
    expect(s.gmail.requests).toHaveLength(0);
  });
});
