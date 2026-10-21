import type { EmulatedMcpServer, EmulatedMessage } from "@rakazo/adapters";
import type { SourceMeeting } from "@rakazo/contracts";
import { FINANCE_MCP_ENDPOINTS } from "@rakazo/contracts";
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
export const DEMO_COMPANY = "Northwind Robotics";
/** A space with nothing connected, for the first-run and empty states. */
export const DEMO_EMPTY_SPACE = "Empty space";
/** A space whose only Gmail account lost its sign-in, for the Reconnect state. */
export const DEMO_RECONNECT_SPACE = "Mail needs reconnect";
/** A space whose Gmail answers every call with a rate limit. */
export const DEMO_RATE_LIMIT_SPACE = "Mail rate-limited";
/** Mail sent to this domain fails, so a failed send can be tried (for example bounce@…). */
export const DEMO_BOUNCE_DOMAIN = "send-fail.example.test";
/** How long after the stack starts the mock new email arrives. */
export const DEMO_NEW_MAIL_DELAY_MS = 3 * 60_000;
/** A company whose Mercury sign-in has expired, for the Finance Reconnect path. */
export const DEMO_FINANCE_RECONNECT_SPACE = "Reconnect needed";
export const DEMO_USER_NAME = "Maya Chen (Mock)";
/** A second member of the company, so sharing and privacy can be looked at. */
export const DEMO_COFOUNDER = {
  name: "River Cofounder (Mock)",
  email: "mock-cofounder@demo.rakazo.test",
};
export const DEMO_EMAIL = "mock-founder@demo.rakazo.test";
/** Short, so the subject itself stays readable in a list row. */
export const MOCK_SUBJECT_PREFIX = "[MOCK]";

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const FOOTER = `\n\n-- \n${MOCK_NOTE}: invented for UX testing. Not a real message.`;

// ---- Inbox ----

