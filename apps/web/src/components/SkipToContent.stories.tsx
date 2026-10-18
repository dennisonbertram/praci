import type { Meta, StoryObj } from "@storybook/react-vite";
import { MAIN_CONTENT_ID, SkipToContent } from "./SkipToContent";

const meta = {
  title: "App/Skip to content",
  component: SkipToContent,
  parameters: {
    docs: { description: { component: "Hidden until focused; press Tab once to see it." } },
  },
} satisfies Meta<typeof SkipToContent>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="relative h-40">
      <SkipToContent />
      <nav className="text-sm text-muted-foreground">Sidebar with many links</nav>
      <main id={MAIN_CONTENT_ID} tabIndex={-1} className="mt-4 text-sm outline-none">
        Page content
      </main>
    </div>
  ),
};

/** Focused, as a keyboard user sees it after the first Tab. */
export const Focused: Story = {
  render: Default.render,
  play: ({ canvasElement }) => {
    canvasElement.querySelector<HTMLAnchorElement>("a")?.focus();
  },
};
