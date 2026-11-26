import { describe, expect, it } from "vitest";
import { prospect } from "../components/fundraising/pipeline-fixtures";
import type { PipelineRow } from "./pipeline-rows";
import {
  callIso,
  filterRows,
  inAWeek,
  isDue,
  nextBand,
  nextWorkingDays,
  sortValue,
  toPipelineRow,
} from "./pipeline-rows";

const TODAY = "2026-11-04";
const row = (id: string, record: Parameters<typeof prospect>[2] = {}, contact = {}): PipelineRow =>
  toPipelineRow(prospect(id, `Firm ${id}`, record, contact));
const at = (day: string) => `${day}T12:00:00.000Z`;

describe("next call bands", () => {
  it("reads a date alone as that day, whatever the viewer's zone", () => {
    expect(nextBand(row("a", { nextCallAt: at("2026-11-03") }), TODAY)).toBe("overdue");
    expect(nextBand(row("b", { nextCallAt: at("2026-11-04") }), TODAY)).toBe("today");
    expect(nextBand(row("c", { nextCallAt: at("2026-11-11") }), TODAY)).toBe("week");
    expect(nextBand(row("d", { nextCallAt: at("2026-11-12") }), TODAY)).toBe("later");
    expect(nextBand(row("e"), TODAY)).toBe("none");
  });
  it("Due now is overdue and today, together", () => {
    expect(isDue(row("a", { nextCallAt: at("2026-11-03") }), TODAY)).toBe(true);
    expect(isDue(row("b", { nextCallAt: at("2026-11-04") }), TODAY)).toBe(true);
    expect(isDue(row("c", { nextCallAt: at("2026-11-05") }), TODAY)).toBe(false);
  });
});

describe("filterRows", () => {
  const rows = [
    row("a", { status: "met", interest: "in", group: "Wave 1", nextCallAt: at("2026-11-02") }),
    row("b", { status: "passed", interest: "out" }),
    row("c", { interest: null, referredBy: { id: "r1", name: "Sam" } }, { nextStep: "Call" }),
    row(
      "d",
      { details: [{ label: "Stage", value: "Seed", source: "agent" }] },
      {
        checkSizeCents: 60_000_000,
      },
    ),
  ];
  const ids = (filters: Parameters<typeof filterRows>[1], search = "") =>
    filterRows(rows, filters, search, TODAY).map((r) => r.id);

  it("hides Passed unless the Status filter asks for it", () => {
    expect(ids({})).toEqual(["a", "c", "d"]);
    expect(ids({ status: "passed" })).toEqual(["b"]);
  });
  it("reaches every column", () => {
    expect(ids({ interest: "in" })).toEqual(["a"]);
    expect(ids({ interest: "none" })).toEqual(["c", "d"]);
    expect(ids({ by: "r1" })).toEqual(["c"]);
    expect(ids({ by: "none" })).toEqual(["a", "d"]);
    expect(ids({ step: "yes" })).toEqual(["c"]);
    expect(ids({ amount: "high" })).toEqual(["d"]);
    expect(ids({ details: "researched" })).toEqual(["d"]);
    expect(ids({ wave: "Wave 1" })).toEqual(["a"]);
    expect(ids({ last: "never" })).toEqual(["a", "c", "d"]);
    expect(ids({ next: "overdue" })).toEqual(["a"]);
    expect(ids({ due: "1" })).toEqual(["a"]);
  });
  it("searches names and people", () => {
    expect(ids({}, "firm c")).toEqual(["c"]);
  });
});

describe("sorting and dates", () => {
  it("sorts status by pipeline order and leaves blanks without a value", () => {
    expect(sortValue("status", row("a", { status: "met" }))).toBe(4);
    expect(sortValue("nextCall", row("a"))).toBeNull();
    expect(sortValue("interest", row("a", { interest: "maybe" }))).toBe(1);
  });
  it("saves a date alone at noon UTC and a time as the instant", () => {
    expect(callIso("2026-11-04", null)).toBe("2026-11-04T12:00:00.000Z");
    expect(callIso("2026-11-04", "15:30")).toBe(new Date("2026-11-04T15:30").toISOString());
  });
  it("offers the next three working days and a week out", () => {
    // Thursday Nov 5 2026 -> Fri, Mon, Tue.
    const thursday = new Date(2026, 10, 5);
    expect(nextWorkingDays(thursday, 3)).toEqual(["2026-11-06", "2026-11-09", "2026-11-10"]);
    expect(inAWeek(thursday)).toBe("2026-11-12");
  });
});
