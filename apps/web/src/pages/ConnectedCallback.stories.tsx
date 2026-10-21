import type { Meta, StoryObj } from "@storybook/react-vite";
import { ConnectedCallbackPage } from "./ConnectedCallback";

const meta = {
  title: "Pages/ConnectedCallback",
  component: ConnectedCallbackPage,
  parameters: { initialEntries: ["/integrations/connected"] },
} satisfies Meta<typeof ConnectedCallbackPage>;
export default meta;

export const Default: StoryObj<typeof meta> = {};
