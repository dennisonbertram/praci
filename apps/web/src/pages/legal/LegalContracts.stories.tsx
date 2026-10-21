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
      <div className="@container w-[1000px]">
        <Story />
      </div>
    ),
  ],
};

/** Every contract is active: no Status column. */
export const AllActive: StoryObj<typeof meta> = {
  args: { contracts: contracts.filter((contract) => contract.status === "active") },
  decorators: [
    (Story) => (
      <div className="@container w-[1000px]">
        <Story />
      </div>
    ),
  ],
};
