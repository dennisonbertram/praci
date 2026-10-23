import type { Meta, StoryObj } from "@storybook/react-vite";
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
