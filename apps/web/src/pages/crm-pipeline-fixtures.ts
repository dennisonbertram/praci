// MOCKUP ONLY. Every firm, person, address, date and amount here is invented.

export const STATUSES = [
  ["not_reached", "Not reached"],
  ["reached_out", "Reached out"],
  ["intro_requested", "Intro requested"],
  ["intro_made", "Intro made"],
  ["meeting_booked", "Meeting booked"],
  ["met", "Met"],
  ["diligence", "Diligence"],
  ["committed", "Committed"],
  ["passed", "Passed"],
] as const satisfies readonly [string, string][];
export type Status = (typeof STATUSES)[number][0];

export type Interest = "in" | "maybe" | "out";
export type Outcome = "Spoke" | "Left message" | "No answer";
export type Person = { id: string; name: string; email: string | null; researched?: boolean };
export type ContactLink = { id: string; name: string };
export type PipelineRow = {
  id: string;
  name: string;
  people: Person[];
  status: string;
  interest: Interest | null;
  referredBy: ContactLink | null;
  amountCents: number | null;
  details: string | null;
  detailsSource: "list" | "researched" | null;
  lastCall: { outcome: Outcome; date: string } | null;
  nextStep: string | null;
  nextCall: string | null;
  nextCallTime: string | null;
  /** An invite exists for this exact next call date. */
  invited: boolean;
  /** Mercury was opened for this prospect; no SAFE has attached yet. */
  waitingSince: string | null;
  /** A pipeline's own filter value, here the wave a prospect is called in. */
  group: string;
};

/** The mockup's fixed today (a Wednesday), so due rows stay the same in every render. */
export const TODAY = "2026-11-04";

export const REFERRERS: ContactLink[] = [
  { id: "c1", name: "Sam Example" },
  { id: "c2", name: "Jordan Sample" },
  { id: "c3", name: "Riley Placeholder" },
];
const [SAM, JORDAN, RILEY] = REFERRERS as [ContactLink, ContactLink, ContactLink];

const person = (name: string, domain: string | null): Person => ({
  id: name,
  name,
  email: domain ? `${name.split(" ")[0]?.toLowerCase()}@${domain}.example.test` : null,
});

const BLANK = {
  people: [],
  interest: null,
  referredBy: null,
  amountCents: null,
  details: null,
  detailsSource: null,
  lastCall: null,
  nextStep: null,
  nextCall: null,
  nextCallTime: null,
  invited: false,
  waitingSince: null,
  group: "1",
} satisfies Partial<PipelineRow>;

/** Written out so the top of the list shows every state a row can be in. */
const FIRST: PipelineRow[] = [
  {
    ...BLANK,
    id: "f1",
    name: "Sample Street Capital",
    people: [
      person("Alex Sample", "samplestreet"),
      { ...person("Drew Sample", "samplestreet"), researched: true },
      person("Morgan Example", null),
    ],
    status: "met",
    interest: "maybe",
    referredBy: SAM,
    amountCents: 25_000_000,
    details: "Seed lead · $250K–$500K",
    detailsSource: "researched",
    lastCall: { outcome: "Spoke", date: "2026-10-28" },
    nextStep: "Send the deck before the call",
    nextCall: "2026-11-02",
    nextCallTime: "10:00",
  },
  {
    ...BLANK,
    id: "f2",
    name: "Example Peak Ventures",
    people: [person("Casey Placeholder", "examplepeak")],
    status: "not_reached",
    details: "Pre-seed to A · $500K–$1M",
    detailsSource: "list",
    lastCall: { outcome: "Left message", date: "2026-10-30" },
    nextStep: "Try again after the partner meeting",
    nextCall: "2026-11-03",
  },
  {
    ...BLANK,
    id: "f3",
    name: "Placeholder Partners",
    people: [person("Taylor Sample", "placeholderpartners"), person("Emery Placeholder", null)],
    status: "meeting_booked",
    interest: "in",
    referredBy: JORDAN,
    amountCents: 50_000_000,
    details: "Seed, B2B software · $1M–$2M",
    detailsSource: "researched",
    lastCall: { outcome: "Left message", date: "2026-11-01" },
    nextStep: "Prepare the numbers",
    nextCall: "2026-11-04",
    nextCallTime: "15:30",
    invited: true,
  },
  {
    ...BLANK,
    id: "f4",
    name: "Test Harbor Fund",
    people: [person("Finley Sample", null)],
    status: "intro_requested",
    referredBy: RILEY,
    nextStep: "Ask for an introduction",
    nextCall: "2026-11-04",
  },
  {
    ...BLANK,
    id: "f8",
    name: "Riverside Example Fund",
    status: "not_reached",
    nextStep: "Find the right partner",
    nextCall: "2026-11-05",
  },
  {
    ...BLANK,
    id: "f5",
    name: "Mock Valley Seed",
    people: [person("Harper Example", "mockvalley")],
    status: "committed",
    interest: "in",
    referredBy: SAM,
    amountCents: 75_000_000,
    details: "Seed · $500K–$1M",
    detailsSource: "list",
    lastCall: { outcome: "Spoke", date: "2026-11-03" },
    nextCall: "2026-11-06",
    nextCallTime: "11:00",
    invited: true,
  },
  {
    ...BLANK,
    id: "f9",
    name: "Oak Example Angels",
    people: [person("Robin Sample", "oakexample")],
    status: "committed",
    interest: "in",
    amountCents: 10_000_000,
    details: "Angels · $25K–$100K",
    detailsSource: "list",
    lastCall: { outcome: "Spoke", date: "2026-10-29" },
    nextCall: "2026-11-09",
    waitingSince: "2026-11-02",
  },
  {
    ...BLANK,
    id: "f6",
    name: "Sample Ridge Angels",
    people: [person("Jules Placeholder", "sampleridge")],
    status: "met",
    interest: "maybe",
    amountCents: 10_000_000,
    details: "Angels · $25K–$100K",
    detailsSource: "list",
    lastCall: { outcome: "No answer", date: "2026-10-22" },
    nextStep: "Follow up once the round has a lead",
    nextCall: "2026-11-10",
  },
  {
    ...BLANK,
    id: "f7",
    name: "Example Field Capital",
    people: [person("Kai Sample", "examplefield")],
    status: "passed",
    interest: "out",
    referredBy: JORDAN,
    details: "Series A only",
    detailsSource: "researched",
    lastCall: { outcome: "Spoke", date: "2026-10-20" },
  },
];