const ME = "Maya Chen (Mock) <mock-founder@northwind.example.test>";
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
    text: "Hi Maya,\n\nHere is the draft of the Q3 update for our LPs. Can you check the runway and hiring numbers before Friday?\n\nPriya\nQuill Capital (Mock)",
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
    text: "Maya,\n\nOur counsel returned redlines on sections 4 (liability cap) and 9 (termination). We can sign this week if you accept them.\n\nMorgan\nHalcyon Logistics (Mock)",
  },
  {
    thread: "msa-redlines",
    agoMs: 26 * HOUR_MS,
    from: ME,
    to: MORGAN,
    cc: DANA,
    sent: true,
    subject: "Redlines on the Master Services Agreement",
    text: "Thanks Morgan. Our counsel is reviewing both sections and I will reply by Thursday.\n\nMaya",
  },
  {
    thread: "msa-redlines",
    agoMs: 8 * HOUR_MS,
    from: DANA,
    cc: MORGAN,
    subject: "Redlines on the Master Services Agreement",
    text: "Maya, to clarify section 9: we are asking for 60 days' notice of termination instead of 30. Section 4 is as marked.\n\nDana\nHalcyon Logistics (Mock)",
  },
  {
    thread: "msa-redlines",
    agoMs: 3 * HOUR_MS,
    from: MORGAN,
    cc: DANA,
    subject: "Redlines on the Master Services Agreement",
    text: "Maya, if section 9 works for you, can we sign on Thursday?\n\nMorgan",
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
    text: "Maya, Dana Fakename would like a short intro call about your seed round. Are you open to it? I can write the intro today.\n\nJamie",
  },
  {
    thread: "board-deck",
    agoMs: 1.5 * DAY_MS,
    from: "Riley Testwell <riley@bookkeeping.example.test>",
    subject: "Q3 board deck (PDF attached)",
    text: "Maya, the Q3 board deck is attached. The financial slides use the September close.\n\nRiley\nBookkeeping Co (Mock)",
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
    text: "Maya, the pilot ran well. We would like to discuss moving to an annual contract. When can we talk?\n\nSam\nPilot Customer Inc (Mock)",
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
    text: "Maya, I have a strong candidate for the firmware role. Shall I send the resume?\n\nTaylor\nRecruiting Partners (Mock)",
  },
  {
    thread: "expense-question",
    agoMs: 4 * DAY_MS,
    from: "Riley Testwell <riley@bookkeeping.example.test>",
    subject: "Question about a September charge",
    text: "Maya, there is a $2,400 charge from Globex Cloud (Mock) in September that I cannot match to a receipt. Can you send one?\n\nRiley",
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
    text: "Hi Maya, I shortlisted two venues for the team offsite on Nov 21 or Nov 28. Which date works for you?\n\nCasey",
  },
  // Over the 10 MB attachment limit, so forwarding it shows the limit.
  {
    thread: "demo-video",
    agoMs: 4.5 * DAY_MS,
    from: "Casey Coworker <casey@northwind.example.test>",
    subject: "Product demo video for the reseller call",
    text: "Maya, here is the demo video for the reseller call. It is large, so download it before you travel.\n\nCasey",
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
    text: "Maya, the countersigned SAFE for $250,000 is filed. Wire should arrive within two business days.\n\nPriya",
  },
  // For the Carta agent's audit-response skill: an auditor's confirmation request and its DocuSign.
  {
    thread: "audit-confirmation",
    agoMs: 2.5 * DAY_MS,
    from: "Quinn Auditwell <quinn@auditwell.example.test>",
    subject: "Audit confirmation: Quill Capital Fund I holdings as of Sep 30",
    text: "Hi Alex,\n\nAs part of the annual audit of Quill Capital Fund I (Mock), please confirm the fund's holdings in Northwind Robotics as of Sep 30, 2026:\n\n- SAFE, purchase amount $250,000, unconverted\n- No other securities\n\nA DocuSign envelope with this confirmation follows. Please reply with any differences by Oct 24.\n\nQuinn Auditwell\nAuditwell LLP (Mock)",
    unread: true,
  },
  {
    thread: "audit-docusign",
    agoMs: 2.4 * DAY_MS,
    from: "DocuSign via Auditwell LLP <dse@docusign.example.test>",
    subject: "Please DocuSign: Investment confirmation for Quill Capital Fund I",
    text: "Quinn Auditwell sent you a document to review and sign: Investment confirmation for Quill Capital Fund I (Mock), as of Sep 30, 2026.\n\nREVIEW DOCUMENT (mock link, does nothing)\n\nDue Oct 24.",
    unread: true,
  },
  // Past monthly investor updates in Sent, so a new one can match their sections and voice.
  {
    thread: "investor-update-august",
    agoMs: 47 * DAY_MS,
    from: ME,
    to: ME,
    sent: true,
    subject: "Northwind Robotics: August investor update",
    text: "Hi all,\n\nHighlights\n- Signed our second pilot customer (Beacon Retail).\n- Shipped firmware 2.3 with 18% faster picking.\n\nLowlights\n- A sensor supplier slipped two weeks.\n\nMetrics\n- Cash: $1.42M. Monthly burn: $72k. Runway: 19 months.\n\nAsks\n- Intros to warehouse operators in the Midwest.\n\nThanks,\nAlex",
  },
  {
    thread: "investor-update-july",
    agoMs: 78 * DAY_MS,
    from: ME,
    to: ME,
    sent: true,
    subject: "Northwind Robotics: July investor update",
    text: "Hi all,\n\nHighlights\n- Closed the $250,000 Quill Capital SAFE.\n- Hired our first firmware engineer.\n\nLowlights\n- Pilot install took a week longer than planned.\n\nMetrics\n- Cash: $1.55M. Monthly burn: $68k. Runway: 22 months.\n\nAsks\n- Candidates for a senior firmware role.\n\nThanks,\nAlex",
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
// More everyday mail, so the Inbox piles read like a working company's.
const DAILY: Array<[string, string, string, string, number, string?, boolean?]> = [
  [
    "Riley Testwell",
    "riley@bookkeeping.example.test",
    "September books are closed",
    "The September books are closed. Net burn was $67,600 and the card reconciliation is attached to the data room.",
    1.2,
    undefined,
    true,
  ],
  [
    "Casey Coworker",
    "casey@northwind.example.test",
    "Receipts for the Austin trip",
    "I uploaded the receipts for the Austin trip. Three are still missing a vendor name.",
    1.6,
  ],
  [
    "Sam Samplesworth",
    "sam@pilot-customer.example.test",
    "Site two network access",
    "Our IT approved the robot network ports. Can you send the MAC addresses before Thursday?",
    2.1,
    undefined,
    true,
  ],
  [
    "Delta Desk Rentals",
    "no-reply@delta-desk.example.test",
    "Invoice 3023 for October",
    "Your October invoice for $420 is attached. Payment is due in 30 days.",
    2.4,
  ],
  [
    "Acme Servo Supply",
    "no-reply@acme-servo.example.test",
    "Order NW-1044 has shipped",
    "Your order of 40 servo motors shipped today and arrives in four days.",
    2.8,
  ],
  [
    "Jamie Placeholder",
    "jamie@placeholder-ventures.example.test",
    "Great meeting at demo day",
    "Maya, great talking at demo day. Could you send the deck and the current metrics?",
    3.0,
    undefined,
    true,
  ],
  [
    "Cobalt Cloud Hosting",
    "no-reply@cobalt-hosting.example.test",
    "Your October invoice",
    "Your hosting invoice for $1,850 is ready. Your plan renews automatically on Dec 8.",
    3.3,
  ],
  [
    "Fictional Law Group",
    "counsel@fictional-law.example.test",
    "Trademark response draft",
    "I attached a draft response to the office action. Please review the claims narrowing on page two.",
    3.6,
  ],
  [
    "Orchard Fulfillment",
    "ops@orchard-fulfillment.example.test",
    "Interested in a pilot",
    "We run three warehouses and would like to see the picking robot. Do you have time next week?",
    4.2,
    undefined,
    true,
  ],
  [
    "Brightsign Ads",
    "support@brightsign.example.test",
    "Your campaign paused",
    "As requested, your November campaign is paused. Resume it any time from the dashboard.",
    4.8,
  ],
  [
    "Alex Firmware",
    "alex@northwind.example.test",
    "Firmware 2.4 release notes",
    "Firmware 2.4 is in staging. It fixes the arm calibration drift reported by Halcyon.",
    5.0,
  ],
  [
    "Quinn Auditwell",
    "quinn@auditwell.example.test",
    "409A refresh timing",
    "The 409A valuation from July is valid for 12 months, but a new round would void it. Want me to schedule a refresh after you close?",
    5.4,
  ],
  [
    "Cascade Robotics",
    "partners@cascade-robotics.example.test",
    "Reseller onboarding call",
    "We are ready to onboard our sales team. Can we book 45 minutes on Nov 4?",
    5.9,
  ],
  [
    "Shieldwell Insurance",
    "policy@shieldwell.example.test",
    "Certificate of insurance",
    "The certificate Halcyon asked for is attached.",
    6.3,
  ],
  [
    "Mock Payments",
    "no-reply@mock-payments.example.test",
    "Payout of $18,400 sent",
    "A payout of $18,400 was sent to your Mercury account ending 4417.",
    6.8,
    "CATEGORY_UPDATES",
  ],
  [
    "Founder Digest",
    "digest@founder-digest.example.test",
    "The seed round checklist",
    "Twelve things to prepare before the first investor meeting.",
    3.1,
    "CATEGORY_UPDATES",
  ],
  [
    "The Mock Weekly",
    "news@mock-weekly.example.test",
    "Warehouse automation hits a record",
    "Orders for warehouse robots rose 31 percent this year, from an invented survey.",
    4.4,
    "CATEGORY_UPDATES",
  ],
  [
    "Robotics Roundup",
    "editor@robotics-roundup.example.test",
    "Five grippers compared",
    "We tested five grippers on the same bin picking task.",
    6.1,
    "CATEGORY_PROMOTIONS",
  ],
  [
    "Docuflow Sales",
    "sales@docuflow.example.test",
    "Last chance: 20 percent off",
    "Your offer ends tonight.",
    5.2,
    "CATEGORY_PROMOTIONS",
  ],
  [
    "SaaS Metrics Monthly",
    "hello@saas-metrics.example.test",
    "Net revenue retention by size",
    "Median retention figures for companies under $5M ARR, from invented data.",
    9.0,
    "CATEGORY_UPDATES",
  ],
  [
    "Mock Conference",
    "team@mock-conference.example.test",
    "Speaker slots for Robotics Week",
    "Slots are open until Nov 15. Submit a 200 word abstract.",
    8.4,
    "CATEGORY_PROMOTIONS",
  ],
  [
    "Casey Coworker",
    "casey@northwind.example.test",
    "Offsite venue shortlist",
    "Both venues have space for 14 people. The lakeside one is $200 cheaper.",
    7.5,
  ],
  [
    "Priya Placeholder",
    "priya@quill-capital.example.test",
    "Intro to a warehouse operator",
    "I introduced you to a warehouse operator I know. Expect an email from them this week.",
    7.9,
  ],
  [
    "Sam Engineer",
    "sam@northwind.example.test",
    "Interview feedback: firmware candidate",
    "Strong on embedded C, weaker on testing. I recommend a second round.",
    8.2,
  ],
  [
    "Dana Fakename",
    "dana@acme-ventures.example.test",
    "Thanks for the deck",
    "The partners will look at it Monday. I will send questions after.",
    9.4,
  ],
  [
    "Riley Testwell",
    "riley@bookkeeping.example.test",
    "Sales tax question",
    "Do you need to collect sales tax on the service plan? I put my notes in the data room.",
    10.3,
  ],
  [
    "Mock Bank Alerts",
    "no-reply@mock-bank.example.test",
    "Large transfer completed",
    "A transfer of $58,400 left your account for payroll.",
    11.0,
    "CATEGORY_UPDATES",
  ],
  [
    "Delta Desk Rentals",
    "no-reply@delta-desk.example.test",
    "Invoice 2991 for September",
    "Your September invoice for $420 was paid. Thank you.",
    31,
  ],
];
DAILY.forEach(([name, email, subject, text, days, label, unread], index) => {
  MAIL.push({
    thread: `daily-${index}`,
    agoMs: days * DAY_MS,
    from: `${name} <${email}>`,
    subject,
    text,
    ...(label ? { labels: [label] } : {}),
    ...(unread ? { unread: true } : {}),
  });
});
// Mail the founder sent, for the Sent folder.
const SENT: Array<[string, string, string, string, number]> = [
  [
    "priya@quill-capital.example.test",
    "Re: Q3 numbers",
    "Priya, runway is 24 months at the current burn and the pilot converted. I will send the full update Friday.",
    "sent-1",
    1.1,
  ],
  [
    "dana@halcyon-logistics.example.test",
    "Security questionnaire",
    "Dana, attached is the completed security questionnaire. Shout if anything is unclear.",
    "sent-2",
    2.7,
  ],
  [
    "casey@northwind.example.test",
    "Offsite date",
    "Let us do Nov 21. Please book the lakeside venue.",
    "sent-3",
    6.9,
  ],
];
for (const [to, subject, text, thread, days] of SENT) {
  MAIL.push({ thread, agoMs: days * DAY_MS, from: ME, to, subject, text, sent: true });
}

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

const BULK_SENDER = /Weekly|Roundup|Conference|Docuflow|Expo Organizers/;

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
      // Bulk senders carry list headers, which is how Praci files them under Newsletters.
      ...(BULK_SENDER.test(item.from)
        ? {
            headers: [
              { name: "List-Unsubscribe", value: "<mailto:unsubscribe@lists.example.test>" },
              { name: "List-Id", value: "<updates.lists.example.test>" },
            ],
          }
        : {}),
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

/** `memo` says what the charge was for, as a card memo would; the month and "(Mock)" are added. */
const BREX_MONTHLY: Array<Recurring & { day: number; memo: string; risePerMonth?: number }> = [
  {
    vendor: "Cloudnine Hosting (Mock)",
    cents: 481_200,
    category: "Servers",
    day: 8,
    memo: "Hosting",
  },
  {
    vendor: "Docuflow (Mock)",
    cents: 12_900,
    category: "Software",
    day: 9,
    memo: "Document signing plan",
  },
  {
    vendor: "Chatterbox Messaging (Mock)",
    cents: 8_750,
    category: "Software",
    day: 10,
    memo: "Team chat seats",
  },
  {
    vendor: "Sketchpad Design (Mock)",
    cents: 4_500,
    category: "Software",
    day: 14,
    memo: "Design tool seat",
  },
  // Rising about 8% a month, so a vendor page shows a real change.
  {
    vendor: "Globex Cloud (Mock)",
    cents: 240_000,
    category: "Servers",
    day: 16,
    risePerMonth: 0.08,
    memo: "Compute usage",
  },
  {
    vendor: "Mockbooks Accounting (Mock)",
    cents: 15_000,
    category: "Software",
    day: 18,
    memo: "Bookkeeping plan",
  },
  // Two AI tools in the same overlap group, so Subscriptions shows the "overlaps" pill.
  {
    vendor: "Cursor Seats (Mock)",
    cents: 20_000,
    category: "Software",
    day: 4,
    memo: "Editor seats",
  },
  {
    vendor: "Devin Agent Seats (Mock)",
    cents: 50_000,
    category: "Software",
    day: 6,
    memo: "Agent seats",
  },
  // More categories, early in the month, so the month-to-date Breakdown has 8 or more.
  {
    vendor: "Penwright Office Supply (Mock)",
    cents: 31_400,
    category: "Office Supplies",
    day: 2,
    memo: "Office supplies",
  },
  {
    vendor: "Brightsign Ads (Mock)",
    cents: 180_000,
    category: "Marketing",
    day: 3,
    memo: "Search ads",
  },
  {
    vendor: "Lunchbox Catering (Mock)",
    cents: 42_600,
    category: "Meals",
    day: 7,
    memo: "Team lunch",
  },
  {
    vendor: "Placeholder Legal LLP (Mock)",
    cents: 125_000,
    category: "Legal",
    day: 11,
    memo: "Monthly retainer",
  },
];

/** How many months of history the demo holds (the catalog asks for 7 or more). */
const HISTORY_MONTHS = 8;
const HISTORY_DAYS = 250;

/** Whole-day offsets from `now` back to the given day of the month `monthsAgo` months earlier. */
function monthDay(now: Date, monthsAgo: number, day: number): Date {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo, day, 15));
  return date;
}

