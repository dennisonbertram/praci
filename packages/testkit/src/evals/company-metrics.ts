import type { CompanyEdgeRecord, CompanyEntityRecord, CompanyEventRecord } from "@rakazo/db";
import type { CompanyFixtureItem } from "../company-fixture.js";
import { northwindGroundTruth } from "../company-fixture.js";

const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
const choose2 = (n: number) => (n * (n - 1)) / 2;
const ratio = (n: number, d: number) => (d === 0 ? null : n / d);

export interface CompanyEvalObservations {
  injectionItemsChecked: number;
  injectionFacts: number;
  outOfAllowlistCalls: number;
  sourceWrites: Record<string, number>;
  isolationRows: number;
  correctionsChecked: number;
  correctionsRetained: number;
  addedFactsOnReplay: number;
  addedEvidenceOnReplay: number;
  addedModelCallsOnReplay: number;
  repeatedEmploymentPeriods: number;
  aliasEntityIds: string[];
  distinctSamIds: string[];
  tokenCap: number;
  usedTokens: number;
  inputTokens: number;
  outputTokens: number;
  reservedTokens: number;
  relevanceCalls: number;
  extractionCalls: number;
  items: number;
}

export function measureCompanyEval(input: {
  entities: Pick<CompanyEntityRecord, "id" | "kind" | "displayName" | "attrs" | "evidence">[];
  edges: Pick<CompanyEdgeRecord, "evidence">[];
  events: Pick<
    CompanyEventRecord,
    "kind" | "title" | "entityIds" | "occursOn" | "endsOn" | "evidence"
  >[];
  corpus: CompanyFixtureItem[];
  observations: CompanyEvalObservations;
}) {
  const { entities, edges, events, observations } = input;
  const identities = (row: { kind: string; attrs: unknown }) => {
    const attrs = row.attrs as { workEmails?: string[]; domain?: string };
    return row.kind === "person"
      ? (attrs.workEmails?.map(normalize) ?? [])
      : attrs.domain
        ? [normalize(attrs.domain)]
        : [];
  };
  const matches = (
    actual: (typeof entities)[number],
    expected: (typeof northwindGroundTruth.entities)[number],
  ) => {
    if (actual.kind !== expected.input.kind) return false;
    const strong = identities(actual),
      oracle = identities(expected.input);
    return strong.length && oracle.length
      ? strong.some((key) => oracle.includes(key))
      : normalize(actual.displayName) === normalize(expected.input.displayName);
  };
  const truthFor = new Map(
    entities.map((entity) => [
      entity.id,
      northwindGroundTruth.entities
        .filter((truth) => matches(entity, truth))
        .map((truth) => truth.id),
    ]),
  );
  const entityKinds = ["company", "person", "organisation", "matter", "product", "project"].map(
    (kind) => {
      const predicted = entities.filter((entity) => entity.kind === kind);
      const truth = northwindGroundTruth.entities.filter((entity) => entity.input.kind === kind);
      const credited = new Set(
        predicted.flatMap((entity) =>
          truthFor.get(entity.id)?.length === 1 ? truthFor.get(entity.id)! : [],
        ),
      );
      const correct = credited.size;
      const found = correct;
      return {
        kind,
        predicted: predicted.length,
        expected: truth.length,
        correct,
        found,
        precision: ratio(correct, predicted.length),
        recall: ratio(found, truth.length),
      };
    },
  );
  const wrongMerges = [...truthFor.values()].reduce((sum, ids) => sum + choose2(ids.length), 0);
  const missedMerges = northwindGroundTruth.entities.reduce(
    (sum, truth) => sum + choose2(entities.filter((actual) => matches(actual, truth)).length),
    0,
  );
  const eventDateChecks = events.map((actual) => {
    const expected = northwindGroundTruth.events.filter(
      (truth) =>
        truth.input.kind === actual.kind &&
        normalize(truth.input.title) === normalize(actual.title),
    );
    return {
      title: actual.title,
      kind: actual.kind,
      occursOn: actual.occursOn,
      correct: expected.some(
        (truth) =>
          JSON.stringify(truth.input.occursOn ?? null) ===
            JSON.stringify(actual.occursOn ?? null) &&
          JSON.stringify(truth.input.endsOn ?? null) === JSON.stringify(actual.endsOn ?? null),
      ),
    };
  });
  const sources = new Map(
    input.corpus.map((item) => [`${item.sourceKind}:${item.sourceItemId}`, item]),
  );
  const facts = [...entities, ...edges, ...events];
  const supported = facts.filter((fact) =>
    fact.evidence.some((evidence) => {
      const source = sources.get(`${evidence.sourceKind}:${evidence.sourceItemId}`);
      return (
        source &&
        evidence.contentHash === source.contentHash &&
        !!evidence.quote &&
        `${source.title}\n${source.body}`.includes(evidence.quote) &&
        !!evidence.extractorRunId &&
        !!evidence.extractorModel &&
        !!evidence.extractedAt
      );
    }),
  ).length;
  const eventTruthKeys = (event: (typeof events)[number]) =>
    event.entityIds.flatMap((id) => truthFor.get(id) ?? []).sort();
  const correctLinks = events.filter((actual) =>
    northwindGroundTruth.events.some(
      (truth) =>
        truth.input.kind === actual.kind &&
        normalize(truth.input.title) === normalize(actual.title) &&
        JSON.stringify([...truth.input.entityIds].sort()) ===
          JSON.stringify(eventTruthKeys(actual)),
    ),
  ).length;
  return {
    schemaVersion: 1,
    mode: "offline-recorded" as const,
    claim:
      "Synthetic recorded-output plumbing and regression measurements; not live extraction quality or real provider token measurements.",
    entityKinds,
    wrongMerges,
    missedMerges,
    eventDates: {
      correct: eventDateChecks.filter((item) => item.correct).length,
      checked: eventDateChecks.length,
      accuracy: ratio(
        eventDateChecks.filter((item) => item.correct).length,
        eventDateChecks.length,
      ),
      checks: eventDateChecks,
    },
    eventSubjectLinks: { correct: correctLinks, checked: events.length },
    provenance: { supported, facts: facts.length, coverage: ratio(supported, facts.length) },
    observations,
    cost: {
      usageKind:
        "recorded synthetic usage settled by the durable engine; not a live tokenizer/provider measurement",
      relevance: {
        calls: observations.relevanceCalls,
        estimatedInput: observations.relevanceCalls * 150,
        estimatedOutput: observations.relevanceCalls * 10,
      },
      extraction: {
        calls: observations.extractionCalls,
        estimatedInput: observations.extractionCalls * 2500,
        estimatedOutput: observations.extractionCalls * 400,
      },
      recordedTokens: observations.usedTokens,
      recordedInputTokens: observations.inputTokens,
      recordedOutputTokens: observations.outputTokens,
      recordedTokensPerItem: ratio(observations.usedTokens, observations.items),
      estimatedTokens: observations.relevanceCalls * 160 + observations.extractionCalls * 2900,
    },
    limitations: [
      "Hand-authored recordings cover a deliberately small subset; all other relevance decisions are recorded false, not inferred quality.",
      "Recorded source readers span all five fixture kinds; production Data room/Gmail adapters have separate integration tests. Future Slack/tracker integrations are not claimed.",
      "Entity identity precision/recall is not full attribute accuracy. Date accuracy compares date plus precision and end date independently of subject-link coverage, which is separately reported.",
      "The draft/final date contradiction remains visible. The weak return mention stays separate (one missed merge); the two-period control uses an identity explicitly supplied by the test owner, not automatic resolution.",
      "Unsupported email-label grammar and preview screening can omit facts. No unread-tail, live recall, live-model cost or provider quality claim.",
      "Fact-bearing unchanged items reuse evidence; items without evidence may be reclassified. Replay model calls are reported separately from fact/evidence idempotency.",
    ],
  };
}

