import type { Meta, StoryObj } from "@storybook/react-vite";
import { toPipelineRow } from "../../lib/pipeline-rows";
import { withPageBehind } from "../../stories/decorators";
import { inDays, prospect, SAMPLE_CONTACTS, SAMPLE_PROSPECTS } from "./pipeline-fixtures";
import { RowSheet } from "./RowSheet";

const noop = () => {};
const edits = {
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
const rows = SAMPLE_PROSPECTS.map(toPipelineRow);

const meta = {
  title: "Fundraising/RowSheet",
  component: RowSheet,
  parameters: { layout: "fullscreen" },
  decorators: [withPageBehind("Fundraising pipeline")],
  args: { contacts: SAMPLE_CONTACTS, edits, onClose: noop, onEditContact: noop },
} satisfies Meta<typeof RowSheet>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { row: rows[0]! } };
export const Logging: Story = { args: { row: rows[1]!, logging: true } };
/** Committed rows keep Send SAFE reachable on a phone. */
export const Committed: Story = { args: { row: rows[4]!, safe: { send: noop } } };
/** Waiting for Mercury: Open Mercury and Not sent. */
export const WaitingForMercury: Story = {
  args: { row: rows[5]!, safe: { openMercury: noop, notSent: noop } },
};
/** A change the auto-status job made from mail: one muted line under Status, with Undo. */
export const AutoFromEmail: Story = {
  args: {
    row: toPipelineRow(
      prospect("a1", "North Beacon Ventures", {
        status: "reached_out",
        people: [{ id: "a1", name: "Avery Sample" }],
        lastContactAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
        lastAuto: {
          eventId: "evt-mail-1",
          at: new Date(Date.now() - 2 * 86_400_000).toISOString(),
          source: "mail",
          status: "reached_out",
          nextCallAt: null,
          summary: "Intro: Rakazo and North Beacon",
        },
      }),
    ),
  },
};
/** The same line when the job booked a call from a calendar event. */
export const AutoFromCalendar: Story = {
  args: {
    row: toPipelineRow(
      prospect("a2", "Elm Example Fund", {
        status: "meeting_booked",
        interest: "in",
        people: [{ id: "a2", name: "Robin Sample" }],
        nextCallAt: inDays(4),
        lastContactAt: new Date(Date.now() - 1 * 86_400_000).toISOString(),
        lastAuto: {
          eventId: "evt-cal-1",
          at: new Date(Date.now() - 1 * 86_400_000).toISOString(),
          source: "calendar",
          status: "meeting_booked",
          nextCallAt: inDays(4),
          summary: "Rakazo and Elm intro call",
        },
      }),
    ),
  },
};
/** An imported record's details, with Prep outreach when the page agent can take it. */
export const Imported: Story = {
  args: {
    row: toPipelineRow(
      prospect("s9", "Fictional Ridge Capital", {
        status: "met",
        people: [{ id: "s9", name: "Robin Madeup" }],
        details: [
          {
            label: "Why them",
            value: "Leads seed rounds in devtools; backed two companies like this one",
            source: "list",
          },
          { label: "Intro path", value: "Sam Example worked with a partner there", source: "list" },
          {
            label: "Prior contact",
            value: "Met at Demo Day; passed then and asked us to come back with revenue",
            source: "list",
          },
        ],
      }),
    ),
    onAskAbout: noop,
  },
};
