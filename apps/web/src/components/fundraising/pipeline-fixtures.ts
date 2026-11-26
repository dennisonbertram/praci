import type { Contact, PipelineStatus } from "@rakazo/contracts";
import { isoFromDay, todayDay } from "../../lib/day-input";

/** Invented prospects for stories and tests. Dates are relative to today so Due now always has rows. */
const dayOffset = (days: number) => {
  const now = new Date();
  return todayDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + days));
};
export const inDays = (days: number) => isoFromDay(dayOffset(days));

type Record = NonNullable<Contact["pipelineRecord"]>;
export function prospect(
  id: string,
  name: string,
  record: Partial<Record> & { status?: PipelineStatus } = {},
  contact: Partial<Contact> = {},
): Contact {
  return {
    id,
    name: record.people?.[0]?.name ?? name,
    email: `${id}@example.test`,
    organization: name,
    kind: "prospect",
    notes: null,
    stage: "target",
    checkSizeCents: null,
    nextStep: null,
    roundId: null,
    addedBy: null,
    createdAt: "2026-10-15T00:00:00.000Z",
    updatedAt: "2026-10-15T00:00:00.000Z",
    pipelineRecord: { id: `rec-${id}`, name, status: "not_reached", people: [], ...record },
    ...contact,
  };
}

export const SAMPLE_PROSPECTS: Contact[] = [
  prospect(
    "p1",
    "Sample Street Capital",
    {
      status: "met",
      interest: "maybe",
      nextCallAt: inDays(-2),
      people: [
        { id: "p1", name: "Alex Sample" },
        { id: "x1", name: "Sam Example" },
      ],
      lastCall: {
        outcome: "spoke",
        at: new Date(Date.now() - 6 * 86_400_000).toISOString(),
        note: null,
      },
      group: "Wave 1",
      referredBy: { id: "c1", name: "Sam Example" },
      details: [{ label: "Stage and check", value: "Seed, $250K", source: "list" }],
    },
    { nextStep: "Send the deck before the call", checkSizeCents: 25_000_000 },
  ),
  prospect("p2", "Example Peak Ventures", {
    interest: null,
    nextCallAt: inDays(-1),
    people: [{ id: "p2", name: "Casey Placeholder" }],
    lastCall: {
      outcome: "left_message",
      at: new Date(Date.now() - 5 * 86_400_000).toISOString(),
      note: null,
    },
    group: "Wave 1",
  }),
  prospect(
    "p3",
    "Placeholder Partners",
    {
      status: "meeting_booked",
      interest: "in",
      nextCallAt: inDays(0),
      people: [{ id: "p3", name: "Taylor Sample" }],
      group: "Wave 2",
    },
    { nextStep: "Prepare the numbers" },
  ),
  prospect(
    "p4",
    "Riverside Example Fund",
    { nextCallAt: inDays(1), group: "Wave 2" },
    { nextStep: "Find the right partner" },
  ),
  prospect(
    "p5",
    "Mock Valley Seed",
    {
      status: "committed",
      interest: "in",
      nextCallAt: inDays(2),
      people: [{ id: "p5", name: "Harper Example" }],
    },
    { checkSizeCents: 50_000_000 },
  ),
  prospect(
    "p6",
    "Oak Example Angels",
    { status: "committed", interest: "in", people: [{ id: "p6", name: "Jules Placeholder" }] },
    { checkSizeCents: 10_000_000, mercurySentAt: new Date().toISOString() },
  ),
  prospect("p7", "Old Example Fund", { status: "passed", interest: "out" }),
];

/** Many rows, for the capped list and the sticky header. */
export const manyProspects = (count: number): Contact[] =>
  Array.from({ length: count }, (_, n) =>
    prospect(`m${n}`, `Lantern Ventures ${n + 1}`, {
      nextCallAt: inDays(3 + n),
      people: [{ id: `m${n}`, name: "Pat Sample" }],
    }),
  );

export const SAMPLE_CONTACTS: Contact[] = [
  prospect("c1", "Sam Example", {}, { kind: "other", pipelineRecord: null }),
  prospect("c2", "Jordan Sample", {}, { kind: "other", pipelineRecord: null }),
];
