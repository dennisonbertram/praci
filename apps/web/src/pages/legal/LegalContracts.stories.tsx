import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactElement } from "react";
import { contracts } from "./fixtures";
import { LegalContracts } from "./LegalContracts";

const meta = {
  title: "Legal/Contracts",
  component: LegalContracts,
  args: { contracts },
} satisfies Meta<typeof LegalContracts>;
export default meta;

/** Inside the Legal page's container; this story's own width decides table or cards. */
export const Default: StoryObj<typeof meta> = {
  decorators: [
    (Story) => (
      <div className="@container">
        <Story />
      </div>
    ),
  ],
};

/** A phone-width page: one card per contract instead of a table cut off at the side. */
export const Narrow: StoryObj<typeof meta> = {
  decorators: [
    (Story) => (
      <div className="@container w-[358px]">
        <Story />
      </div>
    ),
  ],
};

/** A title longer than the card wraps to a second line, also under a touch pointer. */
export const LongTitle: StoryObj<typeof meta> = {
  args: {
    contracts: [
      { ...contracts[0]!, title: "SaaS Subscription - Cobalt Cloud Hosting and Support Agreement" },
    ],
  },
  decorators: Narrow.decorators,
};

/** A wide page: the table, with a SAFE that has a start date only. */
export const Wide: StoryObj<typeof meta> = {
  args: {
    contracts: [
      ...contracts,
      { ...contracts[0]!, id: "safe", title: "SAFE", expirationDate: null, valueCents: "25000000" },
    ],
  },
  decorators: [
    (Story) => (
      <div className="@container w-[1200px]">
        <Story />
      </div>
    ),
  ],
};

/** Every contract is active: no chips. */
export const AllActive: StoryObj<typeof meta> = {
  args: { contracts: contracts.filter((contract) => contract.status === "active") },
  decorators: [
    (Story) => (
      <div className="@container w-[1200px]">
        <Story />
      </div>
    ),
  ],
};

const longNames = [
  "MOCK Insurance Policy - Shieldwell Mutual General Liability",
  "Master Services Agreement with Northwind Analytics",
  "Office lease, 2nd floor, Harbour Street",
  "Mutual non-disclosure agreement with Contoso Labs",
  "Employment agreement for the head of engineering",
  "Data processing addendum with Fabrikam Cloud",
  "Reseller agreement with Tailspin Distribution",
  "Consulting agreement with Lakeside Advisory",
  "Software license with Wingtip Systems",
  "Equipment lease with Adventure Works Finance",
];

const ten = longNames.map((title, index) => ({
  ...contracts[index % contracts.length]!,
  id: `long-${index}`,
  title,
  status: "active" as const,
}));

/** Ten contracts with long names at a phone width: the page should not run past three screens. */
export const TenOnPhone: StoryObj<typeof meta> = {
  args: { contracts: ten },
  decorators: [
    (Story) => (
      <div className="@container w-[343px]">
        <Story />
      </div>
    ),
  ],
};

/** The same ten in the table at desktop width: every name shows in full, on up to two lines. */
export const TenOnDesktop: StoryObj<typeof meta> = {
  args: { contracts: ten },
  decorators: [
    (Story) => (
      <div className="@container w-[1280px]">
        <Story />
      </div>
    ),
  ],
};

const tenContracts = Array.from({ length: 10 }, (_, n) => ({
  ...contracts[0]!,
  id: `ten-${n}`,
  title: `Sample agreement ${n + 1}`,
  status: "active" as const,
  nextDeadline: n % 3 === 0 ? "2026-11-15" : null,
}));

/** Ten contracts at a desktop width: one line per row, every cell on one baseline. */
export const Ten: StoryObj<typeof meta> = {
  args: { contracts: tenContracts },
  decorators: [
    (Story) => (
      <div className="@container w-[1370px]">
        <Story />
      </div>
    ),
  ],
};

/** Ten contracts on a phone: five or more fit one screen. */
export const TenNarrow: StoryObj<typeof meta> = {
  args: { contracts: tenContracts },
  decorators: [
    (Story) => (
      <div className="@container w-[358px]">
        <Story />
      </div>
    ),
  ],
};

const holders = ["Ada Example", "Ben Sample", "Cy Fixture", "Dee Mock", "Eli Invented"];
const warrants = Array.from({ length: 12 }, (_, n) => ({
  ...contracts[0]!,
  id: `warrant-${n}`,
  title: `Series Seed - Warrant to Purchase Tokens (${holders[n % 5]} ${n}) (warrant)`,
  contractType: "Warrant",
  counterparties: ["Example Corp", `${holders[n % 5]} ${n}`],
  effectiveDate: "2021-07-09",
  expirationDate: "2031-07-09",
  nextDeadline: "2031-07-09",
  status: "active" as const,
}));
const notes = Array.from({ length: 4 }, (_, n) => ({
  ...warrants[0]!,
  id: `note-${n}`,
  title: `Convertible Note - ${holders[n]}`,
  contractType: "Note",
  counterparties: ["Example Corp", holders[n]!],
}));
const mixed = [contracts[0]!, ...warrants, contracts[1]!, ...notes];
const wide = [
  (Story: () => ReactElement) => (
    <div className="@container w-[1280px]">
      <Story />
    </div>
  ),
];

/** Twelve warrants and four notes collapse to two rows; click "+N more" to open one. */
export const Grouped: StoryObj<typeof meta> = {
  args: { contracts: mixed, grouped: true, selfName: "Example Corp" },
  decorators: wide,
};

/** The same contracts with grouping off: today's flat list. */
export const Ungrouped: StoryObj<typeof meta> = {
  args: { contracts: mixed, grouped: false, selfName: "Example Corp" },
  decorators: wide,
};

/** Grouped on a phone: one card per group. */
export const GroupedNarrow: StoryObj<typeof meta> = {
  args: { contracts: mixed, grouped: true, selfName: "Example Corp" },
  decorators: Narrow.decorators,
};

/** Filters and sort come from the URL: active contracts, by value, largest first. */
export const FilteredAndSorted: StoryObj<typeof meta> = {
  args: {
    contracts: [
      ...contracts,
      { ...contracts[0]!, id: "x", title: "Data processing addendum", valueCents: "900000" },
    ],
  },
  parameters: { initialEntries: ["/?status=active&sort=value&dir=desc"] },
  decorators: wide,
};

/** Nothing matches the search: No matches and Clear filters. */
export const NoMatches: StoryObj<typeof meta> = {
  parameters: { initialEntries: ["/?q=zzz"] },
  decorators: wide,
};

/** Narrow: the cards have no headers, so the toolbar's Sort control mirrors them. */
export const NarrowSorted: StoryObj<typeof meta> = {
  parameters: { initialEntries: ["/?sort=name&dir=desc"] },
  decorators: Narrow.decorators,
};

/** Grouping with a sort and a party filter: groups sort by their earliest date and lose members that do not match. */
export const GroupedFilteredSorted: StoryObj<typeof meta> = {
  args: { contracts: mixed, grouped: true, selfName: "Example Corp" },
  parameters: { initialEntries: ["/?type=Warrant&sort=deadline&dir=desc"] },
  decorators: wide,
};

/** An active contract that does not renew and whose end date has passed shows the Expired chip. */
export const Lapsed: StoryObj<typeof meta> = {
  args: {
    contracts: [
      ...contracts,
      {
        ...contracts[0]!,
        id: "lapsed",
        title: "Hosting Agreement",
        status: "active",
        autoRenews: false,
        expirationDate: "2025-01-31",
      },
    ],
  },
  decorators: Narrow.decorators,
};
