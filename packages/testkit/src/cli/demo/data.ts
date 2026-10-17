import type { EmulatedMcpServer, EmulatedMessage } from "@rakazo/adapters";
import { makePdf } from "../../../../adapters/src/data-room-test-fakes.js";
import {
  brexAccountsResponse,
  brexExpense,
  fakeBrex,
  fakeMercury,
  MERCURY_CHECKING,
  MERCURY_SAVINGS,
  mercuryAccountsResponse,
  mercuryRow,
} from "../../../../adapters/src/finance-fake-tools.js";
import { fakeRpc } from "../../../../adapters/src/rpc-crypto-fake-fetch.js";

/**
 * Everything the mock demo stack shows. Each name, subject, address and note is invented and says
 * so, so nobody mistakes the demo for a real company. Dates are relative to `now`.
 */

export const MOCK_NOTE = "Mock demo data";
export const DEMO_COMPANY = "MOCK DEMO DATA — Northwind Robotics";
/** A space with nothing connected, for the first-run and empty states. */
export const DEMO_EMPTY_SPACE = "MOCK DEMO DATA — Empty space";
/** A space whose only Gmail account lost its sign-in, for the Reconnect state. */
export const DEMO_RECONNECT_SPACE = "MOCK DEMO DATA — Mail needs reconnect";
/** Mail sent to this domain fails, so a failed send can be tried (for example bounce@…). */
export const DEMO_BOUNCE_DOMAIN = "send-fail.example.test";
/** How long after the stack starts the mock new email arrives. */
export const DEMO_NEW_MAIL_DELAY_MS = 3 * 60_000;
export const DEMO_USER_NAME = "Alex Founder (Mock)";
export const DEMO_EMAIL = "mock-founder@demo.rakazo.test";
/** Short, so the subject itself stays readable in a list row. */
export const MOCK_SUBJECT_PREFIX = "[MOCK]";

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const FOOTER = `\n\n-- \n${MOCK_NOTE}: invented for UX testing. Not a real message.`;

// ---- Inbox ----

const ME = "Alex Founder (Mock) <mock-founder@northwind.example.test>";
const MORGAN = "Morgan Pretend <morgan@halcyon-logistics.example.test>";
const DANA = "Dana Counselor <dana@halcyon-logistics.example.test>";

type Mail = {
  /** Unique within the mailbox; a reply shares its thread's id. */
  thread: string;
  agoMs: number;
  from: string;
  /** Defaults to the founder. */
  to?: string;
  cc?: string;
  subject: string;
  text: string;
  labels?: string[];
  unread?: boolean;
  starred?: boolean;
  /** Sent by the founder: in Sent, not in the Inbox. */
  sent?: boolean;
  attachments?: EmulatedMessage["attachments"];
};

/** A file of `bytes` mock bytes, for attachment-size limits. */
const mockFile = (filename: string, mimeType: string, bytes: number) => ({
  filename,
  mimeType,
  size: 0,
  data: Buffer.alloc(bytes, 77).toString("base64"),
});

