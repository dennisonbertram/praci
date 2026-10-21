import { describe, expect, it } from "vitest";
import { companyDateRange, companyHistoryItems, layoutCompanyHistory } from "./company-history.js";

const data: Parameters<typeof companyHistoryItems>[0] = {
  entities: [
    {
      id: "company",
      kind: "company",
      displayName: "Northwind Robotics",
      attrs: {},
      status: "confirmed",
    },
    { id: "sam", kind: "person", displayName: "Sam Reed", attrs: {}, status: "confirmed" },
    {
      id: "customer",
      kind: "organisation",
      displayName: "Harbor Parts",
      attrs: {},
      status: "confirmed",
    },
    { id: "matter", kind: "matter", displayName: "Supply dispute", attrs: {}, status: "confirmed" },
  ],
  edges: [
    {
      id: "sam-first",
      fromId: "sam",
      toId: "company",
      relation: "works_at",
      role: "Engineer",
      startsOn: { date: "2021-03-08", precision: "day" },
      endsOn: { date: "2022-06-30", precision: "day" },
      status: "confirmed",
    },
    {
      id: "sam-return",
      fromId: "sam",
      toId: "company",
      relation: "works_at",
      role: "Senior Engineer",
      startsOn: { date: "2023-02-06", precision: "day" },
      endsOn: null,
      status: "confirmed",
    },
    {
      id: "contract",
      fromId: "company",
      toId: "customer",
      relation: "party_to",
      role: "Supply contract",
      startsOn: { date: "2022-01-01", precision: "year" },
      endsOn: { date: "2022-12-31", precision: "day" },
      status: "suggested",
    },
  ],
  events: [
    {
      id: "matter-opened",
      kind: "matter_opened",
      stream: "legal",
      title: "Matter opened",
      occursOn: { date: "2021-09-13", precision: "day" },
      endsOn: null,
      entityIds: ["matter"],
      status: "confirmed",
    },
    {
      id: "matter-closed",
      kind: "matter_closed",
      stream: "legal",
      title: "Matter closed",
      occursOn: { date: "2021-10-25", precision: "day" },
      endsOn: null,
      entityIds: ["matter"],
      status: "confirmed",
    },
    {
      id: "year-only",
      kind: "funding_round",
      stream: "funding",
      title: "Series A",
      occursOn: { date: "2022-01-01", precision: "year" },
      endsOn: null,
      entityIds: ["company"],
      status: "suggested",
    },
    {
      id: "point",
      kind: "launch",
      stream: "product",
      title: "Pilot launch",
      occursOn: { date: "2024-04-12", precision: "day" },
      endsOn: null,
      entityIds: ["company"],
      status: "confirmed",
    },
  ],
};
describe("company history", () => {
  it("lays out the independent fixture with separate employment periods and matter bars", () => {
    const items = companyHistoryItems(data);
    const layout = layoutCompanyHistory(items, "year", "2024-12-31");
    const person = layout.lanes
      .find((lane) => lane.stream === "people")!
      .items.filter((item) => item.kind === "edge" && item.title.startsWith("Sam Reed"));
    expect(person).toHaveLength(2);
    expect(person[0]!.x + person[0]!.width).toBeLessThan(person[1]!.x);
    expect(person.every((item) => !item.marker)).toBe(true);
    const matter = layout.lanes
      .find((lane) => lane.stream === "legal")!
      .items.find((item) => item.kind === "entity" && item.id === "matter");
    expect(matter?.start.date).toBe("2021-09-13");
    expect(matter?.end?.date).toBe("2021-10-25");
    expect(
      layout.lanes
        .find((lane) => lane.stream === "legal")
        ?.items.some((item) => item.id === "contract"),
    ).toBe(true);
    for (const lane of layout.lanes)
      for (const item of lane.items) {
        expect(item.x).toBeGreaterThanOrEqual(120);
        expect(item.x + item.width).toBeLessThan(layout.width);
        expect(item.y).toBeLessThan(lane.y + lane.height);
        for (const other of lane.items) {
          if (other === item || other.y !== item.y || other.x < item.x) continue;
          expect(other.x).toBeGreaterThanOrEqual(item.x + Math.max(item.width, 220) + 12);
        }
      }
    expect(layoutCompanyHistory([...items].reverse(), "year", "2024-12-31")).toEqual(layout);
  });
  it("renders imprecise dates as ranges at every zoom, with precise points as markers", () => {
    const items = companyHistoryItems(data);
    const widths = ["year", "quarter", "month"].map((zoom) => {
      const layout = layoutCompanyHistory(
        items,
        zoom as "year" | "quarter" | "month",
        "2024-12-31",
      );
      const yearOnly = layout.lanes
        .flatMap((lane) => lane.items)
        .find((item) => item.id === "year-only")!;
      expect(yearOnly.uncertain).toBe(true);
      expect(yearOnly.marker).toBe(false);
      expect(
        layout.lanes.flatMap((lane) => lane.items).find((item) => item.id === "point")?.marker,
      ).toBe(true);
      return yearOnly.width;
    });
    expect(widths[0]).toBeLessThan(widths[1]!);
    expect(widths[1]).toBeLessThan(widths[2]!);
    const leapYear = companyDateRange({ date: "2024-01-01", precision: "year" });
    expect(leapYear.end - leapYear.start).toBe(366);
  });
  it("handles empty history and does not invent dates for undated facts", () => {
    expect(
      companyHistoryItems({
        entities: [],
        edges: [],
        events: [{ ...data.events[0]!, occursOn: null }],
      }),
    ).toEqual([]);
    expect(layoutCompanyHistory([], "month", "2024-01-01").lanes).toHaveLength(6);
  });
  it("shows founded profile dates and treats founded relationships as point markers", () => {
    const founded = { date: "2019-03-08", precision: "day" } as const;
    const company = {
      id: "company",
      kind: "company",
      displayName: "Northwind Robotics",
      attrs: { founded },
      status: "suggested",
    } as const;
    const profileItems = companyHistoryItems({ entities: [company], edges: [], events: [] });
    expect(profileItems).toMatchObject([
      {
        id: "company",
        kind: "entity",
        stream: "company",
        start: founded,
        period: false,
        status: "suggested",
      },
    ]);

    const foundedEdge = {
      id: "founded-edge",
      fromId: "founder",
      toId: "company",
      relation: "founded",
      role: null,
      startsOn: founded,
      endsOn: null,
      status: "confirmed",
    } as const;
    const matchingItems = companyHistoryItems({
      entities: [company],
      edges: [foundedEdge],
      events: [],
    });
    expect(matchingItems).toHaveLength(1);
    expect(matchingItems[0]).toMatchObject({
      id: "founded-edge",
      kind: "edge",
      start: founded,
      period: false,
    });
    expect(
      layoutCompanyHistory(matchingItems, "year", "2024-12-31")
        .lanes.flatMap((lane) => lane.items)
        .find((item) => item.id === "founded-edge")?.marker,
    ).toBe(true);

    const conflictingItems = companyHistoryItems({
      entities: [company],
      edges: [{ ...foundedEdge, startsOn: { date: "2020-01-01", precision: "year" } }],
      events: [],
    });
    expect(conflictingItems).toHaveLength(2);

    const invalidProfileItems = companyHistoryItems({
      entities: [
        {
          ...company,
          attrs: { founded: { date: "2019-02-01", precision: "year" } },
        },
      ],
      edges: [],
      events: [],
    });
    expect(invalidProfileItems).toEqual([]);
  });
});
