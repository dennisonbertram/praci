import { createHash } from "node:crypto";
import { EquityHealthRunInputSchema } from "@rakazo/contracts";
import { runHealthChecks } from "@rakazo/core/equity";
import type { Prisma } from "../client.js";
import type { EquityDb, EquityScope } from "./ledger.js";
import { ensureLedger, inTransaction, scopeOf, today } from "./ledger.js";
import { loadLedger } from "./overview.js";

/** The same offending records give the same fingerprint, so a dismissed finding stays dismissed. */
const fingerprintOf = (check: string, ids: string[]) =>
  createHash("sha256")
    .update(`${check}:${[...ids].sort().join(",")}`)
    .digest("hex");

/**
 * Runs every health check on the caller's ledger, records each finding (rerunning updates the
 * same one), and resolves open findings that no longer apply. Read through equity.healthFindings.
 */
export async function runEquityHealthChecks(
  prisma: EquityDb,
  actor: EquityScope,
  rawInput: unknown = {},
) {
  const { check } = EquityHealthRunInputSchema.parse(rawInput);
  const scope = scopeOf(actor);
  const [{ input, stakeholders }, certificateLabels, grantLabels] = await Promise.all([
    loadLedger(prisma, scope, today()),
    prisma.equityCertificate.findMany({ where: scope, select: { id: true, label: true } }),
    prisma.equityOptionGrant.findMany({ where: scope, select: { id: true, label: true } }),
  ]);
  const all = runHealthChecks({
    ...input,
    labels: Object.fromEntries(
      [...certificateLabels, ...grantLabels].map((row) => [row.id, row.label]),
    ),
    stakeholders: stakeholders.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.contactEmail ?? row.portfolioEmail ?? null,
    })),
  });
  // One check reruns only its own findings; the others stay as they are.
  const findings = check ? all.filter((finding) => finding.check === check) : all;
  return inTransaction(prisma, async (tx) => {
    await ensureLedger(tx, scope);
    const keep = new Set<string>();
    for (const finding of findings) {
      const fingerprint = fingerprintOf(
        finding.check,
        finding.rows.map((row) => row.recordId),
      );
      keep.add(`${finding.check}|${fingerprint}`);
      const data = {
        tag: finding.tag,
        severity: finding.severity,
        rows: finding.rows as Prisma.InputJsonArray,
      };
      const existing = await tx.equityHealthFinding.findUnique({
        where: {
          spaceId_userId_check_fingerprint: { ...scope, check: finding.check, fingerprint },
        },
      });
      if (existing)
        await tx.equityHealthFinding.update({
          where: { id: existing.id },
          data: { ...data, ...(existing.status === "resolved" ? { status: "open" } : {}) },
        });
      else
        await tx.equityHealthFinding.create({
          data: { ...scope, ...data, check: finding.check, fingerprint },
        });
    }
    const stale = (
      await tx.equityHealthFinding.findMany({
        where: { ...scope, status: "open", ...(check ? { check } : {}) },
        select: { id: true, check: true, fingerprint: true },
      })
    ).filter((row) => !keep.has(`${row.check}|${row.fingerprint}`));
    if (stale.length)
      await tx.equityHealthFinding.updateMany({
        where: { ...scope, id: { in: stale.map((row) => row.id) } },
        data: { status: "resolved" },
      });
    const open = await tx.equityHealthFinding.count({ where: { ...scope, status: "open" } });
    return { ranAt: new Date().toISOString(), open, resolved: stale.length };
  });
}
