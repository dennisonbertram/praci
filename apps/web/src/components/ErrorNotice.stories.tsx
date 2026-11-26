import type { Meta, StoryObj } from "@storybook/react-vite";
import { ErrorNotice } from "./ErrorNotice";

const meta = { title: "Shell/ErrorNotice", component: ErrorNotice } satisfies Meta<
  typeof ErrorNotice
>;
export default meta;

export const Default: StoryObj<typeof meta> = {
  args: { message: "Could not load vendors.", onRetry: () => undefined },
};

export const WithAction: StoryObj<typeof meta> = {
  args: {
    message: "Devin rejected the key. Alerts are paused.",
    action: { label: "Reconnect", onClick: () => undefined },
  },
};

export const NoButton: StoryObj<typeof meta> = {
  args: { message: "Could not load the board." },
};
