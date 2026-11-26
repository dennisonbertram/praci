import * as z from "zod";
import { Id, IsoDate } from "../ids.js";
import { EquityRecordBaseSchema, EquityText, equityListInput, equityPage } from "./common.js";

/** Cap table access levels, most to least. `none` is no cap table access. */
export const EQUITY_ACCESS_LEVELS = [
  "full_detail",
  "advanced",
  "basic",
  "restricted",
  "none",
] as const;
export const EquityAccessLevelSchema = z.enum(EQUITY_ACCESS_LEVELS);
export type EquityAccessLevel = z.infer<typeof EquityAccessLevelSchema>;
export const EQUITY_ACCESS_LEVEL_LABELS: Record<EquityAccessLevel, string> = {
  full_detail: "Full detail",
  advanced: "Advanced",
  basic: "Basic",
  restricted: "Restricted",
  none: "No access",
};

export const EQUITY_ACCESS_GROUPS = [
  "founders",
  "investors",
  "employees",
  "former_employees",
  "other",
] as const;
export const EquityAccessGroupKeySchema = z.enum(EQUITY_ACCESS_GROUPS);
export type EquityAccessGroupKey = z.infer<typeof EquityAccessGroupKeySchema>;

export const EquityAccessGroupSchema = z.object({
  key: EquityAccessGroupKeySchema,
  level: EquityAccessLevelSchema,
  memberCount: z.number().int().nonnegative(),
  updatedAt: IsoDate.nullable(),
});
export type EquityAccessGroup = z.infer<typeof EquityAccessGroupSchema>;
export const EquityAccessGroupSetInputSchema = z.object({
  key: EquityAccessGroupKeySchema,
  level: EquityAccessLevelSchema,
});

export const EquityAccessGrantSchema = EquityRecordBaseSchema.extend({
  stakeholderId: Id,
  stakeholderName: z.string(),
  /** Null uses the group level. */
  level: EquityAccessLevelSchema.nullable(),
  requestedLevel: EquityAccessLevelSchema.nullable(),
  requestedAt: IsoDate.nullable(),
});
export type EquityAccessGrant = z.infer<typeof EquityAccessGrantSchema>;
/** Sets (or clears, with null) one stakeholder's override. */
export const EquityAccessGrantSetInputSchema = z.object({
  stakeholderId: Id,
  level: EquityAccessLevelSchema.nullable(),
});
export const EquityAccessGrantListInputSchema = equityListInput(["stakeholderName", "updatedAt"], {
  /** Only rows with an open request. */
  requested: z.boolean().optional(),
});
export const EquityAccessGrantPageSchema = equityPage(EquityAccessGrantSchema);

/** The tabs a view can be saved on. */
export const EQUITY_VIEW_PAGES = [
  "stakeholders",
  "securities",
  "share-classes",
  "plans",
  "rounds",
  "activity",
  "overview",
] as const;
export const EquityViewPageSchema = z.enum(EQUITY_VIEW_PAGES);
export const EquitySavedViewSchema = EquityRecordBaseSchema.extend({
  page: EquityViewPageSchema,
  name: EquityText,
  /** The list's query string, e.g. "relationship=employee&sort=name". */
  params: z.string().max(4000),
});
export type EquitySavedView = z.infer<typeof EquitySavedViewSchema>;
export const EquitySavedViewCreateInputSchema = z.object({
  page: EquityViewPageSchema,
  name: EquityText,
  params: z.string().max(4000),
});
export const EquitySavedViewUpdateInputSchema = z.object({
  id: Id,
  name: EquityText.optional(),
  params: z.string().max(4000).optional(),
});
export const EquitySavedViewListInputSchema = equityListInput(["name", "updatedAt"], {
  page: EquityViewPageSchema.optional(),
});
export const EquitySavedViewPageSchema = equityPage(EquitySavedViewSchema);

export const EQUITY_HEALTH_TAGS = [
  "share_classes",
  "company",
  "securities",
  "documents",
  "stakeholder",
] as const;
export const EquityHealthTagSchema = z.enum(EQUITY_HEALTH_TAGS);
export const EQUITY_HEALTH_SEVERITIES = ["required", "recommended"] as const;
export const EquityHealthSeveritySchema = z.enum(EQUITY_HEALTH_SEVERITIES);
export const EQUITY_HEALTH_STATUSES = ["open", "dismissed", "resolved"] as const;
export const EquityHealthStatusSchema = z.enum(EQUITY_HEALTH_STATUSES);

export const EquityHealthFindingSchema = z.object({
  id: Id,
  check: z.string(),
  tag: EquityHealthTagSchema,
  severity: EquityHealthSeveritySchema,
  status: EquityHealthStatusSchema,
  fingerprint: z.string(),
  rows: z.array(z.record(z.string(), z.unknown())),
  detectedAt: IsoDate,
  dismissedAt: IsoDate.nullable(),
  updatedAt: IsoDate,
});
export type EquityHealthFinding = z.infer<typeof EquityHealthFindingSchema>;
/** Records a check result; the same check and fingerprint updates the open finding. */
export const EquityHealthFindingCreateInputSchema = z.object({
  check: z.string().trim().min(1).max(100),
  tag: EquityHealthTagSchema,
  severity: EquityHealthSeveritySchema,
  fingerprint: z.string().trim().min(1).max(500),
  rows: z.array(z.record(z.string(), z.unknown())).max(1000).optional(),
});
export const EquityHealthFindingUpdateInputSchema = z.object({
  id: Id,
  status: EquityHealthStatusSchema,
});
export const EquityHealthFindingListInputSchema = equityListInput(["detectedAt", "check"], {
  status: z.array(EquityHealthStatusSchema).optional(),
  severity: EquityHealthSeveritySchema.optional(),
  tag: EquityHealthTagSchema.optional(),
});
export const EquityHealthFindingPageSchema = equityPage(EquityHealthFindingSchema);