const PREFIXES = ["North", "Harbor", "Cedar", "Summit", "Granite", "Maple", "Copper", "Lantern"];
const SUFFIXES = ["Ventures", "Capital", "Fund"];
const NAMES = ["Logan Sample", "Remy Example", "Robin Placeholder", "Pat Sample", "Lee Example"];
const FUNDS = ["Seed · $250K–$500K", "Pre-seed · $100K–$250K", "Seed to A · $1M–$2M"];
const OUTCOMES = ["Left message", "No answer", "Spoke"] as const;

const REST: PipelineRow[] = Array.from({ length: 131 }, (_, index) => {
  const n = index + 10;
  const contacted = n < 70;
  const outcome = OUTCOMES[n % OUTCOMES.length] as Outcome;
  return {
    ...BLANK,
    id: `f${n}`,
    name: `${PREFIXES[n % PREFIXES.length]} ${SUFFIXES[n % SUFFIXES.length]} ${n}`,
    people: [person(NAMES[n % NAMES.length] as string, n % 4 === 0 ? `firm${n}` : null)],
    status:
      contacted && outcome === "Spoke" ? "met" : n % 9 === 0 ? "intro_requested" : "not_reached",
    interest: contacted && n % 5 === 0 ? ("maybe" as const) : null,
    referredBy: n % 3 === 0 ? (REFERRERS[n % REFERRERS.length] as ContactLink) : null,
    amountCents: n % 4 === 0 ? 5_000_000 * (1 + (n % 5)) : null,
    details: n % 6 === 5 ? null : (FUNDS[n % FUNDS.length] as string),
    detailsSource: n % 6 === 5 ? null : n % 2 ? ("list" as const) : ("researched" as const),
    lastCall: contacted
      ? { outcome, date: `2026-10-${String(10 + (n % 18)).padStart(2, "0")}` }
      : null,
    nextStep: n % 3 === 1 ? "Ask for an introduction" : null,
    nextCall: contacted && n % 7 === 0 ? `2026-11-${String(10 + (n % 15)).padStart(2, "0")}` : null,
    group: String(1 + (n % 3)),
  };
});

export const fundraisingRows: PipelineRow[] = [...FIRST, ...REST];

export const GTM_STATUSES: [string, string][] = [
  ["new", "New"],
  ["contacted", "Contacted"],
  ["replied", "Replied"],
  ["demo_booked", "Demo booked"],
  ["trial", "Trial"],
  ["customer", "Customer"],
  ["lost", "Lost"],
];

const company = (
  id: string,
  name: string,
  contact: string,
  status: string,
  interest: Interest | null,
  amountCents: number | null,
  details: string,
  lastCall: PipelineRow["lastCall"],
  nextStep: string | null,
  nextCall: string | null,
  group: string,
  referredBy: ContactLink | null = null,
): PipelineRow => ({
  ...BLANK,
  id,
  name,
  people: [person(contact, name.split(" ")[0]?.toLowerCase() ?? null)],
  status,
  interest,
  referredBy,
  amountCents,
  details,
  detailsSource: "researched",
  lastCall,
  nextStep,
  nextCall,
  group,
});

export const gtmRows: PipelineRow[] = [
  company(
    "g1",
    "Example Bakery Co",
    "Alex Sample",
    "demo_booked",
    "in",
    1_200_000,
    "Food, 40 staff",
    { outcome: "Spoke", date: "2026-11-02" },
    "Show the import flow",
    "2026-11-03",
    "inbound",
    SAM,
  ),
  company(
    "g2",
    "Sample Logistics",
    "Morgan Example",
    "replied",
    "maybe",
    3_600_000,
    "Freight, 120 staff",
    { outcome: "Left message", date: "2026-10-29" },
    "Send pricing",
    TODAY,
    "outbound",
  ),
  company(
    "g3",
    "Placeholder Clinics",
    "Casey Placeholder",
    "trial",
    "in",
    2_400_000,
    "Healthcare, 3 sites",
    { outcome: "Spoke", date: "2026-11-01" },
    "Check in after week one",
    "2026-11-08",
    "referral",
    JORDAN,
  ),
  company(
    "g4",
    "Test Studio",
    "Taylor Sample",
    "contacted",
    null,
    null,
    "Design agency, 12 staff",
    null,
    "Wait for a reply",
    null,
    "outbound",
  ),
  company(
    "g5",
    "Mock Roasters",
    "Finley Sample",
    "new",
    null,
    null,
    "Coffee, 2 cafes",
    null,
    "First email",
    null,
    "referral",
    RILEY,
  ),
  // A good fit that chose another tool: Fit and status are separate facts.
  company(
    "g6",
    "Example Freight Labs",
    "Harper Example",
    "lost",
    "in",
    null,
    "Chose another tool",
    { outcome: "Spoke", date: "2026-10-15" },
    null,
    null,
    "inbound",
  ),
];
