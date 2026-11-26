// Priced-round execution and scenario modeling share one exact-rational price and conversion
// kernel. The round price is the pre-money valuation over the pre-money fully diluted shares: base
// shares, the pre-round pool top-up and the shares the SAFEs and notes convert into (the standard
// term-sheet treatment, so price x post-money fully diluted shares equals the post-money
// valuation). Pre-money caps exclude conversions; post-money caps include converting securities and
// exclude financing shares and pool increases. Only final share counts and display prices round.

import type {
  CapType,
  Compounding,
  ConversionMethod,
  DayCount,
  InterestType,
} from "./convertibles.js";
import { accruedInterestCents } from "./convertibles.js";
import type { Fixed } from "./fixed.js";
import { formatFixed, SCALE } from "./fixed.js";
import type { Rational } from "./round-pricing.js";
import {
  addRational,
  compareRational,
  divideRational,
  fixedFromRational,
  floorRational,
  multiplyRational,
  priceConvertible,
  rational,
  subtractRational,
} from "./round-pricing.js";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** One SAFE or note to convert in the round. A note carries its interest terms. */
export type PricedRoundConvertible =
  | {
      id: string;
      kind: "safe";
      principalCents: bigint;
      valuationCapCents: bigint | null;
      capType: CapType | null;
      discountPercent: Fixed | null;
    }
  | {
      id: string;
      kind: "note";
      principalCents: bigint;
      valuationCapCents: bigint | null;
      capType: CapType | null;
      discountPercent: Fixed | null;
      ratePercent: Fixed;
      startDate: string;
      interestType: InterestType;
      dayCount: DayCount;
      compounding?: Compounding;
    };

export type PricedRoundConversionInput = {
  preMoneyValuationCents: bigint;
  newMoneyCents: bigint;
  /** Per-investor payments; omitted to treat `newMoneyCents` as one investment. */
  investmentAmountsCents?: readonly bigint[];
  preRoundFullyDilutedShares: bigint;
  /** Shares added to the option pool before the round. */
  poolTopUpShares?: bigint;
  /** Conversion date for the notes, `YYYY-MM-DD`. */
  asOf: string;
  convertibles: readonly PricedRoundConvertible[];
};

/** One converted convertible, in the order it was given. */
export type PricedRoundConvertibleResult = {
  id: string;
  shares: bigint;
  /** Decimal dollars per share, the best of cap, discount and round. */
  conversionPrice: string;
  method: ConversionMethod;
  /** Principal for a SAFE, principal plus accrued interest for a note. */
  amountConvertedCents: bigint;
};

export type PricedRoundConversionResult = {
  /** Decimal dollars per share paid by the new money. */
  pricePerShare: string;
  newMoneyShares: bigint;
  convertibles: PricedRoundConvertibleResult[];
  postRoundFullyDilutedShares: bigint;
  totalConvertedShares: bigint;
};

export type RoundPricingConvertible = {
  id: string;
  amountCents: bigint;
  valuationCapCents: bigint | null;
  capType: CapType;
  discountPercent: Fixed | null;
};

export type RoundPricingInput = {
  preMoneyValuationCents: bigint;
  baseShares: bigint;
  poolTopUpShares: bigint;
  investmentAmountsCents: readonly bigint[];
  convertibles: readonly RoundPricingConvertible[];
};

export type RoundPricingResult = {
  pricePerShare: Fixed;
  newMoneyShares: bigint[];
  totalNewMoneyShares: bigint;
  convertibles: Array<{
    id: string;
    method: ConversionMethod;
    pricePerShare: Fixed;
    exactShares: Rational;
    shares: bigint;
  }>;
  totalConvertedShares: bigint;
};

const MAX_METHOD_ITERATIONS = 128;

/** A capped convertible must say whether its cap is pre-money or post-money; there is no default. */
function requireCapType(convertible: PricedRoundConvertible): CapType {
  if (convertible.capType != null) return convertible.capType;
  if ((convertible.valuationCapCents ?? 0n) > 0n) {
    throw new RangeError(`convertible ${convertible.id} has a valuation cap but no cap type`);
  }
  return "pre_money";
}

