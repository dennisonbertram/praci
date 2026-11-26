// Pro forma model of a new priced round. Execution and scenario modeling share the exact-rational
// price and conversion kernel; only the scenario layer solves for a requested option-pool target.

import type { Compounding, DayCount, InterestType } from "./convertibles.js";
import { accruedInterestCents } from "./convertibles.js";
import type { Fixed } from "./fixed.js";
import { divRoundHalfUp, formatFixed, percentOf, SCALE } from "./fixed.js";
import type { RoundPricingConvertible } from "./priced-round.js";
import { priceRoundKernel } from "./priced-round.js";

/** Current fully diluted holding of one stakeholder, with option grants already counted. */
export type RoundModelHolder = { id: string; name: string; shares: bigint };

/** One SAFE or note converting in the round. `preMoney` is required when there is a cap. */
export type RoundModelConvertible = {
  id: string;
  stakeholderId: string;
  name: string;
  kind: "safe" | "note";
  principalCents: bigint;
  interestCents?: bigint | null;
  valuationCapCents?: bigint | null;
  discountPercent?: Fixed | null;
  preMoney?: boolean;
  ratePercent?: Fixed | null;
  startDate?: string;
  conversionDate?: string;
  interestType?: InterestType;
  dayCount?: DayCount;
  compounding?: Compounding;
};

export type RoundModelInput = {
  holders: RoundModelHolder[];
  unallocatedPoolShares: bigint;
  preMoneyValuationCents: bigint;
  investments: { id: string; name: string; amountCents: bigint }[];
  convertibles: RoundModelConvertible[];
  /** Target option pool as a percent of post-money fully diluted, e.g. 10% for a 10% pool. */
  targetPoolPercentPostMoney?: Fixed | null;
};

export type RoundModelRow = {
  id: string;
  name: string;
  kind: "existing" | "new_money" | "conversion" | "pool";
  preShares: bigint;
  postShares: bigint;
  prePercent: string;
  postPercent: string;
};

export type RoundModelResult = {
  pricePerShare: Fixed;
  preMoneyFullyDilutedShares: bigint;
  poolIncreaseShares: bigint;
  newMoneyShares: bigint;
  conversionShares: bigint;
  postMoneyFullyDilutedShares: bigint;
  postMoneyValuationCents: bigint;
  rows: RoundModelRow[];
};

const POOL_ROW_ID = "__pool";
const POOL_ROW_NAME = "Unallocated pool";
const MAX_POOL_ITERATIONS = 2048;

function capTypeOf(convertible: RoundModelConvertible): "pre_money" | "post_money" {
  if (convertible.preMoney == null && (convertible.valuationCapCents ?? 0n) > 0n) {
    throw new RangeError(`convertible ${convertible.id} has a valuation cap but no cap type`);
  }
  return convertible.preMoney === false ? "post_money" : "pre_money";
}

