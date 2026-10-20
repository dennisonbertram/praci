/**
 * Offline evaluation of the free pile rules over synthetic messages, with no database and no model.
 * Each case is raw header text, run through the real header parser and rule classifier. Two numbers
 * must stay at zero: spam or scam in a pile the user could clear in bulk, and personal, work,
 * security or billing mail in updates or newsletters.
 *
 * Learned sender decisions (stage 5) are covered with the `learned` field: a spoofed sender that
 * matches a learned decision must not use it.
 */
import type { InboxPile } from "@rakazo/contracts";
import { classifyPile, type LearnedPile } from "@rakazo/core";
import { describe, expect, it } from "vitest";
import { parseMailSignals } from "./mail-signals.js";

type Kind =
  | "personal"
  | "work"
  | "security"
  | "billing"
  | "receipt"
  | "notification"
  | "newsletter"
  | "marketing"
  | "cold_sales"
  | "spam"
  | "scam";

interface Case {
  name: string;
  kind: Kind;
  expected: InboxPile | null;
  from: string;
  subject: string;
  headers?: Array<[string, string]>;
  labels?: string[];
  mark?: "important" | "noise";
  /** Default false: checked and never written to. */
  prior?: boolean | null;
  /** The row was cached before headers were fetched. */
  noSignals?: boolean;
  /** The pile learned for this sender from earlier model verdicts. */
  learned?: LearnedPile;
}

const pass = (domain: string): [string, string] => [
  "Authentication-Results",
  `mx.google.com; dkim=pass header.i=@${domain}; spf=pass smtp.mailfrom=${domain}; dmarc=pass header.from=${domain}`,
];
const fail = (): [string, string] => [
  "Authentication-Results",
  "mx.google.com; dkim=fail header.i=@mail.example.test; spf=softfail; dmarc=fail",
];
const unsubscribe = (domain: string): Array<[string, string]> => [
  ["List-Unsubscribe", `<https://${domain}/u/token>, <mailto:u@${domain}>`],
  ["List-Unsubscribe-Post", "List-Unsubscribe=One-Click"],
];

