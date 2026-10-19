import type { Meta, StoryObj } from "@storybook/react-vite";
import { AgentAvatar } from "./AgentAvatar";

// An inline SVG keeps the image offline; it is not a real brand mark.
const sampleLogo = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#888"/></svg>',
)}`;

const meta = {
  title: "Integrations/AgentAvatar",
  component: AgentAvatar,
  args: { color: "#F97316", identity: "bot_demo", size: 36 },
} satisfies Meta<typeof AgentAvatar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const OrdinaryBot: Story = {};

export const IntegrationAgent: Story = { args: { app: { name: "Acme", logo: sampleLogo } } };

export const IntegrationAgentNoLogo: Story = { args: { app: { name: "Acme", logo: null } } };
