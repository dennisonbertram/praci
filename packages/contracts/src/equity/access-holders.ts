import * as z from "zod";
import { Id, IsoDate } from "../ids.js";
import { EquityAccessGroupKeySchema, EquityAccessLevelSchema } from "./access.js";
import { equityListInput, equityPage } from "./common.js";

/** One row of the investor relations list: who holds what, and what they can see. */
export const EquityAccessHolderSchema = z.object({
  stakeholderId: Id,
  name: z.string(),
  relationship: z.string().nullable(),
  group: EquityAccessGroupKeySchema,
  email: z.string().nullable(),
  /** The linked investor contact, through which documents and the portal reach the holder. */
  contactId: Id.nullable(),
  majorInvestor: z.boolean(),
  /** Share of outstanding shares, percent with 4 decimals. */
  ownershipPercent: z.string(),
  /** The prefix of each share class held, e.g. CS, PA. */
  classCodes: z.array(z.string()),
  groupLevel: EquityAccessLevelSchema,
  overrideLevel: EquityAccessLevelSchema.nullable(),
  /** What the holder sees now: none once nothing is outstanding. */
  effectiveLevel: EquityAccessLevelSchema,
  requestedLevel: EquityAccessLevelSchema.nullable(),
  requestedAt: IsoDate.nullable(),
  /** The last time the holder opened the investor portal. */
  lastSeenAt: IsoDate.nullable(),
});
export type EquityAccessHolder = z.infer<typeof EquityAccessHolderSchema>;

export const EquityAccessHolderListInputSchema = equityListInput(
  ["name", "ownership", "effectiveLevel", "lastSeenAt"],
  {
    level: z.array(EquityAccessLevelSchema).optional(),
    group: z.array(EquityAccessGroupKeySchema).optional(),
    requested: z.boolean().optional(),
    shareClassId: Id.optional(),
  },
);
export const EquityAccessHolderPageSchema = equityPage(EquityAccessHolderSchema);

/** Sets (or clears, with null) the override of many stakeholders at once. */
export const EquityAccessLevelBulkSetInputSchema = z.object({
  stakeholderIds: z
    .array(Id)
    .min(1)
    .max(500)
    .refine((ids) => new Set(ids).size === ids.length, "each stakeholder once"),
  level: EquityAccessLevelSchema.nullable(),
});

export const EquityAccessRequestResolveInputSchema = z.object({
  stakeholderId: Id,
  /** The level the owner reviewed; the resolve fails if the holder has since asked for another. */
  requestedLevel: EquityAccessLevelSchema,
  approve: z.boolean(),
});

/** A holder asks for more than they have. */
export const EquityAccessRequestInputSchema = z.object({
  stakeholderId: Id,
  level: EquityAccessLevelSchema,
});

/** Links a holder to the investor contact the portal and documents reach them through. */
export const EquityAccessContactLinkInputSchema = z.object({
  stakeholderId: Id,
  /** Null removes the link. */
  contactId: Id.nullable(),
});