/**
 * Last month's statement for a bank with no integration, as a CSV export, so Accounts shows a
 * statement account (named from the statement, and renamable) and the monthly reminder.
 */
export function demoStatementCsv(now = new Date()): { fileName: string; body: string } {
  const day = (d: number) => monthDay(now, 1, d).toISOString().slice(0, 10);
  const month = day(1).slice(0, 7);
  const rows = [
    [day(3), "MOCK Customer Beta (Mock) deposit", "1200.00", "11200.00"],
    [day(9), "MOCK Office Supplies (Mock)", "-250.00", "10950.00"],
    [day(18), "MOCK Courier Service (Mock)", "-450.00", "10500.00"],
  ];
  // A title line names the bank and account ending, and stated balances bracket the lines, the way
  // bank exports do, so the account is named from the statement and its balances are checked.
  return {
    fileName: `mock-community-bank-${month}.csv`,
    body: [
      "MOCK Community Bank,Account ending 5502",
      "Opening balance,10000.00",
      "Date,Description,Amount,Balance",
      ...rows.map((r) => r.join(",")),
      "Closing balance,10500.00",
      "",
    ].join("\n"),
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
  const once = (id: string, at: Date, row: Partial<Parameters<typeof mercuryRow>[1]>) => ({
    at,
    row: mercuryRow(id, { date: at.toISOString(), ...row }),
  });
  const oneOffs = [
    // A large one-off two months ago, so that month's page has an outlier to explain.
    once("mock-merc-hardware", monthDay(now, 2, 14), {
      counterpartyName: "Ironclad Hardware Supply (Mock)",
      amount: -48_000,
      category: "Equipment",
      kind: "ach",
    }),
    // Moving cash into Treasury is a transfer between own accounts, never spend.
    once("mock-merc-to-treasury", monthDay(now, 3, 20), {
      counterpartyName: "Mercury Treasury (Mock)",
      amount: -100_000,
      category: null,
      kind: "treasuryTransfer",
    }),
  ];
  const checking = dated([
    safeWire,
    ...Array.from({ length: HISTORY_MONTHS }, (_, monthsAgo) => monthsAgo).flatMap((monthsAgo) =>
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
      }).filter(({ at }) => now.getTime() - at.getTime() < HISTORY_DAYS * DAY_MS),
    ),
    ...oneOffs,
  ]);

  const expenses = dated(
    Array.from({ length: HISTORY_MONTHS }, (_, monthsAgo) => monthsAgo).flatMap((monthsAgo) =>
      BREX_MONTHLY.map((m) => {
        const at = monthDay(now, monthsAgo, m.day);
        // Integer cents: a rising vendor was cheaper by its monthly rise for each month back.
        const cents = Math.round(m.cents * (1 - (m.risePerMonth ?? 0) * monthsAgo));
        const value = (cents / 100).toFixed(2);
        const money = { value, currency: "USD", display: `$${value} USD` };
        return {
          at,
          row: brexExpense(`mock-brex-${monthsAgo}-${m.day}`, {
            purchased_at: at.toISOString(),
            posted_at: new Date(at.getTime() + DAY_MS).toISOString(),
            merchant: { id: `pmch_${m.day}`, name: m.vendor },
            vendor: { id: `pmch_${m.day}`, name: m.vendor, email: null },
            merchant_category: { id: `pmca_${m.day}`, name: m.category },
            memo: `${m.memo}, ${at.toLocaleString("en-US", { month: "long", timeZone: "UTC" })} (Mock)`,
            original_amount: money,
            purchased_amount: money,
            amount: money,
            card: { id: "ncard_1", last4: "0001", partner: null },
          }),
        };
      }).filter(({ at }) => now.getTime() - at.getTime() < HISTORY_DAYS * DAY_MS),
    ),
  );

  const accounts = mercuryAccountsResponse();
  const mercuryAccounts = {
    ...accounts,
    accounts: (accounts.accounts as Array<Record<string, unknown>>).map((a) => ({
      ...a,
      name: a.id === MERCURY_CHECKING ? "MOCK Checking ••1111" : "MOCK Savings ••2222",
      // High enough that the balance rebuilt backward from today never dips below zero.
      availableBalance: a.id === MERCURY_CHECKING ? 412_420.55 : 60_000,
    })),
    totalAvailableBalance: 472_420.55,
  };
  // Treasury with six months of yield, so the Treasury yield card and the account's Yield table show.
  const treasury = {
    accounts: [
      {
        id: "mock-trs-3333",
        status: "active",
        createdAt: monthDay(now, 12, 1).toISOString(),
        availableBalance: 1_150_000,
        currentBalance: 1_150_000,
        netReturns: Array.from({ length: 6 }, (_, i) => {
          const month = monthDay(now, i + 1, 1)
            .toISOString()
            .slice(0, 10);
          const dividends = 4_100 + i * 35;
          return {
            month,
            netAmount: dividends - 95,
            dividends: [
              {
                id: `mock-div-${i}`,
                type: [],
                securityName: "MOCK Money Market Fund",
                amount: dividends,
              },
            ],
            treasuryFee: -95,
            status: "charged",
          };
        }),
      },
    ],
    page: {},
  };
  const brexAccounts = {
    ...brexAccountsResponse,
    items: brexAccountsResponse.items.map((a) => ({
      ...a,
      name: a.account_type === "CARD" ? "MOCK Brex Card" : "MOCK Brex Cash",
      // An ending like the other accounts', so every account reads the same way.
      account_number_last_four: a.account_type === "CARD" ? null : "3003",
      nickname: undefined,
    })),
  };

  const mercury = fakeMercury({
    txns: { [MERCURY_CHECKING]: checking, [MERCURY_SAVINGS]: [] },
    accounts: mercuryAccounts,
    treasury,
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
      memo: "Flight to the robotics expo (Mock)",
      original_amount: pendingMoney,
      purchased_amount: pendingMoney,
      amount: pendingMoney,
      card: { id: "ncard_1", last4: "0001", partner: null },
    }),
  );
  // One charge in euros (left out of totals and noted on the dashboard), and one memo that holds a
  // dollar amount, so Hide amounts can be checked on memos.
  const euroAt = monthDay(now, 1, 21);
  const euros = { value: "380.00", currency: "EUR", display: "€380.00 EUR" };
  const depositAt = monthDay(now, 1, 24);
  const deposit = { value: "4200.00", currency: "USD", display: "$4,200.00 USD" };
  expenses.push(
    brexExpense("mock-brex-eur", {
      purchased_at: euroAt.toISOString(),
      posted_at: new Date(euroAt.getTime() + DAY_MS).toISOString(),
      merchant: { id: "pmch_eur", name: "Berlin Coworking (Mock)" },
      vendor: { id: "pmch_eur", name: "Berlin Coworking (Mock)", email: null },
      merchant_category: { id: "pmca_rent", name: "Rent" },
      memo: "Coworking day passes (Mock)",
      original_amount: euros,
      purchased_amount: euros,
      amount: euros,
      card: { id: "ncard_1", last4: "0001", partner: null },
    }),
    brexExpense("mock-brex-deposit", {
      purchased_at: depositAt.toISOString(),
      posted_at: new Date(depositAt.getTime() + DAY_MS).toISOString(),
      merchant: { id: "pmch_venue", name: "Harborview Event Space (Mock)" },
      vendor: { id: "pmch_venue", name: "Harborview Event Space (Mock)", email: null },
      merchant_category: { id: "pmca_events", name: "Events" },
      memo: "Invoice 4417 — $4,200 deposit (Mock)",
      original_amount: deposit,
      purchased_amount: deposit,
      amount: deposit,
      card: { id: "ncard_1", last4: "0001", partner: null },
    }),
  );
  expenses.sort((a, b) => b.purchased_at.localeCompare(a.purchased_at));
  // An approved bill not yet paid: an "Upcoming" bill row, not a transaction.
  const bills = [
    {
      id: "mock-bill-legal",
      status: "APPROVED",
      // The 30th, as the Chief and Finance replies say ("Oct 30").
      due_at: new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + (now.getUTCDate() > 28 ? 1 : 0), 30, 12),
      ).toISOString(),
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

