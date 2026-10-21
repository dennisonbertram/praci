import * as z from "zod";
import { CompanyDateSchema, CompanyStreamSchema } from "./company.js";
import { CompanyFactRefSchema } from "./company-page.js";

export const CompanyCalendarInputSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  anniversaries: z.boolean().default(false),
});
export const CompanyCalendarItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  date: CompanyDateSchema,
  stream: CompanyStreamSchema,
  status: z.string(),
  anniversary: z.boolean(),
  fact: CompanyFactRefSchema.nullable(),
  legalDeadlineId: z.string().nullable(),
});
export const CompanyCalendarSchema = z.array(CompanyCalendarItemSchema);
export type CompanyCalendarItem = z.infer<typeof CompanyCalendarItemSchema>;
