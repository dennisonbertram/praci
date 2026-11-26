import { t } from "@lingui/core/macro";

/** "Meeting 2:30 PM", in the person's own time format. */
export function defaultMeetingTitle(at: Date): string {
  const time = at.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return t`Meeting ${time}`;
}
