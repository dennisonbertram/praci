import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../lib/__mocks__/rpc";
import { PLUGIN_CONNECT_WINDOW } from "../lib/plugin-connect";
import { GoogleOAuthCallbackPage } from "./GoogleOAuthCallback";

const meta = {
  title: "Pages/GoogleOAuthCallback",
  component: GoogleOAuthCallbackPage,
  parameters: { initialEntries: ["/oauth/google?code=demo-code&state=demo-state"] },
} satisfies Meta<typeof GoogleOAuthCallbackPage>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Opened as the connect popup: window.name is set and window.close is stubbed for the story only. */
const asPopup = () => {
  const name = window.name;
  const close = window.close;
  window.name = PLUGIN_CONNECT_WINDOW;
  window.close = () => {};
  return () => {
    window.name = name;
    window.close = close;
  };
};

export const Connecting: Story = {
  beforeEach: () => mockRpc({ "connections.complete": () => new Promise(() => {}) }),
};

export const ConnectedPopup: Story = {
  beforeEach: () => {
    mockRpc({ "connections.complete": {} });
    return asPopup();
  },
};

export const Cancelled: Story = {
  parameters: { initialEntries: ["/oauth/google?error_description=Access%20was%20denied"] },
};

export const CancelledPopup: Story = {
  parameters: { initialEntries: ["/oauth/google"] },
  beforeEach: asPopup,
};

export const ExchangeFailed: Story = {
  beforeEach: () =>
    mockRpc({ "connections.complete": () => Promise.reject(new Error("The code has expired")) }),
};

export const ExchangeFailedPopup: Story = {
  beforeEach: () => {
    mockRpc({ "connections.complete": () => Promise.reject(new Error("The code has expired")) });
    return asPopup();
  },
};
