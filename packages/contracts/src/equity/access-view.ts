import * as z from "zod";
import { Id } from "../ids.js";
import { EquityAccessLevelSchema } from "./access.js";
import { EquityCents, EquityDate, EquityShares } from "./common.js";

/**
 * What one holder may see of the cap table at an access level. Each level adds to the one below:
 * restricted is the holder's own holdings, basic adds share class terms, the summary cap table and
 * fundraising history, advanced adds detailed holdings of preferred holders, full detail of every
 * holder. A key the level does not include is absent, never null.
 */
export const EQUITY_ACCESS_VIEW_KEYS = {
  none: [],
  restricted: ["personal", "fairMarketValue"],
  basic: ["personal", "fairMarketValue", "shareClasses", "summary", "fundraising"],
  advanced: ["personal", "fairMarketValue", "shareClasses", "summary", "fundraising", "holders"],
  full_detail: ["personal", "fairMarketValue", "shareClasses", "summary", "fundraising", "holders"],
} as const;

export const EquityAccessHoldingSchema = z
  .object({
    kind: z.enum(["certificate", "option", "warrant", "convertible"]),
    label: z.string(),
    shareClassName: z.string().nullable(),
    /** Shares for certificates, options and warrants; null for a convertible. */
    quantity: EquityShares.nullable(),
    /** Principal for a convertible; null otherwise. */
    principalCents: EquityCents.nullable(),
    issueDate: EquityDate,
  })
  .strict();
export type EquityAccessHolding = z.infer<typeof EquityAccessHoldingSchema>;

export const EquityAccessHolderViewSchema = z
  .object({ stakeholderId: Id, name: z.string(), holdings: z.array(EquityAccessHoldingSchema) })
  .strict();

export const EquityAccessViewSchema = z
  .object({
    level: EquityAccessLevelSchema,
    personal: EquityAccessHolderViewSchema.optional(),
    /** The latest common price per share on record, or null when there is none. */
    fairMarketValue: z
      .object({ pricePerShare: z.string(), effectiveDate: EquityDate })
      .strict()
      .nullable()
      .optional(),
    shareClasses: z
      .array(
        z
          .object({
            name: z.string(),
            prefix: z.string(),
            classType: z.enum(["common", "preferred"]),
            originalIssuePrice: z.string().nullable(),
            conversionRatio: z.string(),
            liquidationMultiple: z.string(),
            participating: z.boolean(),
            seniority: z.number().int(),
          })
          .strict(),
      )
      .optional(),
    summary: z
      .object({
        outstandingShares: EquityShares,
        fullyDilutedShares: EquityShares,
        classes: z.array(
          z
            .object({
              name: z.string(),
              outstandingShares: EquityShares,
              fullyDilutedShares: EquityShares,
              fullyDilutedPercent: z.string(),
            })
            .strict(),
        ),
      })
      .strict()
      .optional(),
    fundraising: z
      .array(
        z
          .object({
            name: z.string(),
            closingDate: EquityDate.nullable(),
            originalIssuePrice: z.string().nullable(),
            preMoneyValuationCents: EquityCents.nullable(),
          })
          .strict(),
      )
      .optional(),
    holders: z.array(EquityAccessHolderViewSchema).optional(),
    /**
     * The holder's shares at the company's estimated price per share, when the company shows
     * holders an estimated value and has set a price.
     */
    estimatedValue: z
      .object({ pricePerShare: z.string(), effectiveDate: EquityDate, valueCents: EquityCents })
      .strict()
      .optional(),
    /** The holder's own open request for a higher level; only on their own view, only when open. */
    requestedLevel: EquityAccessLevelSchema.optional(),
  })
  .strict();
export type EquityAccessView = z.infer<typeof EquityAccessViewSchema>;

/** The admin preview: one holder's view, at their own level or one chosen to try. */
export const EquityAccessViewInputSchema = z.object({
  stakeholderId: Id,
  level: EquityAccessLevelSchema.optional(),
});

/** What a holder may propose about themself from the portal; the company reviews it. */
export const EquityPortalProfileProposalSchema = z
  .object({
    firstName: z.string().trim().min(1).max(200).optional(),
    lastName: z.string().trim().min(1).max(200).optional(),
    contactEmail: z.string().trim().toLowerCase().email().max(320).optional(),
    address: z
      .object({
        country: z.string().trim().max(100).nullable().default(null),
        street: z.string().trim().max(300).nullable().default(null),
        city: z.string().trim().max(100).nullable().default(null),
        state: z.string().trim().max(100).nullable().default(null),
        postalCode: z.string().trim().max(30).nullable().default(null),
      })
      .optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Change at least one field");