const str = { type: "string" } as const;
const obj = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: "object",
  properties,
  required,
});
/** Only the tools the canned servers answer, with the arguments their handlers need. */
const DEMO_FINANCE_TOOLS = {
  mercury: {
    getAccounts: obj({}),
    getTreasury: obj({}),
    getRecipients: obj({ limit: { type: "number" } }),
    listTransactions: obj(
      {
        accountId: { type: "array", items: str },
        status: { type: "array", items: str },
        limit: { type: "number" },
        start_after: str,
      },
      ["accountId", "limit"],
    ),
    getTransactionById: obj({ transactionId: str }, ["transactionId"]),
    getAttachment: obj({ attachmentId: str }, ["attachmentId"]),
    // The emulated Mercury only records this call, so a Mercury agent's write approval can be tried.
    requestSendMoney: obj(
      { accountId: str, recipientId: str, amount: { type: "number" }, note: str },
      ["accountId", "recipientId", "amount"],
    ),
  },
  brex: {
    list_business_accounts: obj({ intent: str }, ["intent"]),
    list_expenses: obj({ intent: str, limit: { type: "number" }, cursor: str }, ["intent"]),
    list_bills: obj({ intent: str, limit: { type: "number" }, cursor: str }, ["intent"]),
    get_expense_by_id: obj({ intent: str, id: str }, ["intent", "id"]),
  },
} as const;

/**
 * Mock Mercury and Brex MCP servers by hostname, so "Add account → Mercury" signs in and connects
 * in the demo. Each asks for a sign-in like the real one; its sign-in page is the app's own OAuth
 * callback with a mock code. Tool calls answer from the same canned history as `demoFinance`.
 */
export function demoFinanceMcp(
  webOrigin: string,
  now = new Date(),
): Record<string, EmulatedMcpServer> {
  const { callToolFor } = demoFinance(now);
  const servers: Record<string, EmulatedMcpServer> = {};
  for (const provider of ["mercury", "brex"] as const) {
    servers[new URL(FINANCE_MCP_ENDPOINTS[provider]).hostname] = {
      authorizeUrl: `${webOrigin}/mcp/oauth/callback?code=mock-demo-${provider}-code`,
      tools: Object.entries(DEMO_FINANCE_TOOLS[provider]).map(([name, inputSchema]) => ({
        name,
        description: `${MOCK_NOTE}: ${name}`,
        inputSchema,
      })),
      call: async (name, args) => (await callToolFor({ provider }))(name, args),
    };
  }
  return servers;
}

/** Invented treasury Safe: 0x…d3e0 is not a real holder; nothing here touches a real chain. */
export const DEMO_WALLET = {
  address: "0x000000000000000000000000000000000000d3e0",
  label: "MOCK Treasury Safe",
  type: "safe",
} as const;
/** An invented ENS name for an operations wallet that also holds a token with no price. */
export const DEMO_ENS_WALLET = {
  name: "mock-ops.eth",
  address: "0x000000000000000000000000000000000000b0b5",
  label: "MOCK Ops wallet",
  type: "personal",
} as const;
const USDC_ETHEREUM = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
/** A listed token the price fake has no price for, so the wallet shows "1 unpriced". */
const LINK_ETHEREUM = "0x514910771af9ca656af840dff83e8264ecf986ca";
const SAFE_OWNERS = [
  "0x000000000000000000000000000000000000a001",
  "0x000000000000000000000000000000000000a002",
  "0x000000000000000000000000000000000000a003",
];

/**
 * Coinbase and Kraken read-only answers for the demo: any well-formed key connects and reads the
 * same invented balances. Requests never leave the process.
 */
function demoExchangeFetch(input: string | URL | Request): Response | null {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  const json = (body: unknown) => Response.json(body);
  if (url.host === "api.coinbase.com") {
    if (url.pathname.endsWith("/key_permissions"))
      return json({ can_view: true, can_trade: false, can_transfer: false });
    if (url.pathname.endsWith("/accounts"))
      return json({
        accounts: [
          { currency: "USD", available_balance: { value: "12000.00" }, hold: { value: "0" } },
          { currency: "BTC", available_balance: { value: "0.35" }, hold: { value: "0" } },
          { currency: "USDC", available_balance: { value: "25000" }, hold: { value: "0" } },
        ],
        has_next: false,
      });
  }
  if (url.host === "api.kraken.com") {
    if (url.pathname.endsWith("/GetApiKeyInfo"))
      return json({ error: [], result: { permissions: ["query-funds"] } });
    if (url.pathname.endsWith("/Balance"))
      return json({ error: [], result: { ZUSD: "5000.0000", XETH: "1.2000000000" } });
  }
  return null;
}

/**
 * An offline JSON-RPC, price and exchange fake: the treasury Safe (2 of 3, 2.5 ETH and 40,000 USDC
 * on Ethereum), the ops wallet (0.4 ETH and an unpriced token), and Coinbase and Kraken answers.
 * Pass `fetch` to `createApp` as `cryptoFetch` so Crypto never calls the network.
 */
export function demoCrypto() {
  const rpc = fakeRpc({
    chains: {
      1: {
        balances: {
          [DEMO_WALLET.address]: 2_500_000_000_000_000_000n,
          [DEMO_ENS_WALLET.address]: 400_000_000_000_000_000n,
        },
        tokens: {
          [USDC_ETHEREUM]: { [DEMO_WALLET.address]: 40_000_000_000n },
          [LINK_ETHEREUM]: { [DEMO_ENS_WALLET.address]: 120_000_000_000_000_000_000n },
        },
        contracts: [DEMO_WALLET.address],
      },
    },
    safe: { owners: SAFE_OWNERS, threshold: 2 },
    ens: { [DEMO_ENS_WALLET.name]: DEMO_ENS_WALLET.address },
    prices: {
      "coingecko:ethereum": { price: 2_500, confidence: 0.99 },
      "coingecko:bitcoin": { price: 60_000, confidence: 0.99 },
      [`ethereum:${USDC_ETHEREUM}`]: { price: 1, confidence: 0.99 },
    },
  });
  const fetchFn = (async (input: string | URL | Request, init?: RequestInit) =>
    demoExchangeFetch(input) ?? rpc.fetch(input, init)) as typeof fetch;
  return { fetch: fetchFn, calls: rpc.calls };
}

/**
 * 90 days of daily crypto totals for one wallet or exchange, so "Balance over time" has a line on
 * the first visit (the sync itself only writes today's point). Stablecoins hold steady; the rest drifts.
 */
export function demoCryptoHistory(
  now = new Date(),
  /** Today's stablecoin and other-crypto cents; earlier days hold the stablecoins and drift the rest. */
  today = { stablecoinCents: 4_000_000, otherCryptoCents: 625_000 },
) {
  return Array.from({ length: 90 }, (_, i) => {
    const back = 89 - i;
    const day = new Date(now.getTime() - back * DAY_MS).toISOString().slice(0, 10);
    // Whole cents, no float money: the non-stable part moves within about ±6%.
    const drift = Math.round((today.otherCryptoCents * (((back * 7_919) % 120) - 60)) / 1_000);
    return {
      day,
      stablecoinCents: today.stablecoinCents,
      otherCryptoCents: today.otherCryptoCents + drift,
    };
  }).slice(0, -1);
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
    kind: "legal" as const,
    notes: `${MOCK_NOTE}: outside counsel.`,
  },
  {
    name: "Sora Angel (Mock)",
    email: "sora@angel.example.test",
    organization: "Independent angel (Mock)",
    kind: "investor" as const,
    notes: `${MOCK_NOTE}: angel, $25,000 SAFE.`,
  },
  {
    name: "Tomas Operator (Mock)",
    email: "tomas@operator-angels.example.test",
    organization: "Operator angels (Mock)",
    kind: "investor" as const,
    notes: `${MOCK_NOTE}: operator angel, $25,000 SAFE, offers customer intros.`,
  },
  {
    name: "Casey Advisor (Mock)",
    email: "casey.advisor@advisors.example.test",
    organization: "Independent advisor (Mock)",
    kind: "advisor" as const,
    notes: `${MOCK_NOTE}: advisor with 250,000 common shares.`,
  },
  {
    name: "Morgan Pretend",
    email: "morgan@halcyon-logistics.example.test",
    organization: "Halcyon Logistics (Mock)",
    kind: "customer" as const,
    notes: `${MOCK_NOTE}: head of operations at our first annual customer.`,
  },
  {
    name: "Dana Counselor",
    email: "dana@halcyon-logistics.example.test",
    organization: "Halcyon Logistics (Mock)",
    kind: "legal" as const,
    notes: `${MOCK_NOTE}: Halcyon's legal counsel.`,
  },
  {
    name: "Robin Prospect",
    email: "robin@bolt-freight.example.test",
    organization: "Bolt Freight (Mock)",
    kind: "customer" as const,
    notes: `${MOCK_NOTE}: prospect asking for pricing on 20 units.`,
  },
  {
    name: "Riley Testwell",
    email: "riley@bookkeeping.example.test",
    organization: "Testwell Bookkeeping (Mock)",
    kind: "vendor" as const,
    notes: `${MOCK_NOTE}: outside bookkeeper, closes the month.`,
  },
  {
    name: "Jamie Placeholder",
    email: "jamie@placeholder-ventures.example.test",
    organization: "Placeholder Ventures (Mock)",
    kind: "investor" as const,
    notes: `${MOCK_NOTE}: prospective seed investor, met at demo day.`,
  },
  {
    name: "Sam Samplesworth",
    email: "sam@pilot-customer.example.test",
    organization: "Pilot customer (Mock)",
    kind: "customer" as const,
    notes: `${MOCK_NOTE}: runs the second pilot site.`,
  },
];