const cases: Case[] = [
  // Personal
  {
    name: "family message, user has written before",
    kind: "personal",
    expected: "important",
    from: "Mom <mom@family.example.test>",
    subject: "Dinner on Sunday",
    headers: [pass("family.example.test")],
    prior: true,
  },
  {
    name: "friend, prior contact not checked yet",
    kind: "personal",
    expected: null,
    from: "Jo Friend <jo@friends.example.test>",
    subject: "Photos from the trip",
    headers: [pass("friends.example.test")],
    prior: null,
  },
  {
    name: "new acquaintance, never written to",
    kind: "personal",
    expected: null,
    from: "Lee New <lee@acquaintance.example.test>",
    subject: "Nice to meet you",
    headers: [pass("acquaintance.example.test")],
  },
  {
    name: "friend the user marked noise, user has written before",
    kind: "personal",
    expected: null,
    from: "Pat Chatty <pat@chatty.example.test>",
    subject: "Funny video",
    headers: [pass("chatty.example.test")],
    prior: true,
    mark: "noise",
  },
  // Work
  {
    name: "work ask from the boss",
    kind: "work",
    expected: null,
    from: "Boss <boss@work.example.test>",
    subject: "Can you send the Q3 numbers?",
    headers: [pass("work.example.test")],
  },
  {
    name: "colleague the user has written to",
    kind: "work",
    expected: "important",
    from: "Dana Colleague <dana@work.example.test>",
    subject: "Notes from standup",
    headers: [pass("work.example.test")],
    prior: true,
  },
  {
    name: "client thread, headers not fetched yet",
    kind: "work",
    expected: null,
    from: "Client <client@customer.example.test>",
    subject: "Re: contract terms",
    noSignals: true,
  },
  {
    name: "prior-contact sender with bulk headers",
    kind: "work",
    expected: null,
    from: "Accountant <tips@firm.example.test>",
    subject: "Year-end tips",
    headers: [pass("firm.example.test"), ...unsubscribe("firm.example.test")],
    prior: true,
  },
  {
    name: "sender with unknown prior contact and bulk headers",
    kind: "work",
    expected: null,
    from: "Partner <updates@partner.example.test>",
    subject: "Partner program changes",
    headers: [pass("partner.example.test"), ["Precedence", "bulk"]],
    prior: null,
  },
  {
    name: "sender marked important who sends List-Unsubscribe mail",
    kind: "work",
    expected: "important",
    from: "Mentor <mentor@advice.example.test>",
    subject: "Weekly digest",
    headers: [pass("advice.example.test"), ...unsubscribe("advice.example.test")],
    mark: "important",
  },
  // Security and billing
  {
    name: "real security alert from no-reply",
    kind: "security",
    expected: null,
    from: "Accounts <no-reply@accounts.example.test>",
    subject: "Security alert: new sign-in from Linux",
    headers: [pass("accounts.example.test"), ["Auto-Submitted", "auto-generated"]],
  },
  {
    name: "verification code from no-reply",
    kind: "security",
    expected: null,
    from: "Login <noreply@login.example.test>",
    subject: "Your verification code is 123456",
    headers: [pass("login.example.test")],
  },
  {
    name: "password reset with auto-submitted",
    kind: "security",
    expected: null,
    from: "Service <donotreply@service.example.test>",
    subject: "Password reset requested",
    headers: [pass("service.example.test"), ["Auto-Submitted", "auto-generated"]],
  },
  {
    name: "overdue invoice from no-reply",
    kind: "billing",
    expected: null,
    from: "Billing <no-reply@billing.example.test>",
    subject: "Invoice 88 is overdue",
    headers: [pass("billing.example.test"), ["Auto-Submitted", "auto-generated"]],
  },
  // Receipts and notifications
  {
    name: "transactional receipt from no-reply",
    kind: "receipt",
    expected: "updates",
    from: "Shop <no-reply@shop.example.test>",
    subject: "Your receipt from Shop",
    headers: [pass("shop.example.test")],
  },
  {
    name: "shipping update, auto-submitted",
    kind: "receipt",
    expected: "updates",
    from: "Orders <orders@shop.example.test>",
    subject: "Your order has shipped",
    headers: [pass("shop.example.test"), ["Auto-Submitted", "auto-generated"]],
  },
  {
    name: "app notification",
    kind: "notification",
    expected: "updates",
    from: "CI <notifications@tracker.example.test>",
    subject: "Build 412 finished",
    headers: [pass("tracker.example.test")],
  },
  {
    name: "social notification",
    kind: "notification",
    expected: "updates",
    from: "Social <hello@social.example.test>",
    subject: "Alex commented on your post",
    headers: [pass("social.example.test")],
    labels: ["CATEGORY_SOCIAL"],
  },
  {
    name: "updates category report",
    kind: "notification",
    expected: "updates",
    from: "Reports <reports@app.example.test>",
    subject: "Your weekly report is ready",
    headers: [pass("app.example.test")],
    labels: ["CATEGORY_UPDATES"],
  },
  // Newsletters and marketing
  {
    name: "newsletter with list id",
    kind: "newsletter",
    expected: "newsletters",
    from: "Weekly <weekly@news.example.test>",
    subject: "Five things worth reading",
    headers: [
      pass("news.example.test"),
      ...unsubscribe("news.example.test"),
      ["List-Id", "Weekly <weekly.news.example.test>"],
    ],
  },
  {
    name: "newsletter that is a forum digest",
    kind: "newsletter",
    expected: "newsletters",
    from: "Forum <digest@forum.example.test>",
    subject: "Top threads this week",
    headers: [pass("forum.example.test")],
    labels: ["CATEGORY_FORUMS"],
  },
  {
    name: "marketing with promotions label",
    kind: "marketing",
    expected: "newsletters",
    from: "Deals <deals@store.example.test>",
    subject: "Fall sale: 40% off",
    headers: [pass("store.example.test"), ...unsubscribe("store.example.test")],
    labels: ["CATEGORY_PROMOTIONS"],
  },
  {
    name: "marketing with bulk precedence only",
    kind: "marketing",
    expected: "newsletters",
    from: "Brand <hello@brand.example.test>",
    subject: "New arrivals",
    headers: [pass("brand.example.test"), ["Precedence", "bulk"]],
  },
  {
    name: "cold sales with List-Unsubscribe",
    kind: "cold_sales",
    expected: "newsletters",
    from: "Rep <rep@outreach.example.test>",
    subject: "Quick idea for your team",
    headers: [pass("outreach.example.test"), ...unsubscribe("outreach.example.test")],
  },
  {
    name: "cold sales with no list headers",
    kind: "cold_sales",
    expected: null,
    from: "Rep <rep@outreach2.example.test>",
    subject: "Following up",
    headers: [pass("outreach2.example.test")],
  },
  // Spam and scams
  {
    name: "spam-labelled with List-Unsubscribe",
    kind: "spam",
    expected: "spam",
    from: "Prize <win@prize.example.test>",
    subject: "You won",
    headers: [pass("prize.example.test"), ...unsubscribe("prize.example.test")],
    labels: ["SPAM"],
  },
  {
    name: "spam-labelled plain message",
    kind: "spam",
    expected: "spam",
    from: "Pills <offer@pharm.example.test>",
    subject: "Cheap meds",
    labels: ["SPAM"],
  },
  {
    name: "spam-labelled message from an address the user wrote to",
    kind: "spam",
    expected: "spam",
    from: "Hijacked <old@contact.example.test>",
    subject: "Check this out",
    labels: ["SPAM"],
    prior: true,
  },
  {
    name: "phishing that claims a brand and fails DMARC, with bulk headers",
    kind: "scam",
    expected: "spam",
    from: "PayPal Support <support@paypa1-secure.example.test>",
    subject: "Confirm your account",
    headers: [fail(), ["Precedence", "bulk"], ...unsubscribe("paypa1-secure.example.test")],
  },
  {
    name: "phishing with a forged passing header and a real failing one",
    kind: "scam",
    expected: "spam",
    from: "Microsoft 365 Team <alerts@m365-alerts.example.test>",
    subject: "Mailbox storage is full",
    headers: [
      ["Authentication-Results", "attacker.example.test; dkim=pass; spf=pass; dmarc=pass"],
      fail(),
      ["Precedence", "bulk"],
    ],
  },
  {
    name: "failed authentication without a known brand and with list headers",
    kind: "scam",
    expected: null,
    from: "Courier <track@parcel-notice.example.test>",
    subject: "A package is waiting",
    headers: [fail(), ...unsubscribe("parcel-notice.example.test")],
  },
  {
    name: "brand-claiming message with failed authentication from a prior contact",
    kind: "scam",
    expected: "spam",
    from: "Apple ID <id@apple-verify.example.test>",
    subject: "Your Apple ID was locked",
    headers: [fail()],
    prior: true,
  },
  {
    name: "forged prior contact with failed authentication, no brand and no list headers",
    kind: "scam",
    expected: null,
    from: "Pat Example <pat@contact.example.test>",
    subject: "Wire needed today",
    headers: [fail()],
    prior: true,
  },
  {
    name: "forged important-marked sender with failed authentication",
    kind: "scam",
    expected: null,
    from: "Pat Example <pat@contact.example.test>",
    subject: "Wire needed today",
    headers: [fail()],
    mark: "important",
  },
  // Newsletters that Gmail files under Updates, and receipts that carry list headers
  {
    name: "Gmail-updates research newsletter with list headers",
    kind: "newsletter",
    expected: "newsletters",
    from: "Research Weekly <digest@research.example.test>",
    subject: "This week in papers",
    headers: [
      pass("research.example.test"),
      ...unsubscribe("research.example.test"),
      ["List-Id", "Research <research.research.example.test>"],
    ],
    labels: ["CATEGORY_UPDATES"],
  },
  {
    name: "shop receipt with list headers and the updates label",
    kind: "receipt",
    expected: "updates",
    from: "Shop <orders@shop.example.test>",
    subject: "Your receipt from Shop",
    headers: [pass("shop.example.test"), ...unsubscribe("shop.example.test")],
    labels: ["CATEGORY_UPDATES"],
  },
  {
    name: "auto-submitted with unsubscribe",
    kind: "notification",
    expected: "updates",
    from: "App <app@service.example.test>",
    subject: "Your export is ready",
    headers: [
      pass("service.example.test"),
      ["Auto-Submitted", "auto-generated"],
      ...unsubscribe("service.example.test"),
    ],
  },
  {
    name: '"Order now" promo with list headers',
    kind: "marketing",
    expected: "newsletters",
    from: "Deals <deals@store.example.test>",
    subject: "Order now and save 20%",
    headers: [pass("store.example.test"), ...unsubscribe("store.example.test")],
    labels: ["CATEGORY_UPDATES"],
  },
  {
    // Documents the known trade-off: a List-Id means a mailing list, so it is read as one.
    name: "notifications@ sender with a List-Id",
    kind: "notification",
    expected: "newsletters",
    from: "Tracker <notifications@tracker.example.test>",
    subject: "New comment on issue 12",
    headers: [pass("tracker.example.test"), ["List-Id", "Project <project.tracker.example.test>"]],
  },
  // Learned sender decisions
  {
    name: "learned newsletter sender with quiet headers and passing auth",
    kind: "newsletter",
    expected: "newsletters",
    from: "Notes <hello@notes.example.test>",
    subject: "Field notes for October",
    headers: [pass("notes.example.test")],
    learned: "newsletters",
  },
  {
    name: "spoofed sender matching a learned newsletter, failed auth, no brand, no list headers",
    kind: "scam",
    expected: null,
    from: "Notes <hello@notes.example.test>",
    subject: "Field notes for October",
    headers: [fail()],
    learned: "newsletters",
  },
  {
    name: "learned sender with a sign-in alert subject",
    kind: "security",
    expected: null,
    from: "Notes <hello@notes.example.test>",
    subject: "New sign-in to your account",
    headers: [pass("notes.example.test")],
    learned: "newsletters",
  },
  {
    name: "learned sender, authentication results missing",
    kind: "newsletter",
    expected: null,
    from: "Notes <hello@notes.example.test>",
    subject: "Field notes for October",
    learned: "newsletters",
  },
];

