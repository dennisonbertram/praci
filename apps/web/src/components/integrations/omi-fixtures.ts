import type { OmiSegmentDto } from "@rakazo/contracts";

const day = new Date().toISOString().slice(0, 10);
const at = (time: string, daysAgo = 0) =>
  `${new Date(Date.parse(`${day}T00:00:00.000Z`) - daysAgo * 86_400_000).toISOString().slice(0, 10)}T${time}:00.000Z`;

const segment = (
  id: string,
  kind: OmiSegmentDto["kind"],
  title: string,
  from: string,
  to: string,
  daysAgo = 0,
): OmiSegmentDto => ({
  id,
  audioItemId: "item_1",
  kind,
  title,
  startedAt: at(from, daysAgo),
  endedAt: at(to, daysAgo),
  sortedBy: "agent",
  meetingId: null,
  noteItemId: null,
});

/** Invented stretches for stories. */
export const mockSegments = [
  segment("seg_1", "meeting", "Pricing review", "09:14", "09:32"),
  segment("seg_2", "note", "Idea for onboarding email", "10:05", "10:11"),
  segment("seg_5", "meeting", "Hiring sync", "15:00", "15:40", 1),
  segment("seg_6", "note", "Grocery list", "08:20", "08:24", 3),
  segment("seg_3", "trash", "Background noise", "11:40", "12:30"),
  segment("seg_4", "trash", "Street and traffic", "13:02", "13:20"),
];
