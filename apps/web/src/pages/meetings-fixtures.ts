import type { StoredMeeting, StoredMeetingDetail } from "@rakazo/contracts";

const meeting = (
  id: string,
  title: string,
  provider: string,
  startedAt: string,
  minutes: number | null,
): StoredMeeting => ({
  id,
  title,
  provider,
  startedAt,
  endedAt: minutes ? new Date(Date.parse(startedAt) + minutes * 60_000).toISOString() : null,
});

export const meetings = [
  meeting("m1", "Pricing review with Dana", "praci", "2026-11-01T10:00:00Z", 38),
  meeting("m2", "Zoom call 2:30 PM", "hex", "2026-10-31T14:30:00Z", 24),
  meeting("m3", "Weekly sync", "granola", "2026-10-29T09:00:00Z", 45),
  meeting("m4", "Walk to the airport", "omi", "2026-10-28T07:40:00Z", 12),
  meeting("m5", "Hiring sync", "granola", "2026-10-27T16:00:00Z", null),
];

export const detail: StoredMeetingDetail = {
  ...meetings[1]!,
  summary: "Walked through the renewal terms and agreed to send a revised quote this week.",
  decisions: ["Annual plan at the revised price, starting Nov 14.", "Pilot extended by two weeks."],
  followUps: ["Who confirms the security review date?"],
  todos: [
    { id: "t1", text: "Send Dana the revised pricing", dueOn: "2026-11-04", doneAt: null },
    { id: "t2", text: "Share the pilot report", dueOn: null, doneAt: null },
  ],
  transcript: "Me: Thanks for joining.\nThem: Happy to be here.",
  partial: false,
  summarizing: false,
  actionItems: [],
};
