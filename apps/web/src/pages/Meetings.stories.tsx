import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { mockRpc } from "../lib/__mocks__/rpc";
import { MeetingsPage } from "./Meetings";
import { meetings } from "./meetings-fixtures";

/** What Record needs to show: a transcription engine the person agreed to, and a space that allows recording. */
const recordMocks = {
  me: { userId: "u1", spaceId: "s1" },
  "meetingCaptures.start": { captureId: "capture-1" },
  "voice.status": { transcribe: false, transcriptionReady: true, transcriptionConsented: true },
  "spaces.list": {
    current: { id: "s1" },
    spaces: [{ id: "s1", meetingRecording: "remind", canSetMeetingRecording: true }],
  },
};

const meta = {
  title: "Pages/Meetings",
  component: MeetingsPage,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof MeetingsPage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  beforeEach: () =>
    mockRpc({ ...recordMocks, "meetings.list": { items: meetings, nextCursor: null } }),
};

export const Phone: Story = {
  beforeEach: () =>
    mockRpc({ ...recordMocks, "meetings.list": { items: meetings, nextCursor: null } }),
  globals: { viewport: { value: "mobile1" } },
};

/** Linked from a contact page: only meetings that list that person. */
export const AttendeeFiltered: Story = {
  parameters: { initialEntries: ["/app/meetings?attendee=ada%40example.test"] },
  beforeEach: () =>
    mockRpc({ ...recordMocks, "meetings.list": { items: meetings, nextCursor: null } }),
};

export const Empty: Story = {
  beforeEach: () => mockRpc({ ...recordMocks, "meetings.list": { items: [], nextCursor: null } }),
};

export const Searched: Story = {
  beforeEach: () =>
    mockRpc({ ...recordMocks, "meetings.list": { items: meetings, nextCursor: null } }),
  play: async ({ canvasElement }) => {
    await userEvent.type(await within(canvasElement).findByRole("searchbox"), "sync");
  },
};

export const NoMatches: Story = {
  beforeEach: () =>
    mockRpc({ ...recordMocks, "meetings.list": { items: meetings, nextCursor: null } }),
  play: async ({ canvasElement }) => {
    await userEvent.type(await within(canvasElement).findByRole("searchbox"), "zzz");
  },
};