export function modelPricedRound(input: RoundModelInput): RoundModelResult {
  if (input.preMoneyValuationCents <= 0n) {
    throw new RangeError("preMoneyValuationCents must be positive");
  }
  if (input.unallocatedPoolShares < 0n) {
    throw new RangeError("unallocatedPoolShares must not be negative");
  }
  for (const holder of input.holders) {
    if (holder.shares < 0n) throw new RangeError("holder shares must not be negative");
  }
  for (const investment of input.investments) {
    if (investment.amountCents < 0n) {
      throw new RangeError("investment amountCents must not be negative");
    }
  }

  const existingShares = input.holders.reduce((sum, holder) => sum + holder.shares, 0n);
  const equityBase = existingShares + input.unallocatedPoolShares;
  if (equityBase <= 0n) throw new RangeError("the cap table has no shares to price");

  const targetPool = input.targetPoolPercentPostMoney ?? null;
  if (targetPool != null && (targetPool < 0n || targetPool >= 100n * SCALE)) {
    throw new RangeError("targetPoolPercentPostMoney must be in [0, 100)");
  }
  if (targetPool === 0n && input.unallocatedPoolShares > 0n) {
    throw new RangeError("a zero target pool cannot include existing unallocated shares");
  }

  const pricingConvertibles: RoundPricingConvertible[] = input.convertibles.map((convertible) => {
    let amountCents = convertible.principalCents;
    if (convertible.kind === "note") {
      const interestCents =
        convertible.interestCents ??
        (convertible.ratePercent != null &&
        convertible.startDate != null &&
        convertible.conversionDate != null
          ? accruedInterestCents({
              principalCents: convertible.principalCents,
              ratePercent: convertible.ratePercent,
              startDate: convertible.startDate,
              asOf: convertible.conversionDate,
              interestType: convertible.interestType ?? "simple",
              dayCount: convertible.dayCount ?? "actual_365",
              compounding: convertible.compounding,
            })
          : 0n);
      amountCents += interestCents;
    }
    return {
      id: convertible.id,
      amountCents,
      valuationCapCents: convertible.valuationCapCents ?? null,
      capType: capTypeOf(convertible),
      discountPercent: convertible.discountPercent ?? null,
    };
  });

  const investmentAmountsCents = input.investments.map((investment) => investment.amountCents);
  const priceAtPool = (poolTopUpShares: bigint) =>
    priceRoundKernel({
      preMoneyValuationCents: input.preMoneyValuationCents,
      baseShares: equityBase,
      poolTopUpShares,
      investmentAmountsCents,
      convertibles: pricingConvertibles,
    });

  let poolIncreaseShares = 0n;
  let priced = priceAtPool(0n);
  if (targetPool != null && targetPool > 0n) {
    let converged = false;
    for (let iteration = 0; iteration < MAX_POOL_ITERATIONS; iteration += 1) {
      try {
        priced = priceAtPool(poolIncreaseShares);
      } catch (error) {
        if (error instanceof RangeError && error.message.includes("round price")) {
          throw new RangeError("target pool is infeasible or did not converge");
        }
        throw error;
      }
      const postShares =
        equityBase + poolIncreaseShares + priced.totalNewMoneyShares + priced.totalConvertedShares;
      const targetShares = divRoundHalfUp(targetPool * postShares, 100n * SCALE);
      const nextIncrease = targetShares - input.unallocatedPoolShares;
      const nextPoolIncrease = nextIncrease > 0n ? nextIncrease : 0n;
      if (nextPoolIncrease === poolIncreaseShares) {
        if (input.unallocatedPoolShares * 100n * SCALE > targetPool * postShares) {
          throw new RangeError("target pool is below the existing unallocated pool");
        }
        converged = true;
        break;
      }
      poolIncreaseShares = nextPoolIncrease;
    }
    if (!converged) {
      throw new RangeError("target pool is infeasible or did not converge");
    }
  }

  priced = priceAtPool(poolIncreaseShares);
  const pricePerShare = priced.pricePerShare;
  const newMoneyShares = priced.totalNewMoneyShares;
  const conversionShares = priced.totalConvertedShares;
  const preMoneyFullyDilutedShares = equityBase + poolIncreaseShares + conversionShares;
  const postMoneyFullyDilutedShares =
    equityBase + poolIncreaseShares + newMoneyShares + conversionShares;
  if (
    targetPool != null &&
    percentOf(input.unallocatedPoolShares + poolIncreaseShares, postMoneyFullyDilutedShares) !==
      formatFixed(targetPool, 4)
  ) {
    throw new RangeError("target pool could not be satisfied at share precision");
  }
  const converted = input.convertibles.map((convertible, index) => ({
    convertible,
    shares: priced.convertibles[index]!.shares,
  }));

  const existingRows: RoundModelRow[] = input.holders.map((holder) => ({
    id: holder.id,
    name: holder.name,
    kind: "existing",
    preShares: holder.shares,
    postShares: holder.shares,
    prePercent: percentOf(holder.shares, preMoneyFullyDilutedShares),
    postPercent: percentOf(holder.shares, postMoneyFullyDilutedShares),
  }));
  // The pool is pre-money money already set aside plus the shuffle, and it never shrinks.
  const poolShares = input.unallocatedPoolShares + poolIncreaseShares;
  const poolRow: RoundModelRow = {
    id: POOL_ROW_ID,
    name: POOL_ROW_NAME,
    kind: "pool",
    preShares: poolShares,
    postShares: poolShares,
    prePercent: percentOf(poolShares, preMoneyFullyDilutedShares),
    postPercent: percentOf(poolShares, postMoneyFullyDilutedShares),
  };
  // Converted shares are part of the pre-money fully diluted count, so they set the round price.
  const conversionRows: RoundModelRow[] = converted.map(({ convertible, shares }) => ({
    id: convertible.id,
    name: convertible.name,
    kind: "conversion",
    preShares: shares,
    postShares: shares,
    prePercent: percentOf(shares, preMoneyFullyDilutedShares),
    postPercent: percentOf(shares, postMoneyFullyDilutedShares),
  }));
  const newMoneyRows: RoundModelRow[] = input.investments.map((investment, index) => {
    const shares = priced.newMoneyShares[index]!;
    return {
      id: investment.id,
      name: investment.name,
      kind: "new_money",
      preShares: 0n,
      postShares: shares,
      prePercent: percentOf(0n, preMoneyFullyDilutedShares),
      postPercent: percentOf(shares, postMoneyFullyDilutedShares),
    };
  });

  const postMoneyValuationCents = input.investments.reduce(
    (sum, investment) => sum + investment.amountCents,
    input.preMoneyValuationCents,
  );

  return {
    pricePerShare,
    preMoneyFullyDilutedShares,
    poolIncreaseShares,
    newMoneyShares,
    conversionShares,
    postMoneyFullyDilutedShares,
    postMoneyValuationCents,
    rows: [...existingRows, poolRow, ...conversionRows, ...newMoneyRows],
  };
}
