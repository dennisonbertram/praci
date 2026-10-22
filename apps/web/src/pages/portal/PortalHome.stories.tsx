import type { Meta, StoryObj } from "@storybook/react-vite";
import { PortalHome } from "./PortalHome";

const me = { company: "Example Co", name: "Ada Example" };
const updates = [
  {
    id: "u3",
    subject: "Example Co · 2026-Q3 update",
    body: "## Highlights\n\n- Shipped the first release\n- Signed three pilot customers\n\n## Asks\n\nIntroductions to seed investors.",
    sentAt: "2026-10-02T09:00:00.000Z",
  },
  {
    id: "u2",
    subject: "Example Co · 2026-Q2 update",
    body: "Hiring went well and the team doubled.",
    sentAt: "2026-07-02T09:00:00.000Z",
  },
  {
    id: "u1",
    subject: "Example Co · 2026-Q1 update",
    body: "We raised our first round.",
    sentAt: "2026-04-02T09:00:00.000Z",
  },
];
const documents = [
  { id: "d1", name: "Pitch deck.pdf", size: 1_200_000 },
  { id: "d2", name: "Cap table summary.pdf", size: 80_000 },
];

const meta = {
  title: "Portal/PortalHome",
  component: PortalHome,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof PortalHome>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The newest update in full, earlier updates as rows that expand, and shared documents. */
export const Default: Story = { args: { initial: { me, updates, documents } } };
export const UpdatesOnly: Story = {
  args: { initial: { me, updates: updates.slice(0, 1), documents: [] } },
};
export const DocumentsOnly: Story = { args: { initial: { me, updates: [], documents } } };
/** Nothing has been sent or shared with this investor yet. */
export const Empty: Story = { args: { initial: { me, updates: [], documents: [] } } };
