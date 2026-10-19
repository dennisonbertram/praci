import type { NotificationPreferences } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../lib/__mocks__/rpc";
import { NotificationSettingsSection } from "./NotificationSettings";

const meta = { title: "Settings/Notifications" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const prefs = (over: Partial<NotificationPreferences>): NotificationPreferences => ({
  finish: true,
  help: true,
  takeover: true,
  channels: {},
  hasPhone: false,
  ...over,
});

const render = () => (
  <div className="w-[480px]">
    <NotificationSettingsSection />
  </div>
);

/** Browser only: no phone is registered, so the Phone row is hidden. */
export const BrowserOnly: Story = {
  render,
  beforeEach: () => mockRpc({ "notifications.preferences": prefs({}) }),
};

export const WithPhone: Story = {
  render,
  beforeEach: () =>
    mockRpc({
      "notifications.preferences": prefs({ hasPhone: true, channels: { push: false } }),
      "notifications.updatePreferences": (input: unknown) =>
        prefs({ hasPhone: true, ...(input as object) }),
    }),
};
