import type {
  CompanyCalendarItem,
  CompanyEdgeRecord,
  CompanyEntityRecord,
  CompanyEventRecord,
  CompanyPartialDate,
} from "@rakazo/contracts";
import { CompanyPartialDateSchema } from "@rakazo/contracts";

export function companyCalendarMonth(month: string) {
  const start = `${month}-01`;
  const date = new Date(`${start}T00:00:00Z`);
  const end = new Date(date);
  end.setUTCMonth(end.getUTCMonth() + 1, 0);
  return {
    start,
    end: end.toISOString().slice(0, 10),
    offset: date.getUTCDay(),
    days: end.getUTCDate(),
  };
}

export function companyCalendarItems(
  data: {
    entities: Pick<CompanyEntityRecord, "id" | "displayName" | "kind" | "attrs" | "status">[];
    edges: Pick<
      CompanyEdgeRecord,
      "id" | "relation" | "fromId" | "toId" | "startsOn" | "endsOn" | "status"
    >[];
    events: Pick<CompanyEventRecord, "id" | "title" | "stream" | "occursOn" | "status">[];
  },
  month: string,
  anniversaries = false,
): CompanyCalendarItem[] {
  const items: CompanyCalendarItem[] = [];
  for (const event of data.events) {
    if (
      event.status === "rejected" ||
      event.occursOn?.precision !== "day" ||
      !event.occursOn.date.startsWith(`${month}-`)
    )
      continue;
    items.push({
      id: `event:${event.id}`,
      title: event.title,
      date: event.occursOn.date,
      stream: event.stream,
      status: event.status,
      anniversary: false,
      fact: { kind: "event", id: event.id },
      legalDeadlineId: null,
    });
  }
  if (!anniversaries) return items.sort(compare);
  const names = new Map(data.entities.map((entity) => [entity.id, entity.displayName]));
  const addAnniversary = (
    id: string,
    kind: "entity" | "edge",
    title: string,
    start: CompanyPartialDate | null | undefined,
    status: string,
    stream: "people" | "company",
  ) => {
    if (
      status === "rejected" ||
      start?.precision !== "day" ||
      start.date.slice(0, 4) >= month.slice(0, 4)
    )
      return;
    const date = `${month.slice(0, 4)}${start.date.slice(4)}`;
    if (
      !date.startsWith(`${month}-`) ||
      new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date
    )
      return;
    items.push({
      id: `anniversary:${kind}:${id}`,
      title,
      date,
      stream,
      status,
      anniversary: true,
      fact: { kind, id },
      legalDeadlineId: null,
    });
  };
  for (const edge of data.edges) {
    if (edge.relation === "works_at" && !edge.endsOn)
      addAnniversary(
        edge.id,
        "edge",
        names.get(edge.fromId) ?? "—",
        edge.startsOn,
        edge.status,
        "people",
      );
    if (edge.relation === "founded")
      addAnniversary(
        edge.id,
        "edge",
        names.get(edge.toId) ?? "—",
        edge.startsOn,
        edge.status,
        "company",
      );
  }
  for (const entity of data.entities) {
    if (entity.kind !== "company") continue;
    const date = CompanyPartialDateSchema.safeParse(entity.attrs.founded);
    if (
      date.success &&
      !data.edges.some(
        (edge) =>
          edge.status !== "rejected" &&
          edge.relation === "founded" &&
          edge.toId === entity.id &&
          edge.startsOn?.date === date.data.date &&
          edge.startsOn.precision === date.data.precision,
      )
    ) {
      addAnniversary(entity.id, "entity", entity.displayName, date.data, entity.status, "company");
    }
  }
  return items.sort(compare);
}

const compare = (a: CompanyCalendarItem, b: CompanyCalendarItem) =>
  a.date.localeCompare(b.date) || a.id.localeCompare(b.id);
