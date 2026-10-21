import type { CompanyEvalTargets } from "./company-metrics.js";

// Frozen from the first offline run. These are recorded-regression floors, not live quality targets.
export const companyEvalTargets: CompanyEvalTargets = {
  precision: { company: 1, person: 4 / 5, organisation: 1, matter: 1, product: 1, project: 1 },
  recall: {
    company: 1,
    person: 4 / 30,
    organisation: 5 / 11,
    matter: 1 / 2,
    product: 1 / 3,
    project: 1 / 3,
  },
  dateAccuracy: 7 / 8,
  eventCount: 8,
  eventSubjectMatches: 4,
  wrongMerges: 0,
  missedMerges: 1,
};
