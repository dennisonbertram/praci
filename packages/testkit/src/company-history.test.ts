import { companyHistoryItems, layoutCompanyHistory } from "@rakazo/core";
import { describe, expect, it } from "vitest";
import { northwindGroundTruth } from "./company-fixture.js";

const items = companyHistoryItems({
  entities: northwindGroundTruth.entities.map(({ id, input }) => ({
    id,
    kind: input.kind,
    displayName: input.displayName,
    attrs: input.attrs ?? {},
    status: "confirmed",
  })),
  edges: northwindGroundTruth.edges.map(({ id, input }) => ({
    id,
    fromId: input.fromId,
    toId: input.toId,
    relation: input.relation,
    role: input.role ?? null,
    startsOn: input.startsOn ?? null,
    endsOn: input.endsOn ?? null,
    status: "confirmed",
  })),
  events: northwindGroundTruth.events.map(({ id, input }) => ({
    id,
    kind: input.kind,
    stream: input.stream,
    title: input.title,
    occursOn: input.occursOn ?? null,
    endsOn: input.endsOn ?? null,
    entityIds: input.entityIds ?? [],
    status: "confirmed",
  })),
});

describe("company history fixture", () => {
  it("lays out the canonical returning-person timeline", () => {
    const layout = layoutCompanyHistory(items, "year", "2024-12-31");
    const sam = layout.lanes
      .find((lane) => lane.stream === "people")!
      .items.filter((item) => item.id === "nw-employment-3" || item.id === "nw-employment-return");

    expect(sam.map(({ start, end }) => [start.date, end?.date])).toEqual([
      ["2021-03-08", "2022-06-30"],
      ["2023-02-06", undefined],
    ]);
    expect(sam[0]!.x + sam[0]!.width).toBeLessThan(sam[1]!.x);

    const matter = layout.lanes
      .find((lane) => lane.stream === "legal")!
      .items.find((item) => item.id === "nw-matter-1");
    expect(matter?.start.date).toBe("2021-09-13");
    expect(matter?.end?.date).toBe("2021-10-25");
  });
});