/** Shared exact-rational price and conversion kernel for execution and scenario modeling. */
export function priceRoundKernel(input: RoundPricingInput): RoundPricingResult {
  if (input.preMoneyValuationCents <= 0n)
    throw new RangeError("preMoneyValuationCents must be positive");
  if (input.baseShares <= 0n) throw new RangeError("baseShares must be positive");
  if (input.poolTopUpShares < 0n) throw new RangeError("poolTopUpShares must not be negative");
  for (const amount of input.investmentAmountsCents) {
    if (amount < 0n) throw new RangeError("investment amountCents must not be negative");
  }

  const priceBase = input.baseShares + input.poolTopUpShares;
  const preMoneyCapBase = rational(priceBase);
  for (const convertible of input.convertibles) {
    if (convertible.amountCents < 0n)
      throw new RangeError("convertible amountCents must not be negative");
  }

  // The round price depends on the conversion shares, which depend on the price: solve it exactly.
  const roundPriceAt = (conversionShares: Rational) =>
    divideRational(
      rational(input.preMoneyValuationCents, 100n),
      addRational(rational(priceBase), conversionShares),
    );

  const conversionsAt = (totalShares: Rational) => {
    const postMoneyCapBase = addRational(rational(input.baseShares), totalShares);
    const roundPrice = roundPriceAt(totalShares);
    return input.convertibles.map((convertible) =>
      priceConvertible({
        amountCents: convertible.amountCents,
        valuationCapCents: convertible.valuationCapCents,
        capType: convertible.capType,
        discountPercent: convertible.discountPercent,
        roundPrice,
        preMoneyCapBase,
        postMoneyCapBase,
      }),
    );
  };

  // With each convertible's method fixed, total conversion shares C solve a linear equation, with
  // S = priceBase + C: round and discount shares are k * S, a pre-money cap is a constant, and a
  // post-money cap is ownership * (baseShares + C). Methods are re-chosen until they stop changing.
  const one = rational(1n);

  let exactConversionShares = rational(0n);
  let conversions: ReturnType<typeof conversionsAt> = [];
  const visitedMethods = new Set<string>();
  let converged = false;
  for (let iteration = 0; iteration < MAX_METHOD_ITERATIONS; iteration += 1) {
    const current = conversionsAt(exactConversionShares);
    const methods = current.map(({ method }) => method).join(",");
    let priceShareRatio = rational(0n);
    let fixedShares = rational(0n);
    let postMoneyOwnership = rational(0n);
    for (let index = 0; index < current.length; index += 1) {
      const convertible = input.convertibles[index]!;
      const { method } = current[index]!;
      if (method === "cap" && convertible.capType === "post_money") {
        postMoneyOwnership = addRational(
          postMoneyOwnership,
          rational(convertible.amountCents, convertible.valuationCapCents!),
        );
      } else if (method === "cap") {
        fixedShares = addRational(fixedShares, current[index]!.exactShares);
      } else {
        const discount = method === "discount" ? convertible.discountPercent! : 0n;
        priceShareRatio = addRational(
          priceShareRatio,
          rational(
            convertible.amountCents * 100n * SCALE,
            input.preMoneyValuationCents * (100n * SCALE - discount),
          ),
        );
      }
    }
    if (compareRational(postMoneyOwnership, one) >= 0)
      throw new RangeError("post-money cap ownership must be below 100 percent");
    const room = subtractRational(subtractRational(one, postMoneyOwnership), priceShareRatio);
    if (room.numerator <= 0n)
      throw new RangeError("converting securities exceed the pre-money valuation");
    const nextShares = divideRational(
      addRational(
        addRational(multiplyRational(priceShareRatio, rational(priceBase)), fixedShares),
        multiplyRational(postMoneyOwnership, rational(input.baseShares)),
      ),
      room,
    );
    const next = conversionsAt(nextShares);
    const nextMethods = next.map(({ method }) => method).join(",");
    if (methods === nextMethods) {
      exactConversionShares = nextShares;
      conversions = next;
      converged = true;
      break;
    }
    if (visitedMethods.has(nextMethods)) break;
    visitedMethods.add(methods);
    exactConversionShares = nextShares;
  }
  if (!converged) throw new RangeError("post-money conversion pricing did not converge");

  const roundPrice = roundPriceAt(exactConversionShares);
  const roundedRoundPrice = fixedFromRational(roundPrice);
  if (roundedRoundPrice <= 0n) throw new RangeError("round price rounds down to zero");

  const exactNewMoneyShares = input.investmentAmountsCents.map((amount) =>
    rational(amount * roundPrice.denominator, 100n * roundPrice.numerator),
  );
  const newMoneyShares = exactNewMoneyShares.map(floorRational);
  const totalNewMoneyShares = newMoneyShares.reduce((sum, shares) => sum + shares, 0n);
  const pricedConvertibles = conversions.map((conversion, index) => ({
    id: input.convertibles[index]!.id,
    method: conversion.method,
    pricePerShare: conversion.pricePerShare,
    exactShares: conversion.exactShares,
    shares: conversion.shares,
  }));
  return {
    pricePerShare: roundedRoundPrice,
    newMoneyShares,
    totalNewMoneyShares,
    convertibles: pricedConvertibles,
    totalConvertedShares: pricedConvertibles.reduce((sum, item) => sum + item.shares, 0n),
  };
}

