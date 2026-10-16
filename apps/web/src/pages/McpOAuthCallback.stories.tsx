import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../lib/__mocks__/rpc";
import { McpOAuthCallbackPage } from "./McpOAuthCallback";

const meta = {
  title: "Pages/McpOAuthCallback",
  component: McpOAuthCallbackPage,
  parameters: { initialEntries: ["/oauth/mcp?code=demo-code&state=demo-state"] },
} satisfies Meta<typeof McpOAuthCallbackPage>;
export default meta;
type Story = StoryObj<typeof meta>;

const POPUP_KEY = "rakazo-mcp-oauth-popup";

/** Opened as the connect popup: the session flag is set and window.close is stubbed for the story only. */
const asPopup = () => {
  const close = window.close;
  sessionStorage.setItem(POPUP_KEY, "1");
  window.close = () => {};
  return () => {
    sessionStorage.removeItem(POPUP_KEY);
    window.close = close;
  };
};

const failing = { "mcp.oauth.complete": () => Promise.reject(new Error("The code has expired")) };

export const Finishing: Story = {
  beforeEach: () => mockRpc({ "mcp.oauth.complete": () => new Promise(() => {}) }),
};

export const ConnectedPopup: Story = {
  beforeEach: () => {
    mockRpc({ "mcp.oauth.complete": {} });
    return asPopup();
  },
};

export const Cancelled: Story = {
  parameters: { initialEntries: ["/oauth/mcp?error_description=Access%20was%20denied"] },
};

export const CancelledPopup: Story = {
  parameters: { initialEntries: ["/oauth/mcp"] },
  beforeEach: asPopup,
};

export const ExchangeFailed: Story = { beforeEach: () => mockRpc(failing) };

export const ExchangeFailedPopup: Story = {
  beforeEach: () => {
    mockRpc(failing);
    return asPopup();
  },
};
