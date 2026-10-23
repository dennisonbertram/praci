import { describe, expect, it } from "vitest";
import { companyCalendarItems, companyCalendarMonth } from "./company-calendar.js";

const companyFixture: Parameters<typeof companyCalendarItems>[0] = {
  entities: [
    { id: "company", kind: "company", displayName: "Northwind", attrs: {}, status: "suggested" },
    { id: "person", kind: "person", displayName: "Alex Reed", attrs: {}, status: "suggested" },
  ],
  edges: [
    {
      id: "employment",
      fromId: "person",
      toId: "company",
      relation: "works_at",
      startsOn: null,
      endsOn: null,
      status: "suggested",
    },
  ],
  events: [
    { id: "event", title: "Funding close", stream: "funding", occursOn: null, status: "suggested" },
  ],
};

describe("Company calendar", () => {
  it("keeps literal days in opposing time zones and never promotes imprecise dates", () => {
    const previous = process.env.TZ;
    try {
      for (const zone of ["Pacific/Honolulu", "Pacific/Kiritimati"]) {
        process.env.TZ = zone;
        const data = structuredClone(companyFixture);
        data.events = [
          {
            ...data.events[0]!,
            id: "board",
            stream: "company",
            title: "Board meeting",
            occursOn: { date: "2026-10-01", precision: "day" },
          },
          {
            ...data.events[0]!,
            id: "funding",
            stream: "funding",
            occursOn: { date: "2026-10-31", precision: "day" },
          },
          { ...data.events[0]!, id: "year", occursOn: { date: "2026-01-01", precision: "year" } },
          { ...data.events[0]!, id: "month", occursOn: { date: "2026-10-01", precision: "month" } },
        ];
        expect(companyCalendarItems(data, "2026-10").map((item) => item.date)).toEqual([
          "2026-10-01",
          "2026-10-31",
        ]);
        expect(companyCalendarItems(data, "2026-01")).toEqual([]);
        expect(companyCalendarMonth("2026-10")).toEqual({
          start: "2026-10-01",
          end: "2026-10-31",
          offset: 4,
          days: 31,
        });
      }
    } finally {
      if (previous === undefined) delete process.env.TZ;
      else process.env.TZ = previous;
    }
  });
  it("leaves anniversaries off and skips non-leap February 29 without shifting", () => {
    const data = structuredClone(companyFixture);
    data.events = [];
    data.edges[0]!.startsOn = { date: "2024-02-29", precision: "day" };
    expect(companyCalendarItems(data, "2028-02")).toEqual([]);
    expect(companyCalendarItems(data, "2027-02", true)).toEqual([]);
    expect(companyCalendarItems(data, "2028-02", true)).toMatchObject([
      { date: "2028-02-29", anniversary: true, fact: { kind: "edge", id: "employment" } },
    ]);
    data.edges[0]!.startsOn = { date: "2024-01-01", precision: "year" };
    expect(companyCalendarItems(data, "2028-01", true)).toEqual([]);
  });
  it("uses company founding dates without duplicating accepted founded edges", () => {
    const data = structuredClone(companyFixture);
    data.events = [];
    const founded = { date: "2020-02-29", precision: "day" as const };
    data.entities[0]!.attrs = { founded };
    data.edges.push({
      id: "founding",
      fromId: "person",
      toId: "company",
      relation: "founded",
      startsOn: founded,
      endsOn: null,
      status: "confirmed",
    });
    expect(companyCalendarItems(data, "2024-02", true)).toMatchObject([
      { date: "2024-02-29", fact: { kind: "edge", id: "founding" } },
    ]);
    data.edges[1]!.status = "rejected";
    expect(companyCalendarItems(data, "2024-02", true)).toMatchObject([
      { date: "2024-02-29", fact: { kind: "entity", id: "company" } },
    ]);
  });
});
