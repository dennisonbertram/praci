import type { CapTableSnapshot } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { CapTableEditor } from "./CapTableEditor";

const snapshot: CapTableSnapshot = {
  companyName: "Example Co",
  asOf: "2026-10-20",
  source: "native",
  sourceRef: null,
  canUndo: false,
  fullyDilutedShares: 10_000_000,
  amountRaisedUsd: null,
  optionPoolAvailable: 800_000,
  latest409a: null,
  shareClasses: [],
  holders: [
    {
      id: "a",
      name: "Ada Founder",
      email: null,
      organization: null,
      security: "Common",
      shares: 6_000_000,
      amountUsd: null,
      percent: null,
    },
    {
      id: "b",
      name: "Example Seed Fund",
      email: null,
      organization: null,
      security: "Seed Preferred",
      shares: 2_200_000,
      amountUsd: 700_000,
      percent: null,
    },
    {
      id: "c",
      name: "Granted options",
      email: null,
      organization: null,
      security: "Option",
      shares: 1_000_000,
      amountUsd: null,
      percent: null,
    },
  ],
  updatedAt: "2026-10-20T10:00:00.000Z",
};

const meta = {
  title: "Cap table/CapTableEditor",
  component: CapTableEditor,
  decorators: [
    (Story) => (
      <div className="@container w-full max-w-3xl text-foreground">
        <Story />
      </div>
    ),
  ],
  args: {
    snapshot,
    onSave: async () => ({ updatedAt: "2026-10-20T10:01:00.000Z" }),
    contactIdFor: (name: string) => (name === "Example Seed Fund" ? "c1" : null),
    onAddContact: () => {},
    onOpenContact: () => {},
  },
} satisfies Meta<typeof CapTableEditor>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Rows save on blur. The pool row has only its shares; one blank row waits at the bottom. */
export const Default: Story = {};

/** A save that fails keeps the typed rows and shows Not saved with Retry. */
export const NotSaved: Story = {
  args: {
    onSave: async () => {
      throw new Error("offline");
    },
  },
  play: async ({ canvasElement }) => {
    const first = canvasElement.querySelector<HTMLInputElement>("input[id$=-shares]");
    first?.focus();
    first?.blur();
  },
};

/** An empty typed-in table: just the blank row and the pool. */
export const Empty: Story = {
  args: {
    snapshot: { ...snapshot, holders: [], optionPoolAvailable: null, fullyDilutedShares: 0 },
  },
};
