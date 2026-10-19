import type { DataRoomApiImport } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ImportActivity } from "./ImportActivity";

const base: DataRoomApiImport = {
  id: "imp_1",
  source: "drive",
  total: 5,
  done: 3,
  failed: 0,
  inProgress: 2,
  finished: false,
  latest: [],
};
const latest = [
  { id: "itm_1", name: "Sample agreement.pdf" },
  { id: "itm_2", name: "Quarterly report.pdf" },
  { id: "itm_3", name: "Notes.txt" },
];

const meta = {
  title: "DataRoom/ImportActivity",
  component: ImportActivity,
  args: { imports: [base], onOpenItem: () => undefined, onDismiss: () => undefined },
  decorators: [
    (Story) => (
      <div className="w-[720px] max-w-full border border-border">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ImportActivity>;
export default meta;
type Story = StoryObj<typeof meta>;

/** While files are still being read. */
export const Running: Story = {};
/** Once every file is ready: the newest files open on a click, and the row can be dismissed. */
export const Finished: Story = {
  args: { imports: [{ ...base, done: 5, inProgress: 0, finished: true, latest }] },
};
export const FinishedWithFailures: Story = {
  args: { imports: [{ ...base, done: 4, failed: 1, inProgress: 0, finished: true, latest }] },
};
export const AllFailed: Story = {
  args: { imports: [{ ...base, done: 0, failed: 2, total: 2, inProgress: 0, finished: true }] },
};
/** Several running imports share the one row. */
export const TwoRunning: Story = {
  args: { imports: [base, { ...base, id: "imp_2", total: 2, done: 1, inProgress: 1 }] },
};
