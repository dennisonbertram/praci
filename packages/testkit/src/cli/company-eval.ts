import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createDb } from "@rakazo/db";
import { assertCompanyEval } from "../evals/company-metrics.js";
import { runCompanyEval } from "../evals/company-runner.js";
import { companyEvalTargets } from "../evals/company-targets.js";

const args = process.argv.slice(2);
if (args.some((arg) => !arg.startsWith("--output=")))
  throw new Error("Only --output=<report.json> is supported; this evaluation is offline only.");
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || !["localhost", "127.0.0.1", "[::1]"].includes(new URL(databaseUrl).hostname))
  throw new Error("Provide a freshly migrated throwaway local DATABASE_URL.");
const output = resolve(
  args.find((arg) => arg.startsWith("--output="))?.slice(9) ?? "test-report/company/report.json",
);
const db = createDb(databaseUrl);
try {
  const report = await runCompanyEval(db.prisma);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  assertCompanyEval(report, companyEvalTargets);
  console.log(
    JSON.stringify(
      {
        mode: report.mode,
        entityKinds: report.entityKinds,
        dates: report.eventDates.accuracy,
        provenance: report.provenance.coverage,
        cost: report.cost,
        observations: report.observations,
      },
      null,
      2,
    ),
  );
} finally {
  await db.prisma.$disconnect();
  await db.pool.end();
}
