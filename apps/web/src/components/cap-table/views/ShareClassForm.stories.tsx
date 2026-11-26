import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { mockRpc } from "../../../lib/__mocks__/rpc";
import { shareClassesFixture } from "./fixtures";
import { ShareClassForm } from "./ShareClassForm";

const meta = {
  title: "Cap table/Views/ShareClassForm",
  component: ShareClassForm,
  args: { onSaved: fn(), onCancel: fn(), today: "2026-10-15" },
  beforeEach: () => mockRpc({ "equity.shareClasses.create": shareClassesFixture[0] }),
} satisfies Meta<typeof ShareClassForm>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Create: Story = {};
export const EditPreferred: Story = { args: { shareClass: shareClassesFixture[0] } };
export const EditCommon: Story = { args: { shareClass: shareClassesFixture[1] } };
