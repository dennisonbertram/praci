import type { DevinSessionKind } from "@rakazo/contracts";
import { DEVIN_KIND_ORDER, DEVIN_KIND_VALUES, isDevinSessionId } from "@rakazo/contracts";

/**
 * Parsers for the text Devin's MCP tools return. The format here is the documented one as the
 * synthetic fixtures in __fixtures__/devin write it, and issue #516 confirms it against real
 * responses. A tool returns one text string: session or message lines start with "- " and carry
 * `key=value` fields (values with spaces are JSON strings), fields are omitted when empty, and a
 * search page that has more ends with `next_cursor: <cursor>`. Other lines are ignored.
 */

export type DevinPr = { url: string; state: string };

export type DevinSessionRow = {
  id: string;
  title: string | null;
  status: string | null;
  statusDetail: string | null;
  /** Unix seconds. */
  createdAt: number | null;
  updatedAt: number | null;
  origin: string | null;
  prs: DevinPr[];
};

export type DevinMessage = {
  eventId: string;
  source: string | null;
  createdAt: number | null;
  body: string | null;
};

const FIELD = /([a-z_]+)=("(?:[^"\\]|\\.)*"|\S*)/gy;

/** The fields of one "- " line, or null when the line does not parse cleanly. */
function parseFields(line: string): Map<string, string> | null {
  const fields = new Map<string, string>();
  FIELD.lastIndex = 0;
  let end = 0;
  for (let match = FIELD.exec(line); match; match = FIELD.exec(line)) {
    let value = match[2] ?? "";
    if (value.startsWith('"')) {
      try {
        value = JSON.parse(value) as string;
      } catch {
        return null;
      }
    }
    fields.set(match[1] ?? "", value);
    end = FIELD.lastIndex;
    while (line[end] === " ") end += 1;
    FIELD.lastIndex = end;
  }
  return end === line.length ? fields : null;
}

const dataLines = (text: string) =>
  text.split("\n").flatMap((line) => (line.startsWith("- ") ? [line.slice(2).trimEnd()] : []));

const orNull = (value: string | undefined) => (value ? value : null);

function seconds(value: string | undefined): number | null {
  const number = value ? Number(value) : Number.NaN;
  return Number.isFinite(number) ? number : null;
}

function parsePrs(value: string | undefined): DevinPr[] {
  return (value ?? "").split(",").flatMap((part) => {
    const match = /^(.+)\[([^\]]*)\]$/.exec(part);
    return match ? [{ url: match[1] ?? "", state: match[2] ?? "" }] : [];
  });
}

export function parseDevinSessionSearch(text: string): {
  sessions: DevinSessionRow[];
  skipped: number;
  nextCursor: string | null;
} {
  const sessions: DevinSessionRow[] = [];
  let skipped = 0;
  for (const line of dataLines(text)) {
    const fields = parseFields(line);
    const id = fields?.get("id");
    if (!fields || !id || !isDevinSessionId(id)) {
      skipped += 1;
      continue;
    }
    sessions.push({
      id,
      title: orNull(fields.get("title")),
      status: orNull(fields.get("status")),
      statusDetail: orNull(fields.get("status_detail")),
      createdAt: seconds(fields.get("created_at")),
      updatedAt: seconds(fields.get("updated_at")),
      origin: orNull(fields.get("origin")),
      prs: parsePrs(fields.get("prs")),
    });
  }
  const cursor = /^next_cursor: (\S+)\s*$/m.exec(text)?.[1];
  return { sessions, skipped, nextCursor: cursor ?? null };
}

/** Messages in the order the tool lists them, which the synthetic fixture documents as oldest first. */
export function parseDevinMessages(text: string): { messages: DevinMessage[] } {
  const messages: DevinMessage[] = [];
  for (const line of dataLines(text)) {
    const fields = parseFields(line);
    const eventId = fields?.get("event_id");
    if (!fields || !eventId) continue;
    messages.push({
      eventId,
      source: orNull(fields.get("source")),
      createdAt: seconds(fields.get("created_at")),
      body: orNull(fields.get("body")),
    });
  }
  return { messages };
}

/** The latest message Devin wrote: its `event_id` is the identity of the question it asks. */
export function latestDevinMessage(messages: DevinMessage[]): DevinMessage | null {
  return messages.findLast((message) => message.source === "devin") ?? null;
}

/** Design 9 of docs/plans/devin.md; `needs_you` wins over any other match. */
export function devinKindOf(
  status: string | null | undefined,
  statusDetail: string | null | undefined,
): DevinSessionKind {
  const s = status?.trim().toLowerCase() ?? "";
  const d = statusDetail?.trim().toLowerCase() ?? "";
  for (const kind of DEVIN_KIND_ORDER) {
    const values = DEVIN_KIND_VALUES[kind];
    if ((s && values.statuses.includes(s)) || (d && values.details.includes(d))) return kind;
  }
  return "unknown";
}
