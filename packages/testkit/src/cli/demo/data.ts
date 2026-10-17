import type { EmulatedMessage } from "@rakazo/adapters";
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
export const DEMO_USER_NAME = "Alex Founder (Mock)";
export const DEMO_EMAIL = "mock-founder@demo.rakazo.test";
export const MOCK_SUBJECT_PREFIX = "[MOCK DEMO]";

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const FOOTER = `\n\n-- \n${MOCK_NOTE}: invented for UX testing. Not a real message.`;

// ---- Inbox ----

type Mail = {
  /** Unique within the mailbox; a reply shares its thread's id. */
  thread: string;
  agoMs: number;
  from: string;
  subject: string;
  text: string;
  labels?: string[];
  unread?: boolean;
  starred?: boolean;
  attachments?: EmulatedMessage["attachments"];
};

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
  {
    thread: "msa-redlines",
    agoMs: 6 * HOUR_MS,
    from: "Morgan Pretend <morgan@halcyon-logistics.example.test>",
    subject: "Redlines on the Master Services Agreement",
    text: "Alex,\n\nOur counsel returned redlines on sections 4 (liability cap) and 9 (termination). We can sign this week if you accept them.\n\nMorgan\nHalcyon Logistics (Mock)",
    unread: true,
  },
  {
    thread: "msa-redlines",
    agoMs: 3 * HOUR_MS,
    from: "Fictional Law Group <counsel@fictional-law.example.test>",
    subject: "Redlines on the Master Services Agreement",
    text: "Alex, we reviewed the redlines. Section 4 is acceptable. We recommend pushing back on section 9. Draft reply attached below on request.\n\nFictional Law Group (Mock)",
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
        data: Buffer.from("%PDF-1.4 MOCK DEMO DATA board deck").toString("base64"),
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
  {
    thread: "support-ticket",
    agoMs: 12 * DAY_MS,
    from: "Sam Samplesworth <sam@pilot-customer.example.test>",
    subject: "Robot arm calibration question",
    text: "One of the arms drifts after long runs. Is there a recalibration procedure we should follow?\n\nSam",
  },
];

/** The demo mailbox, shaped like `e2eMailboxes` so the e2e Composio emulator can serve it. */
export function demoMailboxes(now = new Date()) {
  const seen = new Map<string, number>();
  const messages = MAIL.map((mail, index): EmulatedMessage => {
    const count = (seen.get(mail.thread) ?? 0) + 1;
    seen.set(mail.thread, count);
    return {
      id: `mock-demo-${index + 1}`,
      threadId: `mock-demo-thread-${mail.thread}`,
      date: new Date(now.getTime() - mail.agoMs).toISOString(),
      labels: [
        "INBOX",
        ...(mail.labels ?? []),
        ...(mail.unread ? ["UNREAD"] : []),
        ...(mail.starred ? ["STARRED"] : []),
      ],
      from: mail.from,
      to: "Alex Founder (Mock) <mock-founder@northwind.example.test>",
      subject: `${MOCK_SUBJECT_PREFIX} ${count > 1 ? "Re: " : ""}${mail.subject}`,
      text: `${mail.text}${FOOTER}`,
      ...(mail.attachments ? { attachments: mail.attachments } : {}),
    };
  });
  return {
    "mock-demo-mailbox": { address: "mock-founder@northwind.example.test", messages },
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

export interface DemoDocument {
  /** Folder path; "Finance/Invoices" is the sub-folder Invoices inside Finance. */
  folder: string;
  name: string;
  /** "broken" is bytes that claim to be a PDF but are not, so the demo shows a failed item. */
  kind: "pdf" | "csv" | "broken";
  /** ASCII only, no parentheses or backslashes (it becomes a PDF text layer). */
  text: string;
}

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
    "holder,class,shares,percent\nAlex Founder Mock,common,4000000,40\nRiver Cofounder Mock,common,3000000,30\nOption pool Mock,pool,1500000,15\nQuill Capital SAFE Mock,safe,0,pending",
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
