import {
  CompanyEdgeInputSchema,
  CompanyEntityInputSchema,
  CompanyEventInputSchema,
} from "@rakazo/contracts";
import { describe, expect, it } from "vitest";
import {
  createNorthwindCompanyFixture,
  createSecondCompanyFixture,
  northwindChannels,
} from "./corpus.js";
import { northwindGroundTruth, secondCompanyGroundTruth } from "./ground-truth.js";

describe("invented Company source corpus", () => {
  it("has the complete sizing and deterministic content without external reads", () => {
    const items = createNorthwindCompanyFixture();
    expect(items).toEqual(createNorthwindCompanyFixture());
    expect(items).toHaveLength(990);
    expect(new Set(items.map((item) => `${item.sourceKind}:${item.sourceItemId}`)).size).toBe(990);
    for (const [kind, count] of [
      ["gmail", 200],
      ["data_room", 40],
      ["slack", 600],
      ["github", 75],
      ["linear", 75],
    ] as const) {
      expect(items.filter((item) => item.sourceKind === kind)).toHaveLength(count);
    }
    expect(northwindChannels).toHaveLength(12);
    expect(
      new Set(items.filter((item) => item.sourceKind === "slack").map((item) => item.channelId))
        .size,
    ).toBe(12);
    expect(
      items
        .filter((item) => item.triage === "instruction_like")
        .map((item) => item.sourceKind)
        .sort(),
    ).toEqual(["data_room", "gmail", "slack"]);
  });

  it("defines valid truth with resolvable evidence and no output-under-test dependency", () => {
    const items = new Map(
      createNorthwindCompanyFixture().map((item) => [
        `${item.sourceKind}:${item.sourceItemId}`,
        item,
      ]),
    );
    const ids = new Set(northwindGroundTruth.entities.map((fact) => fact.id));
    for (const fact of northwindGroundTruth.entities)
      expect(CompanyEntityInputSchema.safeParse(fact.input).success).toBe(true);
    for (const fact of northwindGroundTruth.edges) {
      expect(CompanyEdgeInputSchema.safeParse(fact.input).success).toBe(true);
      expect(ids.has(fact.input.fromId) && ids.has(fact.input.toId)).toBe(true);
    }
    for (const fact of northwindGroundTruth.events) {
      expect(CompanyEventInputSchema.safeParse(fact.input).success).toBe(true);
      expect(fact.input.entityIds.every((id) => ids.has(id))).toBe(true);
    }
    for (const fact of [
      ...northwindGroundTruth.entities,
      ...northwindGroundTruth.edges,
      ...northwindGroundTruth.events,
    ]) {
      expect(fact.sources.length).toBeGreaterThan(0);
      expect(fact.statement.length).toBeLessThanOrEqual(240);
      for (const source of fact.sources)
        expect(items.get(`${source.sourceKind}:${source.sourceItemId}`)?.body).toContain(
          fact.statement,
        );
    }
  });

  it("keeps the difficult cases independent and unambiguous in the oracle", () => {
    const { entities, edges, events } = northwindGroundTruth;
    expect(entities.filter((fact) => fact.input.kind === "person")).toHaveLength(30);
    expect(
      entities.filter(
        (fact) => fact.input.kind === "organisation" && fact.input.attrs.type === "customer",
      ),
    ).toHaveLength(5);
    expect(
      entities.filter(
        (fact) => fact.input.kind === "organisation" && fact.input.attrs.type === "vendor",
      ),
    ).toHaveLength(3);
    expect(
      entities.filter(
        (fact) => fact.input.kind === "organisation" && fact.input.attrs.type === "law_firm",
      ),
    ).toHaveLength(1);
    expect(entities.filter((fact) => fact.input.kind === "matter")).toHaveLength(2);
    expect(entities.filter((fact) => fact.input.kind === "product")).toHaveLength(3);
    expect(events.filter((fact) => fact.input.kind === "funding_round")).toHaveLength(2);
    const periods = edges.filter(
      (fact) => fact.input.fromId === "nw-person-3" && fact.input.relation === "works_at",
    );
    expect(periods).toHaveLength(2);
    expect(periods.map((fact) => [fact.input.startsOn?.date, fact.input.endsOn?.date])).toEqual([
      ["2021-03-08", "2022-06-30"],
      ["2023-02-06", undefined],
    ]);
    expect(northwindGroundTruth.identityAliases[0]?.workEmails).toHaveLength(3);
    expect(northwindGroundTruth.distinctPeople).toEqual([["nw-person-3", "nw-person-4"]]);
    expect(events.find((fact) => fact.id === "nw-year-only")?.input.occursOn).toEqual({
      date: "2021-01-01",
      precision: "year",
    });
    expect(northwindGroundTruth.contradictions[0]?.factId).toBe("nw-series-a");
    expect(events.find((fact) => fact.id === "nw-series-a")?.input.amountCents).toBe(800000000);
    expect(secondCompanyGroundTruth.entities[1]?.input).toMatchObject({
      kind: "person",
      attrs: { workEmails: ["sam.reed@northwind.example"] },
    });
    expect(createSecondCompanyFixture()).toHaveLength(2);
    expect(createSecondCompanyFixture().every((item) => item.companyId === "seabright")).toBe(true);
    expect(entities.some((fact) => fact.input.displayName === "Override Incorporated")).toBe(false);
  });
});
