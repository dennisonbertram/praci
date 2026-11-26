// Convertible debt: accrued interest (simple or compound, three day-count conventions) and the
// conversion of a SAFE or a note into shares at the lowest of the cap price, the discount price and
// the round price. Amounts are BigInt cents and prices are fixed-point dollars per share.

import { addMonthsClamped, days360, daysBetween } from "./dates.js";
import type { Fixed } from "./fixed.js";
import { divRoundHalfUp, SCALE } from "./fixed.js";
import { priceConvertible, rational } from "./round-pricing.js";

export type InterestType = "simple" | "compound";
export type DayCount = "actual_365" | "actual_360" | "30_360";
export type Compounding = "annually" | "monthly";
export type CapType = "pre_money" | "post_money";
export type ConversionMethod = "cap" | "discount" | "round";

export type AccruedInterestInput = {
  principalCents: bigint;
  ratePercent: Fixed;
  startDate: string;
  asOf: string;
  interestType: InterestType;
  dayCount: DayCount;
  compounding?: Compounding;
};

function daysFor(startDate: string, asOf: string, dayCount: DayCount): number {
  return dayCount === "30_360" ? days360(startDate, asOf) : daysBetween(startDate, asOf);
}

function dayCountBasis(dayCount: DayCount): bigint {
  return dayCount === "actual_365" ? 365n : 360n;
}

/**
 * Interest accrued from `startDate` to `asOf`, in cents, rounded half-up. Zero when the as-of date
 * is not after the start date, or there is no principal or rate.
 */
export function accruedInterestCents(input: AccruedInterestInput): bigint {
  if (input.asOf <= input.startDate) return 0n;
  if (input.principalCents <= 0n || input.ratePercent <= 0n) return 0n;
  const days = daysFor(input.startDate, input.asOf, input.dayCount);
  if (days <= 0) return 0n;
  const basis = dayCountBasis(input.dayCount);

  if (input.interestType === "simple") {
    return divRoundHalfUp(
      input.principalCents * input.ratePercent * BigInt(days),
      SCALE * 100n * basis,
    );
  }

  // Compound interest uses calendar periods: one month (monthly) or twelve months (annually),
  // counted from the start date with month ends clamped (Jan 31 -> Feb 28 -> Mar 31). Whole
  // periods use the per-period rate exactly; a final partial period accrues the fraction of its
  // days elapsed, counted with the note's day-count convention. Everything is BigInt arithmetic.

  const periodMonths = input.compounding === "monthly" ? 1 : 12;
  const periodsPerYear = BigInt(12 / periodMonths);
  const periodScale = 100n * SCALE * periodsPerYear;
  const dateAt = (period: number) => addMonthsClamped(input.startDate, period * periodMonths);
  const [startYear = 0, startMonth = 0] = input.startDate.split("-").map(Number);
  const [asOfYear = 0, asOfMonth = 0] = input.asOf.split("-").map(Number);
  let wholePeriods = Math.floor(
    ((asOfYear - startYear) * 12 + (asOfMonth - startMonth)) / periodMonths,
  );
  while (wholePeriods > 0 && dateAt(wholePeriods) > input.asOf) wholePeriods -= 1;
  while (dateAt(wholePeriods + 1) <= input.asOf) wholePeriods += 1;

  let amountCents = input.principalCents;
  for (let period = 0; period < wholePeriods; period += 1) {
    amountCents = divRoundHalfUp(amountCents * (periodScale + input.ratePercent), periodScale);
  }
  const lastDate = dateAt(wholePeriods);
  if (lastDate < input.asOf) {
    const elapsed = daysFor(lastDate, input.asOf, input.dayCount);
    const periodLength = daysFor(lastDate, dateAt(wholePeriods + 1), input.dayCount);
    amountCents += divRoundHalfUp(
      amountCents * input.ratePercent * BigInt(elapsed),
      periodScale * BigInt(periodLength),
    );
  }
  return amountCents - input.principalCents;
}

export type ConvertSafeInput = {
  amountCents: bigint;
  valuationCapCents?: bigint | null;
  capType: CapType;
  discountPercent?: Fixed | null;
  roundPricePerShare: Fixed;
  companyCapitalization: bigint;
};

export type ConversionResult = {
  pricePerShare: Fixed;
  shares: bigint;
  method: ConversionMethod;
};

/**
 * Converts a SAFE. The price is the lowest of the valuation cap price, the discount price and the
 * round price; shares are the amount divided by that price, floored.
 *
 * The cap price is `valuationCap / companyCapitalization`, and the caller supplies the
 * capitalization the cap type requires: the pre-money capitalization for a `pre_money` cap, the
 * post-money capitalization for a `post_money` cap. This function does not derive it, and it skips
 * a cap with no capitalization rather than guessing.
 */
export function convertSafe(input: ConvertSafeInput): ConversionResult {
  const base = rational(input.companyCapitalization);
  const conversion = priceConvertible({
    amountCents: input.amountCents,
    valuationCapCents: input.valuationCapCents,
    capType: input.capType,
    discountPercent: input.discountPercent,
    roundPrice: rational(input.roundPricePerShare, SCALE),
    preMoneyCapBase: base,
    postMoneyCapBase: base,
  });
  return {
    pricePerShare: conversion.pricePerShare,
    shares: conversion.shares,
    method: conversion.method,
  };
}

export type ConvertNoteInput = Omit<ConvertSafeInput, "amountCents"> & {
  principalCents: bigint;
  ratePercent: Fixed;
  startDate: string;
  conversionDate: string;
  interestType: InterestType;
  dayCount: DayCount;
  compounding?: Compounding;
};

export type ConvertNoteResult = ConversionResult & {
  amountCents: bigint;
  interestCents: bigint;
};

/** Converts a note, whose amount is the principal plus interest accrued to the conversion date. */
export function convertNote(input: ConvertNoteInput): ConvertNoteResult {
  const interestCents = accruedInterestCents({
    principalCents: input.principalCents,
    ratePercent: input.ratePercent,
    startDate: input.startDate,
    asOf: input.conversionDate,
    interestType: input.interestType,
    dayCount: input.dayCount,
    compounding: input.compounding,
  });
  const amountCents = input.principalCents + interestCents;
  const conversion = convertSafe({
    amountCents,
    valuationCapCents: input.valuationCapCents,
    capType: input.capType,
    discountPercent: input.discountPercent,
    roundPricePerShare: input.roundPricePerShare,
    companyCapitalization: input.companyCapitalization,
  });
  return { ...conversion, amountCents, interestCents };
}
