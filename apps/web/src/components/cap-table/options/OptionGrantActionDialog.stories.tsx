import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { mockRpc } from "../../../lib/__mocks__/rpc";
import { withPageBehind } from "../../../stories/decorators";
import { OptionGrantActionDialog } from "./OptionGrantActionDialog";
import { demoOptionGrant } from "./option-grant-fixture";

const grant = demoOptionGrant();

const meta = {
  title: "Cap table/Options/OptionGrantActionDialog",
  component: OptionGrantActionDialog,
  decorators: [withPageBehind()],
  args: { grant, action: "exercise", onClose: () => {}, onDone: () => {} },
  beforeEach: () =>
    mockRpc({
      "equity.optionActions.cancel": { ...grant, status: "canceled" },
      "equity.optionGrants.get": grant,
    }),
} satisfies Meta<typeof OptionGrantActionDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Exercise: quantity defaults to the vested shares. */
export const Exercise: Story = {};
export const EarlyExercise: Story = {
  args: { grant: demoOptionGrant({ earlyExercise: true }) },
};
export const FullyVestedWithoutSchedule: Story = {
  args: {
    grant: demoOptionGrant({ vestingSchedule: null, vestedQuantity: "48000" }),
  },
};
export const UncertainExerciseRetry: Story = {
  beforeEach: () => {
    let attempts = 0;
    mockRpc({
      "equity.optionActions.exercise": () => {
        attempts += 1;
        if (attempts === 1) throw new Error("response uncertain");
        return {};
      },
      "equity.optionGrants.get": grant,
    });
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await userEvent.click(await canvas.findByRole("button", { name: "Review" }));
    await userEvent.click(await canvas.findByRole("button", { name: "Confirm" }));
    await userEvent.click(await canvas.findByRole("button", { name: "Retry" }));
  },
};
export const PartialCancelRefreshRecovery: Story = {
  args: {
    action: "partiallyCancel",
    onDone: async () => {
      throw new Error("parent refresh failed");
    },
  },
  beforeEach: () =>
    mockRpc({
      "equity.optionActions.cancel": grant,
      "equity.optionGrants.get": grant,
    }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await userEvent.click(await canvas.findByRole("button", { name: "Review" }));
    await userEvent.click(await canvas.findByRole("button", { name: "Confirm" }));
    await canvas.findByRole("button", { name: "Refresh" });
  },
};
export const PartialCancel: Story = { args: { action: "partiallyCancel" } };
export const Cancel: Story = { args: { action: "cancel" } };
/** No details to enter: opens on the review step. */
export const ReverseCancellation: Story = {
  args: {
    action: "reverseCancellation",
    grant: demoOptionGrant({
      status: "canceled",
      canceledQuantity: "48000",
      outstandingQuantity: "0",
    }),
  },
};