const MAIL: Mail[] = [
  {
    thread: "investor-update",
    agoMs: 2 * HOUR_MS,
    from: "Priya Placeholder <priya@quill-capital.example.test>",
    subject: "Q3 investor update: draft for your review",
    text: "Hi Alex,\n\nHere is the draft of the Q3 update for our LPs. Can you check the runway and hiring numbers before Friday?\n\nPriya\nQuill Capital (Mock)",
    unread: true,
    starred: true,
  },
  // A four-message conversation with Cc, for the thread view and Reply all.
  {
    thread: "msa-redlines",
    agoMs: 30 * HOUR_MS,
    from: MORGAN,
    cc: DANA,
    subject: "Redlines on the Master Services Agreement",
    text: "Alex,\n\nOur counsel returned redlines on sections 4 (liability cap) and 9 (termination). We can sign this week if you accept them.\n\nMorgan\nHalcyon Logistics (Mock)",
  },
  {
    thread: "msa-redlines",
    agoMs: 26 * HOUR_MS,
    from: ME,
    to: MORGAN,
    cc: DANA,
    sent: true,
    subject: "Redlines on the Master Services Agreement",
    text: "Thanks Morgan. Our counsel is reviewing both sections and I will reply by Thursday.\n\nAlex",
  },
  {
    thread: "msa-redlines",
    agoMs: 8 * HOUR_MS,
    from: DANA,
    cc: MORGAN,
    subject: "Redlines on the Master Services Agreement",
    text: "Alex, to clarify section 9: we are asking for 60 days' notice of termination instead of 30. Section 4 is as marked.\n\nDana\nHalcyon Logistics (Mock)",
  },
  {
    thread: "msa-redlines",
    agoMs: 3 * HOUR_MS,
    from: MORGAN,
    cc: DANA,
    subject: "Redlines on the Master Services Agreement",
    text: "Alex, if section 9 works for you, can we sign on Thursday?\n\nMorgan",
    unread: true,
  },
  {
    thread: "hosting-invoice",
    agoMs: 9 * HOUR_MS,
    from: "Cloudnine Hosting <billing@cloudnine-hosting.example.test>",
    subject: "Invoice #MOCK-1043 due Oct 30",
    text: "Your October invoice for $4,812.00 is ready. Pay by Oct 30 to avoid a late fee.\n\nCloudnine Hosting (Mock)",
    unread: true,
  },
  {
    thread: "trademark-notice",
    agoMs: 1 * DAY_MS,
    from: "Fictional Law Group <notices@fictional-law.example.test>",
    subject: "Legal notice: trademark office action response due in 30 days",
    text: "The trademark office issued an office action on the Northwind mark. A response is due in 30 days. Please confirm whether you want us to prepare it.\n\nFictional Law Group (Mock)",
    unread: true,
    starred: true,
  },
  {
    thread: "intro-request",
    agoMs: 1.2 * DAY_MS,
    from: "Jamie Placeholder <jamie@intros.example.test>",
    subject: "Intro request: Dana Fakename at Acme Ventures (Mock)",
    text: "Alex, Dana Fakename would like a short intro call about your seed round. Are you open to it? I can write the intro today.\n\nJamie",
  },
  {
    thread: "board-deck",
    agoMs: 1.5 * DAY_MS,
    from: "Riley Testwell <riley@bookkeeping.example.test>",
    subject: "Q3 board deck (PDF attached)",
    text: "Alex, the Q3 board deck is attached. The financial slides use the September close.\n\nRiley\nBookkeeping Co (Mock)",
    attachments: [
      {
        filename: "MOCK-q3-board-deck.pdf",
        mimeType: "application/pdf",
        size: 0,
        // A real one-page PDF, so it opens and shows a sensible size.
        data: Buffer.from(
          makePdf(
            "MOCK DEMO DATA - Northwind Robotics Q3 board deck. Revenue, burn and hiring use the September close. Invented for UX testing.",
          ),
        ).toString("base64"),
      },
    ],
  },
  {
    thread: "customer-pilot",
    agoMs: 2 * DAY_MS,
    from: "Sam Samplesworth <sam@pilot-customer.example.test>",
    subject: "Pilot results and next steps",
    text: "Alex, the pilot ran well. We would like to discuss moving to an annual contract. When can we talk?\n\nSam\nPilot Customer Inc (Mock)",
    unread: true,
  },
  {
    thread: "payroll",
    agoMs: 2.5 * DAY_MS,
    from: "Paylodex Payroll <no-reply@paylodex.example.test>",
    subject: "Payroll run scheduled for Oct 28",
    text: "Your payroll run for 6 employees is scheduled for Oct 28. Total: $58,400.00.\n\nPaylodex (Mock)",
  },
  {
    thread: "lease-renewal",
    agoMs: 3 * DAY_MS,
    from: "Landlord Placeholder LLC <leasing@placeholder-lease.example.test>",
    subject: "Office lease renewal option",
    text: "Your office lease renews on Jan 31. Please tell us by Nov 30 whether you will renew for 24 months.\n\nLandlord Placeholder LLC (Mock)",
  },
  {
    thread: "candidate",
    agoMs: 3.5 * DAY_MS,
    from: "Taylor Notreal <taylor@recruiting.example.test>",
    subject: "Candidate for Senior Firmware Engineer",
    text: "Alex, I have a strong candidate for the firmware role. Shall I send the resume?\n\nTaylor\nRecruiting Partners (Mock)",
  },
  {
    thread: "expense-question",
    agoMs: 4 * DAY_MS,
    from: "Riley Testwell <riley@bookkeeping.example.test>",
    subject: "Question about a September charge",
    text: "Alex, there is a $2,400 charge from Globex Cloud (Mock) in September that I cannot match to a receipt. Can you send one?\n\nRiley",
  },
  {
    thread: "demo-day",
    agoMs: 5 * DAY_MS,
    from: "Accelerator Team <hello@mock-accelerator.example.test>",
    subject: "Demo day: speaker slots open",
    text: "Demo day is Nov 14. Speaker slots are open to alumni. Reply by Nov 1 to reserve yours.\n\nMock Accelerator",
  },
  {
    thread: "security-review",
    agoMs: 5.5 * DAY_MS,
    from: "Halcyon Security <security@halcyon-logistics.example.test>",
    subject: "Vendor security questionnaire",
    text: "Before signing, our security team needs the attached questionnaire completed. Typical turnaround is 5 business days.\n\nHalcyon Logistics (Mock)",
    attachments: [
      {
        filename: "MOCK-security-questionnaire.csv",
        mimeType: "text/csv",
        size: 0,
        data: Buffer.from(
          "question,answer\nDo you encrypt data at rest? (MOCK DEMO DATA),\nDo you run annual penetration tests? (MOCK DEMO DATA),\n",
        ).toString("base64"),
      },
    ],
  },
  {
    thread: "insurance",
    agoMs: 6 * DAY_MS,
    from: "Shieldwell Insurance <policy@shieldwell.example.test>",
    subject: "Your policy renews Dec 1",
    text: "Your general liability policy renews on Dec 1 at $3,100 per year. No action is needed unless you want to change coverage.\n\nShieldwell Insurance (Mock)",
  },
  {
    thread: "saas-offer",
    agoMs: 6.5 * DAY_MS,
    from: "Docuflow Sales <sales@docuflow.example.test>",
    subject: "Your trial ends in 3 days",
    text: "Your Docuflow trial ends soon. Upgrade now for 20 percent off the first year.\n\nDocuflow (Mock)",
    labels: ["CATEGORY_PROMOTIONS"],
  },
  {
    thread: "team-lunch",
    agoMs: 7 * DAY_MS,
    from: "Casey Coworker <casey@northwind.example.test>",
    subject: "Team offsite: dates and venue",
    text: "Hi Alex, I shortlisted two venues for the team offsite on Nov 21 or Nov 28. Which date works for you?\n\nCasey",
  },
  // Over the 10 MB attachment limit, so forwarding it shows the limit.
  {
    thread: "demo-video",
    agoMs: 4.5 * DAY_MS,
    from: "Casey Coworker <casey@northwind.example.test>",
    subject: "Product demo video for the reseller call",
    text: "Alex, here is the demo video for the reseller call. It is large, so download it before you travel.\n\nCasey",
    attachments: [mockFile("MOCK-northwind-demo.mp4", "video/mp4", 12 * 1024 * 1024)],
  },
  {
    thread: "newsletter-weekly",
    agoMs: 1 * DAY_MS,
    from: "The Mock Weekly <news@mock-weekly.example.test>",
    subject: "This week in robotics funding",
    text: "Seed rounds for robotics startups rose this quarter. Read the full roundup on our site.",
    labels: ["CATEGORY_UPDATES"],
    unread: true,
  },
  {
    thread: "newsletter-founder",
    agoMs: 2 * DAY_MS,
    from: "Founder Digest <digest@founder-digest.example.test>",
    subject: "How to run a board meeting",
    text: "Five habits that make board meetings shorter and more useful. Plus: a template for the pre-read.",
    labels: ["CATEGORY_UPDATES"],
  },
  {
    thread: "newsletter-metrics",
    agoMs: 4 * DAY_MS,
    from: "SaaS Metrics Monthly <hello@saas-metrics.example.test>",
    subject: "Benchmarks: burn multiple by stage",
    text: "Median burn multiples by stage for October, from 400 invented companies.",
    labels: ["CATEGORY_UPDATES"],
  },
  {
    thread: "newsletter-robotics",
    agoMs: 8 * DAY_MS,
    from: "Robotics Roundup <editor@robotics-roundup.example.test>",
    subject: "New sensors worth watching",
    text: "Three new depth sensors reviewed, with prices and lead times.",
    labels: ["CATEGORY_PROMOTIONS"],
  },
  {
    thread: "tax-reminder",
    agoMs: 9 * DAY_MS,
    from: "Riley Testwell <riley@bookkeeping.example.test>",
    subject: "Quarterly estimated tax reminder",
    text: "A reminder that the Q4 estimated tax payment is due Dec 15. I will prepare the figures once October closes.\n\nRiley",
  },
  {
    thread: "safe-signed",
    agoMs: 10 * DAY_MS,
    from: "Priya Placeholder <priya@quill-capital.example.test>",
    subject: "SAFE countersigned",
    text: "Alex, the countersigned SAFE for $250,000 is filed. Wire should arrive within two business days.\n\nPriya",
  },
  {
    thread: "partner-intro",
    agoMs: 11 * DAY_MS,
    from: "Jordan Mockerson <jordan@channel-partner.example.test>",
    subject: "Partnership proposal: reseller program",
    text: "We would like to resell Northwind robots in the Midwest. Can we schedule a call to discuss margins?\n\nJordan",
  },
  {
    thread: "grant-application",
    agoMs: 13 * DAY_MS,
    from: "Mock Innovation Fund <grants@mock-innovation.example.test>",
    subject: "Grant application received",
    text: "We received your application for the Robotics Innovation Grant. Decisions are announced Dec 5.\n\nMock Innovation Fund",
  },
  // Older than the 14-day sync window: only Search older mail finds it.
  {
    thread: "w9-request",
    agoMs: 40 * DAY_MS,
    from: "Riley Testwell <riley@bookkeeping.example.test>",
    subject: "W-9 for the new vendor",
    text: "Alex, can you send the W-9 for Globex Cloud (Mock) so I can file it?\n\nRiley",
  },
  {
    thread: "support-ticket",
    agoMs: 12 * DAY_MS,
    from: "Sam Samplesworth <sam@pilot-customer.example.test>",
    subject: "Robot arm calibration question",
    text: "One of the arms drifts after long runs. Is there a recalibration procedure we should follow?\n\nSam",
  },
];

