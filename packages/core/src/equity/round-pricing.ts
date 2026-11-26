import type { ConversionMethod } from "./convertibles.js";
import { divRoundHalfUp, SCALE } from "./fixed.js";

export type Rational = { numerator: bigint; denominator: bigint };

export type ConvertiblePricingInput = {
  amountCents: bigint;
  valuationCapCents?: bigint | null;
  capType: "pre_money" | "post_money";
  discountPercent?: bigint | null;
  roundPrice: Rational;
  preMoneyCapBase: Rational;
  postMoneyCapBase: Rational;
};

export type ConvertiblePricing = {
  method: ConversionMethod;
  price: Rational;
  pricePerShare: bigint;
  exactShares: Rational;
  shares: bigint;
};

function abs(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function gcd(left: bigint, right: bigint): bigint {
  let a = abs(left);
  let b = abs(right);
  while (b !== 0n) [a, b] = [b, a % b];
  return a || 1n;
}

export function rational(numerator: bigint, denominator = 1n): Rational {
  if (denominator === 0n) throw new RangeError("rational denominator must not be zero");
  const sign = denominator < 0n ? -1n : 1n;
  const divisor = gcd(numerator, denominator);
  return {
    numerator: (numerator / divisor) * sign,
    denominator: abs(denominator) / divisor,
  };
}

export function addRational(left: Rational, right: Rational): Rational {
  return rational(
    left.numerator * right.denominator + right.numerator * left.denominator,
    left.denominator * right.denominator,
  );
}

export function subtractRational(left: Rational, right: Rational): Rational {
  return rational(
    left.numerator * right.denominator - right.numerator * left.denominator,
    left.denominator * right.denominator,
  );
}

export function multiplyRational(left: Rational, right: Rational): Rational {
  return rational(left.numerator * right.numerator, left.denominator * right.denominator);
}

export function divideRational(left: Rational, right: Rational): Rational {
  if (right.numerator === 0n) throw new RangeError("division by zero");
  return rational(left.numerator * right.denominator, left.denominator * right.numerator);
}

export function compareRational(left: Rational, right: Rational): number {
  const difference = left.numerator * right.denominator - right.numerator * left.denominator;
  return difference < 0n ? -1 : difference > 0n ? 1 : 0;
}

export function floorRational(value: Rational): bigint {
  if (value.numerator < 0n) throw new RangeError("cannot floor a negative share count");
  return value.numerator / value.denominator;
}

export function fixedFromRational(value: Rational): bigint {
  return divRoundHalfUp(value.numerator * SCALE, value.denominator);
}

export function priceConvertible(input: ConvertiblePricingInput): ConvertiblePricing {
  if (input.amountCents < 0n) throw new RangeError("amountCents must not be negative");
  if (input.roundPrice.numerator <= 0n) throw new RangeError("round price must be positive");

  const discountPercent = input.discountPercent ?? null;
  if (discountPercent != null && (discountPercent < 0n || discountPercent >= 100n * SCALE)) {
    throw new RangeError("discountPercent must be in [0, 100)");
  }

  const candidates: { method: ConversionMethod; price: Rational }[] = [];
  const capCents = input.valuationCapCents ?? null;
  if (capCents != null && capCents <= 0n)
    throw new RangeError("valuationCapCents must be positive");
  const capBase = input.capType === "post_money" ? input.postMoneyCapBase : input.preMoneyCapBase;
  if (capCents != null && capBase.numerator > 0n) {
    candidates.push({
      method: "cap",
      price: rational(capCents * capBase.denominator, 100n * capBase.numerator),
    });
  }
  if (discountPercent != null && discountPercent > 0n) {
    candidates.push({
      method: "discount",
      price: multiplyRational(
        input.roundPrice,
        rational(100n * SCALE - discountPercent, 100n * SCALE),
      ),
    });
  }
  candidates.push({ method: "round", price: input.roundPrice });

  let best = candidates[0]!;
  for (const candidate of candidates.slice(1)) {
    if (compareRational(candidate.price, best.price) < 0) best = candidate;
  }
  if (best.price.numerator <= 0n) throw new RangeError("conversion price must be positive");

  const exactShares = rational(
    input.amountCents * best.price.denominator,
    100n * best.price.numerator,
  );
  const pricePerShare = fixedFromRational(best.price);
  if (pricePerShare <= 0n) throw new RangeError("conversion price rounds down to zero");
  return {
    method: best.method,
    price: best.price,
    pricePerShare,
    exactShares,
    shares: floorRational(exactShares),
  };
}
