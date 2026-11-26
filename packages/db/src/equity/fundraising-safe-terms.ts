import type { EquityAppSafe } from "@rakazo/contracts";
import { Prisma } from "../client.js";
import { EquityInputError, fromBig, fromBigOrNull, fromDateOrNull } from "./ledger.js";

type SafeTermsSource = Pick<
  Prisma.SafeGetPayload<object>,
  | "amountCents"
  | "valuationType"
  | "capCents"
  | "discountPercent"
  | "mfn"
  | "proRata"
  | "investmentDate"
>;

export type FundraisingSafeConvertibleTerms = Pick<
  EquityAppSafe,
  | "principalCents"
  | "valuationCapCents"
  | "valuationCapType"
  | "discountPercent"
  | "mfn"
  | "proRata"
  | "issueDate"
>;

const discountPercent = (value: number | null): string | null => {
  if (value === null) return null;
  if (!Number.isFinite(value))
    throw new EquityInputError("SAFE discount must be between 0 and 100 percent");
  const decimal = new Prisma.Decimal(value);
  if (decimal.lessThan(0) || decimal.greaterThanOrEqualTo(100))
    throw new EquityInputError("SAFE discount must be between 0 and 100 percent");
  if (decimal.decimalPlaces() > 10)
    throw new EquityInputError("SAFE discount cannot exceed 10 decimal places");
  return decimal.toFixed(10);
};

export function mapFundraisingSafeTerms(safe: SafeTermsSource): FundraisingSafeConvertibleTerms {
  if (safe.amountCents <= 0n) throw new EquityInputError("SAFE principal must be positive");

  let valuationCapType: FundraisingSafeConvertibleTerms["valuationCapType"];
  switch (safe.valuationType) {
    case "pre_money_cap":
      if (safe.capCents === null || safe.capCents <= 0n)
        throw new EquityInputError("A pre-money SAFE must have a positive valuation cap");
      valuationCapType = "pre_money";
      break;
    case "post_money_cap":
      if (safe.capCents === null || safe.capCents <= 0n)
        throw new EquityInputError("A post-money SAFE must have a positive valuation cap");
      valuationCapType = "post_money";
      break;
    case "no_valuation":
      if (safe.capCents !== null)
        throw new EquityInputError("A SAFE without a valuation cannot have a cap");
      valuationCapType = null;
      break;
    default:
      throw new EquityInputError("SAFE valuation type is unsupported");
  }

  return {
    principalCents: fromBig(safe.amountCents),
    valuationCapCents: fromBigOrNull(safe.capCents),
    valuationCapType,
    discountPercent: discountPercent(safe.discountPercent),
    mfn: safe.mfn,
    proRata: safe.proRata,
    issueDate: fromDateOrNull(safe.investmentDate),
  };
}
