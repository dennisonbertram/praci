import type { MessageBlock } from "@rakazo/contracts";

/**
 * The conversations the demo's agents have already had with the founder. Everything is invented and
 * agrees with the rest of the demo data: the Finance numbers (cash, burn, runway, upcoming payments),
 * the cap table, the Legal contracts and deadlines, the Inbox and the Data room.
 * `{artifact:File name.md}` becomes a link to that artifact (see linkDemoArtifacts).
 */
export type Turn =
  | { role: "user"; text: string }
  | { role: "bot"; blocks: MessageBlock[]; botName?: string };

const user = (text: string): Turn => ({ role: "user", text });
const bot = (text: string, ...more: MessageBlock[]): Turn => ({
  role: "bot",
  blocks: [{ kind: "text", text }, ...more],
});
const steps = (
  ...list: Array<[label: string, summary: string, ...lines: string[]]>
): MessageBlock => ({
  kind: "steps",
  steps: list.map(([label, summary, ...lines]) => ({
    label,
    count: 1,
    summary,
    lines: lines.map((text) => ({ text })),
  })),
  durationMs: 4200,
});
const card = (...lines: Array<[string, string]>): MessageBlock => ({
  kind: "card",
  lines: lines.map(([k, v]) => ({ k, v })),
});
const approved = (text: string, answer: string, detail?: string): MessageBlock => ({
  kind: "ask",
  text,
  ...(detail ? { detail } : {}),
  status: "answered",
  answer,
  actions: [
    {
      id: "approve",
      label: "Approve",
      ...(answer === "Approve" ? { outcome: "created" as const } : {}),
    },
    { id: "decline", label: "Decline" },
  ],
});
export const DEMO_CONVERSATIONS: Record<string, { gapHours: number; turns: Turn[] }> = {
  Chief: {
    gapHours: 9,
    turns: [
      user("Morning. What do I need to know today?"),
      bot(
        "Three things. Priya sent the Q3 investor update draft and wants your numbers check by Friday. The Halcyon security questionnaire is due Friday. And the Q3 board consent signature is 5 days overdue.",
        steps(
          [
            "Read the Inbox",
            "10 unread, 4 need a reply",
            "Priya Placeholder: Q3 investor update draft",
            "Morgan Pretend: MSA redlines",
          ],
          ["Checked Legal deadlines", "1 overdue, 3 due in the next 30 days"],
        ),
      ),
      user("When is the next board meeting?"),
      bot(
        "The Q3 board meeting is on the 28th. I drafted the deck; it is in Artifacts as {artifact:MOCK Q3 Board Deck.md}.",
      ),
      user("What did we agree with Halcyon Logistics?"),
      bot(
        "The pilot converted to an annual contract for 20 picking robots, starting in Q1. The MSA is $120,000 over 24 months and either side can end it on 60 days notice. A statement of work for the deployment is $48,000.",
        steps([
          "Searched the Data room",
          "3 documents",
          "MOCK Master Services Agreement - Halcyon Logistics.pdf",
          "MOCK Statement of Work - Halcyon Logistics.pdf",
        ]),
      ),
      user("Remind me where runway stands."),
      bot(
        "24.2 months, until October 2028. Cash is $1,633,221 and the 3-month average net burn is $67,621. Payroll of $58,400 leaves on the 28th, which is the biggest payment coming up.",
        card(["Cash", "$1,633,221"], ["Monthly burn", "$67,621"], ["Runway", "24.2 months"]),
      ),
      user("Who still owes us a signed NDA?"),
      bot("Bolt Freight. Their NDA upload failed, so it is worth asking them to send it again."),
      user("Draft a short thank-you to Priya for the intro to a warehouse operator."),
      bot(
        'Here is a draft: "Thanks for the intro, Priya. I will report back after we speak this week." It is saved as a draft in Founder mail for you to send.',
      ),
      user("What should I hire for first?"),
      bot(
        "The hiring plan puts a senior robotics engineer first, in November, then a field deployment lead in December. It is in Artifacts as {artifact:MOCK Hiring Plan - Q4.md}. Both fit inside the current burn without cutting runway below 16 months.",
      ),
      user("Pay Placeholder Legal LLP the $2,000 bill on the 30th."),
      bot(
        "Scheduled. I asked for your approval first because it is a payment.",
        approved(
          "Pay Placeholder Legal LLP (Mock) $2,000 on Oct 30?",
          "Approve",
          "From Mercury checking.",
        ),
      ),
      user("Make a one-page list of where we spend, for the offsite."),
      bot(
        "Done. Hosting and ads are the two easy trims, about $900 a month. It is in Artifacts as {artifact:MOCK Vendor Spend Review.md}.",
        steps(
          [
            "Read Finance spend",
            "Oct 1 - 20: $20,484",
            "Rent $7,500",
            "Servers $7,212",
            "Marketing $1,800",
          ],
          ["Created an artifact", "MOCK Vendor Spend Review.md"],
        ),
      ),
      user("Great. What is on the pipeline?"),
      bot(
        "Five open deals. Halcyon is won at $120,000. Bolt Freight is in negotiation at $60,000, waiting on the NDA. The second pilot site goes live on Nov 6. The list is in {artifact:MOCK Customer Pipeline.csv}.",
      ),
    ],
  },
  "Finance agent": {
    gapHours: 5,
    turns: [
      user("What is our runway?"),
      bot(
        "You have 24.2 months of runway at the last 3 months' burn, with $1,633,221 in cash. At that pace cash would run out around October 2028.",
        steps(["Read the Finance overview", "5 bank accounts across Mercury and Brex"]),
      ),
      user("How did this month compare with last?"),
      bot(
        "Spend so far this month is $20,484, 1% above the same days in September ($20,200). Rent is $7,500 and servers $7,212; everything else is under $2,000.",
        card(["Oct 1 - 20", "$20,484"], ["Sep 1 - 20", "$20,200"], ["Change", "+1%"]),
      ),
      user("Anything unusual?"),
      bot(
        "Nothing stands out. Rent and servers are the two largest lines and both match September. Marketing is $1,800 for the Brightsign campaign, which you paused for November.",
      ),
      user("What payments are coming up?"),
      bot(
        "$79,888 in the next 30 days. The big one is Paylodex payroll of $58,400 on Oct 28. Then Placeholder Legal LLP $2,000 on Oct 30 and the lease $7,500 on Nov 1.",
        steps(["Read upcoming payments", "16 items in 30 days"]),
      ),
      user("What does crypto look like?"),
      bot(
        "$105,250, held in the treasury Safe and the ENS ops wallet. $77,000 is stablecoins. It is not counted in runway; one holding has no price, so it is excluded from the total.",
      ),
      user("Model hiring two engineers."),
      bot(
        "Hiring two engineers adds about $34,000 a month, so burn goes to roughly $101,600 and runway drops from 24.2 to 16.1 months. Cutting tools by 10% instead gets you to 26.8 months. The scenarios are in {artifact:MOCK Runway Scenarios.csv}.",
      ),
      user("Set up a month-end close checklist."),
      bot(
        "Added three items to the Month-end close checklist on this page: reconcile Mercury and Brex, chase missing receipts, send the investor update. The first is already checked.",
      ),
      user("Chase missing receipts every Monday at 9."),
      bot(
        "Created the routine Monday receipt chase. It runs Mondays at 9:00 and posts the list here. I will ask before emailing anyone.",
        approved("Turn on the routine Monday receipt chase?", "Approve"),
      ),
    ],
  },
  "Inbox agent": {
    gapHours: 6,
    turns: [
      user("What needs my reply today?"),
      bot(
        "Four threads. Priya (Q3 update draft), Morgan Pretend (MSA redlines, section 9), Fictional Law Group (trademark response draft) and Jamie Placeholder (wants the deck).",
        steps([
          "Searched mail",
          "10 unread, 4 need a reply",
          "Founder mail: 7 unread",
          "Sales mail: 3 unread",
        ]),
      ),
      user("Summarize the MSA redlines."),
      bot(
        "Halcyon accepted our liability cap of one times annual fees and wants section 9 changed so termination for convenience needs 90 days notice instead of 60. Dana Counselor, their counsel, is copied. Nothing else is open.",
        steps(["Read the thread", "4 messages, Oct 17 - 19"]),
      ),
      user("Reply: 90 days is fine if they accept the cap."),
      bot("Drafted a reply to Morgan and Dana, saved in your Founder mail drafts for you to send."),
      user("Anything from investors?"),
      bot(
        "Priya's Q3 draft, Dana Fakename at Acme (thanks for the deck, questions Monday) and Jamie Placeholder (met at demo day, wants the deck and metrics). Nothing urgent from Dana.",
      ),
      user("Send Jamie the deck."),
      bot(
        "Sent from Founder mail with the Q3 board deck attached.",
        approved(
          "Send Jamie Placeholder the deck?",
          "Approve",
          "From Founder mail. Attachment: MOCK Q3 Board Deck.pdf",
        ),
      ),
      user("Unsubscribe me from the promo mail."),
      bot(
        "Three senders sent only promotions: Docuflow, Robotics Roundup and Mock Conference. I will not unsubscribe without your say so. They are already in Newsletters.",
      ),
      user("Fine, leave them. Draft something for the Orchard pilot request."),
      bot(
        "Drafted a reply offering a site visit the week of Nov 10 and asking how many picking stations they run. It is saved as a draft in Founder mail.",
      ),
    ],
  },
  "Legal agent": {
    gapHours: 7,
    turns: [
      user("What did the last scan find?"),
      bot(
        "10 contracts, all active. One deadline is overdue (Q3 board consent signature, 5 days) and four are coming up. Total contract value in the data room is about $255,000 plus the $250,000 SAFE.",
        steps([
          "Read the Legal folder",
          "10 contracts found",
          "52 other documents checked, none legal",
        ]),
      ),
      user("What is coming up?"),
      bot(
        "In date order: pay the Cascade onboarding fee in 9 days, non-renewal notice for the Cobalt hosting subscription in 19 days, the Shieldwell insurance notice in 11 days, and the trademark office action response in 28 days.",
        card(
          ["Insurance notice", "in 11 days"],
          ["Cobalt hosting notice", "in 19 days"],
          ["Trademark response", "in 28 days"],
        ),
      ),
      user("Does the office lease auto renew?"),
      bot(
        "Yes. The lease renews automatically unless notice is given at least 62 days before it ends. It ends in 106 days, so the notice deadline is in 44 days.",
        steps(["Read MOCK Office Lease - 100 Placeholder Street.pdf", "Section 3: Renewal"]),
      ),
      user("Add a deadline for the Delaware franchise tax."),
      bot(
        "Added Delaware franchise tax and annual report, due in 47 days, to the deadlines.",
        approved(
          "Add this deadline to Legal?",
          "Approve",
          "Delaware franchise tax and annual report",
        ),
      ),
      user("Who are our counterparties with the biggest contracts?"),
      bot(
        "Halcyon Logistics $120,000 (MSA) plus $48,000 (SOW), Quill Capital $250,000 (SAFE), and the office landlord at $90,000 over the term.",
      ),
      user("Anything risky in the reseller agreement?"),
      bot(
        "Two things. It renews for two years unless notice is given 90 days before the term ends, and Cascade gets exclusivity in two regions. Margin is 15 percent. I would ask counsel about the exclusivity.",
      ),
      user("Ask Fictional Law Group to look at it."),
      bot(
        "Drafted a note to Fictional Law Group asking about the exclusivity, saved in your drafts.",
      ),
    ],
  },
  "Carta agent": {
    gapHours: 8,
    turns: [
      user("Refresh the cap table from Carta."),
      bot(
        "Done. The cap table is as of Oct 1: 10,000,000 fully diluted shares, $350,000 raised in four SAFEs.",
        steps(["Called Carta", "cap_table_chart", "12 holders read"]),
      ),
      user("What do I own?"),
      bot(
        "4,000,000 common shares, 40% fully diluted. River Cofounder holds 3,000,000 (30%).",
        card(["Maya Chen", "4,000,000 · 40%"], ["River Cofounder", "3,000,000 · 30%"]),
      ),
      user("How much is left in the option pool?"),
      bot(
        "600,000 shares (6%) are unallocated. 1,000,000 are granted to four people: Sam 400,000, Jo 250,000, Alex 250,000 and Riley 100,000.",
      ),
      user("What happens to the SAFEs if we raise at $10M pre?"),
      bot(
        "All four convert at the $8,000,000 cap, which is cheaper than the round price. $350,000 buys about 4.2% of the post-SAFE company before the new money. I can chart the dilution if you want.",
        steps(["Modeled conversion", "$350,000 at an $8,000,000 cap"]),
      ),
      user("What is our 409A?"),
      bot(
        "$0.42 per share as of July 1. A new round would void it, so Quinn at Auditwell suggested refreshing after you close.",
      ),
      user("Add Sora and Tomas as contacts."),
      bot("Both are in Contacts as investors, with their SAFE amounts."),
      user("Who has the largest SAFE?"),
      bot(
        "Quill Capital (Priya Placeholder) with $250,000. Lee, Sora and Tomas hold $50,000, $25,000 and $25,000.",
      ),
    ],
  },
  "Data room agent": {
    gapHours: 6,
    turns: [
      user("Find the latest contract."),
      bot(
        "The newest is MOCK Reseller Agreement - Cascade Robotics.pdf, added 20 days ago. It is in Legal.",
        steps(["Searched the Data room", "64 documents", "Filtered by type: contract"]),
      ),
      user("Which documents mention renewal?"),
      bot(
        "Four: the office lease, the Cobalt hosting subscription, the Cascade reseller agreement and the Shieldwell policy. Each renews automatically unless notice is given.",
      ),
      user("What is not tagged yet?"),
      bot(
        "One document: MOCK Term Sheet Draft - Quill Capital.pdf. It was read but never tagged, because AI sharing was off when it arrived. One file could not be read: MOCK Signed NDA - Bolt Freight.pdf is a damaged scan.",
      ),
      user("Put the term sheet in Fundraising and tag it."),
      bot(
        "It is already in Fundraising. I tagged it as an investor document with Quill Capital as the party.",
        approved("Tag this document?", "Approve", "MOCK Term Sheet Draft - Quill Capital.pdf"),
      ),
      user("Summarize the term sheet."),
      bot(
        "A seed round with a $9,000,000 pre-money valuation, led by Quill Capital. It does not say a closing date or a board seat yet.",
      ),
      user("Show me every invoice over $3,000."),
      bot(
        "One: MOCK Invoice NW-1044 - Acme Servo Supply.pdf for 40 servo motors, $3,200, due Nov 15.",
      ),
    ],
  },
  "Founder mail agent": {
    gapHours: 6,
    turns: [
      user("Summarize what is new this week."),
      bot(
        "Seven unread. The Q3 investor draft from Priya, Halcyon's MSA redlines, the October Cloudinary invoice ($4,812, due Oct 30), the trademark notice, and three newsletters.",
        steps(["Read Founder mail", "7 unread", "3 in Newsletters"]),
      ),
      user("Who is waiting on me?"),
      bot(
        "Priya (numbers check by Friday), Morgan Pretend (MSA section 9) and Jamie Placeholder (deck). Casey also asked which offsite date you prefer.",
      ),
      user("Tell Casey Nov 21 and to book the lakeside venue."),
      bot(
        "Sent.",
        approved("Send this email to Casey Coworker?", "Approve", "Subject: Offsite date."),
      ),
      user("Draft a reply to Priya about the numbers."),
      bot(
        "Drafted: runway 24.2 months, burn $67,621, pilot converted to an annual contract. It is in your drafts for review.",
      ),
      user("Archive the newsletters older than a week."),
      bot(
        "Three archived: Robotics Roundup, SaaS Metrics Monthly and Mock Conference.",
        approved("Archive 3 newsletters?", "Approve"),
      ),
    ],
  },
  "Sales mail agent": {
    gapHours: 8,
    turns: [
      user("Any new leads in sales mail?"),
      bot(
        "Two. Robin Prospect at Bolt Freight asked for pricing on 20 units, and Orchard Fulfillment, a three-warehouse operator, wants a pilot.",
        steps(["Read Sales mail", "3 unread", "2 leads"]),
      ),
      user("What price did we quote Bolt?"),
      bot(
        "$3,000 per unit with a 10% discount for 20 units, so $54,000, and a $6,000 setup fee. Total $60,000, which matches the pipeline.",
      ),
      user("Reply to Orchard with a site visit the week of Nov 10."),
      bot(
        "Drafted and saved in Sales mail drafts. It asks how many picking stations they run and proposes Nov 11 or 12.",
      ),
      user("Follow up with Robin on the NDA."),
      bot(
        "Sent a short note asking Robin to resend the signed NDA, since the earlier upload failed.",
        approved(
          "Send this email to Robin Prospect?",
          "Approve",
          "From Sales mail. Subject: NDA resend.",
        ),
      ),
      user("Add Orchard to the pipeline."),
      bot("Added to {artifact:MOCK Customer Pipeline.csv} as Qualified at $45,000."),
    ],
  },
  "Investor Relations (mock)": {
    gapHours: 12,
    turns: [
      user("Draft the September investor update."),
      bot(
        "Done. The pilot conversion leads, then cash and burn, then one ask. It is in Artifacts as {artifact:MOCK Investor Update - September.md}.",
        steps(["Read Finance overview", "Read the Inbox", "Created an artifact"]),
      ),
      user("Who is on the investor list?"),
      bot(
        "Priya Placeholder (Quill Capital), Lee Notarealperson, Sora Angel, Tomas Operator, and Dana Fakename at Acme as a prospect. That is 4 SAFE holders and 1 prospect.",
      ),
      user("What was in the August update?"),
      bot(
        "Revenue from two pilots, the hiring plan and a request for intros to warehouse buyers. I kept the same structure for September.",
      ),
      user("Add the seed plan to the list of things to prepare."),
      bot(
        "I started {artifact:MOCK Seed Fundraising Plan.md}: a $2,000,000 target on top of the $350,000 in SAFEs, first meetings in November.",
      ),
    ],
  },
  "Leadership sync (mock)": {
    gapHours: 10,
    turns: [
      user("Quick status check from everyone, please."),
      {
        role: "bot",
        botName: "Chief",
        blocks: [
          {
            kind: "text",
            text: "Cash $1,633,221, runway 24.2 months. Payroll of $58,400 goes out on the 28th. Two legal deadlines this month need you.",
          },
        ],
      },
      {
        role: "bot",
        botName: "Investor Relations (mock)",
        blocks: [
          {
            kind: "text",
            text: "September update is drafted. Priya's Q3 numbers check is due Friday. I have one question about naming Bolt Freight in the October draft.",
          },
        ],
      },
      user("Name Bolt Freight only if the NDA is signed."),
      {
        role: "bot",
        botName: "Chief",
        blocks: [
          {
            kind: "text",
            text: "Understood. Bolt's NDA upload failed, so I will keep them anonymous for now.",
          },
        ],
      },
      user("What should the team focus on this week?"),
      {
        role: "bot",
        botName: "Chief",
        blocks: [
          {
            kind: "text",
            text: "Three things: the Halcyon security questionnaire (Friday), the Q3 board consent signature, and the pilot site two network setup for Nov 6.",
          },
        ],
      },
      {
        role: "bot",
        botName: "Investor Relations (mock)",
        blocks: [{ kind: "text", text: "I will send the October draft for review on Thursday." }],
      },
    ],
  },
};

