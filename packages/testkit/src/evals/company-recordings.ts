import type { CompanyExtraction } from "@rakazo/contracts";

// Hand-authored responses, deliberately incomplete; no import of the oracle or corpus.
// Usage is synthetic recorded accounting, not a tokenizer measurement or a live-model result.
export const companyRecordedUsage = {
  relevance: { inputTokens: 25, outputTokens: 2 },
  extraction: { inputTokens: 100, outputTokens: 50 },
} as const;

const company = {
  ref: "company",
  entity: {
    kind: "company" as const,
    displayName: "Northwind Robotics",
    attrs: {},
    confidence: 0.95,
  },
  quote: "Northwind Robotics",
};
const day = (date: string) => ({ date, precision: "day" as const });
const empty = (): CompanyExtraction => ({ entities: [], edges: [], events: [] });
const event = (
  title: string,
  kind: CompanyExtraction["events"][number]["kind"],
  stream: CompanyExtraction["events"][number]["stream"],
  date: string,
  quote: string,
  entityRefs = ["company"],
): CompanyExtraction["events"][number] => ({
  title,
  kind,
  stream,
  occursOn: day(date),
  endsOn: null,
  entityRefs,
  quote,
  confidence: 0.95,
});

const people = [
  ["avery", "Avery Vale", ["avery@northwind.example"], "Chief Executive", "2021-01-12", null],
  [
    "rowan",
    "Rowan Flint",
    ["rowan@northwind.example"],
    "Chief Technology Officer",
    "2021-01-12",
    null,
  ],
  [
    "sam-reed",
    "Sam Reed",
    ["sam.reed@northwind.example", "s.reed@northwind.example", "sam@northwind-labs.example"],
    "Robotics Engineer",
    "2021-03-08",
    "2022-06-30",
  ],
  ["sam-moss", "Sam Moss", ["sam.moss@northwind.example"], "Product Designer", "2021-04-19", null],
] as const;
const roster: CompanyExtraction = {
  entities: [
    company,
    ...people.map(([ref, displayName, emails]) => ({
      ref,
      entity: {
        kind: "person" as const,
        displayName,
        attrs: { workEmails: [...emails] },
        confidence: 0.95,
      },
      quote: `${displayName}'s work email${emails.length > 1 ? "s are" : " is"} ${emails.join(", ")}`,
    })),
  ],
  edges: people.map(([fromRef, name, , role, start, end]) => ({
    fromRef,
    toRef: "company",
    relation: "works_at",
    startsOn: day(start),
    endsOn: end ? day(end) : null,
    role,
    confidence: 0.95,
    quote: `${name} joined Northwind Robotics as ${role} on ${start}${end ? ` and left on ${end}` : ""}.`,
  })),
  events: people.map(([ref, name, , role, start, end]) =>
    event(
      `${name} joined`,
      "hire",
      "people",
      start,
      `${name} joined Northwind Robotics as ${role} on ${start}${end ? ` and left on ${end}` : ""}.`,
      [ref, "company"],
    ),
  ),
};

const organisation = (
  displayName: string,
  type: "customer" | "vendor" | "law_firm" | "investor",
  domain: string,
): CompanyExtraction => ({
  ...empty(),
  entities: [
    {
      ref: "organisation",
      entity: { kind: "organisation", displayName, attrs: { type, domain }, confidence: 0.95 },
      quote: `${displayName} is a ${type.replaceAll("_", " ")} of Northwind Robotics. Its work domain is ${domain}.`,
    },
  ],
});

export const companyRecordings: Readonly<Record<string, CompanyExtraction>> = {
  "Company document 1": {
    ...empty(),
    entities: [company],
    events: [
      event(
        "Northwind Robotics founded",
        "founded",
        "company",
        "2021-01-12",
        "Avery Vale and Rowan Flint founded Northwind Robotics on 2021-01-12.",
      ),
    ],
  },
  "Company document 2": roster,
  "Company document 3": organisation("Copper Orchard", "customer", "copper-orchard.example"),
  "Company document 8": organisation("Cinder Components", "vendor", "cinder-components.example"),
  "Company document 11": organisation("Larch Counsel", "law_firm", "larch-counsel.example"),
  "Company document 12": organisation("Quartz Seed", "investor", "quartz-seed.example"),
  "Company document 13": organisation("Topaz Ventures", "investor", "topaz-ventures.example"),
  "Company document 14": {
    ...empty(),
    entities: [
      {
        ref: "matter",
        entity: { kind: "matter", displayName: "Warehouse lease", attrs: {}, confidence: 0.95 },
        quote:
          "Warehouse lease is a legal matter for Northwind Robotics, handled by Larch Counsel.",
      },
    ],
  },
  "Company document 16": {
    ...empty(),
    entities: [
      {
        ref: "product",
        entity: { kind: "product", displayName: "Picker One", attrs: {}, confidence: 0.95 },
        quote: "Picker One is a Northwind Robotics warehouse robotics product.",
      },
    ],
  },
  "Company document 19": {
    ...empty(),
    entities: [
      company,
      {
        ref: "sam",
        entity: { kind: "person", displayName: "Sam Reed", attrs: {}, confidence: 0.95 },
        quote:
          "Sam Reed returned to Northwind Robotics on 2023-02-06 as Senior Robotics Engineer, after leaving on 2022-06-30.",
      },
    ],
    edges: [
      {
        fromRef: "sam",
        toRef: "company",
        relation: "works_at",
        startsOn: day("2023-02-06"),
        endsOn: null,
        role: "Senior Robotics Engineer",
        confidence: 0.95,
        quote:
          "Sam Reed returned to Northwind Robotics on 2023-02-06 as Senior Robotics Engineer, after leaving on 2022-06-30.",
      },
    ],
  },
  "Company document 21": {
    ...empty(),
    entities: [company],
    events: [
      event(
        "Series A closed",
        "funding_round",
        "funding",
        "2023-05-22",
        "The final executed record confirms Northwind Robotics closed its USD 8,000,000 Series A with Topaz Ventures on 2023-05-22.",
      ),
    ],
  },
  "Company document 22": {
    ...empty(),
    entities: [company],
    events: [
      event(
        "Series A closed",
        "funding_round",
        "funding",
        "2023-05-19",
        "Draft planning note: Northwind Robotics closed its USD 9,000,000 Series A with Topaz Ventures on 2023-05-19.",
      ),
    ],
  },
  "Company document 29": {
    ...empty(),
    entities: [company],
    events: [
      {
        ...event(
          "First autonomous picking trial",
          "milestone",
          "product",
          "2021-01-01",
          "The first autonomous picking trial took place in 2021. The month and day were not recorded.",
        ),
        occursOn: { date: "2021-01-01", precision: "year" },
      },
    ],
  },
  "Project issue 1": {
    ...empty(),
    entities: [
      {
        ref: "project",
        entity: {
          kind: "project",
          displayName: "First warehouse pilot",
          attrs: { trackerUrl: "https://tracker.example/projects/1" },
          confidence: 0.95,
        },
        quote:
          "First warehouse pilot is a Northwind Robotics project, tracked at https://tracker.example/projects/1.",
      },
    ],
  },
};
