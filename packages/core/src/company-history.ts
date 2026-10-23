import type {
  CompanyEdgeRecord,
  CompanyEntityRecord,
  CompanyEventRecord,
  CompanyPartialDate,
} from "@rakazo/contracts";
import { CompanyPartialDateSchema } from "@rakazo/contracts";

export type CompanyHistoryZoom = "year" | "quarter" | "month";
export const companyHistoryStreams = [
  "company",
  "people",
  "funding",
  "legal",
  "product",
  "customers",
] as const;
export type CompanyHistoryStream = (typeof companyHistoryStreams)[number];
export interface CompanyHistoryItem {
  id: string;
  kind: "entity" | "edge" | "event";
  stream: CompanyHistoryStream;
  title: string;
  start: CompanyPartialDate;
  end?: CompanyPartialDate | null;
  period: boolean;
  status: string;
}

const day = 86_400_000;
const ordinal = (date: string) => Date.parse(`${date}T00:00:00Z`) / day;
export function companyDateRange(value: CompanyPartialDate): { start: number; end: number } {
  const start = ordinal(value.date);
  const end = new Date(start * day);
  if (value.precision === "year") end.setUTCFullYear(end.getUTCFullYear() + 1);
  else if (value.precision === "quarter") end.setUTCMonth(end.getUTCMonth() + 3);
  else if (value.precision === "month") end.setUTCMonth(end.getUTCMonth() + 1);
  else end.setUTCDate(end.getUTCDate() + 1);
  return { start, end: end.getTime() / day };
}

export function companyHistoryItems(data: {
  entities: Pick<CompanyEntityRecord, "id" | "kind" | "displayName" | "attrs" | "status">[];
  edges: Pick<
    CompanyEdgeRecord,
    "id" | "fromId" | "toId" | "relation" | "role" | "startsOn" | "endsOn" | "status"
  >[];
  events: Pick<
    CompanyEventRecord,
    "id" | "kind" | "stream" | "title" | "occursOn" | "endsOn" | "entityIds" | "status"
  >[];
}): CompanyHistoryItem[] {
  const names = new Map(data.entities.map((entity) => [entity.id, entity.displayName]));
  const items: CompanyHistoryItem[] = data.events.flatMap((event) =>
    event.occursOn
      ? [
          {
            id: event.id,
            kind: "event",
            stream: event.stream,
            title: event.title,
            start: event.occursOn,
            end: event.endsOn,
            period: Boolean(event.endsOn),
            status: event.status,
          },
        ]
      : [],
  );
  const streams: Record<string, CompanyHistoryStream> = {
    works_at: "people",
    reports_to: "people",
    founded: "company",
    invested_in: "funding",
    customer_of: "customers",
    vendor_of: "customers",
    counsel_for: "legal",
    party_to: "legal",
    works_on: "product",
    part_of: "company",
  };
  for (const edge of data.edges) {
    if (!edge.startsOn) continue;
    items.push({
      id: edge.id,
      kind: "edge",
      stream: streams[edge.relation] ?? "company",
      title: `${names.get(edge.fromId) ?? "—"} · ${edge.role ?? edge.relation.replaceAll("_", " ")} · ${names.get(edge.toId) ?? "—"}`,
      start: edge.startsOn,
      end: edge.endsOn,
      period: edge.relation !== "founded",
      status: edge.status,
    });
  }
  for (const entity of data.entities) {
    if (entity.kind === "company") {
      const founded = CompanyPartialDateSchema.safeParse(entity.attrs.founded);
      if (founded.success) {
        const hasMatchingFoundedEdge = data.edges.some(
          (edge) =>
            edge.relation === "founded" &&
            edge.toId === entity.id &&
            edge.startsOn?.date === founded.data.date &&
            edge.startsOn?.precision === founded.data.precision,
        );
        if (!hasMatchingFoundedEdge) {
          items.push({
            id: entity.id,
            kind: "entity",
            stream: "company",
            title: entity.displayName,
            start: founded.data,
            period: false,
            status: entity.status,
          });
        }
      }
    }
    if (entity.kind === "matter") {
      const opens = data.events.filter(
        (event) =>
          event.kind === "matter_opened" && event.occursOn && event.entityIds.includes(entity.id),
      );
      const closes = data.events.filter(
        (event) =>
          event.kind === "matter_closed" && event.occursOn && event.entityIds.includes(entity.id),
      );
      const start = opens[0]?.occursOn;
      const end = closes[0]?.occursOn;
      if (opens.length === 1 && closes.length <= 1 && start && (!end || end.date >= start.date)) {
        items.push({
          id: entity.id,
          kind: "entity",
          stream: "legal",
          title: entity.displayName,
          start,
          end,
          period: true,
          status: [entity, ...opens, ...closes].every((fact) => fact.status === "confirmed")
            ? "confirmed"
            : "suggested",
        });
      }
    }
    if (entity.kind === "project" && entity.attrs.startsOn) {
      items.push({
        id: entity.id,
        kind: "entity",
        stream: "product",
        title: entity.displayName,
        start: entity.attrs.startsOn as CompanyPartialDate,
        end: entity.attrs.endsOn as CompanyPartialDate | undefined,
        period: true,
        status: entity.status,
      });
    }
  }
  return items;
}

