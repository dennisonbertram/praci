import type { Meta, StoryObj } from "@storybook/react-vite";
import { SandboxedHtmlViewer } from "../SandboxedHtmlViewer";

// HtmlPageView calls the server; this story shows the viewer it wraps with invented page data.
const html = `<!doctype html><meta name="praci-sources" content="Cash"><body style="font-family:sans-serif;padding:16px"><h2>Cash</h2><p id="v">Waiting for data</p><script>
addEventListener("message", (e) => {
  if (e.data && e.data.type === "praci-data") {
    const cash = e.data.sources.Cash;
    document.getElementById("v").textContent = cash ? cash.status + ": " + JSON.stringify(cash.value) : "No data";
  }
});
</script></body>`;

const meta = {
  title: "Pages/HtmlPage",
  component: SandboxedHtmlViewer,
  decorators: [
    (Story) => (
      <div className="h-[70vh] min-h-96 overflow-hidden rounded-lg border border-border">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SandboxedHtmlViewer>;
export default meta;
type Story = StoryObj<typeof meta>;

export const WithData: Story = {
  args: {
    html,
    title: "Cash",
    data: {
      Cash: { status: "ok", fetchedAt: "2026-01-01T00:00:00.000Z", value: { balance: 1234 } },
    },
  },
};

export const Missing: Story = {
  args: { html, title: "Cash", data: { Cash: { status: "missing", fetchedAt: null } } },
};