/** The second connected account, so the account tabs and the From picker have something to show. */
const SALES_MAIL: Mail[] = [
  {
    thread: "sales-lead",
    agoMs: 5 * HOUR_MS,
    from: "Robin Prospect <robin@beacon-retail.example.test>",
    to: "Northwind Sales (Mock) <sales@northwind.example.test>",
    subject: "Pricing for 20 units",
    text: "Hello, could you send pricing for 20 picking robots, delivered in Q1?\n\nRobin\nBeacon Retail (Mock)",
    unread: true,
  },
  {
    thread: "sales-trade-show",
    agoMs: 2 * DAY_MS,
    from: "Expo Organizers <booths@mock-expo.example.test>",
    to: "Northwind Sales (Mock) <sales@northwind.example.test>",
    subject: "Booth confirmation for the logistics expo",
    text: "Your booth B14 is confirmed for Nov 20-22.\n\nMock Expo",
  },
];

function toMessages(prefix: string, mail: Mail[], now: Date): EmulatedMessage[] {
  const seen = new Map<string, number>();
  return mail.map((item, index): EmulatedMessage => {
    const count = (seen.get(item.thread) ?? 0) + 1;
    seen.set(item.thread, count);
    return {
      id: `${prefix}-${index + 1}`,
      threadId: `${prefix}-thread-${item.thread}`,
      date: new Date(now.getTime() - item.agoMs).toISOString(),
      labels: [
        item.sent ? "SENT" : "INBOX",
        ...(item.labels ?? []),
        ...(item.unread ? ["UNREAD"] : []),
        ...(item.starred ? ["STARRED"] : []),
      ],
      from: item.from,
      to: item.to ?? ME,
      ...(item.cc ? { cc: item.cc } : {}),
      // "Re:" first, as mail clients write it, so a reply does not read "Re: [MOCK] Re: …".
      subject: `${count > 1 ? "Re: " : ""}${MOCK_SUBJECT_PREFIX} ${item.subject}`,
      text: `${item.text}${FOOTER}`,
      ...(item.attachments ? { attachments: item.attachments } : {}),
    };
  });
}

