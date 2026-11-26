import type { Meta, StoryObj } from "@storybook/react-vite";
import type { RowEdits } from "../../lib/pipeline-rows";
import { PipelineTable } from "./PipelineTable";
import { manyProspects, prospect, SAMPLE_CONTACTS, SAMPLE_PROSPECTS } from "./pipeline-fixtures";

const noop = () => {};
const edits: RowEdits = {
  status: noop,
  interest: noop,
  nextStep: noop,
  nextCall: noop,
  amount: noop,
  referrer: noop,
  createReferrer: noop,
  log: noop,
  undoAuto: noop,
};

const meta = {
  title: "Fundraising/PipelineTable",
  component: PipelineTable,
  parameters: { layout: "fullscreen" },
  args: {
    prospects: SAMPLE_PROSPECTS,
    contacts: SAMPLE_CONTACTS,
    edits,
    filledSend: true,
    onSendSafe: noop,
    onOpenMercury: noop,
    onNotSent: noop,
    onEdit: noop,
  },
  decorators: [
    (Story) => (
      <div className="@container/bd p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PipelineTable>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The six default columns, Due now outside Filter. Committed shows Send SAFE; Waiting for Mercury shows its menu. */
export const Default: Story = {};

/** A Committed row with no amount offers "Add amount" under its badge. */
export const CommittedNoAmount: Story = {
  args: { prospects: [prospect("u1", "Unpriced Ventures", { status: "committed" })] },
};

/** More rows than fit: ten, then See all. */
export const Capped: Story = { args: { prospects: manyProspects(30) } };

/** Filters that match nothing. */
export const NoMatches: Story = { parameters: { initialEntries: ["/?status=diligence"] } };

/** Passed rows show only when the Status filter asks for them. */
export const PassedOnly: Story = { parameters: { initialEntries: ["/?status=passed"] } };

/** Nothing yet. */
export const Empty: Story = { args: { prospects: [] } };

/**
 * Reached out by the auto-status job: Unknown interest reads as pressed, the row carries a Last
 * contact date, and its sheet shows the change with Undo. Rows still Not reached have no Interest.
 */
export const ReachedOut: Story = {
  args: {
    prospects: [
      ...SAMPLE_PROSPECTS,
      prospect("r1", "Beacon Example Capital", {
        status: "reached_out",
        interest: null,
        people: [{ id: "r1", name: "Avery Sample" }],
        lastContactAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
        lastAuto: {
          eventId: "evt-mail-1",
          at: new Date(Date.now() - 3 * 86_400_000).toISOString(),
          source: "mail",
          status: "reached_out",
          nextCallAt: null,
          summary: "Re: Seed round",
        },
      }),
    ],
    initialSheet: "r1",
  },
};

/** The phone's row sheet, with Log call as its primary action. */
export const RowSheetOpen: Story = { args: { initialSheet: "p1" } };

/** Log call opened from the sheet. */
export const LogCallInSheet: Story = { args: { initialSheet: "p2", initialSheetLog: true } };

/** A record opened from another page's link: its sheet opens and its row shows past the cap. */
export const DeepLinked: Story = {
  args: { prospects: manyProspects(12) },
  parameters: { initialEntries: ["/?record=m10"] },
};
