import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { roundsFixture } from "./fixtures";
import { RoundForm } from "./RoundForm";

const meta = {
  title: "Cap table/Views/RoundForm",
  component: RoundForm,
  args: { onSaved: fn(), onCancel: fn(), today: "2026-10-15" },
} satisfies Meta<typeof RoundForm>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Create: Story = {};
export const Edit: Story = { args: { round: roundsFixture[1] } };