/** The email that arrives a few minutes after the stack starts, to watch new mail come in. */
export function demoNewMail(now = new Date()): EmulatedMessage {
  return {
    id: `mock-demo-new-${now.getTime()}`,
    threadId: "mock-demo-thread-new-mail",
    date: now.toISOString(),
    labels: ["INBOX", "UNREAD"],
    from: "Priya Placeholder <priya@quill-capital.example.test>",
    to: ME,
    subject: `${MOCK_SUBJECT_PREFIX} Quick question on the hiring plan`,
    text: `Hi Alex,\n\nBefore the LP call, can you confirm we still plan two engineering hires in Q4?\n\nPriya${FOOTER}`,
  };
}

/**
 * The demo mailboxes, shaped like `e2eMailboxes` so the e2e Composio emulator can serve them. The
 * emulator hands them out in this order, one per Gmail connection.
 */
export function demoMailboxes(now = new Date()) {
  return {
    "mock-demo-mailbox": {
      address: "mock-founder@northwind.example.test",
      messages: toMessages("mock-demo", MAIL, now),
    },
    "mock-demo-sales": {
      address: "sales@northwind.example.test",
      messages: toMessages("mock-sales", SALES_MAIL, now),
    },
  };
}

// ---- Finance ----

const mockName = (name: string) => `${name} (Mock)`;

type Recurring = { vendor: string; cents: number; category: string };

const MERCURY_MONTHLY: Array<{
  vendor: string;
  dollars: number;
  day: number;
  category: string | null;
  kind: string;
}> = [
  {
    vendor: "Paylodex Payroll (Mock)",
    dollars: -58_400,
    day: 28,
    category: "Payroll",
    kind: "ach",
  },
  {
    vendor: "Landlord Placeholder LLC (Mock)",
    dollars: -7_500,
    day: 1,
    category: "Rent",
    kind: "ach",
  },
  {
    vendor: "Pilot Customer Inc (Mock)",
    dollars: 18_000,
    day: 12,
    category: "Revenue",
    kind: "ach",
  },
  {
    vendor: "Beacon Retail (Mock)",
    dollars: 9_500,
    day: 20,
    category: "Revenue",
    kind: "wire",
  },
  // Left uncategorized, as Mercury leaves it, so Finance recognizes it as a Brex card payment.
  { vendor: "Brex", dollars: -11_200, day: 5, category: null, kind: "ach" },
  {
    vendor: "Shieldwell Insurance (Mock)",
    dollars: -258.33,
    day: 3,
    category: "Insurance",
    kind: "ach",
  },
];

const BREX_MONTHLY: Array<Recurring & { day: number }> = [
  { vendor: "Cloudnine Hosting (Mock)", cents: 481_200, category: "Servers", day: 8 },
  { vendor: "Docuflow (Mock)", cents: 12_900, category: "Software", day: 9 },
  { vendor: "Chatterbox Messaging (Mock)", cents: 8_750, category: "Software", day: 10 },
  { vendor: "Sketchpad Design (Mock)", cents: 4_500, category: "Software", day: 14 },
  { vendor: "Globex Cloud (Mock)", cents: 240_000, category: "Servers", day: 16 },
  { vendor: "Mockbooks Accounting (Mock)", cents: 15_000, category: "Software", day: 18 },
];

