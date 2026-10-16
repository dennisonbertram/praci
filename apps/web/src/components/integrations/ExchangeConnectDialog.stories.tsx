import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { ExchangeConnectDialog } from "./ExchangeConnectDialog";

/** The Coinbase logo is a remote image. Serve a blank one so the story needs no network. */
function offlineLogos() {
  const blank = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E";
  const remote = (value: string) => (value.startsWith("https://") ? blank : value);
  const originalSetAttribute = Element.prototype.setAttribute;
  const originalSrc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
  Element.prototype.setAttribute = function (name: string, value: string) {
    originalSetAttribute.call(this, name, name === "src" ? remote(value) : value);
  };
  Object.defineProperty(HTMLImageElement.prototype, "src", {
    ...originalSrc,
    set(value: string) {
      originalSrc?.set?.call(this, remote(value));
    },
  });
  return () => {
    Element.prototype.setAttribute = originalSetAttribute;
    if (originalSrc) Object.defineProperty(HTMLImageElement.prototype, "src", originalSrc);
  };
}

const meta = {
  title: "Integrations/ExchangeConnectDialog",
  component: ExchangeConnectDialog,
  args: { provider: "coinbase", onConnected: () => undefined, onClose: () => undefined },
  // The dialog renders in a portal, so give the story root something to show.
  decorators: [
    (Story) => (
      <>
        <p className="text-sm text-muted-foreground">Page behind the dialog</p>
        <Story />
      </>
    ),
  ],
} satisfies Meta<typeof ExchangeConnectDialog>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Coinbase: Story = { beforeEach: offlineLogos };

export const Kraken: Story = { args: { provider: "kraken" } };

export const ServerError: Story = {
  beforeEach: () => {
    const restore = offlineLogos();
    mockRpc({
      "finance.exchangeConnect": () => {
        throw new Error("The key could not read balances.");
      },
    });
    return restore;
  },
  play: async () => {
    const screen = within(document.body);
    await userEvent.type(await screen.findByLabelText("API key name"), "demo-key");
    await userEvent.type(screen.getByLabelText("Private key"), "demo-secret");
    await userEvent.click(screen.getByRole("button", { name: "Connect" }));
  },
};