function run(testCase: Case) {
  const headers = new Map<string, string[]>();
  for (const [name, value] of testCase.headers ?? []) {
    const key = name.toLowerCase();
    headers.set(key, [...(headers.get(key) ?? []), value]);
  }
  const match = /^(.*?)\s*<(.+)>$/.exec(testCase.from);
  return classifyPile({
    fromName: match?.[1] || null,
    fromAddress: (match?.[2] ?? testCase.from).toLowerCase(),
    subject: testCase.subject,
    signals: testCase.noSignals ? null : parseMailSignals(headers, testCase.labels ?? []),
    senderMark: testCase.mark ?? null,
    priorContact: testCase.prior === undefined ? false : testCase.prior,
    skipInbox: false,
    learnedPile: testCase.learned ?? null,
  });
}

describe("pile rules over synthetic messages", () => {
  it("has at least thirty cases", () => {
    expect(cases.length).toBeGreaterThanOrEqual(30);
  });

  for (const testCase of cases)
    it(`${testCase.kind}: ${testCase.name} -> ${testCase.expected ?? "model"}`, () => {
      expect(run(testCase).pile).toBe(testCase.expected);
    });

  it("never puts spam or scam in a pile the user could clear in bulk", () => {
    const bad = cases.filter((c) => {
      const pile = run(c).pile;
      return (c.kind === "spam" || c.kind === "scam") && pile !== "spam" && pile !== null;
    });
    expect(bad.map((c) => c.name)).toEqual([]);
  });

  it("never hides personal, work, security or billing mail in updates or newsletters", () => {
    const bad = cases.filter((c) => {
      const pile = run(c).pile;
      return (
        ["personal", "work", "security", "billing"].includes(c.kind) &&
        (pile === "updates" || pile === "newsletters")
      );
    });
    expect(bad.map((c) => c.name)).toEqual([]);
  });
});
