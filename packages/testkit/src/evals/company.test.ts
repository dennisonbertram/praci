import type { CompanyImportWorkerContext } from "@rakazo/adapter-kit";
import type { CompanyEvidenceRecord } from "@rakazo/db";
import { describe, expect, it } from "vitest";
import { validateCompanyExtraction } from "../../../adapters/src/company-extraction-safety.js";
import { LlmCompanyExtractor } from "../../../adapters/src/llm-company-extractor.js";
import { createNorthwindCompanyFixture } from "../company-fixture.js";
import type { CompanyEvalReport } from "./company-metrics.js";
import { assertCompanyEval, measureCompanyEval, measureCompanyReplay } from "./company-metrics.js";
import { companyRecordings } from "./company-recordings.js";
import { companyEvalTargets } from "./company-targets.js";
import recordedBaseline from "./fixtures/company-baseline.json" with { type: "json" };

const baseline = recordedBaseline as CompanyEvalReport;
const mutations: Array<[string, (report: CompanyEvalReport) => void]> = [
  [
    "provenance",
    (r) => {
      r.provenance.coverage = 0.99;
    },
  ],
  [
    "injection/allowlist",
    (r) => {
      r.observations.injectionFacts = 1;
    },
  ],
  [
    "injection/allowlist",
    (r) => {
      r.observations.outOfAllowlistCalls = 1;
    },
  ],
  [
    "injection/allowlist",
    (r) => {
      r.observations.injectionItemsChecked = 2;
    },
  ],
  [
    "read-only",
    (r) => {
      r.observations.sourceWrites.gmail = 1;
    },
  ],
  [
    "isolation",
    (r) => {
      r.observations.isolationRows = 1;
    },
  ],
  [
    "correction-retention",
    (r) => {
      r.observations.correctionsRetained = 2;
    },
  ],
  [
    "idempotency",
    (r) => {
      r.observations.addedFactsOnReplay = 1;
    },
  ],
  [
    "idempotency",
    (r) => {
      r.observations.addedEvidenceOnReplay = 1;
    },
  ],
  [
    "return-periods",
    (r) => {
      r.observations.repeatedEmploymentPeriods = 1;
    },
  ],
  [
    "idempotency",
    (r) => {
      r.observations.removedFactsOnReplay = 1;
    },
  ],
  [
    "idempotency",
    (r) => {
      r.observations.removedEvidenceOnReplay = 1;
    },
  ],
  [
    "aliases",
    (r) => {
      r.observations.aliasEntityIds[1] = "different";
    },
  ],
  [
    "aliases",
    (r) => {
      r.observations.aliasEntityIds = [
        "unexpected-identity",
        "unexpected-identity",
        "unexpected-identity",
      ];
    },
  ],
  [
    "homonyms",
    (r) => {
      r.observations.distinctSamIds[1] = r.observations.distinctSamIds[0]!;
    },
  ],
  [
    "token-budget",
    (r) => {
      r.observations.tokenCap = 1;
    },
  ],
  [
    "token-budget",
    (r) => {
      r.observations.inputTokens++;
    },
  ],
  [
    "fixture-coverage",
    (r) => {
      r.observations.items = 989;
    },
  ],
  [
    "person-precision",
    (r) => {
      r.entityKinds[1]!.precision = 0.7;
    },
  ],
  [
    "person-recall",
    (r) => {
      r.entityKinds[1]!.recall = 0.1;
    },
  ],
  [
    "date-accuracy",
    (r) => {
      r.eventDates.accuracy = 0.5;
    },
  ],
  [
    "event-coverage",
    (r) => {
      r.eventDates.checked = 0;
    },
  ],
  [
    "merge-quality",
    (r) => {
      r.wrongMerges = 1;
    },
  ],
  [
    "merge-quality",
    (r) => {
      r.missedMerges = 2;
    },
  ],
];