/** Whole-day offsets from `now` back to the given day of the month `monthsAgo` months earlier. */
function monthDay(now: Date, monthsAgo: number, day: number): Date {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo, day, 15));
  return date;
}

/**
 * Last month's statement for a bank with no integration, as a CSV export, so Accounts shows a
 * statement account (named from the file, so it can be renamed) and the monthly reminder.
 */
export function demoStatementCsv(now = new Date()): { fileName: string; body: string } {
  const day = (d: number) => monthDay(now, 1, d).toISOString().slice(0, 10);
  const month = day(1).slice(0, 7);
  const rows = [
    [day(3), "MOCK Customer Beta (Mock) deposit", "1200.00", "11200.00"],
    [day(9), "MOCK Office Supplies (Mock)", "-250.00", "10950.00"],
    [day(18), "MOCK Courier Service (Mock)", "-450.00", "10500.00"],
  ];
  return {
    fileName: `mock-community-bank-${month}.csv`,
    body: `Date,Description,Amount,Balance\n${rows.map((r) => r.join(",")).join("\n")}\n`,
  };
}

/**
 * Canned Mercury and Brex tool callers holding about three months of invented history, built on the
 * repo's finance fakes. Pass `callToolFor` to `createApp` and to `syncFinanceForUser`.
 */
export function demoFinance(now = new Date()) {
  const dated = <T>(rows: Array<{ at: Date; row: T }>) =>
    rows
      .filter((r) => r.at <= now)
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .map((r) => r.row);

  const safeAt = new Date(now.getTime() - 8 * DAY_MS);
  const safeWire = {
    at: safeAt,
    row: mercuryRow("mock-merc-safe-wire", {
      counterpartyName: "Quill Capital (Mock)",
      amount: 250_000,
      date: safeAt.toISOString(),
      category: "Investment",
      kind: "wire",
    }),
  };
  const checking = dated([
    safeWire,
    ...[0, 1, 2, 3, 4].flatMap((monthsAgo) =>
      MERCURY_MONTHLY.map((m) => {
        const at = monthDay(now, monthsAgo, m.day);
        return {
          at,
          row: mercuryRow(`mock-merc-${monthsAgo}-${m.day}-${m.vendor.slice(0, 4)}`, {
            counterpartyName: m.vendor,
            amount: m.dollars,
            date: at.toISOString(),
            category: m.category,
            kind: m.kind,
          }),
        };
      }).filter(({ at }) => now.getTime() - at.getTime() < 130 * DAY_MS),
    ),
  ]);

  const expenses = dated(
    [0, 1, 2, 3, 4].flatMap((monthsAgo) =>
      BREX_MONTHLY.map((m) => {
        const at = monthDay(now, monthsAgo, m.day);
        const value = (m.cents / 100).toFixed(2);
        const money = { value, currency: "USD", display: `$${value} USD` };
        return {
          at,
          row: brexExpense(`mock-brex-${monthsAgo}-${m.day}`, {
            purchased_at: at.toISOString(),
            posted_at: new Date(at.getTime() + DAY_MS).toISOString(),
            merchant: { id: `pmch_${m.day}`, name: m.vendor },
            vendor: { id: `pmch_${m.day}`, name: m.vendor, email: null },
            merchant_category: { id: `pmca_${m.day}`, name: m.category },
            memo: MOCK_NOTE,
            original_amount: money,
            purchased_amount: money,
            amount: money,
            card: { id: "ncard_1", last4: "0001", partner: null },
          }),
        };
      }).filter(({ at }) => now.getTime() - at.getTime() < 130 * DAY_MS),
    ),
  );

  const accounts = mercuryAccountsResponse();
  const mercuryAccounts = {
    ...accounts,
    accounts: (accounts.accounts as Array<Record<string, unknown>>).map((a) => ({
      ...a,
      name: a.id === MERCURY_CHECKING ? "MOCK Checking ••1111" : "MOCK Savings ••2222",
      availableBalance: a.id === MERCURY_CHECKING ? 187_420.55 : 225_000,
    })),
    totalAvailableBalance: 412_420.55,
  };
  const brexAccounts = {
    ...brexAccountsResponse,
    items: brexAccountsResponse.items.map((a) => ({
      ...a,
      name: mockName(a.name),
      nickname: undefined,
    })),
  };

  const mercury = fakeMercury({
    txns: { [MERCURY_CHECKING]: checking, [MERCURY_SAVINGS]: [] },
    accounts: mercuryAccounts,
    treasury: { accounts: [], page: {} },
  });
  // Not yet cleared: shows as Pending on the dashboard and on its transaction page.
  const pendingAt = new Date(now.getTime() - DAY_MS);
  const pendingMoney = { value: "612.40", currency: "USD", display: "$612.40 USD" };
  expenses.unshift(
    brexExpense("mock-brex-pending", {
      purchased_at: pendingAt.toISOString(),
      posted_at: null,
      payment_status: "PROCESSING",
      merchant: { id: "pmch_air", name: "Skyline Air (Mock)" },
      vendor: { id: "pmch_air", name: "Skyline Air (Mock)", email: null },
      merchant_category: { id: "pmca_air", name: "Travel" },
      memo: MOCK_NOTE,
      original_amount: pendingMoney,
      purchased_amount: pendingMoney,
      amount: pendingMoney,
      card: { id: "ncard_1", last4: "0001", partner: null },
    }),
  );
  // An approved bill not yet paid: an "Upcoming" bill row, not a transaction.
  const bills = [
    {
      id: "mock-bill-legal",
      status: "APPROVED",
      due_at: new Date(now.getTime() + 10 * DAY_MS).toISOString(),
      vendor: { name: "Placeholder Legal LLP (Mock)" },
      amount: { value: "2000.00", currency: "USD" },
    },
  ];
  const brex = fakeBrex({ expenses, bills });
  const brexCallTool: typeof brex.callTool = async (name, args) =>
    name === "list_business_accounts" ? brexAccounts : brex.callTool(name, args);
  return {
    callToolFor: async (server: { provider: string }) =>
      server.provider === "mercury" ? mercury.callTool : brexCallTool,
  };
}

