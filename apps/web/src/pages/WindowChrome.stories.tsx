import type { Meta, StoryObj } from "@storybook/react-vite";
import { WindowChrome } from "./WindowChrome";

const meta = {
  title: "Shell/Window chrome",
  component: WindowChrome,
  decorators: [
    (Story) => (
      <div className="p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof WindowChrome>;
export default meta;
type Story = StoryObj<typeof meta>;

type Bridge = NonNullable<typeof window.rakazoDesktop>;
const installBridge = (platform: string) => () => {
  window.rakazoDesktop = {
    platform,
    window: {
      close: async () => undefined,
      minimize: async () => undefined,
      toggleMaximize: async () => undefined,
      state: async () => ({ minimized: false, maximized: false, fullScreen: false }),
    },
  } as Bridge;
  return () => {
    window.rakazoDesktop = undefined;
  };
};

/** In a browser there is no desktop bridge, so only a spacer renders. */
export const Browser: Story = {};
/** The native traffic lights sit in this reserved drag area. */
export const DesktopMac: Story = { beforeEach: installBridge("darwin") };
/** Other platforms draw their own close, minimize and fullscreen buttons. */
export const DesktopWithControls: Story = { beforeEach: installBridge("win32") };