/** The Carta agent's last read of the mock cap table; matches the MOCK Cap Table Summary in the data room. */
export const DEMO_CAP_TABLE = {
  companyName: DEMO_COMPANY,
  asOf: "2026-10-01",
  fullyDilutedShares: 10_000_000,
  amountRaisedUsd: 350_000,
  optionPoolAvailable: 600_000,
  latest409a: { pricePerShareUsd: 0.42, date: "2026-07-01" },
  shareClasses: [
    { name: "Common (Mock)", shares: 8_400_000, percent: 84 },
    { name: "Option pool (Mock)", shares: 1_600_000, percent: 16 },
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
      shares: 1_150_000,
      amountUsd: null,
      percent: 11.5,
    },
    {
      name: "Casey Advisor (Mock)",
      email: "casey.advisor@advisors.example.test",
      organization: "Independent advisor (Mock)",
      security: "Common",
      shares: 250_000,
      amountUsd: null,
      percent: 2.5,
    },
    {
      name: "Sam Engineer (Mock)",
      email: null,
      organization: null,
      security: "Options",
      shares: 400_000,
      amountUsd: null,
      percent: 4,
    },
    {
      name: "Jo Designer (Mock)",
      email: null,
      organization: null,
      security: "Options",
      shares: 250_000,
      amountUsd: null,
      percent: 2.5,
    },
    {
      name: "Alex Firmware (Mock)",
      email: null,
      organization: null,
      security: "Options",
      shares: 250_000,
      amountUsd: null,
      percent: 2.5,
    },
    {
      name: "Riley Operations (Mock)",
      email: null,
      organization: null,
      security: "Options",
      shares: 100_000,
      amountUsd: null,
      percent: 1,
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
    {
      name: "Sora Angel (Mock)",
      email: "sora@angel.example.test",
      organization: "Independent angel (Mock)",
      security: "SAFE",
      shares: null,
      amountUsd: 25_000,
      percent: null,
    },
    {
      name: "Tomas Operator (Mock)",
      email: "tomas@operator-angels.example.test",
      organization: "Operator angels (Mock)",
      security: "SAFE",
      shares: null,
      amountUsd: 25_000,
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
/**
 * Types are the classifier's own values (DataRoomDocTypeSchema), so tagged and newly read documents
 * use one vocabulary. Parties are written as the document text names them.
 */
export const DEMO_DOCUMENT_FACETS: Record<
  string,
  { docType: string; daysAgo: number; parties: string[] }
> = {
  "MOCK Statement of Work - Halcyon Logistics.pdf": {
    docType: "contract",
    daysAgo: 95,
    parties: ["Halcyon Logistics (Mock)"],
  },
  "MOCK SaaS Subscription - Cobalt Cloud Hosting.pdf": {
    docType: "contract",
    daysAgo: 316,
    parties: ["Cobalt Cloud Hosting (Mock)"],
  },
  "MOCK Equipment Lease - Delta Desk Rentals.pdf": {
    docType: "contract",
    daysAgo: 165,
    parties: ["Delta Desk Rentals (Mock)"],
  },
  "MOCK Reseller Agreement - Cascade Robotics.pdf": {
    docType: "contract",
    daysAgo: 20,
    parties: ["Cascade Robotics (Mock)"],
  },
  "MOCK Insurance Policy - Shieldwell.pdf": {
    docType: "contract",
    daysAgo: 324,
    parties: ["Shieldwell Insurance (Mock)"],
  },
  "MOCK Consulting Agreement - Fictional Law Group.pdf": {
    docType: "contract",
    daysAgo: 300,
    parties: ["Fictional Law Group (Mock)"],
  },
  "MOCK Master Services Agreement - Halcyon Logistics.pdf": {
    docType: "contract",
    daysAgo: 95,
    parties: ["Halcyon Logistics (Mock)"],
  },
  "MOCK Mutual NDA - Acme Ventures.pdf": {
    docType: "contract",
    daysAgo: 60,
    parties: ["Acme Ventures (Mock)"],
  },
  "MOCK Office Lease - 100 Placeholder Street.pdf": {
    docType: "contract",
    daysAgo: 400,
    parties: ["Placeholder Street Landlord (Mock)"],
  },
  "MOCK SAFE - Quill Capital.pdf": {
    docType: "investor",
    daysAgo: 150,
    parties: ["Quill Capital (Mock)"],
  },
  "MOCK Q3 Board Deck.pdf": { docType: "presentation", daysAgo: 3, parties: [] },
  "MOCK Budget FY27.csv": { docType: "spreadsheet", daysAgo: 20, parties: [] },
  "MOCK Investor Update Draft.pdf": { docType: "investor", daysAgo: 1, parties: [] },
  "MOCK Cap Table Summary.csv": { docType: "spreadsheet", daysAgo: 1, parties: [] },
  "MOCK Product Roadmap.pdf": { docType: "report", daysAgo: 30, parties: [] },
  "MOCK Invoice NW-1044 - Acme Servo Supply.pdf": {
    docType: "invoice",
    daysAgo: 12,
    parties: ["Acme Servo Supply (Mock)"],
  },
  "MOCK Invoice 2209 - Cobalt Cloud Hosting.pdf": {
    docType: "invoice",
    daysAgo: 8,
    parties: ["Cobalt Cloud Hosting (Mock)"],
  },
};

const doc = (folder: string, name: string, text: string, kind: DemoDocument["kind"] = "pdf") => ({
  folder,
  name,
  kind,
  // "Acme Mock" reads as "Acme (Mock)", the form the parties take, so a model reading it agrees.
  text: `MOCK DEMO DATA. ${text.replace(/ Mock\b/g, " (Mock)")} ${MOCK_NOTE}, not a real document.`,
});

export const DEMO_DOCUMENTS: DemoDocument[] = [
  doc(
    "Legal",
    "MOCK Statement of Work - Halcyon Logistics.pdf",
    "Statement of Work for 20 picking robots at Halcyon Logistics Mock. Term 12 months. Fees 48000 dollars.",
  ),
  doc(
    "Legal",
    "MOCK SaaS Subscription - Cobalt Cloud Hosting.pdf",
    "Subscription agreement for cloud hosting between Northwind Robotics Mock and Cobalt Cloud Hosting Mock. Fees 22200 dollars a year. Renews automatically unless notice is given 30 days before.",
  ),
  doc(
    "Legal",
    "MOCK Equipment Lease - Delta Desk Rentals.pdf",
    "Equipment lease for desks and lab benches between Northwind Robotics Mock and Delta Desk Rentals Mock. Total 12600 dollars.",
  ),
  doc(
    "Legal",
    "MOCK Reseller Agreement - Cascade Robotics.pdf",
    "Reseller agreement between Northwind Robotics Mock and Cascade Robotics Mock. Margin 15 percent. Renews for two years unless notice is given 90 days before.",
  ),
  doc(
    "Legal",
    "MOCK Insurance Policy - Shieldwell.pdf",
    "General liability policy from Shieldwell Insurance Mock. Premium 3100 dollars a year. Limit 1000000 dollars. Renews December 1.",
  ),
  doc(
    "Legal",
    "MOCK Consulting Agreement - Fictional Law Group.pdf",
    "Consulting agreement for legal services between Northwind Robotics Mock and Fictional Law Group Mock. Retainer 2500 dollars a month.",
  ),
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
    "Office lease for 100 Placeholder Street between Northwind Robotics Mock and Placeholder Street Landlord Mock. Monthly rent 7500 dollars. The lease renews automatically at the end of its term unless notice is given at least 62 days before.",
  ),
  doc(
    "Legal",
    "MOCK SAFE - Quill Capital.pdf",
    "Simple Agreement for Future Equity. Investor Quill Capital Mock. Purchase amount 250000 dollars. Valuation cap 8000000 dollars. Discount 20 percent.",
  ),
  doc(
    "Finance",
    "MOCK Q3 Board Deck.pdf",
    "Board deck for the third quarter. Cash 1633221 dollars. Monthly net burn 67621 dollars. Runway 24.2 months.",
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
    "Draft investor update. Highlights: pilot converted to an annual contract; runway 24.2 months.",
  ),
  doc(
    "Fundraising",
    "MOCK Cap Table Summary.csv",
    "holder,class,shares,percent\nMaya Chen Mock,common,4000000,40\nRiver Cofounder Mock,common,3000000,30\nEarly employees Mock,common,1500000,15\nOption pool Mock,pool,1500000,15\nQuill Capital SAFE Mock,safe,0,pending",
    "csv",
  ),
  doc(
    "Product",
    "MOCK Product Roadmap.pdf",
    "Roadmap for the next two quarters. Q4: calibration tool. Q1: fleet dashboard.",
  ),
];

/**
 * Enough more documents to page the list (over 50), with the folders a founder keeps: investor
 * updates, bank statements, HR, contracts and an archive. Each one has its type, date and parties.
 */
const MORE_DOCUMENTS: (DemoDocument & {
  facets: { docType: string; daysAgo: number; parties: string[] };
})[] = [
  ...["July", "August", "September"].map((month, index) => ({
    ...doc(
      "Finance/Bank statements",
      `MOCK Mercury Statement - ${month}.pdf`,
      `Mercury Mock checking statement for ${month}. Opening balance and closing balance for Northwind Robotics Mock.`,
    ),
    facets: { docType: "statement", daysAgo: 75 - index * 30, parties: ["Mercury (Mock)"] },
  })),
  ...Array.from({ length: 12 }, (_, index) => ({
    ...doc(
      "Investors",
      `MOCK Monthly Investor Update ${String(index + 1).padStart(2, "0")}.pdf`,
      `Monthly investor update number ${index + 1}. Revenue, burn and hiring for the month.`,
    ),
    // Numbered in date order: update 12 is the latest.
    facets: { docType: "investor", daysAgo: 30 * (13 - index), parties: [] },
  })),
  ...Array.from({ length: 24 }, (_, index) => {
    const vendor = ["Acme Servo Supply", "Cobalt Cloud Hosting", "Delta Desk Rentals"][index % 3];
    return {
      ...doc(
        "Finance/Invoices",
        `MOCK Invoice ${3000 + index} - ${vendor}.pdf`,
        `Invoice ${3000 + index} from ${vendor} Mock to Northwind Robotics Mock. Amount due ${400 + index * 25} dollars.`,
      ),
      facets: { docType: "invoice", daysAgo: 20 + index * 14, parties: [`${vendor} (Mock)`] },
    };
  }),
  ...["Offer Letter - Sam Engineer", "Offer Letter - Jo Designer", "Employee Handbook"].map(
    (name, index) => ({
      ...doc("HR", `MOCK ${name}.pdf`, `${name} for Northwind Robotics Mock.`),
      facets: {
        docType: "hr",
        daysAgo: 100 + index * 40,
        parties: [],
      },
    }),
  ),
  ...["Halcyon Logistics", "Bolt Freight"].map((party, index) => ({
    ...doc(
      "Legal/Contracts",
      `MOCK Pilot Agreement - ${party}.pdf`,
      `Pilot agreement between Northwind Robotics Mock and ${party} Mock. Term 6 months.`,
    ),
    facets: { docType: "contract", daysAgo: 200 + index * 30, parties: [`${party} (Mock)`] },
  })),
  ...["Pitch Deck v1", "Pitch Deck v2", "Old Budget"].map((name, index) => ({
    ...doc(
      "Archive/Old drafts/2025",
      `MOCK ${name}.pdf`,
      `${name}, an old draft kept for reference.`,
    ),
    facets: {
      docType: index === 2 ? "spreadsheet" : "presentation",
      daysAgo: 300 + index * 10,
      parties: [],
    },
  })),
];
DEMO_DOCUMENTS.push(...MORE_DOCUMENTS.map(({ facets: _facets, ...document }) => document));
for (const { name, facets } of MORE_DOCUMENTS) DEMO_DOCUMENT_FACETS[name] = facets;

/**
 * Read but never tagged (AI sharing was off when it arrived), so "Allow" has something to tag
 * while every other document keeps the type and date it already has.
 */
export const DEMO_UNTAGGED_DOCUMENT = doc(
  "Fundraising",
  "MOCK Term Sheet Draft - Quill Capital.pdf",
  "Draft term sheet from Quill Capital Mock for a seed round. Pre money valuation 9000000 dollars.",
);
DEMO_DOCUMENTS.push(DEMO_UNTAGGED_DOCUMENT);

/**
 * A file that could not be read, added among the last so it is on the list's first page and the
 * "Failed" state and Try again can be seen without paging.
 */
export const DEMO_FAILED_DOCUMENT = doc(
  // Outside the Legal folder, so the failed state does not hide a contract from the Legal page.
  "Product",
  "MOCK Signed NDA - Bolt Freight.pdf",
  "A damaged scan that is not a readable PDF.",
  "broken",
);
DEMO_DOCUMENTS.push(DEMO_FAILED_DOCUMENT);

/** Still being read when the demo opens, so the "Reading" state shows. */
export const DEMO_READING_DOCUMENT = doc(
  "Investors",
  "MOCK Board Minutes - October.pdf",
  "Minutes of the October board meeting of Northwind Robotics Mock.",
);
DEMO_DOCUMENTS.push(DEMO_READING_DOCUMENT);

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
  description: "Last month's update to investors, to start October from",
  text: `# MOCK DEMO DATA: Investor update, September

Hi Priya, Dana and Lee,

Highlights
- The Halcyon Logistics (Mock) pilot converted to an annual contract.
- Cash is $1,633,221 with $67,621 monthly net burn: about 24 months of runway.

Asks
- Intros to robotics buyers in warehousing.

Maya

${MOCK_NOTE}: invented for UX testing. Not a real update.
`,
};

/** The draft's earlier version, so the artifact shows a version history. */
export const DEMO_CHIEF_DRAFT_V1 = {
  ...DEMO_CHIEF_DRAFT,
  text: `# MOCK DEMO DATA: Investor update, September (first draft)

Hi all,

- Halcyon Logistics (Mock) pilot is going well.
- Cash and burn: to fill in.

${MOCK_NOTE}: invented for UX testing. Not a real update.
`,
};

/** Other files bots "made", one of each kind the Artifacts page shows. */
export const DEMO_ARTIFACTS = [
  {
    name: "MOCK Q3 Board Deck.md",
    mimeType: "text/markdown",
    description: "Board meeting deck: results, plan and asks",
    text: `# MOCK DEMO DATA: Q3 board deck

1. Results: 3 pilots, 1 annual contract
2. Cash: $1,633,221, 24.2 months of runway
3. Plan for Q4: 2 hires, 5 new pilots
4. Asks for the board

${MOCK_NOTE}: invented for UX testing.
`,
  },
  {
    name: "MOCK Cash Dashboard.html",
    mimeType: "text/html",
    description: "Cash, burn and runway at a glance",
    text: `<!doctype html><html><body style="font-family:sans-serif;padding:24px">
<h1>MOCK DEMO DATA: Cash dashboard</h1>
<p>Cash: $1,633,221 · Monthly burn: $67,621 · Runway: 24.2 months</p>
<p>${MOCK_NOTE}: invented for UX testing.</p>
</body></html>
`,
  },
  {
    name: "MOCK Runway Scenarios.csv",
    mimeType: "text/csv",
    description: "Runway if burn changes",
    text: `scenario,monthly_burn_usd,runway_months
current,67621,24.2
hire two engineers,101600,16.1
cut tools 10%,60859,26.8
${MOCK_NOTE},,
`,
  },
  {
    name: "MOCK Burn by Month.csv",
    mimeType: "text/csv",
    description: "Monthly net burn for the last six months",
    text: `month,net_burn_usd
2026-04,58200
2026-05,61000
2026-06,63400
2026-07,64900
2026-08,66800
2026-09,67600
${MOCK_NOTE},
`,
  },
  {
    name: "MOCK Hiring Plan - Q4.md",
    mimeType: "text/markdown",
    description: "Two roles for Q4 and what they cost",
    text: `# MOCK DEMO DATA: Hiring plan, Q4

- Senior robotics engineer, from November
- Field deployment lead, from December

${MOCK_NOTE}: invented for UX testing.
`,
  },
  {
    name: "MOCK Customer Pipeline.csv",
    mimeType: "text/csv",
    description: "Open pilots and deals by stage",
    text: `customer,stage,value_usd,next_step
Halcyon Logistics (Mock),Won,120000,Q1 deployment kickoff
Bolt Freight (Mock),Negotiation,60000,Resend the signed NDA
Cascade Robotics (Mock),Won,0,Reseller onboarding
Pilot customer (Mock),Pilot,25000,Review results on Nov 6
Orchard Fulfillment (Mock),Qualified,45000,Site visit
${MOCK_NOTE},,,
`,
  },
  {
    name: "MOCK Vendor Spend Review.md",
    mimeType: "text/markdown",
    description: "Where the monthly spend goes and what to trim",
    text: `# MOCK DEMO DATA: Vendor spend review

| Vendor | Monthly | Note |
| --- | --- | --- |
| Placeholder Street Landlord (Mock) | $7,500 | Lease renews in 106 days |
| Cobalt Cloud Hosting (Mock) | $1,850 | Renews in 49 days; right-size the instances |
| Brightsign Ads (Mock) | $1,800 | Paused in November |
| Cursor Seats (Mock) | $200 | Keep |

Trimming hosting and ads saves about $900 a month.

${MOCK_NOTE}: invented for UX testing.
`,
  },
  {
    name: "MOCK Seed Fundraising Plan.md",
    mimeType: "text/markdown",
    description: "Target round, investor list and timeline",
    text: `# MOCK DEMO DATA: Seed fundraising plan

- Target: $2,000,000 on top of the $350,000 in SAFEs
- Lead candidates: Quill Capital (Mock), Acme Ventures (Mock), Placeholder Ventures (Mock)
- Timeline: first meetings in November, close in January
- The SAFEs convert at the $8,000,000 cap

${MOCK_NOTE}: invented for UX testing.
`,
  },
  {
    name: "MOCK All-hands Notes - October.md",
    mimeType: "text/markdown",
    description: "Decisions and owners from the October all-hands",
    text: `# MOCK DEMO DATA: All-hands notes, October

- Pilot site two goes live Nov 6 (owner: Sam)
- Offsite on Nov 21 (owner: Casey)
- Security questionnaire for Halcyon due Friday (owner: Maya)

${MOCK_NOTE}: invented for UX testing.
`,
  },
];

/** An earlier conversation with Chief, so history, search and recall have something to find. */
/**
 * Turns each `{artifact:<file name>}` in a seeded message into a link that opens that artifact,
 * named without its extension. A name with no id is left as plain text.
 */
export function linkDemoArtifacts(text: string, ids: ReadonlyMap<string, string>): string {
  return text.replace(/\{artifact:([^}]+)\}/g, (_match, name: string) => {
    const label = name.replace(/\.[a-z0-9]+$/i, "");
    const id = ids.get(name);
    return id ? `[${label}](/app/artifacts/${id})` : label;
  });
}

