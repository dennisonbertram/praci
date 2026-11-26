import type { EquityEstimatedValueSettings } from "@rakazo/contracts";
import { EquityEstimatedValueSettingsInputSchema } from "@rakazo/contracts";
import { recordEquityAudit } from "./audit.js";
import type { EquityDb, EquityScope } from "./ledger.js";
import {
  EquityInputError,
  ensureLedger,
  fromDateOrNull,
  fromDecimalOrNull,
  inTransaction,
  iso,
  scopeOf,
  toDateOrNull,
  toDecimalOrNull,
} from "./ledger.js";

type Row = {
  estimatedValueVisibility: string;
  pricePerShare: Parameters<typeof fromDecimalOrNull>[0];
  effectiveDate: Date | null;
  updatedAt: Date;
};

function toSettings(row: Row | null): EquityEstimatedValueSettings {
  if (!row)
    return { visibility: "hidden", pricePerShare: null, effectiveDate: null, updatedAt: null };
  return {
    visibility: row.estimatedValueVisibility === "holders" ? "holders" : "hidden",
    pricePerShare: fromDecimalOrNull(row.pricePerShare),
    effectiveDate: fromDateOrNull(row.effectiveDate),
    updatedAt: iso(row.updatedAt),
  };
}

const settingsFields = (s: EquityEstimatedValueSettings) => ({
  visibility: s.visibility,
  pricePerShare: s.pricePerShare,
  effectiveDate: s.effectiveDate,
});

/** Whether holders see an estimated value, and the price per share it uses. */
export async function getEquityEstimatedValue(
  prisma: EquityDb,
  actor: EquityScope,
): Promise<EquityEstimatedValueSettings> {
  const row = await prisma.equityViewsSettings.findUnique({
    where: { spaceId_userId: scopeOf(actor) },
  });
  return toSettings(row);
}

export async function setEquityEstimatedValue(
  prisma: EquityDb,
  actor: EquityScope,
  rawInput: unknown,
): Promise<EquityEstimatedValueSettings> {
  const input = EquityEstimatedValueSettingsInputSchema.parse(rawInput);
  if (input.pricePerShare !== null && input.effectiveDate === null)
    throw new EquityInputError("A price per share needs an effective date");
  const scope = scopeOf(actor);
  const data = {
    estimatedValueVisibility: input.visibility,
    pricePerShare: toDecimalOrNull(input.pricePerShare),
    effectiveDate: toDateOrNull(input.effectiveDate),
  };
  const row = await inTransaction(prisma, async (tx) => {
    await ensureLedger(tx, scope);
    const previous = await tx.equityViewsSettings.findUnique({ where: { spaceId_userId: scope } });
    const saved = await tx.equityViewsSettings.upsert({
      where: { spaceId_userId: scope },
      create: { ...scope, ...data },
      update: data,
    });
    const beforeFields = previous ? settingsFields(toSettings(previous)) : null;
    const afterFields = settingsFields(toSettings(saved));
    if (JSON.stringify(beforeFields) !== JSON.stringify(afterFields))
      await recordEquityAudit(tx, actor, {
        kind: "estimated_value.set",
        subjectType: "views_settings",
        subjectId: scope.spaceId,
        before: beforeFields,
        after: afterFields,
      });
    return saved;
  });
  return toSettings(row);
}
