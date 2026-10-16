import type { Meta, StoryObj } from "@storybook/react-vite";
import { endCall, startCall, toggleMute, toggleTranscript } from "../../lib/call-session";
import { CallCard } from "./CallCard";

/**
 * The card reads the shared call session. startCall opens the microphone and a thread feed; in
 * Storybook the microphone is refused and the feed is empty, which the card shows as a caption.
 */
const meta = {
  title: "Chat/Call card",
  component: CallCard,
  args: { onSettings: () => undefined },
  beforeEach: () => {
    startCall({ botId: "bot_ada", botName: "Ada", botColor: "#2f7d6d" });
    return () => endCall();
  },
} satisfies Meta<typeof CallCard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Listening: Story = {};

export const Muted: Story = {
  beforeEach: () => {
    startCall({ botId: "bot_ada", botName: "Ada" });
    toggleMute();
    return () => endCall();
  },
};

export const TranscriptOpen: Story = {
  beforeEach: () => {
    startCall({ botId: "bot_ada", botName: "A bot with a very long name that has to truncate" });
    toggleTranscript();
    return () => endCall();
  },
};
