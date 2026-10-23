import { createDb } from "@rakazo/db";
import { describe, expect, it } from "vitest";
import { assertCompanyEval } from "./evals/company-metrics.js";
import { runCompanyEval } from "./evals/company-runner.js";
import { companyEvalTargets } from "./evals/company-targets.js";
import recordedBaseline from "./evals/fixtures/company-baseline.json" with { type: "json" };

const databaseUrl = process.env.DATABASE_URL;
const postgres = process.env.VERIFY_DATABASE && databaseUrl ? describe : describe.skip;

postgres("independently grounded offline company evaluation", () => {
  it("runs the durable pipeline and enforces safety, isolation and owner retention", async () => {
    const db = createDb(databaseUrl!);
    try {
      const report = await runCompanyEval(db.prisma);
      expect(() => assertCompanyEval(report, companyEvalTargets)).not.toThrow();
      expect(report.observations.items).toBe(990);
      expect(report).toEqual(recordedBaseline);
    } finally {
      await db.prisma.$disconnect();
      await db.pool.end();
    }
  }, 240_000);
});
