import type { MeetingSource } from "@rakazo/adapter-kit";
import { MeetingSourceError } from "@rakazo/adapter-kit";
import type { SourceMeeting } from "@rakazo/contracts";
import { MEETING_TRANSCRIPT_MAX_BYTES, MEETING_TRUNCATION_MARKER } from "@rakazo/contracts";

/** In-memory MeetingSource. A meeting's startedAt stands in for its creation time. */
export class FakeMeetingSource implements MeetingSource {
  readonly provider: string;
  private readonly meetings: SourceMeeting[];
  private readonly pageSize: number;

  constructor(meetings: SourceMeeting[], options: { provider?: string; pageSize?: number } = {}) {
    this.provider = options.provider ?? "fake";
    this.pageSize = options.pageSize ?? 30;
    this.meetings = [...meetings].sort(
      (a, b) =>
        Date.parse(a.updatedAt) - Date.parse(b.updatedAt) ||
        a.externalId.localeCompare(b.externalId),
    );
  }

  async list(filter: { updatedAfter?: Date; createdAfter?: Date; cursor?: string }) {
    const start = filter.cursor === undefined ? 0 : Number(filter.cursor);
    if (!Number.isInteger(start) || start < 0)
      throw new MeetingSourceError("mapping", "Bad cursor");
    const matching = this.meetings.filter(
      (m) =>
        (!filter.updatedAfter || new Date(m.updatedAt) > filter.updatedAfter) &&
        (!filter.createdAfter || new Date(m.startedAt) >= filter.createdAfter),
    );
    const page = matching.slice(start, start + this.pageSize);
    const next = start + this.pageSize;
    return {
      items: page.map((m) => ({
        externalId: m.externalId,
        updatedAt: m.updatedAt,
        ...(m.deleted ? { deleted: true } : {}),
      })),
      ...(next < matching.length ? { nextCursor: String(next) } : {}),
    };
  }

  async get(externalId: string, options: { includeTranscript: boolean }): Promise<SourceMeeting> {
    const meeting = this.meetings.find((m) => m.externalId === externalId);
    if (!meeting) throw new MeetingSourceError("not_found", "No such meeting");
    if (!options.includeTranscript || !meeting.transcript) return { ...meeting, transcript: null };
    // Whole lines up to the cap, then a marker line.
    const kept: SourceMeeting["transcript"] = [];
    let bytes = 0;
    for (const line of meeting.transcript) {
      bytes += Buffer.byteLength(line.text);
      if (bytes > MEETING_TRANSCRIPT_MAX_BYTES) {
        kept.push({ text: MEETING_TRUNCATION_MARKER.trim() });
        return { ...meeting, transcript: kept, transcriptTruncated: true };
      }
      kept.push(line);
    }
    return { ...meeting, transcript: kept };
  }
}
