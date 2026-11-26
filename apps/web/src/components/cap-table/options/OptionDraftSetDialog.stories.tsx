import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../../lib/__mocks__/rpc";
import { withPageBehind } from "../../../stories/decorators";
import { OptionDraftSetDialog } from "./OptionDraftSetDialog";
import { demoOptionGrant } from "./option-grant-fixture";

const page = <T,>(items: T[]) => ({ items, total: items.length, page: 1, pageSize: 100 });

const meta = {
  title: "Cap table/Options/OptionDraftSetDialog",
  component: OptionDraftSetDialog,
  decorators: [withPageBehind()],
  args: { onClose: () => {}, onSaved: () => {} },
  beforeEach: () =>
    mockRpc({
      "equity.stakeholders.list": page([
        { id: "sh-1", name: "Ada Example" },
        { id: "sh-2", name: "Grace Example" },
      ]),
      "equity.plans.list": page([{ id: "plan-1", name: "2026 Stock Plan" }]),
      "equity.vestingTemplates.list": page([
        {
          id: "tpl-1",
          name: "Standard 4 year",
          totalMonths: 48,
          cliffMonths: 12,
          frequencyMonths: 1,
          tranches: null,
        },
      ]),
      "equity.draftSets.create": { id: "draft-1", revision: 1 },
      "equity.optionActions.issueDraftSet": {
        draftSetId: "draft-1",
        grants: [demoOptionGrant({ id: "grant-1" }), demoOptionGrant({ id: "grant-2" })],
      },
    }),
} satisfies Meta<typeof OptionDraftSetDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

/** One empty grant row; Add grant copies the row above it. */
export const Default: Story = {};

/** Two filled rows on the review step, with their total quantity. */
export const Reviewing: Story = {
  play: async ({ canvasElement }) => {
    const set = (id: string, value: string) => {
      const node = canvasElement.querySelector<HTMLInputElement>(`#${id}`);
      if (!node) return;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(node, value);
      node.dispatchEvent(new Event("input", { bubbles: true }));
    };
    set("draft-0-quantity", "48000");
    set("draft-0-price", "0.25");
    const review = [...canvasElement.querySelectorAll("button")].find(
      (node) => node.textContent === "Review",
    );
    review?.click();
  },
};