/**
 * Prices a round and converts every SAFE and note at its best price.
 *
 * The exact price is `preMoneyValuationCents / (100 * (preRoundFullyDilutedShares + poolTopUp +
 * converted shares))`, so the price times the post-money fully diluted shares is the post-money
 * valuation.
 * New-money and conversion shares are floored from that rational price; displayed prices are
 * independently rounded half-up. Post-round fully diluted shares include the pool top-up, new
 * money and conversions. By default, the aggregate new-money amount is one investment; pass
 * `investmentAmountsCents` to floor multiple investors' shares independently. A duplicate
 * convertible id is rejected.
 */
export function pricedRoundConversion(
  input: PricedRoundConversionInput,
): PricedRoundConversionResult {
  if (!DATE_PATTERN.test(input.asOf)) {
    throw new RangeError(`asOf must be YYYY-MM-DD: ${input.asOf}`);
  }
  if (input.preMoneyValuationCents <= 0n) {
    throw new RangeError("preMoneyValuationCents must be positive");
  }
  if (input.preRoundFullyDilutedShares <= 0n) {
    throw new RangeError("preRoundFullyDilutedShares must be positive");
  }
  if (input.newMoneyCents < 0n) throw new RangeError("newMoneyCents must not be negative");
  const investmentAmountsCents = input.investmentAmountsCents ?? [input.newMoneyCents];
  const investmentTotalCents = investmentAmountsCents.reduce((sum, amount) => {
    if (amount < 0n) throw new RangeError("investment amountCents must not be negative");
    return sum + amount;
  }, 0n);
  if (investmentTotalCents !== input.newMoneyCents) {
    throw new RangeError("investmentAmountsCents must sum to newMoneyCents");
  }
  const poolTopUpShares = input.poolTopUpShares ?? 0n;
  if (poolTopUpShares < 0n) throw new RangeError("poolTopUpShares must not be negative");

  const seen = new Set<string>();
  const pricingConvertibles: RoundPricingConvertible[] = [];
  const amountsById = new Map<string, bigint>();
  for (const convertible of input.convertibles) {
    if (seen.has(convertible.id))
      throw new RangeError(`duplicate convertible id: ${convertible.id}`);
    seen.add(convertible.id);
    const amountCents =
      convertible.kind === "safe"
        ? convertible.principalCents
        : convertible.principalCents +
          accruedInterestCents({
            principalCents: convertible.principalCents,
            ratePercent: convertible.ratePercent,
            startDate: convertible.startDate,
            asOf: input.asOf,
            interestType: convertible.interestType,
            dayCount: convertible.dayCount,
            compounding: convertible.compounding,
          });
    amountsById.set(convertible.id, amountCents);
    pricingConvertibles.push({
      id: convertible.id,
      amountCents,
      valuationCapCents: convertible.valuationCapCents,
      capType: requireCapType(convertible),
      discountPercent: convertible.discountPercent,
    });
  }
  const priced = priceRoundKernel({
    preMoneyValuationCents: input.preMoneyValuationCents,
    baseShares: input.preRoundFullyDilutedShares,
    poolTopUpShares,
    investmentAmountsCents,
    convertibles: pricingConvertibles,
  });
  const convertibles: PricedRoundConvertibleResult[] = priced.convertibles.map((conversion) => ({
    id: conversion.id,
    shares: conversion.shares,
    conversionPrice: formatFixed(conversion.pricePerShare),
    method: conversion.method,
    amountConvertedCents: amountsById.get(conversion.id)!,
  }));
  const newMoneyShares = priced.totalNewMoneyShares;
  const totalConvertedShares = priced.totalConvertedShares;
  const postRoundFullyDilutedShares =
    input.preRoundFullyDilutedShares + poolTopUpShares + newMoneyShares + totalConvertedShares;

  return {
    pricePerShare: formatFixed(priced.pricePerShare),
    newMoneyShares,
    convertibles,
    postRoundFullyDilutedShares,
    totalConvertedShares,
  };
}