/** Invented treasury wallet: 0x…d3e0 is not a real holder; nothing here touches a real chain. */
export const DEMO_WALLET = {
  address: "0x000000000000000000000000000000000000d3e0",
  label: "MOCK Treasury wallet",
} as const;
const USDC_ETHEREUM = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";

/**
 * An offline JSON-RPC and price fake holding the mock wallet's balances (2.5 ETH and 40,000 USDC on
 * Ethereum). Pass `fetch` to `createApp` as `cryptoFetch` so the Crypto page never calls the network.
 */
export function demoCrypto() {
  return fakeRpc({
    chains: {
      1: {
        balances: { [DEMO_WALLET.address]: 2_500_000_000_000_000_000n },
        tokens: { [USDC_ETHEREUM]: { [DEMO_WALLET.address]: 40_000_000_000n } },
      },
    },
    prices: {
      "coingecko:ethereum": { price: 2_500, confidence: 0.99 },
      [`ethereum:${USDC_ETHEREUM}`]: { price: 1, confidence: 0.99 },
    },
  });
}

// ---- Cap table contacts, data room, bots ----

export const DEMO_CONTACTS = [
  {
    name: "Priya Placeholder",
    email: "priya@quill-capital.example.test",
    organization: "Quill Capital (Mock)",
    kind: "investor" as const,
    notes: `${MOCK_NOTE}: lead investor, holds the $250,000 SAFE.`,
  },
  {
    name: "Dana Fakename",
    email: "dana@acme-ventures.example.test",
    organization: "Acme Ventures (Mock)",
    kind: "investor" as const,
    notes: `${MOCK_NOTE}: prospective seed investor, intro requested.`,
  },
  {
    name: "Lee Notarealperson",
    email: "lee@angel.example.test",
    organization: "Independent angel (Mock)",
    kind: "investor" as const,
    notes: `${MOCK_NOTE}: angel, 0.5% via a small SAFE.`,
  },
  {
    name: "Quinn Auditwell",
    email: "quinn@auditwell.example.test",
    organization: "Auditwell LLP (Mock)",
    kind: "auditor" as const,
    notes: `${MOCK_NOTE}: annual 409A and audit contact.`,
  },
  {
    name: "Fictional Law Group",
    email: "counsel@fictional-law.example.test",
    organization: "Fictional Law Group (Mock)",
    kind: "other" as const,
    notes: `${MOCK_NOTE}: outside counsel.`,
  },
];

/** The Carta agent's last read of the mock cap table; matches the MOCK Cap Table Summary in the data room. */
export const DEMO_CAP_TABLE = {
  companyName: DEMO_COMPANY,
  asOf: "2026-10-01",
  fullyDilutedShares: 10_000_000,
  amountRaisedUsd: 300_000,
  optionPoolAvailable: 600_000,
  latest409a: { pricePerShareUsd: 0.42, date: "2026-07-01" },
  shareClasses: [
    { name: "Common (Mock)", shares: 8_500_000, percent: 85 },
    { name: "Option pool (Mock)", shares: 1_500_000, percent: 15 },
  ],
  holders: [
    {
      name: DEMO_USER_NAME,
      email: null,
      organization: null,
      security: "Common",
      shares: 4_000_000,
      amountUsd: null,
      percent: 40,
    },
    {
      name: "River Cofounder (Mock)",
      email: null,
      organization: null,
      security: "Common",
      shares: 3_000_000,
      amountUsd: null,
      percent: 30,
    },
    {
      name: "Early employees (Mock)",
      email: null,
      organization: null,
      security: "Common",
      shares: 1_500_000,
      amountUsd: null,
      percent: 15,
    },
    {
      name: "Granted options (Mock)",
      email: null,
      organization: null,
      security: "Options",
      shares: 900_000,
      amountUsd: null,
      percent: 9,
    },
    {
      name: "Priya Placeholder",
      email: "priya@quill-capital.example.test",
      organization: "Quill Capital (Mock)",
      security: "SAFE",
      shares: null,
      amountUsd: 250_000,
      percent: null,
    },
    {
      name: "Lee Notarealperson",
      email: "lee@angel.example.test",
      organization: "Independent angel (Mock)",
      security: "SAFE",
      shares: null,
      amountUsd: 50_000,
      percent: null,
    },
  ],
};