/**
 * The email agent's chat for the Sam Ortiz thread ("Ask agent" on that email). It follows the thread
 * card the agent starts with. The 4,600 figure is calculated, and the answer says so.
 */
export const DEMO_EMAIL_AGENT_CONVERSATION: { gapHours: number; turns: Turn[] } = {
  gapHours: 0.02,
  turns: [
    user("Help me answer this."),
    {
      role: "bot",
      blocks: [
        steps(
          ["Read the thread", "Read email thread"],
          ["Read Carta", "Read Carta: Sam Ortiz"],
          [
            "Searched the Data room",
            "Searched Data room: 4 found",
            "Recapitalization Summary",
            "Warrant Agreement",
          ],
          ["Read the Data room file", "Read Recapitalization Summary"],
          ["Searched mail", "Searched mail: 3 found"],
        ),
        {
          kind: "text",
          text: `**1. Closing out.** Carta lists 18,400 Series Seed Preferred and a 2,000-share warrant for Sam. The Warrant Agreement lets the holder cancel it with written consent. I found no repurchase template or board consent. Tax treatment is a question for your counsel.

**2. After the recap.** Carta's snapshot is from Sep 30, before the recap. The Recapitalization Summary sets a 1-for-4 reverse split, which gives **4,600 shares (calculated from the summary, not read from Carta)**. Seed Prime was offered to all 9 existing investors on Sep 8, including Sam. I found no reply from him.

Draft reply:

> Hi Sam,
>
> Your 18,400 preferred shares become 4,600 after the 1-for-4 reverse split. Seed Prime was offered to all existing investors, including you, on Sep 8.
>
> On closing out: we can do it either way. I will confirm which and send the paperwork this week.
>
> Maya`,
        },
      ],
    },
  ],
};