/** Calendar coordinates are UTC day ordinals, never viewer-local instants. */
export function layoutCompanyHistory(
  items: CompanyHistoryItem[],
  zoom: CompanyHistoryZoom,
  today: string,
) {
  const now = ordinal(today);
  const ranges = items.map((item) => {
    const start = companyDateRange(item.start);
    const end = item.end
      ? companyDateRange(item.end).end
      : item.period
        ? Math.max(start.end, now + 1)
        : start.end;
    return {
      item,
      start: start.start,
      end,
      uncertain:
        item.start.precision !== "day" || Boolean(item.end && item.end.precision !== "day"),
    };
  });
  const first = Math.min(now, ...ranges.map((range) => range.start));
  const last = Math.max(now + 1, ...ranges.map((range) => range.end));
  const year = new Date(first * day).getUTCFullYear();
  const lastYear = new Date((last - 1) * day).getUTCFullYear();
  const min = ordinal(`${String(year).padStart(4, "0")}-01-01`);
  const max = ordinal(`${String(lastYear + 1).padStart(4, "0")}-01-01`);
  const scale = Math.min(
    { year: 240, quarter: 600, month: 1440 }[zoom] / 365.25,
    48000 / (max - min),
  );
  const left = 120;
  const x = (value: number) => left + (value - min) * scale;
  const ticks: { x: number; label: string }[] = [];
  const step = zoom === "year" ? 12 : zoom === "quarter" ? 3 : 1;
  for (let y = year; y <= lastYear; y++) {
    for (let month = 1; month <= 12; month += step) {
      const date = `${String(y).padStart(4, "0")}-${String(month).padStart(2, "0")}-01`;
      ticks.push({
        x: x(ordinal(date)),
        label:
          zoom === "year"
            ? String(y)
            : zoom === "quarter"
              ? `${y} Q${Math.ceil(month / 3)}`
              : date.slice(0, 7),
      });
    }
  }
  let y = 40;
  const lanes = companyHistoryStreams.map((stream) => {
    const rows: number[] = [];
    const top = y;
    const placed = ranges
      .filter((range) => range.item.stream === stream)
      .sort((a, b) => a.start - b.start || a.item.id.localeCompare(b.item.id))
      .map((range) => {
        const startX = x(range.start);
        const width = Math.max(8, (range.end - range.start) * scale);
        let row = rows.findIndex((end) => end + 12 <= startX);
        if (row < 0) row = rows.length;
        rows[row] = startX + Math.max(width, 220);
        return {
          ...range.item,
          x: startX,
          y: top + row * 52 + 20,
          width,
          uncertain: range.uncertain,
          marker: !range.item.period && !range.uncertain && !range.item.end,
        };
      });
    const height = Math.max(1, rows.length) * 52 + 16;
    y += height;
    return { stream, y: top, height, items: placed };
  });
  return { width: Math.max(760, x(max) + 240), height: y, ticks, lanes };
}