/**
 * A mock Carta MCP server for the demo: the read tools the Carta agent uses, all answering from
 * DEMO_CAP_TABLE, so the agent can answer ownership questions offline.
 *
 * With `webOrigin`, it asks for a sign-in like the real Carta does. Its mock sign-in page is the
 * app's own OAuth callback with a mock code, so Connect Carta stores a real (mock) login and starts
 * the first read of the cap table, with no Carta account involved.
 */
export function demoCarta(webOrigin?: string): EmulatedMcpServer {
  const noInput = { type: "object", properties: {} };
  const account = { id: "mock-demo-company", name: DEMO_COMPANY, note: MOCK_NOTE };
  const capTable = {
    note: `${MOCK_NOTE}: an invented cap table, not a real company.`,
    ...DEMO_CAP_TABLE,
    safes: DEMO_CAP_TABLE.holders
      .filter((holder) => holder.security === "SAFE")
      .map((holder) => ({
        investor: holder.organization ?? holder.name,
        contact: holder.name,
        amountUsd: holder.amountUsd,
        status: "unconverted",
      })),
  };
  const tools = {
    welcome: () => ({
      note: MOCK_NOTE,
      text: "Mock Carta. Call cap_table_chart for the cap table of the current company.",
    }),
    list_accounts: () => ({ accounts: [account] }),
    get_current_user: () => ({ name: DEMO_USER_NAME, note: MOCK_NOTE }),
    set_context: () => ({ ok: true, account }),
    cap_table_chart: () => capTable,
    // The generic Carta read path returns the same cap table.
    fetch: () => capTable,
    read_tool: () => capTable,
  } satisfies Record<string, () => unknown>;
  const description: Record<keyof typeof tools, string> = {
    welcome: "How to use this Carta server.",
    list_accounts: "List the companies you can read.",
    get_current_user: "The signed-in Carta user.",
    set_context: "Pick the company to read.",
    cap_table_chart:
      "The company's cap table: fully diluted shares, share classes, option pool, holders and SAFEs.",
    fetch: "Read Carta data, such as the cap table.",
    read_tool: "Read Carta data, such as the cap table.",
  };
  return {
    ...(webOrigin
      ? { authorizeUrl: `${webOrigin}/mcp/oauth/callback?code=mock-demo-carta-code` }
      : {}),
    tools: (Object.keys(tools) as (keyof typeof tools)[]).map((name) => ({
      name,
      description: description[name],
      inputSchema: noInput,
    })),
    call: (name) =>
      Object.hasOwn(tools, name)
        ? tools[name as keyof typeof tools]()
        : { error: `Unknown tool ${name}` },
  };
}

export interface DemoDocument {
  /** Folder path; "Finance/Invoices" is the sub-folder Invoices inside Finance. */
  folder: string;
  name: string;
  /** "broken" is bytes that claim to be a PDF but are not, so the demo shows a failed item. */
  kind: "pdf" | "csv" | "broken";
  /** ASCII only, no parentheses or backslashes (it becomes a PDF text layer). */
  text: string;
}

/**
 * What the Data room classifier would file for each document. The demo has AI sharing off, so the
 * classifier skips and the seed writes these instead, keeping the Type and Date columns filled.
 */
export const DEMO_DOCUMENT_FACETS: Record<
  string,
  { docType: string; daysAgo: number; parties: string[] }
> = {
  "MOCK Master Services Agreement - Halcyon Logistics.pdf": {
    docType: "Contract",
    daysAgo: 95,
    parties: ["Halcyon Logistics (Mock)"],
  },
  "MOCK Mutual NDA - Acme Ventures.pdf": {
    docType: "NDA",
    daysAgo: 60,
    parties: ["Acme Ventures (Mock)"],
  },
  "MOCK Office Lease - 100 Placeholder Street.pdf": {
    docType: "Lease",
    daysAgo: 400,
    parties: ["Placeholder Street Landlord (Mock)"],
  },
  "MOCK SAFE - Quill Capital.pdf": {
    docType: "SAFE",
    daysAgo: 150,
    parties: ["Quill Capital (Mock)"],
  },
  "MOCK Q3 Board Deck.pdf": { docType: "Board deck", daysAgo: 3, parties: [] },
  "MOCK Budget FY27.csv": { docType: "Budget", daysAgo: 20, parties: [] },
  "MOCK Investor Update Draft.pdf": { docType: "Investor update", daysAgo: 1, parties: [] },
  "MOCK Cap Table Summary.csv": { docType: "Cap table", daysAgo: 1, parties: [] },
  "MOCK Product Roadmap.pdf": { docType: "Roadmap", daysAgo: 30, parties: [] },
  "MOCK Invoice NW-1044 - Acme Servo Supply.pdf": {
    docType: "Invoice",
    daysAgo: 12,
    parties: ["Acme Servo Supply (Mock)"],
  },
  "MOCK Invoice 2209 - Cobalt Cloud Hosting.pdf": {
    docType: "Invoice",
    daysAgo: 8,
    parties: ["Cobalt Cloud Hosting (Mock)"],
  },
};

