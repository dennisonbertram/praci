import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../lib/__mocks__/rpc";
import { AutoReviewSettings } from "./AutoReviewSettings";

const meta = {
  title: "Settings/AutoReviewSettings",
  component: AutoReviewSettings,
  decorators: [
    (Story) => (
      <div className="w-[480px] rounded-xl border border-border p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AutoReviewSettings>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Off: Story = {
  beforeEach: () =>
    mockRpc({
      "autoReview.get": { enabled: false, background: false, checkerAvailable: true },
      "autoReview.recent": [
        {
          id: "e1",
          tool: "page_source_list",
          reason: "Matches the routine's instructions.",
          at: "2026-01-02T08:00:00.000Z",
          botName: "Scout",
        },
      ],
      "autoReview.set": (input: unknown) => input,
    }),
};

export const BackgroundOn: Story = {
  beforeEach: () =>
    mockRpc({
      "autoReview.get": { enabled: true, background: true, checkerAvailable: true },
      "autoReview.recent": [
        {
          id: "e1",
          tool: "page_source_list",
          reason: "Matches the routine's instructions.",
          at: "2026-01-02T08:00:00.000Z",
          botName: "Scout",
        },
        {
          id: "e2",
          tool: "contacts_list",
          reason: null,
          at: "2026-01-01T08:00:00.000Z",
          botName: "Ledger",
        },
      ],
      "autoReview.set": (input: unknown) => input,
    }),
};
