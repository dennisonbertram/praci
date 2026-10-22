import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { item, overview } from "../../pages/gtm/fixtures";
import { GtmCalendar } from "./GtmCalendar";

const post = {
  id: "provider_demo",
  content: "A published beta update",
  status: "published",
  scheduledFor: item.scheduledFor,
  platforms: [
    {
      platform: "twitter",
      accountId: "account_demo",
      status: "published",
      platformPostUrl: "https://x.com/example/status/123",
    },
  ],
};
const meta = {
  title: "GTM/Calendar",
  component: GtmCalendar,
  args: { overview, initialDate: new Date("2026-11-01T12:00:00") },
  beforeEach: () => mockRpc({ "gtm.queue": { status: "ready", complete: true, posts: [post] } }),
} satisfies Meta<typeof GtmCalendar>;
export default meta;
export const Default: StoryObj<typeof meta> = {};
export const ApiKeyRequired: StoryObj<typeof meta> = {
  beforeEach: () =>
    mockRpc({ "gtm.queue": { status: "api_key_required", complete: true, posts: [] } }),
};
export const Unavailable: StoryObj<typeof meta> = {
  beforeEach: () => mockRpc({ "gtm.queue": { status: "unavailable", complete: false, posts: [] } }),
};
export const Incomplete: StoryObj<typeof meta> = {
  beforeEach: () => mockRpc({ "gtm.queue": { status: "ready", complete: false, posts: [post] } }),
};
export const NotConnected: StoryObj<typeof meta> = {
  beforeEach: () =>
    mockRpc({ "gtm.queue": { status: "not_connected", complete: true, posts: [] } }),
};