const doc = (folder: string, name: string, text: string, kind: DemoDocument["kind"] = "pdf") => ({
  folder,
  name,
  kind,
  text: `MOCK DEMO DATA. ${text} ${MOCK_NOTE}, not a real document.`,
});

export const DEMO_DOCUMENTS: DemoDocument[] = [
  doc(
    "Legal",
    "MOCK Master Services Agreement - Halcyon Logistics.pdf",
    "Master Services Agreement between Northwind Robotics Mock and Halcyon Logistics Mock. Term 24 months. Liability cap one times annual fees. Termination for convenience on 60 days notice.",
  ),
  doc(
    "Legal",
    "MOCK Mutual NDA - Acme Ventures.pdf",
    "Mutual Non Disclosure Agreement between Northwind Robotics Mock and Acme Ventures Mock. Term 3 years.",
  ),
  doc(
    "Legal",
    "MOCK Office Lease - 100 Placeholder Street.pdf",
    "Office lease for 100 Placeholder Street. Monthly rent 7500 dollars. Renewal date 31 January. Notice of renewal due 30 November.",
  ),
  doc(
    "Legal",
    "MOCK SAFE - Quill Capital.pdf",
    "Simple Agreement for Future Equity. Investor Quill Capital Mock. Purchase amount 250000 dollars. Valuation cap 8000000 dollars. Discount 20 percent.",
  ),
  doc(
    "Finance",
    "MOCK Q3 Board Deck.pdf",
    "Board deck for the third quarter. Cash 412000 dollars. Monthly net burn 46000 dollars. Runway 8.9 months.",
  ),
  doc(
    "Finance",
    "MOCK Budget FY27.csv",
    "team,monthly_spend_usd\nplatform,41000\nfirmware,28000\ngrowth,26000",
    "csv",
  ),
  doc(
    "Finance/Invoices",
    "MOCK Invoice NW-1044 - Acme Servo Supply.pdf",
    "Invoice NW-1044 from Acme Servo Supply Mock to Northwind Robotics Mock. 40 servo motors. Amount due 3200 dollars by 15 November.",
  ),
  doc(
    "Finance/Invoices",
    "MOCK Invoice 2209 - Cobalt Cloud Hosting.pdf",
    "Invoice 2209 from Cobalt Cloud Hosting Mock to Northwind Robotics Mock. October hosting. Amount due 1850 dollars.",
  ),
  doc(
    "Fundraising",
    "MOCK Investor Update Draft.pdf",
    "Draft investor update. Highlights: pilot converted to an annual contract; runway 8.9 months.",
  ),
  doc(
    "Fundraising",
    "MOCK Cap Table Summary.csv",
    "holder,class,shares,percent\nAlex Founder Mock,common,4000000,40\nRiver Cofounder Mock,common,3000000,30\nEarly employees Mock,common,1500000,15\nOption pool Mock,pool,1500000,15\nQuill Capital SAFE Mock,safe,0,pending",
    "csv",
  ),
  doc(
    "Product",
    "MOCK Product Roadmap.pdf",
    "Roadmap for the next two quarters. Q4: calibration tool. Q1: fleet dashboard.",
  ),
  doc(
    "Legal",
    "MOCK Signed NDA - Bolt Freight.pdf",
    "A damaged scan that is not a readable PDF.",
    "broken",
  ),
];

/** Every folder path the documents use, each parent before its children ("A" before "A/B"). */
export function demoFolderPaths(documents: DemoDocument[]): string[] {
  const paths = new Set<string>();
  for (const { folder } of documents) {
    const parts = folder.split("/");
    for (let i = 1; i <= parts.length; i++) paths.add(parts.slice(0, i).join("/"));
  }
  return [...paths].sort((a, b) => a.split("/").length - b.split("/").length);
}

/** A draft Chief "made" last week, so the monthly investor update can start from it. */
export const DEMO_CHIEF_DRAFT = {
  name: "MOCK Investor Update - September.md",
  mimeType: "text/markdown",
  text: `# MOCK DEMO DATA: Investor update, September

Hi Priya, Dana and Lee,

Highlights
- The Halcyon Logistics (Mock) pilot converted to an annual contract.
- Cash is $412,000 with $46,000 monthly net burn: about 8.9 months of runway.

Asks
- Intros to robotics buyers in warehousing.

Alex

${MOCK_NOTE}: invented for UX testing. Not a real update.
`,
};

export const DEMO_BOTS = [
  {
    name: "Legal Desk (mock)",
    title: "Contracts",
    description: `${MOCK_NOTE}: tracks the demo contracts and their renewal dates.`,
  },
  {
    name: "Investor Relations (mock)",
    title: "Fundraising",
    description: `${MOCK_NOTE}: drafts the demo investor updates.`,
  },
];

export const DEMO_GROUP = { name: "Leadership sync (mock)" };