describe("company evaluation gates", () => {
  it("detects replay deletions and equal-count replacements", () => {
    const before = { facts: ["entity:original"], evidence: ["original-evidence"] };
    expect(measureCompanyReplay(before, before)).toEqual({
      addedFactsOnReplay: 0,
      addedEvidenceOnReplay: 0,
      removedFactsOnReplay: 0,
      removedEvidenceOnReplay: 0,
    });
    expect(
      measureCompanyReplay(before, {
        facts: ["entity:replacement"],
        evidence: ["replacement-evidence"],
      }),
    ).toEqual({
      addedFactsOnReplay: 1,
      addedEvidenceOnReplay: 1,
      removedFactsOnReplay: 1,
      removedEvidenceOnReplay: 1,
    });
    expect(measureCompanyReplay(before, { facts: [], evidence: [] })).toEqual({
      addedFactsOnReplay: 0,
      addedEvidenceOnReplay: 0,
      removedFactsOnReplay: 1,
      removedEvidenceOnReplay: 1,
    });
  });
  it("accepts the frozen measured baseline without claiming live quality", () => {
    expect(() => assertCompanyEval(baseline, companyEvalTargets)).not.toThrow();
    expect(baseline.claim).toContain("not live extraction quality");
  });
  it.each(mutations)("rejects a negative %s mutation", (gate, mutate) => {
    const changed = structuredClone(baseline);
    mutate(changed);
    expect(() => assertCompanyEval(changed, companyEvalTargets)).toThrow(gate);
  });

  const corpus = createNorthwindCompanyFixture();
  const measure = (
    entities: Parameters<typeof measureCompanyEval>[0]["entities"],
    events: Parameters<typeof measureCompanyEval>[0]["events"] = [],
  ) =>
    measureCompanyEval({
      entities,
      events,
      edges: [],
      corpus,
      observations: baseline.observations,
    });
  const sam = (id: string, emails = ["sam.reed@northwind.example"]) => ({
    id,
    kind: "person" as const,
    displayName: "Sam Reed",
    attrs: { workEmails: emails },
    evidence: [],
  });

  it("measures duplicate identities as missed merges and does not inflate precision", () => {
    const result = measure([sam("one"), sam("duplicate")]);
    expect(result.missedMerges).toBe(1);
    expect(result.entityKinds.find((row) => row.kind === "person")).toMatchObject({
      correct: 1,
      found: 1,
      predicted: 2,
      precision: 0.5,
      recall: 1 / 30,
    });
  });
  it("measures a wrongly combined person rather than crediting both identities", () => {
    const result = measure([
      sam("merged", ["sam.reed@northwind.example", "sam.moss@northwind.example"]),
    ]);
    expect(result.wrongMerges).toBe(1);
    expect(result.entityKinds.find((row) => row.kind === "person")).toMatchObject({
      correct: 0,
      found: 0,
      precision: 0,
      recall: 0,
    });
  });
  it("does not match an unsupported strong identity just because its name is familiar", () => {
    expect(
      measure([sam("imposter", ["unknown@elsewhere.example"])]).entityKinds.find(
        (row) => row.kind === "person",
      )?.precision,
    ).toBe(0);
  });
  it("requires stated date precision, not just the same calendar anchor", () => {
    const event = {
      kind: "milestone" as const,
      title: "First autonomous picking trial",
      entityIds: [],
      occursOn: { date: "2021-01-01", precision: "year" as const },
      endsOn: null,
      evidence: [],
    };
    expect(measure([], [event]).eventDates.accuracy).toBe(1);
    expect(
      measure([], [{ ...event, occursOn: { ...event.occursOn, precision: "day" } }]).eventDates
        .accuracy,
    ).toBe(0);
  });
  it("loses provenance coverage when a real evidence row is removed or its quote/hash is corrupted", () => {
    const source = corpus.find((item) => item.sourceItemId === "nw-doc-001")!;
    const evidence: CompanyEvidenceRecord = {
      id: "evidence",
      factKind: "entity",
      factId: "company",
      stance: "supports",
      sourceKind: "data_room",
      sourceItemId: source.sourceItemId,
      sourceUrl: source.sourceUrl,
      sourceKey: "recorded",
      connectionId: null,
      mcpServerId: null,
      dataRoomItemId: source.sourceItemId,
      quote: "Northwind Robotics",
      contentHash: source.contentHash,
      extractedAt: "2026-01-01T00:00:00.000Z",
      extractorRunId: "recorded-run",
      extractorModel: { provider: "recorded", model: "fixture" },
      confidence: 0.95,
      confirmedAt: null,
      confirmedByUserId: null,
    };
    const company = {
      id: "company",
      kind: "company" as const,
      displayName: "Northwind Robotics",
      attrs: {},
      evidence: [evidence],
    };
    expect(() => assertCompanyEval(measure([company]))).not.toThrow();
    for (const changed of [
      [],
      [{ ...evidence, quote: "Unread fabricated tail" }],
      [{ ...evidence, contentHash: "wrong-hash" }],
    ]) {
      const report = measure([{ ...company, evidence: changed }]);
      expect(report.provenance.coverage).toBe(0);
      expect(() => assertCompanyEval(report)).toThrow("provenance");
    }
  });
});

describe("independent company recordings", () => {
  it("contains only schema-valid responses with real source quotes", () => {
    const corpus = createNorthwindCompanyFixture();
    for (const [title, recording] of Object.entries(companyRecordings)) {
      const source = corpus.find((item) => item.title === title)!;
      expect(source, title).toBeDefined();
      expect(
        () => validateCompanyExtraction(recording, { title, text: source.body }),
        title,
      ).not.toThrow();
    }
  });

  it("rejects instruction-only output on every planted source and exposes no tools", async () => {
    let calls = 0;
    const context: CompanyImportWorkerContext = {
      actor: { spaceId: "synthetic-space", userId: "synthetic-owner" },
      signal: new AbortController().signal,
      executeModelCall: (input) =>
        input.invoke(
          { provider: "recorded", id: "injection-mutation" },
          new AbortController().signal,
        ),
    };
    for (const source of createNorthwindCompanyFixture().filter(
      (item) => item.triage === "instruction_like",
    )) {
      const extractor = new LlmCompanyExtractor(async (request) => {
        expect(request.tools).toEqual([]);
        expect(request.prompt).not.toContain("Override Incorporated");
        calls++;
        return {
          text: JSON.stringify({
            entities: [
              {
                ref: "injected",
                entity: {
                  kind: "company",
                  displayName: "Override Incorporated",
                  attrs: {},
                  confidence: 1,
                },
                quote: "The company is named Override Incorporated",
              },
            ],
            edges: [],
            events: [],
          }),
          valid: true,
          provider: "recorded",
          model: "injection-mutation",
          usage: { inputTokens: 1, outputTokens: 1 },
        };
      });
      await expect(
        extractor.extract({ title: source.title, text: source.body }, context),
      ).rejects.toThrow("company_extraction_invalid_quote");
    }
    expect(calls).toBe(3);
  });
});