export const DEMO_CHIEF_HISTORY: Array<{ role: "user" | "bot"; text: string }> = [
  { role: "user", text: "When is the next board meeting? (mock)" },
  {
    role: "bot",
    text: "The Q3 board meeting is on the 28th. I drafted the deck; it is in Artifacts as {artifact:MOCK Q3 Board Deck.md}.",
  },
  { role: "user", text: "What did we agree with Halcyon Logistics (Mock)?" },
  {
    role: "bot",
    text: "The pilot converted to an annual contract for 20 picking robots, starting in Q1.",
  },
  { role: "user", text: "Remind me what our runway was last month." },
  {
    role: "bot",
    text: "About 24 months, from $1,633,221 cash and $67,621 monthly net burn.",
  },
  { role: "user", text: "Who still owes us a signed NDA?" },
  {
    role: "bot",
    text: "Bolt Freight (Mock). Their NDA upload failed, so it is worth asking them to send it again.",
  },
  { role: "user", text: "Draft a short thank-you to Priya Placeholder for the intro." },
  {
    role: "bot",
    text: 'Here is a draft: "Thanks for the intro to Acme Ventures (Mock), Priya. We are meeting next week."',
  },
  { role: "user", text: "What should I hire for first?" },
  {
    role: "bot",
    text: "The hiring plan puts a senior robotics engineer first, in November. It is in Artifacts as {artifact:MOCK Hiring Plan - Q4.md}.",
  },
];

