import type { StoredMeeting } from "@rakazo/contracts";

export { MEETING_SOURCES, meetingSourceName } from "@rakazo/contracts";

/** Whole minutes between start and end, or null while the end is unknown. */
export const meetingMinutes = (meeting: Pick<StoredMeeting, "startedAt" | "endedAt">) =>
  meeting.endedAt
    ? Math.max(
        1,
        Math.round((Date.parse(meeting.endedAt) - Date.parse(meeting.startedAt)) / 60_000),
      )
    : null;