export type CompanyEvalReport = ReturnType<typeof measureCompanyEval>;
export interface CompanyEvalTargets {
  recall: Record<string, number>;
  precision: Record<string, number>;
  dateAccuracy: number;
  eventCount: number;
  eventSubjectMatches: number;
  wrongMerges: number;
  missedMerges: number;
}

export function assertCompanyEval(report: CompanyEvalReport, targets?: CompanyEvalTargets) {
  const failures: string[] = [];
  const check = (ok: boolean, name: string) => {
    if (!ok) failures.push(name);
  };
  const o = report.observations;
  check(report.provenance.facts > 0 && report.provenance.coverage === 1, "provenance");
  check(
    o.injectionItemsChecked === 3 && o.injectionFacts === 0 && o.outOfAllowlistCalls === 0,
    "injection/allowlist",
  );
  check(
    Object.keys(o.sourceWrites).length === 5 &&
      ["data_room", "gmail", "slack", "github", "linear"].every(
        (kind) => o.sourceWrites[kind] === 0,
      ),
    "read-only",
  );
  check(o.isolationRows === 0, "isolation");
  check(o.correctionsChecked === 3 && o.correctionsRetained === 3, "correction-retention");
  check(o.addedFactsOnReplay === 0 && o.addedEvidenceOnReplay === 0, "idempotency");
  check(o.repeatedEmploymentPeriods === 2, "return-periods");
  check(
    o.aliasEntityIds.length === 3 && o.aliasEntityIds.every((id) => id === "sam-reed"),
    "aliases",
  );
  check(o.distinctSamIds.length === 2 && new Set(o.distinctSamIds).size === 2, "homonyms");
  check(
    o.usedTokens > 0 &&
      o.reservedTokens === 0 &&
      o.usedTokens <= o.tokenCap &&
      o.inputTokens + o.outputTokens === o.usedTokens,
    "token-budget",
  );
  check(o.items === 990 && o.relevanceCalls > 0 && o.extractionCalls > 0, "fixture-coverage");
  if (targets) {
    check(
      report.entityKinds.length === 6 &&
        Object.keys(targets.precision).every((kind) =>
          report.entityKinds.some((row) => row.kind === kind),
        ),
      "entity-kind-coverage",
    );
    for (const kind of report.entityKinds) {
      check(
        kind.precision !== null && kind.precision >= targets.precision[kind.kind]!,
        `${kind.kind}-precision`,
      );
      check(
        kind.recall !== null && kind.recall >= targets.recall[kind.kind]!,
        `${kind.kind}-recall`,
      );
    }
    check(
      report.eventDates.accuracy !== null && report.eventDates.accuracy >= targets.dateAccuracy,
      "date-accuracy",
    );
    check(
      report.eventDates.checked >= targets.eventCount &&
        report.eventSubjectLinks.correct >= targets.eventSubjectMatches,
      "event-coverage",
    );
    check(
      report.wrongMerges <= targets.wrongMerges && report.missedMerges <= targets.missedMerges,
      "merge-quality",
    );
  }
  if (failures.length) throw new Error(`company_eval_failed:${failures.join(",")}`);
}
