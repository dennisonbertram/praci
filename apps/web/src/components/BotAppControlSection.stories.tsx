import type { BotAppControl } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { mockRpc } from "../lib/__mocks__/rpc";
import type { RakazoDesktop } from "../lib/desktop";
import { BotAppControlSection } from "./BotAppControlSection";

const music = { id: "com.apple.Music", name: "Music" };
const notes = { id: "com.apple.Notes", name: "Notes" };
const calendar = { id: "com.apple.iCal", name: "Calendar" };
const off: BotAppControl = { enabled: false, apps: [], headed: false };
const granted = { available: true, accessibility: "granted", platform: "macos" };

const meta = {
  title: "Shell/Bot app control",
  component: BotAppControlSection,
  args: { value: off, onChange: () => {}, runsOnThisMac: false },
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
  render: (args) => {
    const [value, setValue] = useState(args.value);
    return (
      <BotAppControlSection
        {...args}
        value={value}
        onChange={(patch) => setValue((current) => ({ ...current, ...patch }))}
      />
    );
  },
  beforeEach: () => {
    window.rakazoDesktop = { platform: "darwin" } as unknown as RakazoDesktop;
    mockRpc({
      "appControl.status": () => granted,
      "appControl.apps": () => ({ apps: [music, notes, calendar] }),
    });
    return () => {
      window.rakazoDesktop = undefined;
    };
  },
} satisfies Meta<typeof BotAppControlSection>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Off: Story = {};

export const OnWithTwoApps: Story = {
  args: { value: { enabled: true, apps: [music, notes], headed: false } },
};

export const RealMouseAndKeyboard: Story = {
  args: { value: { enabled: true, apps: [music], headed: true } },
};

export const AccessibilityDenied: Story = {
  args: { value: { enabled: true, apps: [music], headed: false } },
  beforeEach: () => {
    window.rakazoDesktop = { platform: "darwin" } as unknown as RakazoDesktop;
    mockRpc({ "appControl.status": () => ({ ...granted, accessibility: "denied" }) });
    return () => {
      window.rakazoDesktop = undefined;
    };
  },
};

/** agent-desktop is missing: only the switch and the install line show. */
export const NeedsInstall: Story = {
  beforeEach: () => {
    window.rakazoDesktop = { platform: "darwin" } as unknown as RakazoDesktop;
    mockRpc({
      "appControl.status": () => ({
        available: false,
        accessibility: "unknown",
        platform: null,
        needsInstall: true,
      }),
    });
    return () => {
      window.rakazoDesktop = undefined;
    };
  },
};

/** Listing open apps failed: the menu shows one disabled item, and reopening retries. */
export const AppsCouldNotLoad: Story = {
  args: { value: { enabled: true, apps: [music], headed: false }, defaultMenuOpen: true },
  beforeEach: () => {
    window.rakazoDesktop = { platform: "darwin" } as unknown as RakazoDesktop;
    mockRpc({
      "appControl.status": () => granted,
      "appControl.apps": () => {
        throw new Error("unavailable");
      },
    });
    return () => {
      window.rakazoDesktop = undefined;
    };
  },
};

/** The menu lists running apps that are not already allowed. */
export const AddAppMenuOpen: Story = {
  args: { value: { enabled: true, apps: [music], headed: false }, defaultMenuOpen: true },
};

/** Not offered when the server says no, so the section renders nothing. */
export const Unavailable: Story = {
  beforeEach: () => {
    window.rakazoDesktop = { platform: "darwin" } as unknown as RakazoDesktop;
    mockRpc({
      "appControl.status": () => ({ available: false, accessibility: "unknown", platform: null }),
    });
    return () => {
      window.rakazoDesktop = undefined;
    };
  },
};
