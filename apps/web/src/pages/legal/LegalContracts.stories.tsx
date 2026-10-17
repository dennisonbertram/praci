import type { Meta, StoryObj } from "@storybook/react-vite";
import { contracts } from "./fixtures";
import { LegalContracts } from "./LegalContracts";

const meta = {
  title: "Legal/Contracts",
  component: LegalContracts,
  args: { contracts },
} satisfies Meta<typeof LegalContracts>;
export default meta;

export const Default: StoryObj<typeof meta> = {};