/** A bot that was archived, so the archive has something to show and restore. */
export const DEMO_ARCHIVED_BOT = {
  name: "Hiring helper (mock)",
  title: "Hiring",
  description: `${MOCK_NOTE}: screened the demo candidates last quarter.`,
};

/** The Legal agent (created by the Legal page) is the space's one legal bot, so none is seeded here. */
export const DEMO_BOTS = [
  {
    name: "Investor Relations (mock)",
    title: "Fundraising",
    description: `${MOCK_NOTE}: drafts the demo investor updates.`,
  },
];

export const DEMO_GROUP = { name: "Leadership sync (mock)" };

/**
 * A bot whose run is still working, so Activity has something under "Working". Written straight
 * to the database with a long lease and no worker behind it, so no model runs. The bot is not in
 * the group chat, so group replies never wait on it. Reseed (demo:down/up) to reset it.
 */
export const DEMO_RUNNING_RUN = {
  bot: {
    name: "Finance helper (mock)",
    title: "Finance",
    description: `${MOCK_NOTE}: compares the demo spend month by month.`,
  },
  prompt: "Compare this quarter's burn with last quarter, by category (mock).",
  leaseMs: 6 * HOUR_MS,
};

/**
 * One run parked on a question, so Activity has something under "Needs you" and the bot's chat
 * shows an answerable question. No model runs until the founder answers. The stuck-work sweep
 * cancels it after a day, so reseed (demo:down/up) for a fresh one.
 */
export const DEMO_WAITING_RUN = {
  botName: "Investor Relations (mock)",
  prompt: "Draft the October investor update from the September one.",
  intro: `${MOCK_NOTE}: I have the September update open and can start the October draft.`,
  question:
    "Should the October update name the Bolt Freight pilot, or keep it as 'a logistics customer'?",
  choices: [
    { id: "name", label: "Name Bolt Freight" },
    { id: "anonymous", label: "Say 'a logistics customer'" },
  ],
};
/** A placeholder OpenRouter key for the Legal agent; OpenRouter rejects it, so it never spends. */
export const DEMO_LEGAL_KEY = {
  apiKey: "sk-or-v1-mock-demo-not-a-real-key",
  label: `OpenRouter (${MOCK_NOTE}: placeholder key, scans fail)`,
};

/**
 * What the Legal agent's last daily scan recorded. Dates are days from today, so the overdue and
 * upcoming deadlines stay that way whenever the demo is seeded. Money is integer cents.
 */
export const DEMO_LEGAL = {
  company: "Northwind Robotics (Mock)",
  contracts: [
    {
      document: "MOCK Office Lease - 100 Placeholder Street.pdf",
      title: "MOCK Office Lease - 100 Placeholder Street",
      contractType: "Lease",
      party: "Placeholder Street Landlord (Mock)",
      jurisdiction: "California",
      effectiveInDays: -400,
      expiresInDays: 106,
      autoRenews: true,
      renewalNoticeDays: 62,
      valueCents: 9_000_000n,
      partyQuote:
        "Office lease for 100 Placeholder Street between Northwind Robotics Mock and Placeholder Street Landlord Mock.",
      renewalQuote:
        "The lease renews automatically at the end of its term unless notice is given at least 62 days before.",
      summary: `${MOCK_NOTE}: office lease, 7,500 dollars a month, renews automatically unless notice is given 62 days before it ends.`,
    },
    {
      document: "MOCK Master Services Agreement - Halcyon Logistics.pdf",
      title: "MOCK Master Services Agreement - Halcyon Logistics",
      contractType: "MSA",
      party: "Halcyon Logistics (Mock)",
      jurisdiction: "Delaware",
      effectiveInDays: -95,
      expiresInDays: 635,
      autoRenews: false,
      renewalNoticeDays: null,
      valueCents: 12_000_000n,
      partyQuote:
        "Master Services Agreement between Northwind Robotics Mock and Halcyon Logistics Mock.",
      renewalQuote: null,
      summary: `${MOCK_NOTE}: 24-month services agreement; either side may end it on 60 days notice.`,
    },
    {
      document: "MOCK Mutual NDA - Acme Ventures.pdf",
      title: "MOCK Mutual NDA - Acme Ventures",
      contractType: "NDA",
      party: "Acme Ventures (Mock)",
      jurisdiction: "Delaware",
      effectiveInDays: -60,
      expiresInDays: 1035,
      autoRenews: false,
      renewalNoticeDays: null,
      valueCents: null,
      partyQuote:
        "Mutual Non Disclosure Agreement between Northwind Robotics Mock and Acme Ventures Mock.",
      renewalQuote: null,
      summary: `${MOCK_NOTE}: mutual NDA for three years.`,
    },
    {
      document: "MOCK SAFE - Quill Capital.pdf",
      title: "MOCK SAFE - Quill Capital",
      contractType: "SAFE",
      party: "Quill Capital (Mock)",
      jurisdiction: "Delaware",
      effectiveInDays: -150,
      expiresInDays: null,
      autoRenews: null,
      renewalNoticeDays: null,
      valueCents: 25_000_000n,
      partyQuote: "Simple Agreement for Future Equity. Investor Quill Capital Mock.",
      renewalQuote: null,
      summary: `${MOCK_NOTE}: SAFE for 250,000 dollars at an 8,000,000 dollar valuation cap.`,
    },
    {
      document: "MOCK Statement of Work - Halcyon Logistics.pdf",
      title: "MOCK Statement of Work - Halcyon Logistics",
      contractType: "SOW",
      party: "Halcyon Logistics (Mock)",
      jurisdiction: "Delaware",
      effectiveInDays: -60,
      expiresInDays: 305,
      autoRenews: false,
      renewalNoticeDays: null,
      valueCents: 4_800_000n,
      partyQuote:
        "Statement of Work under the Master Services Agreement between Northwind Robotics Mock and Halcyon Logistics Mock.",
      renewalQuote: null,
      summary: `${MOCK_NOTE}: 12-month deployment of 20 picking robots, billed monthly after acceptance.`,
    },
    {
      document: "MOCK SaaS Subscription - Cobalt Cloud Hosting.pdf",
      title: "MOCK SaaS Subscription - Cobalt Cloud Hosting",
      contractType: "Subscription",
      party: "Cobalt Cloud Hosting (Mock)",
      jurisdiction: "California",
      effectiveInDays: -316,
      expiresInDays: 49,
      autoRenews: true,
      renewalNoticeDays: 30,
      valueCents: 2_220_000n,
      partyQuote:
        "Subscription agreement between Northwind Robotics Mock and Cobalt Cloud Hosting Mock.",
      renewalQuote:
        "The subscription renews for another year unless notice is given 30 days before the term ends.",
      summary: `${MOCK_NOTE}: annual cloud hosting; renews unless cancelled 30 days before the end of the term.`,
    },
    {
      document: "MOCK Equipment Lease - Delta Desk Rentals.pdf",
      title: "MOCK Equipment Lease - Delta Desk Rentals",
      contractType: "Lease",
      party: "Delta Desk Rentals (Mock)",
      jurisdiction: "California",
      effectiveInDays: -165,
      expiresInDays: 200,
      autoRenews: false,
      renewalNoticeDays: null,
      valueCents: 1_260_000n,
      partyQuote: "Equipment lease between Northwind Robotics Mock and Delta Desk Rentals Mock.",
      renewalQuote: null,
      summary: `${MOCK_NOTE}: desk and lab bench rental, 12,600 dollars over the term, ends without renewal.`,
    },
    {
      document: "MOCK Reseller Agreement - Cascade Robotics.pdf",
      title: "MOCK Reseller Agreement - Cascade Robotics",
      contractType: "Reseller",
      party: "Cascade Robotics (Mock)",
      jurisdiction: "Delaware",
      effectiveInDays: -20,
      expiresInDays: 710,
      autoRenews: true,
      renewalNoticeDays: 90,
      valueCents: null,
      partyQuote: "Reseller agreement between Northwind Robotics Mock and Cascade Robotics Mock.",
      renewalQuote:
        "The agreement renews for two years unless notice is given 90 days before the term ends.",
      summary: `${MOCK_NOTE}: non-exclusive reseller rights in two regions, 15 percent margin.`,
    },
    {
      document: "MOCK Insurance Policy - Shieldwell.pdf",
      title: "MOCK Insurance Policy - Shieldwell",
      contractType: "Insurance",
      party: "Shieldwell Insurance (Mock)",
      jurisdiction: "California",
      effectiveInDays: -324,
      expiresInDays: 41,
      autoRenews: true,
      renewalNoticeDays: 30,
      valueCents: 310_000n,
      partyQuote:
        "General liability policy issued by Shieldwell Insurance Mock to Northwind Robotics Mock.",
      renewalQuote: "The policy renews on December 1 unless cancelled 30 days before.",
      summary: `${MOCK_NOTE}: general liability, 1,000,000 dollar limit, 3,100 dollars a year.`,
    },
    {
      document: "MOCK Consulting Agreement - Fictional Law Group.pdf",
      title: "MOCK Consulting Agreement - Fictional Law Group",
      contractType: "Services",
      party: "Fictional Law Group (Mock)",
      jurisdiction: "California",
      effectiveInDays: -300,
      expiresInDays: 330,
      autoRenews: false,
      renewalNoticeDays: null,
      valueCents: 3_000_000n,
      partyQuote:
        "Consulting agreement between Northwind Robotics Mock and Fictional Law Group Mock.",
      renewalQuote: null,
      summary: `${MOCK_NOTE}: outside counsel on a 2,500 dollar monthly retainer.`,
    },
  ],
  /** Deadlines added by hand, not tied to a contract: one overdue, one coming up. */
  manualDeadlines: [
    { title: "Q3 board consent signature", kind: "compliance", dueInDays: -5 },
    { title: "Trademark office action response", kind: "filing", dueInDays: 28 },
    { title: "Delaware franchise tax and annual report", kind: "filing", dueInDays: 47 },
    { title: "Refresh the 409A valuation", kind: "compliance", dueInDays: 72 },
    { title: "Pay Cascade Robotics onboarding fee", kind: "payment", dueInDays: 9 },
  ],
} as const;

