import type { EquityRoundModel } from "@rakazo/contracts";
import { EquityRoundModelInputSchema, EquityRoundModelSchema } from "@rakazo/contracts";
import type { RoundModelConvertible, RoundModelResult } from "@rakazo/core/equity";
import {
  accruedInterestCents,
  formatFixed,
  modelPricedRound,
  parseFixed,
} from "@rakazo/core/equity";
import type { EquityDb, EquityScope } from "./ledger.js";
import {
  assertPostgresBigInt,
  EquityInputError,
  fromBig,
  fromDate,
  scopeOf,
  toBig,
  today,
} from "./ledger.js";
import { equityCapTableByStakeholder } from "./views-by-stakeholder.js";
import { getEquityRoundScenario } from "./views-scenarios.js";

/**
 * Models a priced round from the ledger: existing holders, the unallocated pool, the outstanding
 * SAFEs and notes and the new money. A scenario only supplies terms; nothing here writes the ledger.
 */

type DayCount = "actual_365" | "actual_360" | "30_360";

export async function equityModelRound(
  prisma: EquityDb,
  actor: EquityScope,
  rawInput: unknown,
): Promise<EquityRoundModel> {
  const parsed = EquityRoundModelInputSchema.parse(rawInput);
  const scope = scopeOf(actor);
  const terms =
    "scenarioId" in parsed
      ? await getEquityRoundScenario(prisma, scope, parsed.scenarioId)
      : { ...parsed, name: "" };
  const asOf = today();

  const [capTable, convertibles] = await Promise.all([
    equityCapTableByStakeholder(prisma, scope, { asOf }),
    prisma.equityConvertible.findMany({
      where: { ...scope, status: "outstanding" },
      include: { stakeholder: { select: { name: true } } },
      orderBy: [{ issueDate: "asc" }, { label: "asc" }],
    }),
  ]);

  const wanted = terms.convertibleIds ?? null;
  if (wanted) {
    const known = new Set(convertibles.map((row) => row.id));
    for (const id of wanted)
      if (!known.has(id)) throw new EquityInputError("Convertible not outstanding in this ledger");
  }

  const rows: RoundModelConvertible[] = convertibles
    .filter((row) => (wanted ? wanted.includes(row.id) : true))
    .map((row) => {
      if (row.valuationCapCents !== null && row.valuationCapType === null)
        throw new EquityInputError(
          `${row.label} has a valuation cap but no cap type; set it first`,
        );
      const ratePercent = row.interestRate ? parseFixed(row.interestRate.toFixed(10)) : null;
      const startDate = row.interestStartDate ? fromDate(row.interestStartDate) : null;
      const interestCents =
        ratePercent != null && startDate != null && row.kind === "note"
          ? accruedInterestCents({
              principalCents: row.principalCents,
              ratePercent,
              startDate,
              asOf,
              interestType: row.interestType === "compound" ? "compound" : "simple",
              dayCount: (row.dayCountConvention ?? "actual_365") as DayCount,
            })
          : null;
      if (interestCents !== null) assertPostgresBigInt(interestCents);
      return {
        id: row.id,
        stakeholderId: row.stakeholderId,
        name: row.stakeholder.name,
        kind: row.kind === "note" ? "note" : "safe",
        principalCents: row.principalCents,
        interestCents,
        valuationCapCents: row.valuationCapCents ?? null,
        discountPercent: row.discountPercent ? parseFixed(row.discountPercent.toFixed(10)) : null,
        preMoney: row.valuationCapType == null ? undefined : row.valuationCapType === "pre_money",
        ratePercent,
        startDate: startDate ?? undefined,
        conversionDate: asOf,
        interestType: row.interestType === "compound" ? "compound" : "simple",
        dayCount: (row.dayCountConvention ?? "actual_365") as DayCount,
      } satisfies RoundModelConvertible;
    });

  let model: RoundModelResult;
  try {
    model = modelPricedRound({
      holders: capTable.rows
        .map((row) => ({
          id: row.stakeholderId,
          name: row.name,
          shares: toBig(row.fullyDilutedShares),
        }))
        .filter((holder) => holder.shares > 0n),
      unallocatedPoolShares: toBig(capTable.unallocatedPoolShares),
      preMoneyValuationCents: toBig(terms.preMoneyValuationCents),
      investments: terms.investments.map((investment, index) => ({
        id: `investment-${index}`,
        name: investment.name,
        amountCents: toBig(investment.amountCents),
      })),
      convertibles: rows,
      targetPoolPercentPostMoney: terms.targetPoolPercent
        ? parseFixed(terms.targetPoolPercent)
        : null,
    });
  } catch (error) {
    if (error instanceof RangeError) throw new EquityInputError(error.message);
    throw error;
  }

  return EquityRoundModelSchema.parse({
    asOf,
    pricePerShare: formatFixed(model.pricePerShare, 10),
    preMoneyFullyDilutedShares: fromBig(model.preMoneyFullyDilutedShares),
    poolIncreaseShares: fromBig(model.poolIncreaseShares),
    newMoneyShares: fromBig(model.newMoneyShares),
    conversionShares: fromBig(model.conversionShares),
    postMoneyFullyDilutedShares: fromBig(model.postMoneyFullyDilutedShares),
    postMoneyValuationCents: fromBig(model.postMoneyValuationCents),
    rows: model.rows.map((row) => ({
      id: row.id,
      name: row.name,
      kind: row.kind,
      preShares: fromBig(row.preShares),
      postShares: fromBig(row.postShares),
      prePercent: row.prePercent,
      postPercent: row.postPercent,
    })),
  });
}