/** Routines the demo agents run on a schedule (created active, so the bot page lists them). */
export const DEMO_ROUTINES = [
  {
    bot: "Chief",
    name: "Morning briefing",
    prompt:
      "Summarize what needs the founder today: unread mail that needs a reply, deadlines due this week and payments leaving in the next 3 days.",
    crons: ["0 8 * * 1-5"],
    timezone: "America/New_York",
  },
  {
    bot: "Finance agent",
    name: "Monday receipt chase",
    prompt: "List card transactions from the last week that have no receipt and post the list.",
    crons: ["0 9 * * 1"],
    timezone: "America/New_York",
  },
  {
    bot: "Inbox agent",
    name: "Daily inbox triage",
    prompt: "Sort new mail into reply, read and archive. Draft replies to the first group.",
    crons: ["0 7 * * 1-5"],
    timezone: "America/New_York",
  },
  {
    bot: "Investor Relations (mock)",
    name: "Monthly investor update draft",
    prompt: "Draft the monthly investor update from last month's update and the Finance numbers.",
    crons: ["0 9 1 * *"],
    timezone: "America/New_York",
  },
] as const;

/** Skills a founder taught the agents, saved and ready to use. */
export const DEMO_SKILLS = [
  {
    bot: "Finance agent",
    name: "Month-end close",
    goal: "Close the books for the month and report what is left to do.",
    playbook: {
      whenToUse: "In the first three business days of a month.",
      inputs: ["Month to close"],
      steps: [
        "Read the month's transactions from Mercury and Brex.",
        "List transactions with no receipt or category.",
        "Compare spend by category with the previous month.",
        "Post a short summary and the open items.",
      ],
      howToCheck: "Totals match the bank balances to the dollar.",
      whatToReturn: "A summary with total spend, the three biggest changes and the open items.",
      approvalBoundaries: "Never pay a bill or email a vendor without approval.",
      failureHandling: "If a bank connection is expired, say which one and stop.",
    },
  },
  {
    bot: "Investor Relations (mock)",
    name: "Monthly investor update",
    goal: "Write the monthly update to investors in the usual shape.",
    playbook: {
      whenToUse: "Around the 5th of each month.",
      inputs: ["Last month's update", "Finance overview", "Pipeline"],
      steps: [
        "Start from last month's update.",
        "Update cash, burn and runway from Finance.",
        "Add three highlights and one ask.",
        "Save the draft as an artifact.",
      ],
      howToCheck: "Every number matches the Finance page.",
      whatToReturn: "A one-page markdown draft.",
      approvalBoundaries: "Never send the update; the founder sends it.",
      failureHandling: "If the Finance numbers are stale, refresh before writing.",
    },
  },
] as const;

/** The one key the demo's Granola emulator accepts. It is fake and works nowhere else. */
export const DEMO_GRANOLA_KEY = "grn_demo_fake_key_0000";

/** Meetings the demo's Granola emulator serves, so Connect has something to sync. Invented. */
export function demoGranolaMeetings(now = new Date()): SourceMeeting[] {
  const at = (daysAgo: number, hour: number) =>
    new Date(now.getTime() - daysAgo * 24 * HOUR_MS + hour * HOUR_MS).toISOString();
  const meeting = (
    externalId: string,
    title: string,
    daysAgo: number,
    summary: string,
    lines: [string, string][],
  ): SourceMeeting => ({
    externalId,
    title: `${MOCK_SUBJECT_PREFIX} ${title}`,
    startedAt: at(daysAgo, -2),
    endedAt: at(daysAgo, -1),
    // The founder attends with her Founder mail address, a verified identity, so her own
    // commitments become Inbox to-dos in the demo.
    attendees: [
      { name: DEMO_USER_NAME, email: "mock-founder@northwind.example.test" },
      { name: "Priya Shah (Mock)", email: "mock-priya@northwind.example.test" },
    ],
    organizerEmail: "mock-founder@northwind.example.test",
    sourceUrl: null,
    folders: [],
    summary,
    privateNotes: "",
    transcript: lines.map(([speaker, text]) => ({ speaker, text })),
    updatedAt: at(daysAgo, -1),
  });
  return [
    meeting(
      "not_demo000000001",
      "Pricing review",
      1,
      "Agreed to move the Pro plan to annual billing. Maya will send Priya the revised pricing table.",
      [
        [DEMO_USER_NAME, "I will send Priya the revised pricing table by Friday."],
        ["Priya Shah (Mock)", "Great. Annual billing for Pro is settled, then."],
      ],
    ),
    meeting(
      "not_demo000000002",
      "Hiring sync",
      3,
      "Two engineering candidates reach final round. Priya books the onsite loops.",
      [
        ["Priya Shah (Mock)", "I will book the onsite loops for both candidates."],
        [DEMO_USER_NAME, "Thanks. I will review their take-home results tonight."],
      ],
    ),
    meeting(
      "not_demo000000003",
      "Roadmap check-in",
      8,
      "Mobile launch moves to next quarter. Billing export ships first.",
      [
        [DEMO_USER_NAME, "Mobile slips to next quarter; the billing export goes first."],
        ["Priya Shah (Mock)", "Understood. I will tell the pilot customers."],
      ],
    ),
  ];
}
